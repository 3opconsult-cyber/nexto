// Serveur uniquement. Réservations refusées ou expirées (052/053) : remboursement automatique à 100 % quand le
// paiement en ligne est actif (séquestre), et e-mail au client même si personne n'ouvre l'application.
// Appelé par le cron /api/bookings/expire (sans session, clé service) et par /api/bookings/ended (juste après un
// refus ou une expiration vue dans l'application).
import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentsProvider, refundEndedBooking, sweepEndedMoney } from '@/lib/payments'
import { sendMissionEmail } from '@/lib/notifyServer'

type Ended = { transaction_id: string; buyer_id: string; booking_status: string }

async function alreadyMailed(db: SupabaseClient, txId: string, userId: string, event: string) {
  const { data } = await db.from('notification_log').select('id').eq('transaction_id', txId).eq('user_id', userId).eq('event', event).limit(1)
  return !!data?.length
}

/** Une réservation terminée sans prestation : remboursement (si payée en ligne) puis e-mails au client. */
export async function processEndedBooking(db: SupabaseClient, row: Ended) {
  const out: Record<string, unknown> = { id: row.transaction_id, booking: row.booking_status }
  if (paymentsProvider()) {
    try { out.paiement = await refundEndedBooking(row.transaction_id) }
    catch (e) { out.paiement = { etat: 'erreur', erreur: (e as Error).message } }
  }
  const event = row.booking_status === 'expiree' ? 'booking_expired' : 'booking_refused'
  if (!(await alreadyMailed(db, row.transaction_id, row.buyer_id, event))) {
    out.email = await sendMissionEmail(db, { transactionId: row.transaction_id, recipientId: row.buyer_id, event, throttle: 'none' })
  }
  const pay = out.paiement as { etat?: string } | undefined
  if (pay?.etat === 'rembourse' && !(await alreadyMailed(db, row.transaction_id, row.buyer_id, 'booking_refunded'))) {
    out.emailRemboursement = await sendMissionEmail(db, { transactionId: row.transaction_id, recipientId: row.buyer_id, event: 'booking_refunded', throttle: 'none' })
  }
  return out
}

/** Cron : expire les réservations sans réponse, prévient chaque client, rembourse, puis reprend l'argent des litiges clos. */
export async function sweepBookings(db: SupabaseClient) {
  const { data: expired } = await db.rpc('expire_pending_bookings')
  // 053 : toutes les réservations terminées dont le client n'a pas encore l'e-mail (y compris celles expirées
  // par pg_cron) ; sans 053, seulement celles que cet appel vient d'expirer.
  const { data: late, error } = await db.rpc('booking_ended_unnotified')
  const rows: Ended[] = !error && Array.isArray(late) ? late as Ended[]
    : (Array.isArray(expired) ? expired : []).map((r: any) => ({ transaction_id: r.transaction_id, buyer_id: r.buyer_id, booking_status: 'expiree' }))
  const seen = new Set<string>()
  const reservations: unknown[] = []
  for (const r of rows) {
    if (!r?.transaction_id || seen.has(r.transaction_id)) continue
    seen.add(r.transaction_id)
    try { reservations.push(await processEndedBooking(db, r)) }
    catch (e) { reservations.push({ id: r.transaction_id, etat: 'erreur', erreur: (e as Error).message }) }
  }
  // Séquestre : réservations payées refusées/expirées déjà prévenues mais pas encore remboursées (encaissement
  // reçu après coup), et litiges clos dont la répartition chez le PSP reste à faire.
  let argent: unknown = { actif: false }
  try { argent = await sweepEndedMoney() } catch (e) { argent = { erreur: (e as Error).message } }
  return { expirees: Array.isArray(expired) ? expired.length : 0, reservations, argent }
}
