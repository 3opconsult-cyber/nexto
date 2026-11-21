// Serveur uniquement. E-mails de mission (Resend), partagés par /api/notify (appelé depuis l'app) et par les routes
// serveur sans session (cron des réservations expirées, répartition de l'argent d'un litige).
// Confidentialité : jamais le texte d'un message ni l'adresse, seulement un lien vers la mission.
// Éteint (rien n'est envoyé) tant que RESEND_API_KEY ou la clé service manque.
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasServiceRole } from '@/lib/supabase/admin'

export const MAIL_EVENTS = ['message', 'offer', 'booking', 'dispute', 'presence_arrivee', 'presence_fin', 'presence_client', 'code_client',
  'booking_request', 'booking_accepted', 'booking_refused', 'booking_expired', 'booking_refunded',
  'dispute_mediation', 'dispute_closed',
  'cancelled_by_client', 'cancelled_by_provider', 'provider_no_show', 'reschedule_proposed', 'reschedule_answer', 'closed_on_proof', 'transfer_not_received', 'transfer_reaffirmed', 'ping_message'] as const
export type MailEvent = typeof MAIL_EVENTS[number]

// Demandes de confirmation de présence : action attendue du client, lien vers la Mission du jour.
export const URGENT_EVENTS: readonly string[] = ['presence_arrivee', 'presence_fin', 'code_client']
// Réservation (052) et litige (054) : chaque étape est envoyée même si un message vient de partir
// (limite propre à l'événement : 1 toutes les 2 min par mission et destinataire).
export const OWN_THROTTLE_EVENTS: readonly string[] = ['booking_request', 'booking_accepted', 'booking_refused', 'booking_expired',
  'booking_refunded', 'dispute_mediation', 'dispute_closed', 'cancelled_by_client', 'cancelled_by_provider', 'provider_no_show',
  'reschedule_proposed', 'reschedule_answer', 'closed_on_proof', 'transfer_not_received', 'transfer_reaffirmed', 'ping_message']
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
  cancelled_by_client: { subject: 'Une réservation a été annulée sur PING', line: () => 'Votre client a annulé la réservation. Le motif et les éventuels frais sont dans la conversation.' },
  cancelled_by_provider: { subject: 'Votre réservation a été annulée par le prestataire sur PING', line: () => 'Votre prestataire a dû annuler la réservation (le motif est dans la conversation). Aucun frais ne vous est facturé et un paiement en ligne est remboursé à 100 %. Vous pouvez choisir un autre prestataire.' },
  provider_no_show: { subject: 'Absence déclarée sur une réservation PING', line: () => 'Le client indique que vous n’êtes pas arrivé au rendez-vous : la réservation est annulée sans frais pour lui. Vous pouvez contester dans les 24 h en ouvrant un litige depuis la conversation.' },
  reschedule_proposed: { subject: 'Nouveau créneau proposé sur PING', line: () => 'L’autre partie propose de déplacer le rendez-vous. Acceptez ou refusez depuis la conversation ; le prix ne change pas.' },
  reschedule_answer: { subject: 'Réponse à votre demande de report sur PING', line: () => 'L’autre partie a répondu à votre proposition de nouveau créneau. Le détail est dans la conversation.' },
  closed_on_proof: { subject: 'Mission enregistrée sur preuve sur PING', line: s => s ? 'Votre mission est enregistrée.' : 'Votre prestataire a enregistré l’étape de la mission sur preuve (photo horodatée et position), faute de réponse de votre part. La mission est facturée normalement ; vous pouvez ouvrir un litige dans les 24 h depuis la conversation.' },
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

// ---------------------------------------------------------------------------------------------------------------
// Alerte à PING à chaque dépôt de pièce (migration 057). La base pose une ligne `admin_notifications` (trigger) ;
// ici le serveur envoie l'e-mail à PING : « Pièce à valider : <type> de <nom> » avec un lien vers /admin, JAMAIS
// le contenu de la pièce. Au plus 1 e-mail par déposant toutes les 10 min (les alertes en attente partent au
// passage suivant, dont le cron quotidien). Destinataire : ADMIN_NOTIFY_EMAIL, repli info@opconsult.co.
// Éteint ({sent:0, reason:'off'}) tant que RESEND_API_KEY ou la clé service manque, ou avant la migration 057.
export const ADMIN_NOTIFY_FALLBACK = 'info@opconsult.co'
const escHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function sendDocumentAlerts(admin: SupabaseClient, opts: { userId?: string } = {}): Promise<{ sent: number; reason?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key || !hasServiceRole()) return { sent: 0, reason: 'off' }
  let q = admin.from('admin_notifications').select('id, user_id, title').eq('kind', 'document_pending').is('handled_at', null).is('emailed_at', null)
    .order('created_at', { ascending: true }).limit(200)
  if (opts.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q
  if (error) return { sent: 0, reason: 'migration_057_absente' }   // table absente : rien ne casse
  const byUser = new Map<string, { id: string; title: string }[]>()
  for (const r of (data ?? []) as { id: string; user_id: string | null; title: string }[]) {
    const k = r.user_id || 'inconnu'
    byUser.set(k, [...(byUser.get(k) ?? []), { id: r.id, title: r.title }])
  }
  const to = (process.env.ADMIN_NOTIFY_EMAIL || '').trim() || ADMIN_NOTIFY_FALLBACK
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  let sent = 0
  for (const [userId, rows] of Array.from(byUser.entries())) {
    // 1 e-mail par déposant toutes les 10 min.
    const { data: recent } = await admin.from('admin_notifications').select('id').eq('kind', 'document_pending').eq('user_id', userId).gte('emailed_at', since).limit(1)
    if (recent && recent.length > 0) continue
    // Comptes de démonstration (.invalid) : l'alerte reste dans l'admin, mais aucun e-mail.
    let demo = false
    if (userId !== 'inconnu') {
      const { data: u } = await admin.auth.admin.getUserById(userId)
      demo = /\.invalid$/i.test(u?.user?.email || '')
    }
    const ids = rows.map(r => r.id)
    if (!demo) {
      const link = `${SITE}/admin`
      const subject = rows.length === 1 ? rows[0].title : `${rows.length} pièces à valider sur PING`
      const text = `${rows.map(r => r.title).join('\n')}\n\nOuvrir l’administration (Conformité) : ${link}\n\nPour la confidentialité, le contenu des pièces n’est jamais envoyé par e-mail.`
      const html = `<div style="font-family:Arial,sans-serif;color:#123644;font-size:15px;line-height:1.5">`
        + rows.map(r => `<p style="margin:0 0 6px"><b>${escHtml(r.title)}</b></p>`).join('')
        + `<p><a href="${link}" style="display:inline-block;background:#12B39C;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">Ouvrir l’administration</a></p>`
        + `<p style="color:#4E6470;font-size:13px">Pour la confidentialité, le contenu des pièces n’est jamais envoyé par e-mail.</p></div>`
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'PING <notifications@ping.invalid>', to: [to], subject, text, html }),
      })
      if (!r.ok) continue   // l'alerte reste « non envoyée » : nouvel essai au prochain passage
      sent++
    }
    await admin.from('admin_notifications').update({ emailed_at: new Date().toISOString() }).in('id', ids)
  }
  return { sent }
}

// ---------------------------------------------------------------------------------------------------------------
// Alerte « contrôles de nuit » (migration 061). La base écrit une ligne par contrôle dans `controles_resultats` et, s'il y
// a du rouge ou de l'orange, une alerte `admin_notifications` (kind 'controle_nuit') : c'est la pastille de l'admin.
// Ici, le serveur envoie UN e-mail court à PING seulement s'il y a du ROUGE dans le dernier passage, une seule fois
// par alerte (emailed_at). Jamais de détail : le titre de chaque ligne rouge (noms de tables, nombres) et un lien vers
// /admin. Format en 4 lignes : problème et gravité / cause / solution ou fait / décision attendue (voir
// docs/controles-niveau-3.md). Éteint ({sent:false}) sans clé Resend, sans clé service ou avant la migration 061.
export async function sendControlAlert(admin: SupabaseClient): Promise<{ sent: boolean; reason?: string; rouge?: number }> {
  const key = process.env.RESEND_API_KEY
  if (!key || !hasServiceRole()) return { sent: false, reason: 'off' }
  const last = await admin.from('controles_resultats').select('run_id, run_at').order('run_at', { ascending: false }).limit(1)
  if (last.error) return { sent: false, reason: 'migration_061_absente' }
  const run = last.data?.[0] as { run_id: string; run_at: string } | undefined
  if (!run) return { sent: false, reason: 'aucun_passage' }
  const { data: lines } = await admin.from('controles_resultats').select('controle, titre').eq('run_id', run.run_id).eq('gravite', 'rouge').order('controle')
  const rouges = (lines ?? []) as { controle: string; titre: string }[]
  if (rouges.length === 0) return { sent: false, reason: 'aucun_rouge', rouge: 0 }
  // Une seule fois par alerte : l'alerte du jour (admin_notifications) porte emailed_at.
  const al = await admin.from('admin_notifications').select('id').eq('kind', 'controle_nuit').is('handled_at', null).is('emailed_at', null).limit(1)
  if (al.error) return { sent: false, reason: 'migration_057_absente' }
  if (!al.data || al.data.length === 0) return { sent: false, reason: 'deja_envoye', rouge: rouges.length }
  const to = (process.env.ADMIN_NOTIFY_EMAIL || '').trim() || ADMIN_NOTIFY_FALLBACK
  const link = `${SITE}/admin`
  const subject = `PING : ${rouges.length} contrôle(s) rouge(s) cette nuit`
  const text = [
    `1. Problème : ${rouges.length} contrôle(s) en rouge (gravité haute).`,
    `2. Cause : ${rouges.map(r => r.titre).join(' ; ')}`,
    '3. Solution : ouvrir Conformité dans l’administration, lire le détail de chaque ligne rouge.',
    '4. Décision attendue : corriger, ou accepter le schéma actuel si le changement est voulu.',
    '', link, '', 'Aucune donnée personnelle dans ce message : seulement des noms de tables et des nombres.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;color:#123644;font-size:15px;line-height:1.5">`
    + `<p style="margin:0 0 6px"><b>1. Problème :</b> ${rouges.length} contrôle(s) en rouge (gravité haute).</p>`
    + `<p style="margin:0 0 6px"><b>2. Cause :</b> ${rouges.map(r => escHtml(r.titre)).join(' ; ')}</p>`
    + `<p style="margin:0 0 6px"><b>3. Solution :</b> ouvrir Conformité dans l’administration, lire le détail de chaque ligne rouge.</p>`
    + `<p style="margin:0 0 12px"><b>4. Décision attendue :</b> corriger, ou accepter le schéma actuel si le changement est voulu.</p>`
    + `<p><a href="${link}" style="display:inline-block;background:#12B39C;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">Ouvrir l’administration</a></p></div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'PING <notifications@ping.invalid>', to: [to], subject, text, html }),
  })
  if (!r.ok) return { sent: false, reason: 'resend_refuse', rouge: rouges.length }
  await admin.from('admin_notifications').update({ emailed_at: new Date().toISOString() }).in('id', (al.data as { id: string }[]).map(x => x.id))
  return { sent: true, rouge: rouges.length }
}
