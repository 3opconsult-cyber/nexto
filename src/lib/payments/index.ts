// Serveur uniquement. Paiement en ligne sous séquestre — orchestration commune aux trois PSP.
//
// État : prêt au branchement, ÉTEINT. S'allume quand, côté Vercel :
//   PAYMENT_PROVIDER = stripe | mangopay | lemonway
//   + les clés du prestataire choisi (voir l'en-tête de stripe.ts / mangopay.ts / lemonway.ts)
//   + SUPABASE_SERVICE_ROLE_KEY (les webhooks et le déblocage automatique n'ont pas de session)
//   + CRON_SECRET (protège le déblocage automatique appelé par le cron Vercel)
// Tant qu'une de ces conditions manque, paymentsProvider() renvoie null et l'app garde le parcours
// actuel (PaymentPendingModal, rien n'est débité).
//
// Invariant : transactions.status (pending → arrived → completed) n'est jamais touché ici ; l'argent
// a son propre statut, transactions.payment_status, posé uniquement par ce module (clé service).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { stripe } from './stripe'
import { mangopay } from './mangopay'
import { lemonway } from './lemonway'
import { applyNetting, isSuspended, planNetting, recordIncident } from './firewall'
import { PaymentError, type AccountRow, type Iban, type Party, type PaymentProvider, type PaymentRow, type ProviderName, type WebhookEvent } from './types'

export { PaymentError } from './types'

export const PROVIDERS: Record<ProviderName, PaymentProvider> = { stripe, mangopay, lemonway }

// Délai entre le scan de fin et le versement au prestataire, pour laisser le client signaler un souci.
export const RELEASE_DELAY_HOURS = Number(process.env.PAYMENT_RELEASE_DELAY_HOURS || 24)

export function paymentsProvider(): PaymentProvider | null {
  const p = PROVIDERS[process.env.PAYMENT_PROVIDER as ProviderName]
  return p && p.configured() && hasServiceRole() ? p : null
}

// Ce qui manque pour allumer chaque prestataire (affiché dans l'admin, jamais les valeurs).
export function readiness() {
  return {
    choisi: (process.env.PAYMENT_PROVIDER as ProviderName) || null,
    actif: paymentsProvider()?.name ?? null,
    cleService: hasServiceRole(),
    cron: !!process.env.CRON_SECRET,
    prestataires: Object.values(PROVIDERS).map(p => ({ nom: p.name, label: p.label, cles: p.configured() })),
  }
}

function need(): PaymentProvider {
  const p = paymentsProvider()
  if (!p) throw new PaymentError("Le paiement en ligne n'est pas encore actif.", 503)
  return p
}

type Tx = {
  id: string; buyer_id: string; seller_id: string; status: string; price_confirmed: boolean | null
  total_charged_cents: number | null; subtotal_cents: number | null; payout_cents: number | null
  completed_at: string | null; en_route_at: string | null; arrived_at: string | null
  payment_status: string; payment_provider: ProviderName | null
}
const TX_COLS = 'id, buyer_id, seller_id, status, price_confirmed, total_charged_cents, subtotal_cents, payout_cents, completed_at, en_route_at, arrived_at, payment_status, payment_provider'

async function loadTx(db: SupabaseClient, id: string): Promise<Tx> {
  const { data, error } = await db.from('transactions').select(TX_COLS).eq('id', id).maybeSingle()
  if (error || !data) throw new PaymentError('Mission introuvable.', 404)
  return data as Tx
}

async function loadAccount(db: SupabaseClient, provider: ProviderName, userId: string, role: 'buyer' | 'seller') {
  const { data } = await db.from('payment_accounts').select('*').eq('provider', provider).eq('user_id', userId).eq('role', role).maybeSingle()
  return (data as AccountRow | null) ?? null
}

async function saveAccount(db: SupabaseClient, provider: ProviderName, userId: string, role: 'buyer' | 'seller', patch: Partial<AccountRow>) {
  const prev = await loadAccount(db, provider, userId, role)
  const row = { ...(prev ?? { status: 'pending' }), ...patch, user_id: userId, provider, role, updated_at: new Date().toISOString() }
  if (!row.external_id) return
  await db.from('payment_accounts').upsert(row, { onConflict: 'user_id,provider,role' })
}

async function partyFor(db: SupabaseClient, userId: string): Promise<Party> {
  const [{ data: prof }, { data: auth }] = await Promise.all([
    db.from('profiles').select('first_name, last_name, full_name').eq('id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ])
  const [f, ...rest] = String(prof?.full_name || '').split(' ')
  return {
    userId,
    email: auth?.user?.email || '',
    firstName: prof?.first_name || f || 'Client',
    lastName: prof?.last_name || rest.join(' ') || 'PING',
  }
}

async function chargesOf(db: SupabaseClient, txId: string) {
  const { data } = await db.from('payments').select('*').eq('transaction_id', txId).order('created_at')
  const rows = (data ?? []) as PaymentRow[]
  const ok = (k: PaymentRow['kind']) => rows.filter(r => r.kind === k && r.status === 'succeeded')
  const charges = ok('charge')
  const paid = charges.reduce((s, r) => s + r.amount_cents, 0) - ok('refund').reduce((s, r) => s + r.amount_cents, 0)
  return { rows, charges, paid }
}

const due = (tx: Tx) => tx.total_charged_cents ?? tx.subtotal_cents ?? 0

async function setPaymentStatus(db: SupabaseClient, txId: string, status: string, provider?: ProviderName) {
  await db.from('transactions').update({ payment_status: status, ...(provider ? { payment_provider: provider } : {}) }).eq('id', txId)
}

// Recalcule le statut de paiement à partir des mouvements réels (jamais de l'URL de retour).
async function recompute(db: SupabaseClient, txId: string) {
  const tx = await loadTx(db, txId)
  if (['released', 'refunded'].includes(tx.payment_status)) return tx.payment_status
  const { rows, paid } = await chargesOf(db, txId)
  const last = rows.filter(r => r.kind === 'charge').at(-1)
  const next = paid > 0 && paid >= due(tx) ? 'held'
    : paid > 0 ? 'complement_due'
    : last?.status === 'failed' ? 'failed'
    : last ? 'awaiting' : 'none'
  if (next !== tx.payment_status) await setPaymentStatus(db, txId, next)
  return next
}

// ---------- prestataire : ouverture du compte de paiement ----------
export async function onboardSeller(userId: string, input: { origin: string; iban?: Iban; birthDate?: string; nationality?: string }) {
  const p = need()
  const db = createAdminClient()
  const { data: pp } = await db.from('provider_profiles').select('id').eq('id', userId).maybeSingle()
  if (!pp) throw new PaymentError('Réservé aux prestataires.', 403)
  const account = await loadAccount(db, p.name, userId, 'seller')
  const seller = { ...(await partyFor(db, userId)), birthDate: input.birthDate, nationality: input.nationality }
  const { patch, redirectUrl } = await p.onboardSeller({ seller, account, iban: input.iban, returnUrl: `${input.origin}/pro/paiements?retour=1` })
  await saveAccount(db, p.name, userId, 'seller', patch)

  // Pièces déjà déposées dans « Mes pièces » : transmises au PSP à la première ouverture.
  const fresh = await loadAccount(db, p.name, userId, 'seller')
  if (fresh && !account && p.submitKycDocument) {
    const { data: docs } = await db.from('documents').select('kind, storage_path').eq('owner_id', userId).in('kind', ['identite', 'kbis'])
    for (const d of docs ?? []) {
      try {
        const { data: file } = await db.storage.from('documents').download(d.storage_path)
        if (file) await p.submitKycDocument(fresh, { kind: d.kind === 'identite' ? 'identity' : 'registration', bytes: new Uint8Array(await file.arrayBuffer()), filename: d.storage_path.split('/').pop() || d.kind })
      } catch (e) {
        await saveAccount(db, p.name, userId, 'seller', { message: `Pièce « ${d.kind} » à redéposer : ${(e as Error).message}` })
      }
    }
  }
  return { redirectUrl, account: await loadAccount(db, p.name, userId, 'seller') }
}

export async function sellerAccount(userId: string, refresh = false) {
  const p = paymentsProvider()
  if (!p) return null
  const db = createAdminClient()
  const account = await loadAccount(db, p.name, userId, 'seller')
  if (account && refresh) {
    try { await saveAccount(db, p.name, userId, 'seller', await p.refreshSeller(account)) } catch { /* dernier état connu */ }
    return loadAccount(db, p.name, userId, 'seller')
  }
  return account
}

// ---------- client : paiement par carte, sous séquestre ----------
export async function startCheckout(userId: string, txId: string, origin: string) {
  const p = need()
  const db = createAdminClient()
  const tx = await loadTx(db, txId)
  if (tx.buyer_id !== userId) throw new PaymentError('Mission introuvable.', 404)
  if (tx.status === 'cancelled') throw new PaymentError('Mission annulée.', 409)
  if (!tx.price_confirmed) throw new PaymentError('Le tarif doit être validé avant le paiement.', 409)
  if (['released', 'refunded'].includes(tx.payment_status)) throw new PaymentError('Cette mission est déjà réglée.', 409)
  if (tx.payment_provider && tx.payment_provider !== p.name) throw new PaymentError('Mission rattachée à un autre prestataire de paiement.', 409)

  const seller = await loadAccount(db, p.name, tx.seller_id, 'seller')
  if (!seller || seller.status !== 'active') throw new PaymentError("Ce prestataire n'a pas encore ouvert son compte de paiement.", 409)

  const { paid } = await chargesOf(db, txId)
  const amount = due(tx) - paid
  if (amount <= 0) { await recompute(db, txId); throw new PaymentError('Rien à régler pour le moment.', 409) }

  const { data: req } = await db.from('transactions').select('requests(category)').eq('id', txId).maybeSingle()
  const cat = (req as any)?.requests?.category as string | undefined
  const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
  const label = `${paid > 0 ? 'Complément — ' : ''}${cat ? TRAD[cat] || cat : 'Prestation'} via PING`

  const buyerAccount = await loadAccount(db, p.name, userId, 'buyer')
  const back = `${origin}/mission/${txId}/qrcodes`
  const r = await p.createCheckout({
    transactionId: txId, amountCents: amount, label, buyer: await partyFor(db, userId), buyerAccount, sellerAccount: seller,
    successUrl: `${back}?paiement=retour`, cancelUrl: `${back}?paiement=annule`,
  })
  if (r.buyerPatch) await saveAccount(db, p.name, userId, 'buyer', r.buyerPatch)
  await db.from('payments').insert({
    transaction_id: txId, provider: p.name, kind: 'charge', external_id: r.externalId, amount_cents: amount,
    status: 'pending', redirect_url: r.redirectUrl, meta: r.meta ?? {},
  })
  if (tx.payment_status !== 'complement_due') await setPaymentStatus(db, txId, 'awaiting', p.name)
  else await setPaymentStatus(db, txId, 'complement_due', p.name)
  return { redirectUrl: r.redirectUrl }
}

// Relit chez le PSP les encaissements encore en attente d'une mission (retour de la page de paiement).
export async function syncTransaction(txId: string) {
  const p = paymentsProvider()
  if (!p) return null
  const db = createAdminClient()
  const { rows } = await chargesOf(db, txId)
  for (const r of rows.filter(r => r.kind === 'charge' && r.status === 'pending' && r.external_id && r.provider === p.name)) {
    await syncCharge(db, p, r)
  }
  return recompute(db, txId)
}

async function syncCharge(db: SupabaseClient, p: PaymentProvider, row: PaymentRow) {
  const c = await p.getCharge(row.external_id!)
  // Antifraude : un encaissement ne compte que s'il correspond exactement au montant demandé.
  const mismatch = c.status === 'succeeded' && c.amountCents !== row.amount_cents
  const status = mismatch ? 'failed' : c.status
  if (status === row.status && !c.meta) return
  const meta = { ...row.meta, ...(c.meta ?? {}), ...(mismatch ? { alerte: `Montant reçu ${c.amountCents} ≠ attendu ${row.amount_cents}` } : {}) }
  await db.from('payments').update({ status, meta, updated_at: new Date().toISOString() }).eq('id', row.id)
}

// ---------- déblocage du séquestre ----------
// Conditions : mission terminée (scan de fin), délai de réclamation écoulé, aucun litige ouvert,
// payé en entier. Si le dépassement horaire n'est pas encore réglé : complement_due, on attend.
export async function settle(txId: string, opts: { force?: boolean } = {}) {
  const p = need()
  const db = createAdminClient()
  const tx = await loadTx(db, txId)
  if (tx.payment_provider && tx.payment_provider !== p.name) return { etat: 'autre_prestataire' }
  if (tx.status === 'cancelled') {
    // Annulation tardive : après remboursement par l'admin, ce qui reste (les frais) va au prestataire,
    // uniquement sur décision admin.
    if (!opts.force) return { etat: 'annulee' }
    const { charges, paid } = await chargesOf(db, txId)
    return paid > 0 ? releaseAmount(db, p, tx, charges, paid, 0) : { etat: 'rien_a_verser' }
  }
  if (!tx.completed_at) return { etat: 'mission_non_terminee' }
  if (!['held', 'complement_due'].includes(tx.payment_status)) return { etat: tx.payment_status }
  if (!opts.force && Date.now() - new Date(tx.completed_at).getTime() < RELEASE_DELAY_HOURS * 3600_000) return { etat: 'delai_reclamation' }
  const { count } = await db.from('disputes').select('id', { count: 'exact', head: true }).eq('transaction_id', txId).eq('status', 'open')
  if (count) return { etat: 'litige_ouvert' }

  let { charges, paid } = await chargesOf(db, txId)
  const total = due(tx)
  if (paid < total) { await setPaymentStatus(db, txId, 'complement_due'); return { etat: 'complement_du', resteCents: total - paid } }
  if (paid > total) {
    // Payé plus que le montant final (mission plus courte) : on rend la différence avant de verser.
    await refundAmount(db, p, txId, charges, paid - total, 'Ajustement au montant final')
    ;({ charges, paid } = await chargesOf(db, txId))
  }
  const payout = Math.max(0, Math.min(tx.payout_cents ?? 0, total))
  return releaseAmount(db, p, tx, charges, payout, total - payout)
}

async function releaseAmount(db: SupabaseClient, p: PaymentProvider, tx: Tx, charges: PaymentRow[], payoutCents: number, keptCents: number) {
  // Pare-feu : aucun versement à un prestataire suspendu (mandat révoqué, impayés au-delà du plafond).
  // L'argent reste bloqué (held) jusqu'à la levée de la suspension par l'admin.
  if (await isSuspended(db, tx.seller_id)) return { etat: 'prestataire_suspendu' }
  // Compensation : les commissions impayées sont retenues sur ce versement et restent à PING.
  const netting = await planNetting(db, tx.seller_id, payoutCents)
  payoutCents = netting.netPayoutCents
  keptCents += netting.recoveredCents
  // Verrou : un seul déblocage par mission, même si le cron et un admin le lancent en même temps.
  const { data: claimed } = await db.from('transactions').update({ payment_status: 'released' })
    .eq('id', tx.id).in('payment_status', ['held', 'complement_due']).select('id')
  if (!claimed?.length) return { etat: 'deja_traite' }
  try {
    const seller = await loadAccount(db, p.name, tx.seller_id, 'seller')
    if (!seller) throw new PaymentError('Compte de paiement du prestataire introuvable.', 409)
    const moves = await p.release({
      transactionId: tx.id, charges, buyerAccount: await loadAccount(db, p.name, tx.buyer_id, 'buyer'),
      sellerAccount: seller, payoutCents, keptCents,
    })
    if (moves.length) await db.from('payments').insert(moves.map(m => ({
      transaction_id: tx.id, provider: p.name, kind: m.kind, external_id: m.externalId,
      amount_cents: m.amountCents, fee_cents: m.feeCents, status: 'succeeded',
    })))
    if (netting.plan.length) await applyNetting(db, tx.seller_id, tx.id, netting.plan)
    return { etat: 'verse', payoutCents, commissionCents: keptCents, retenueImpayesCents: netting.recoveredCents }
  } catch (e) {
    await setPaymentStatus(db, tx.id, 'held')
    throw e
  }
}

async function refundAmount(db: SupabaseClient, p: PaymentProvider, txId: string, charges: PaymentRow[], amount: number, reason: string) {
  const tx = await loadTx(db, txId)
  const buyerAccount = await loadAccount(db, p.name, tx.buyer_id, 'buyer')
  const { rows } = await chargesOf(db, txId)
  let left = amount
  // Du plus récent au plus ancien, sans dépasser ce qui reste remboursable sur chaque encaissement.
  for (const c of [...charges].reverse()) {
    if (left <= 0) break
    const already = rows.filter(r => r.kind === 'refund' && r.status === 'succeeded' && r.meta?.charge_id === c.id).reduce((s, r) => s + r.amount_cents, 0)
    const part = Math.min(left, c.amount_cents - already)
    if (part <= 0) continue
    const r = await p.refund({ charge: c, amountCents: part, reason, buyerAccount })
    await db.from('payments').insert({
      transaction_id: txId, provider: p.name, kind: 'refund', external_id: r.externalId, amount_cents: part,
      status: 'succeeded', meta: { charge_id: c.id, motif: reason },
    })
    left -= part
  }
  return amount - left
}

// Remboursement. Règle antifraude (décision Romain 29/10) : l'argent du séquestre ne sort que sur
// décision de PING. Seule exception automatique : l'annulation AVANT que le prestataire soit en route,
// remboursée en entier au client (aucune somme ne part vers le prestataire). Tout le reste (annulation
// tardive, geste commercial, litige) est décidé par un admin OpConsult.
export async function refund(actor: { userId: string; isAdmin: boolean }, txId: string, input: { amountCents?: number; reason: string }) {
  const p = need()
  const db = createAdminClient()
  const tx = await loadTx(db, txId)
  const isParty = actor.userId === tx.buyer_id || actor.userId === tx.seller_id
  if (!actor.isAdmin && !isParty) throw new PaymentError('Mission introuvable.', 404)
  if (tx.payment_status === 'released') throw new PaymentError('Déjà versé au prestataire : passez par un litige.', 409)
  const { charges, paid } = await chargesOf(db, txId)
  if (paid <= 0) return { rembourseCents: 0 }

  if (!actor.isAdmin) {
    // Partie à la mission : uniquement l'annulation gratuite, montant non choisi.
    if (tx.status !== 'cancelled') throw new PaymentError('Ouvrez un litige depuis la conversation.', 403)
    if (tx.en_route_at || tx.arrived_at || tx.completed_at) {
      return { rembourseCents: 0, enAttente: 'Annulation tardive : remboursement décidé par PING sous 48 h.' }
    }
    const back = await refundAmount(db, p, txId, charges, paid, 'Annulation')
    await setPaymentStatus(db, txId, 'refunded')
    return { rembourseCents: back }
  }

  // Admin : montant libre (litige, annulation tardive : on rembourse tout sauf les frais).
  const amount = Math.min(paid, input.amountCents ?? paid)
  const back = await refundAmount(db, p, txId, charges, amount, input.reason || 'Remboursement')
  if (back >= paid) await setPaymentStatus(db, txId, 'refunded')
  else await recompute(db, txId)
  return { rembourseCents: back }
}

// ---------- webhooks ----------
export async function handleWebhook(name: ProviderName, events: WebhookEvent[]) {
  const p = PROVIDERS[name]
  const db = createAdminClient()
  for (const e of events) {
    if (e.type === 'payment') {
      const { data } = await db.from('payments').select('*').eq('provider', name).eq('external_id', e.externalId).maybeSingle()
      if (!data) continue
      await syncCharge(db, p, data as PaymentRow)
      await recompute(db, (data as PaymentRow).transaction_id)
    } else if (e.type === 'incident') {
      const found = await incidentTarget(db, name, e)
      if (!found) {
        await db.from('payment_alerts').insert({ provider_id: null, kind: e.kind, detail: { psp: name, ref: e.ref, nonRattache: true } })
        continue
      }
      let amount = e.amountCents
      if (e.kind === 'chargeback' && found.transactionId) {
        // Opposition : dette seulement si l'argent était déjà versé au prestataire, et au plus sa part
        // (la commission perdue reste une perte PING). Avant versement, le séquestre couvre le litige.
        const tx = await loadTx(db, found.transactionId)
        amount = tx.payment_status === 'released' ? Math.min(amount ?? 0, tx.payout_cents ?? 0) : 0
      }
      await recordIncident({ providerId: found.providerId, transactionId: found.transactionId, kind: e.kind, amountCents: amount, ref: e.ref, psp: name })
    } else {
      const { data } = await db.from('payment_accounts').select('*').eq('provider', name).eq('external_id', e.externalId)
      for (const a of (data ?? []) as AccountRow[]) {
        if (a.role !== 'seller') continue
        await saveAccount(db, name, a.user_id, 'seller', await p.refreshSeller(a))
      }
    }
  }
}

// Retrouve le prestataire visé par un incident : métadonnée PING, compte chez le PSP, ou encaissement.
async function incidentTarget(db: SupabaseClient, name: ProviderName, e: Extract<WebhookEvent, { type: 'incident' }>) {
  if (e.pingUserId) return { providerId: e.pingUserId, transactionId: null }
  if (e.sellerExternalId) {
    const { data } = await db.from('payment_accounts').select('user_id').eq('provider', name).eq('role', 'seller').eq('external_id', e.sellerExternalId).maybeSingle()
    if (data) return { providerId: data.user_id as string, transactionId: null }
  }
  if (e.paymentExternalId) {
    const { data } = await db.from('payments').select('transaction_id').eq('provider', name)
      .or(`external_id.eq.${e.paymentExternalId},meta->>payment_intent.eq.${e.paymentExternalId}`).limit(1).maybeSingle()
    if (data) {
      const { data: tx } = await db.from('transactions').select('seller_id').eq('id', data.transaction_id).maybeSingle()
      if (tx) return { providerId: tx.seller_id as string, transactionId: data.transaction_id as string }
    }
  }
  return null
}

// ---------- déblocage automatique (cron) ----------
// PAYMENT_RELEASE_MODE=manuel : rien ne part tout seul, chaque versement est validé dans /admin/paiements.
export const AUTO_RELEASE = process.env.PAYMENT_RELEASE_MODE !== 'manuel'

export async function releaseDue() {
  need()
  if (!AUTO_RELEASE) return []
  const db = createAdminClient()
  const before = new Date(Date.now() - RELEASE_DELAY_HOURS * 3600_000).toISOString()
  const { data } = await db.from('transactions').select('id').eq('payment_status', 'held').not('completed_at', 'is', null).lte('completed_at', before).limit(100)
  const out: Array<{ id: string; etat: string; erreur?: string }> = []
  for (const t of data ?? []) {
    try { out.push({ id: t.id, ...(await settle(t.id)) }) }
    catch (e) { out.push({ id: t.id, etat: 'erreur', erreur: (e as Error).message }) }
  }
  return out
}

// ---------- admin : missions dont l'argent est bloqué ----------
export async function adminOverview() {
  const db = createAdminClient()
  const { data } = await db.from('transactions')
    .select('id, status, payment_status, payment_provider, total_charged_cents, payout_cents, completed_at, en_route_at, arrived_at, created_at')
    .in('payment_status', ['held', 'complement_due', 'awaiting', 'failed']).order('created_at', { ascending: false }).limit(200)
  const ids = (data ?? []).map(t => t.id)
  const [{ data: pays }, { data: disputes }] = await Promise.all([
    ids.length ? db.from('payments').select('transaction_id, kind, amount_cents, status, meta').in('transaction_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('disputes').select('transaction_id, status').in('transaction_id', ids).eq('status', 'open') : Promise.resolve({ data: [] as any[] }),
  ])
  return (data ?? []).map(t => {
    const mine = (pays ?? []).filter(p => p.transaction_id === t.id)
    const sum = (k: string) => mine.filter(p => p.kind === k && p.status === 'succeeded').reduce((s, p) => s + p.amount_cents, 0)
    return {
      ...t, payeCents: sum('charge') - sum('refund'),
      litige: (disputes ?? []).some(d => d.transaction_id === t.id),
      alerte: mine.find(p => p.meta?.alerte)?.meta?.alerte ?? null,
    }
  })
}
