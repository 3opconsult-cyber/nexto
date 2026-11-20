import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'

// Notification par e-mail de l'AUTRE partie d'une mission (message, tarif proposé, réservation, litige).
// Confidentialité : le corps ne contient jamais le texte du message ni l'adresse, seulement un lien.
// Tout est éteint (réponse {sent:false, reason:'off'}) tant que RESEND_API_KEY ou la clé service manque.
const EVENTS = ['message', 'offer', 'booking', 'dispute', 'presence_arrivee', 'presence_fin', 'presence_client', 'code_client',
  'booking_request', 'booking_accepted', 'booking_refused', 'booking_expired'] as const
// Demandes de confirmation de présence : action attendue du client, donc hors de la limite des 10 min des
// messages ; leur propre limite est de 1 e-mail par mission et par type toutes les 2 min (la base n'accepte
// déjà qu'une demande par minute, 5 au total). Le code n'est JAMAIS mis dans l'e-mail : il s'affiche dans l'application.
const URGENT: readonly string[] = ['presence_arrivee', 'presence_fin', 'code_client']
// Réservation à accepter et réponse du prestataire (052) : chaque étape est envoyée même si un message vient de
// partir (limite propre à l'événement, comme les demandes de présence), mais le lien ouvre la conversation.
const BOOKING: readonly string[] = ['booking_request', 'booking_accepted', 'booking_refused', 'booking_expired']
const URGENT_THROTTLE_MS = 2 * 60 * 1000
type Ev = typeof EVENTS[number]
const THROTTLE_MS = 10 * 60 * 1000
const SITE = 'https://nexto-eta.vercel.app'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WHAT: Record<Ev, { subject: string; line: (asSeller: boolean) => string }> = {
  message: { subject: 'Nouveau message sur PING', line: s => `Vous avez reçu un nouveau message ${s ? 'd’un client' : 'd’un prestataire'}.` },
  offer: { subject: 'Nouvelle proposition de tarif sur PING', line: s => `${s ? 'Un client' : 'Un prestataire'} vous a envoyé une proposition de tarif.` },
  booking: { subject: 'Nouvelle réservation sur PING', line: s => s ? 'Un client vient de réserver une prestation auprès de vous.' : 'Votre réservation a bien été enregistrée.' },
  dispute: { subject: 'Un litige a été ouvert sur PING', line: () => 'Un litige a été ouvert sur une de vos missions. La discussion continue dans le dossier du litige.' },
  presence_arrivee: { subject: 'Votre prestataire est arrivé : confirmez dans PING', line: () => 'Votre prestataire indique être arrivé chez vous et ne pas vous y trouver. Ouvrez la mission du jour pour confirmer sa présence en un appui (ou signaler un problème).' },
  presence_fin: { subject: 'Fin de mission : envoyez votre code de fin sur PING', line: () => 'Votre prestataire indique avoir terminé la mission. Ouvrez la mission du jour pour voir la durée et le montant, puis envoyer votre code de fin ou contester.' },
  presence_client: { subject: 'Votre client a indiqué s’il sera sur place', line: () => 'Votre client a indiqué s’il sera sur place le jour du rendez-vous. Ouvrez la mission pour voir comment valider votre arrivée et la fin.' },
  booking_request: { subject: 'Nouvelle réservation à accepter sur PING', line: () => 'Un client vient de réserver une prestation auprès de vous, au prix de votre fiche. Acceptez-la ou refusez-la en un appui depuis la conversation : sans réponse dans le délai indiqué, elle est annulée.' },
  booking_accepted: { subject: 'Votre réservation est acceptée sur PING', line: () => 'Votre prestataire a accepté votre réservation : le rendez-vous est confirmé.' },
  booking_refused: { subject: 'Votre réservation n’a pas été acceptée sur PING', line: () => 'Votre prestataire ne peut pas assurer cette réservation. Elle est annulée sans frais : vous pouvez choisir un autre prestataire depuis la conversation.' },
  booking_expired: { subject: 'Votre réservation a expiré sur PING', line: () => 'Votre prestataire n’a pas répondu à temps : la réservation est annulée sans frais. Vous pouvez choisir un autre prestataire depuis la conversation.' },
  code_client: { subject: 'Votre client vous a envoyé son code sur PING', line: () => 'Votre client vous a envoyé son code dans la conversation. Saisissez-le dans la mission du jour.' },
}

const off = () => NextResponse.json({ sent: false, reason: 'off' })

export async function POST(req: Request) {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key || !hasServiceRole()) return off()

    let b: { transactionId?: string; event?: string } = {}
    try { b = await req.json() } catch { }
    const event = b.event as Ev
    if (!b.transactionId || !UUID.test(b.transactionId) || !EVENTS.includes(event)) {
      return NextResponse.json({ sent: false, reason: 'invalid' }, { status: 400 })
    }

    // Appelant connecté, et partie à la mission.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ sent: false, reason: 'auth' }, { status: 401 })

    const admin = createAdminClient()
    const { data: tx } = await admin.from('transactions').select('id, buyer_id, seller_id').eq('id', b.transactionId).maybeSingle()
    if (!tx || (tx.buyer_id !== user.id && tx.seller_id !== user.id)) {
      return NextResponse.json({ sent: false, reason: 'forbidden' }, { status: 403 })
    }
    const otherId: string = tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id
    if (!otherId || otherId === user.id) return NextResponse.json({ sent: false, reason: 'no_recipient' })

    // Limite : 1 e-mail par mission et par destinataire toutes les 10 minutes.
    const urgent = URGENT.includes(event)
    const ownThrottle = urgent || BOOKING.includes(event)
    const since = new Date(Date.now() - (ownThrottle ? URGENT_THROTTLE_MS : THROTTLE_MS)).toISOString()
    let q = admin.from('notification_log').select('id')
      .eq('user_id', otherId).eq('transaction_id', tx.id).gte('created_at', since)
    if (ownThrottle) q = q.eq('event', event)
    const { data: recent } = await q.limit(1)
    if (recent && recent.length > 0) return NextResponse.json({ sent: false, reason: 'throttled' })

    const { data: u } = await admin.auth.admin.getUserById(otherId)
    const to = u?.user?.email
    // Comptes de démonstration (.invalid) : pas d'envoi.
    if (!to || /\.invalid$/i.test(to)) return NextResponse.json({ sent: false, reason: 'no_email' })

    const link = urgent ? `${SITE}/mission/${tx.id}/jour` : `${SITE}/mission/${tx.id}/chat`
    const w = WHAT[event]
    const text = `Bonjour,\n\n${w.line(otherId === tx.seller_id)}\n\n${urgent ? 'Pour confirmer' : 'Pour la lire et répondre'} : ${link}\n\nVous recevez cet e-mail car vous avez une mission en cours sur PING. Pour votre confidentialité, le contenu des échanges n’est jamais envoyé par e-mail.\n\nL’équipe PING`
    const html = `<div style="font-family:Arial,sans-serif;color:#123644;font-size:15px;line-height:1.5">`
      + `<p>Bonjour,</p><p>${w.line(otherId === tx.seller_id)}</p>`
      + `<p><a href="${link}" style="display:inline-block;background:#12B39C;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">${urgent ? 'Ouvrir la mission du jour' : 'Ouvrir la conversation'}</a></p>`
      + `<p style="color:#4E6470;font-size:13px">Vous recevez cet e-mail car vous avez une mission en cours sur PING. Pour votre confidentialité, le contenu des échanges n’est jamais envoyé par e-mail.</p>`
      + `<p style="color:#4E6470;font-size:13px">L’équipe PING</p></div>`

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'PING <notifications@ping.invalid>', to: [to], subject: w.subject, text, html }),
    })
    if (!r.ok) return NextResponse.json({ sent: false, reason: 'provider_error' })

    await admin.from('notification_log').insert({ user_id: otherId, transaction_id: tx.id, event })
    return NextResponse.json({ sent: true })
  } catch {
    return NextResponse.json({ sent: false, reason: 'error' })
  }
}
