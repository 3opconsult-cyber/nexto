// Serveur uniquement. Pare-feu des commissions (décision Romain 30/10) : que se passe-t-il si un
// prestataire révoque son mandat de prélèvement SEPA, si un prélèvement de commission est rejeté
// (compte vide), ou si un client fait opposition sur sa carte après versement ?
//
//   1. PING est prévenu : chaque incident crée une alerte (table payment_alerts, /admin/paiements).
//   2. La commission due devient une dette (commission_debts, statut « open »).
//   3. Les dettes ouvertes sont COMPENSÉES sur le prochain versement au prestataire, avant tout virement.
//   4. Au-delà du plafond d'impayés (app_settings.unpaid_ceiling_cents, 50 € par défaut), le compte est
//      suspendu : invisible sur la carte, aucun versement tant que l'admin n'a pas levé la suspension.
//      Un mandat révoqué alors qu'une dette est ouverte suspend aussi tout de suite.
// Le prestataire ne peut lever ni sa suspension ni changer l'état de son mandat (trigger 019).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export const DEFAULT_UNPAID_CEILING_CENTS = 5000

export type IncidentKind = 'mandate_revoked' | 'mandate_failed' | 'mandate_active' | 'debit_rejected' | 'chargeback'

export async function unpaidCeiling(db: SupabaseClient = createAdminClient()) {
  const { data } = await db.from('app_settings').select('value').eq('key', 'unpaid_ceiling_cents').maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_UNPAID_CEILING_CENTS
}

export async function openDebtCents(db: SupabaseClient, providerId: string) {
  const { data } = await db.from('commission_debts').select('amount_cents').eq('provider_id', providerId).eq('status', 'open')
  return (data ?? []).reduce((s, d) => s + d.amount_cents, 0)
}

export async function isSuspended(db: SupabaseClient, providerId: string) {
  const { data } = await db.from('provider_profiles').select('payments_suspended_at').eq('id', providerId).maybeSingle()
  return !!data?.payments_suspended_at
}

async function alert(db: SupabaseClient, providerId: string | null, kind: string, detail: Record<string, unknown>) {
  await db.from('payment_alerts').insert({ provider_id: providerId, kind, detail })
}

// Suspend le compte : retiré de la carte, plus aucun versement. Le motif est visible du prestataire
// (bandeau sur « Mon entreprise » et « Mes versements »), jamais sur sa fiche publique.
export async function suspendProvider(providerId: string, reason: string, db: SupabaseClient = createAdminClient()) {
  if (await isSuspended(db, providerId)) return { deja: true }
  await db.from('provider_profiles').update({ is_active: false, payments_suspended_at: new Date().toISOString() }).eq('id', providerId)
  await db.from('provider_private').upsert({ id: providerId, suspension_reason: reason, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  await alert(db, providerId, 'suspended', { reason, openDebtCents: await openDebtCents(db, providerId) })
  return { suspendu: true }
}

// Levée par l'admin uniquement. Le prestataire se remet lui-même « disponible » ensuite.
export async function unsuspendProvider(providerId: string, adminId: string, db: SupabaseClient = createAdminClient()) {
  await db.from('provider_profiles').update({ payments_suspended_at: null }).eq('id', providerId)
  await db.from('provider_private').upsert({ id: providerId, suspension_reason: null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  await alert(db, providerId, 'unsuspended', { by: adminId })
  return { leve: true }
}

// Incident remonté par un webhook du prestataire de paiement (déjà relu chez lui, jamais cru sur parole).
export async function recordIncident(input: { providerId: string; kind: IncidentKind; transactionId?: string | null; amountCents?: number; ref?: string; psp: string }) {
  const db = createAdminClient()
  const { providerId, kind } = input
  if (kind === 'mandate_active') {
    await db.from('provider_profiles').update({ sepa_mandate_status: 'active' }).eq('id', providerId)
    return { etat: 'mandat_actif' }
  }
  if (kind === 'mandate_revoked' || kind === 'mandate_failed') {
    await db.from('provider_profiles').update({ sepa_mandate_status: kind === 'mandate_revoked' ? 'revoked' : 'failed' }).eq('id', providerId)
  }
  if ((kind === 'debit_rejected' || kind === 'chargeback') && input.amountCents && input.amountCents > 0) {
    await db.from('commission_debts').insert({
      provider_id: providerId, transaction_id: input.transactionId ?? null, amount_cents: input.amountCents,
      reason: kind === 'debit_rejected' ? 'Prélèvement de commission rejeté' : 'Opposition du client après versement',
    })
  }
  await alert(db, providerId, kind, { psp: input.psp, ref: input.ref ?? null, transactionId: input.transactionId ?? null, amountCents: input.amountCents ?? null })

  const owed = await openDebtCents(db, providerId)
  const ceiling = await unpaidCeiling(db)
  if (owed > ceiling) {
    await suspendProvider(providerId, `Commissions impayées : ${(owed / 100).toFixed(2).replace('.', ',')} € (plafond ${(ceiling / 100).toFixed(2).replace('.', ',')} €).`, db)
  } else if (kind === 'mandate_revoked' && owed > 0) {
    await suspendProvider(providerId, 'Mandat de prélèvement révoqué alors qu’une commission reste due.', db)
  }
  return { etat: 'enregistre', detteCents: owed }
}

// Compensation : avant tout versement, les commissions impayées sont retenues sur la part du
// prestataire (les plus anciennes d'abord). Renvoie le versement net et le plan à appliquer une fois
// le virement réellement passé (jamais avant : un virement refusé ne doit rien solder).
export async function planNetting(db: SupabaseClient, providerId: string, payoutCents: number) {
  const { data } = await db.from('commission_debts').select('id, amount_cents').eq('provider_id', providerId).eq('status', 'open').order('created_at')
  let left = payoutCents
  const plan: Array<{ id: string; take: number; whole: boolean; amount: number }> = []
  for (const d of data ?? []) {
    if (left <= 0) break
    const take = Math.min(d.amount_cents, left)
    plan.push({ id: d.id, take, whole: take === d.amount_cents, amount: d.amount_cents })
    left -= take
  }
  return { netPayoutCents: left, recoveredCents: payoutCents - left, plan }
}

export async function applyNetting(db: SupabaseClient, providerId: string, transactionId: string, plan: Array<{ id: string; take: number; whole: boolean; amount: number }>) {
  const now = new Date().toISOString()
  for (const p of plan) {
    if (p.whole) {
      await db.from('commission_debts').update({ status: 'recovered', recovered_at: now }).eq('id', p.id).eq('status', 'open')
    } else {
      // Dette partiellement soldée : le reste reste ouvert, la part retenue est tracée à part.
      await db.from('commission_debts').update({ amount_cents: p.amount - p.take }).eq('id', p.id).eq('status', 'open')
      await db.from('commission_debts').insert({ provider_id: providerId, transaction_id: transactionId, amount_cents: p.take, reason: 'Retenue sur versement', status: 'recovered', recovered_at: now })
    }
  }
}

// Vue admin : alertes non traitées et prestataires suspendus.
export async function firewallOverview() {
  const db = createAdminClient()
  const [{ data: alerts }, { data: suspended }, { data: debts }] = await Promise.all([
    db.from('payment_alerts').select('*').is('handled_at', null).order('created_at', { ascending: false }).limit(100),
    db.from('provider_profiles').select('id, company_name, payments_suspended_at, sepa_mandate_status').not('payments_suspended_at', 'is', null),
    db.from('commission_debts').select('provider_id, amount_cents').eq('status', 'open'),
  ])
  const ids = Array.from(new Set([...(alerts ?? []).map(a => a.provider_id), ...(suspended ?? []).map(s => s.id)].filter(Boolean))) as string[]
  const [{ data: names }, { data: priv }] = await Promise.all([
    ids.length ? db.from('profiles').select('id, full_name').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('provider_private').select('id, suspension_reason').in('id', ids) : Promise.resolve({ data: [] as any[] }),
  ])
  const nameOf = (id: string | null) => (names ?? []).find(n => n.id === id)?.full_name || 'Prestataire'
  const owed = (id: string) => (debts ?? []).filter(d => d.provider_id === id).reduce((s, d) => s + d.amount_cents, 0)
  return {
    plafondCents: await unpaidCeiling(db),
    alertes: (alerts ?? []).map(a => ({ ...a, nom: nameOf(a.provider_id) })),
    suspendus: (suspended ?? []).map(s => ({
      ...s, nom: s.company_name || nameOf(s.id), detteCents: owed(s.id),
      motif: (priv ?? []).find(p => p.id === s.id)?.suspension_reason ?? null,
    })),
  }
}

export async function markAlertHandled(alertId: string) {
  await createAdminClient().from('payment_alerts').update({ handled_at: new Date().toISOString() }).eq('id', alertId)
}
