import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { MAIL_EVENTS, sendMissionEmail, type MailEvent } from '@/lib/notifyServer'

// Notification par e-mail de l'AUTRE partie d'une mission (message, tarif proposé, réservation, litige).
// Le texte des e-mails et la limite d'envoi sont dans src/lib/notifyServer.ts (partagés avec les routes serveur).
// Confidentialité : le corps ne contient jamais le texte du message ni l'adresse, seulement un lien.
// Tout est éteint (réponse {sent:false, reason:'off'}) tant que RESEND_API_KEY ou la clé service manque.
// 'booking_refunded' et 'dispute_closed' ne partent que du serveur (cron, répartition d'un litige).
const FROM_APP: readonly MailEvent[] = MAIL_EVENTS.filter(e => e !== 'booking_refunded' && e !== 'dispute_closed')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const off = () => NextResponse.json({ sent: false, reason: 'off' })

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY || !hasServiceRole()) return off()

    let b: { transactionId?: string; event?: string; disputeId?: string } = {}
    try { b = await req.json() } catch { }
    const event = b.event as MailEvent
    if (!b.transactionId || !UUID.test(b.transactionId) || !FROM_APP.includes(event) || (b.disputeId && !UUID.test(b.disputeId))) {
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
    // Le lien vers un litige n'est mis que s'il porte bien sur cette mission.
    let disputeId: string | undefined
    if (b.disputeId) {
      const { data: d } = await admin.from('disputes').select('id').eq('id', b.disputeId).eq('transaction_id', tx.id).maybeSingle()
      disputeId = d?.id
    }

    return NextResponse.json(await sendMissionEmail(admin, { transactionId: tx.id, recipientId: otherId, event, disputeId }))
  } catch {
    return NextResponse.json({ sent: false, reason: 'error' })
  }
}
