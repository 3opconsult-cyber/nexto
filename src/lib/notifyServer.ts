// Serveur uniquement. E-mails de mission (Resend), partagés par /api/notify (appelé depuis l'app) et par les routes
// serveur sans session (cron des réservations expirées, répartition de l'argent d'un litige).
// Confidentialité : jamais le texte d'un message ni l'adresse, seulement un lien vers la mission.
// Éteint (rien n'est envoyé) tant que RESEND_API_KEY ou la clé service manque.
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasServiceRole } from '@/lib/supabase/admin'

export const MAIL_EVENTS = ['message', 'offer', 'booking', 'dispute', 'presence_arrivee', 'presence_fin', 'presence_client', 'code_client',
  'booking_request', 'booking_accepted', 'booking_refused', 'booking_expired', 'booking_refunded',
  'dispute_mediation', 'dispute_closed', 'transfer_not_received', 'transfer_reaffirmed', 'ping_message'] as const
export type MailEvent = typeof MAIL_EVENTS[number]

// Demandes de confirmation de présence : action attendue du client, lien vers la Mission du jour.
export const URGENT_EVENTS: readonly string[] = ['presence_arrivee', 'presence_fin', 'code_client']
// Réservation (052) et litige (054) : chaque étape est envoyée même si un message vient de partir
// (limite propre à l'événement : 1 toutes les 2 min par mission et destinataire).
export const OWN_THROTTLE_EVENTS: readonly string[] = ['booking_request', 'booking_accepted', 'booking_refused', 'booking_expired',
  'booking_refunded', 'dispute_mediation', 'dispute_closed', 'transfer_not_received', 'transfer_reaffirmed', 'ping_message']
export const SITE = 'https://nexto-eta.vercel.app'

const WHAT: Record<MailEvent, { subject: string; line: (asSeller: boolean) => string }> = {
  message: { subject: 'Nouveau message sur PING', line: s => `Vous avez reçu un nouveau message ${s ? 'd’un client' : 'd’un prestataire'}.` },
  offer: { subject: 'Nouvelle proposition de tarif sur PING', line: s => `${s ? 'Un client' : 'Un prestataire'} vous a envoyé une proposition de tarif.` },
  booking: { subject: 'Nouvelle réservation sur PING', line: s => s ? 'Un client vient de réserver une prestation auprès de vous.' : 'Votre réservation a bien été enregistrée.' },
  dispute: { subject: 'Un litige a été ouvert sur PING', line: () => 'Un litige a été ouvert sur une de vos missions. Le paiement est bloqué jusqu’à sa résolution. La discussion continue dans le dossier du litige.' },
  presence_arrivee: { subject: 'Votre prestataire est arrivé : confirmez dans PING', line: () => 'Votre prestataire indique être arrivé chez vous et ne pas vous y trouver. Ouvrez la mission du jour pour confirmer sa présence en un appui (ou signaler un problème).' },
  presence_fin: { subject: 'Fin de mission : envoyez votre code de fin sur PING', line: () => 'Votre prestataire indique avoir terminé la mission. Ouvrez la mission du jour pour voir la durée et le montant, puis envoyer votre code de fin ou contester.' },
  presence_client: { subject: 'Votre client a indiqué s’il sera sur place', line: () => 'Votre client a indiqué s’il sera sur place le jour du rendez-vous. Ouvrez la mission pour voir comment valider votre arrivée et la fin.' },
  booking_request: { subject: 'Nouvelle réservation à accepter sur PING', line: () => 'Un client vient de réserver une prestation auprès de vous, au prix de votre fiche. Acceptez-la ou refusez-la en un appui depuis la conversation : sans réponse dans le délai indiqué, elle est annulée.' },
  booking_accepted: { subject: 'Votre réservation est acceptée sur PING', line: () => 'Votre prestataire a accepté votre réservation : le rendez-vous est confirmé.' },
  booking_refused: { subject: 'Votre réservation n’a pas été acceptée sur PING', line: () => 'Votre prestataire ne peut pas assurer cette réservation. Elle est annulée sans frais : vous pouvez choisir un autre prestataire depuis la conversation.' },
  booking_expired: { subject: 'Votre réservation a expiré sur PING', line: () => 'Votre prestataire n’a pas répondu à temps : la réservation est annulée sans frais. Vous pouvez choisir un autre prestataire depuis la conversation.' },
  booking_refunded: { subject: 'Votre paiement est remboursé sur PING', line: () => 'Votre réservation est annulée : le paiement est remboursé à 100 % sur votre moyen de paiement.' },
  code_client: { subject: 'Votre client vous a envoyé son code sur PING', line: () => 'Votre client vous a envoyé son code dans la conversation. Saisissez-le dans la mission du jour.' },
  dispute_mediation: { subject: 'Intervention de PING demandée sur un litige', line: () => 'L’intervention de PING a été demandée sur un litige de vos missions. PING prend le relais dans le dossier du litige et rendra sa décision. Le paiement reste bloqué d’ici là.' },
  transfer_not_received: { subject: 'Un virement est signalé non reçu sur PING', line: () => 'Le destinataire indique ne pas avoir reçu un virement annoncé sur une de vos missions. Vérifiez le montant, la référence et l’IBAN, puis confirmez dans l’écran Facturation de la mission.' },
  transfer_reaffirmed: { subject: 'Le payeur maintient son virement sur PING', line: () => 'Le payeur maintient avoir fait un virement que vous n’avez pas reçu. PING est informé et peut intervenir dans la conversation de la mission.' },
  ping_message: { subject: 'PING vous a écrit sur une mission', line: () => 'PING vous a envoyé un message dans la conversation de votre mission (médiation). Ouvrez la conversation pour le lire et répondre.' },
  dispute_closed: { subject: 'Litige clos sur PING', line: () => 'Un litige de vos missions est clos. La décision et la répartition du paiement sont dans le dossier du litige.' },
}

export type MailResult = { sent: boolean; reason?: string }

/** Envoie l'e-mail `event` de la mission `transactionId` à `recipientId` (partie à la mission). */
export async function sendMissionEmail(admin: SupabaseClient, input: {
  transactionId: string; recipientId: string; event: MailEvent
  /** Lien vers le dossier du litige (événements de litige). */
  disputeId?: string
  /** 'none' : pas de limite (dédoublonnage fait par l'appelant) ; défaut : limite habituelle. */
  throttle?: 'default' | 'none'
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key || !hasServiceRole()) return { sent: false, reason: 'off' }
  const { transactionId, recipientId, event } = input
  const { data: tx } = await admin.from('transactions').select('id, buyer_id, seller_id').eq('id', transactionId).maybeSingle()
  if (!tx || (tx.buyer_id !== recipientId && tx.seller_id !== recipientId)) return { sent: false, reason: 'forbidden' }

  const urgent = URGENT_EVENTS.includes(event)
  if (input.throttle !== 'none') {
    const own = urgent || OWN_THROTTLE_EVENTS.includes(event)
    const since = new Date(Date.now() - (own ? 2 : 10) * 60 * 1000).toISOString()
    let q = admin.from('notification_log').select('id').eq('user_id', recipientId).eq('transaction_id', tx.id).gte('created_at', since)
    if (own) q = q.eq('event', event)
    const { data: recent } = await q.limit(1)
    if (recent && recent.length > 0) return { sent: false, reason: 'throttled' }
  }

  const { data: u } = await admin.auth.admin.getUserById(recipientId)
  const to = u?.user?.email
  // Comptes de démonstration (.invalid) : pas d'envoi.
  if (!to || /\.invalid$/i.test(to)) return { sent: false, reason: 'no_email' }

  const link = input.disputeId ? `${SITE}/litiges/${input.disputeId}` : urgent ? `${SITE}/mission/${tx.id}/jour` : `${SITE}/mission/${tx.id}/chat`
  const cta = input.disputeId ? 'Ouvrir le dossier du litige' : urgent ? 'Ouvrir la mission du jour' : 'Ouvrir la conversation'
  const w = WHAT[event]
  const line = w.line(recipientId === tx.seller_id)
  const text = `Bonjour,\n\n${line}\n\n${urgent ? 'Pour confirmer' : 'Pour voir le détail'} : ${link}\n\nVous recevez cet e-mail car vous avez une mission en cours sur PING. Pour votre confidentialité, le contenu des échanges n’est jamais envoyé par e-mail.\n\nL’équipe PING`
  const html = `<div style="font-family:Arial,sans-serif;color:#123644;font-size:15px;line-height:1.5">`
    + `<p>Bonjour,</p><p>${line}</p>`
    + `<p><a href="${link}" style="display:inline-block;background:#12B39C;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">${cta}</a></p>`
    + `<p style="color:#4E6470;font-size:13px">Vous recevez cet e-mail car vous avez une mission en cours sur PING. Pour votre confidentialité, le contenu des échanges n’est jamais envoyé par e-mail.</p>`
    + `<p style="color:#4E6470;font-size:13px">L’équipe PING</p></div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'PING <notifications@ping.invalid>', to: [to], subject: w.subject, text, html }),
  })
  if (!r.ok) return { sent: false, reason: 'provider_error' }
  await admin.from('notification_log').insert({ user_id: recipientId, transaction_id: tx.id, event })
  return { sent: true }
}
