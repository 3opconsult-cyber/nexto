"use client"
import type { createClient } from '@/lib/supabase/client'
import { getRates } from '@/lib/pricing'

type Sb = ReturnType<typeof createClient>
export type OfferMsg = {
  id: string
  offer_cents: number | null
  offer_hourly_cents?: number | null
  offer_included_hours?: number | null
}

/**
 * Accepte une proposition de tarif (message kind='offer' en attente). Logique unique, partagée par
 * le chat et « Accepter ce prestataire » de Mes demandes (audit ergonomie 18/11, amélioration 6).
 * Règle suprême du tarif : sans effet si le prix est déjà validé. Commissions figées sur la
 * transaction au taux du réglage à l'instant de l'acceptation (getRates).
 */
export async function acceptOfferMessage(supabase: Sb, transactionId: string, m: OfferMsg): Promise<{ tx: any } | { error: string }> {
  if (!m.offer_cents) return { error: 'Proposition sans montant.' }
  const cents = m.offer_cents
  const rates = await getRates()
  const buyerFee = Math.round(cents * rates.buyer)
  const sellerFee = Math.round(cents * rates.seller)
  // Forfait + dépassement si la proposition porte un tarif de dépassement ; sinon prix sec (efface
  // toute structure de dépassement héritée d'une proposition précédente).
  const hasOvertime = m.offer_hourly_cents != null && m.offer_included_hours != null
  // Tarif horaire seul (sans heures incluses) : le montant est une estimation, la facture suit
  // les heures réellement passées au scan de fin.
  const hourlyOnly = m.offer_hourly_cents != null && m.offer_included_hours == null
  const { data: updated, error } = await supabase.from('transactions').update({
    subtotal_cents: cents,
    buyer_fee_cents: buyerFee,
    seller_fee_cents: sellerFee,
    total_charged_cents: cents + buyerFee,
    payout_cents: cents - sellerFee,
    price_confirmed: true,
    hourly_rate_cents: (hasOvertime || hourlyOnly) ? m.offer_hourly_cents : null,
    included_hours: hasOvertime ? m.offer_included_hours : null,
    base_forfait_cents: hasOvertime ? cents : null,
  }).eq('id', transactionId).eq('price_confirmed', false).select().maybeSingle()
  if (error || !updated) return { error: 'Acceptation non enregistrée — réessayez.' }
  await supabase.from('messages').update({ offer_status: 'accepted' }).eq('id', m.id)
  if (updated.request_id) await closeRequest(supabase, updated.request_id, transactionId)
  return { tx: updated }
}

/**
 * Une proposition acceptée ferme la demande publiée (audit ergonomie 19/11, correction 1) : sinon elle
 * restait « open » et visible des pros dans « Demandes autour de vous » (requests_nearby filtre sur
 * status = 'open') après l'accord, et même après la fin de la mission.
 * Chemin 1 : l'auteur de la demande (le client) peut modifier sa demande (RLS requests, comme
 * « Annuler » dans Mes demandes). Chemin 2, quand c'est le prestataire qui accepte une contre-offre
 * (la RLS lui refuse l'écriture sur requests, 0 ligne sans erreur) : RPC SECURITY DEFINER
 * `match_request_on_accept` (supabase/a_coller/051_demande_fermee_a_l_accord.sql, qui pose aussi un
 * trigger sur transactions.price_confirmed). Sans la RPC en base, l'échec est silencieux : rien ne casse.
 */
async function closeRequest(supabase: Sb, requestId: string, transactionId: string) {
  try {
    const { data } = await supabase.from('requests').update({ status: 'matched' })
      .eq('id', requestId).eq('status', 'open').select('id')
    if (data && data.length) return
    await supabase.rpc('match_request_on_accept', { p_transaction: transactionId })
  } catch { /* non bloquant : l'accord sur le prix est déjà enregistré */ }
}
