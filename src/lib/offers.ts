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
  return { tx: updated }
}
