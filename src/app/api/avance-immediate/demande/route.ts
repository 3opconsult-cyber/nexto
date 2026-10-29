import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isConfigured, rechercherDemandes, transmettreDemande, UrssafError } from '@/lib/urssaf/avanceImmediate'
import { isEligible, partClientCents } from '@/lib/creditImpot'

export const dynamic = 'force-dynamic'

const day = (iso: string) => iso.slice(0, 10)

// POST { transactionId } : le prestataire transmet à l'Urssaf la demande de paiement d'une mission
// terminée. L'Urssaf demande ensuite au client de la valider (48 h) puis prélève sa part.
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "L'avance immédiate n'est pas encore active." }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const { transactionId } = await req.json().catch(() => ({})) as { transactionId?: string }
  if (!transactionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })

  const { data: tx } = await supabase.from('transactions')
    .select('id, seller_id, status, arrived_at, completed_at, subtotal_cents, total_charged_cents, hourly_rate_cents, duration_minutes')
    .eq('id', transactionId).single()
  if (!tx || tx.seller_id !== user.id) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })
  if (!tx.completed_at) return NextResponse.json({ error: 'La mission doit être terminée (scan de fin).' }, { status: 409 })

  const { data: ctx } = await supabase.rpc('avance_immediate_context', { p_transaction: transactionId }).maybeSingle()
  const c = ctx as { id_client: string | null; date_naissance: string | null; category: string | null; sap_number: string | null } | null
  if (!c?.sap_number) return NextResponse.json({ error: 'Renseignez votre numéro SAP pour transmettre.' }, { status: 409 })
  if (!c.id_client || !c.date_naissance) return NextResponse.json({ error: "Le client n'est pas inscrit à l'avance immédiate." }, { status: 409 })
  if (!isEligible(c.category)) return NextResponse.json({ error: 'Prestation non éligible.' }, { status: 409 })

  const total = tx.total_charged_cents ?? tx.subtotal_cents
  const hourly = !!tx.hourly_rate_cents && !!tx.duration_minutes
  try {
    const r = await transmettreDemande({
      idClient: c.id_client,
      dateNaissanceClient: c.date_naissance,
      numFactureTiers: `PING-${tx.id.slice(0, 8).toUpperCase()}`,
      dateFacture: day(tx.completed_at),
      dateDebutEmploi: day(tx.arrived_at || tx.completed_at),
      dateFinEmploi: day(tx.completed_at),
      category: c.category!,
      quantite: hourly ? Math.round((tx.duration_minutes / 60) * 100) / 100 : 1,
      unite: hourly ? 'HEURE' : 'FORFAIT',
      montantTtcCents: total,
    })
    await supabase.from('avance_immediate_demandes').upsert({
      transaction_id: tx.id, id_demande_paiement: r.idDemandePaiement, statut: r.statut || 'transmise',
      montant_cents: total, part_client_cents: partClientCents(total), message: null, updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ statut: r.statut || 'transmise' })
  } catch (e) {
    const err = e as UrssafError
    return NextResponse.json({ error: err.message, details: err.details ?? null }, { status: err.status && err.status < 500 ? 422 : 502 })
  }
}

// GET ?transactionId= : relit le statut auprès de l'Urssaf et le met à jour.
export async function GET(req: Request) {
  const supabase = await createClient()
  const id = new URL(req.url).searchParams.get('transactionId')
  if (!id) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })
  const { data: row } = await supabase.from('avance_immediate_demandes').select('*').eq('transaction_id', id).maybeSingle()
  if (!row || !row.id_demande_paiement || !isConfigured()) return NextResponse.json({ demande: row ?? null })
  try {
    const res = await rechercherDemandes([row.id_demande_paiement]) as { infoDemandePaiements?: Array<{ statut?: { code?: string } }> }
    const statut = res?.infoDemandePaiements?.[0]?.statut?.code
    if (statut && statut !== row.statut) {
      await supabase.from('avance_immediate_demandes').update({ statut, updated_at: new Date().toISOString() }).eq('transaction_id', id)
      row.statut = statut
    }
  } catch { /* on renvoie le dernier statut connu */ }
  return NextResponse.json({ demande: row })
}
