import { NextResponse } from 'next/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { applyDisputeMoney } from '@/lib/payments'
import { sendMissionEmail } from '@/lib/notifyServer'
import { currentUser } from '../../payments/_auth'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Session : cookie de l'application, ou jeton Supabase en en-tête (public/admin.html).
async function caller(req: Request) {
  const me = await currentUser().catch(() => null)
  if (me) return me
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !hasServiceRole()) return null
  const db = createAdminClient()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return null
  const { data: prof } = await db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return { id: user.id, isAdmin: !!prof?.is_admin }
}

// POST { disputeId } : appelé juste après la fin d'un litige (arrangement accepté par une partie, ou « Appliquer la
// décision » de PING). La base a déjà clos le litige, émis l'avoir et ajusté le virement (040 / 054) ; ici :
//  - séquestre actif : X € remboursés au client puis versement du reste au prestataire (applyDisputeMoney) ;
//  - les deux parties sont prévenues par e-mail (lien vers le dossier du litige).
// Le cron /api/bookings/expire reprend toute répartition qui n'aurait pas abouti.
export async function POST(req: Request) {
  if (!hasServiceRole()) return NextResponse.json({ actif: false })
  const me = await caller(req)
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const { disputeId } = await req.json().catch(() => ({})) as { disputeId?: string }
  if (!disputeId || !UUID.test(disputeId)) return NextResponse.json({ error: 'Litige manquant.' }, { status: 400 })
  const db = createAdminClient()
  const { data: d } = await db.from('disputes').select('id, status, transaction_id').eq('id', disputeId).maybeSingle()
  if (!d) return NextResponse.json({ error: 'Litige introuvable.' }, { status: 404 })
  const { data: tx } = await db.from('transactions').select('id, buyer_id, seller_id').eq('id', d.transaction_id).maybeSingle()
  if (!tx || (![tx.buyer_id, tx.seller_id].includes(me.id) && !me.isAdmin)) return NextResponse.json({ error: 'Litige introuvable.' }, { status: 404 })
  if (d.status === 'open') return NextResponse.json({ etat: 'litige_ouvert' })

  let argent: Record<string, unknown>
  try { argent = await applyDisputeMoney(d.id) }
  catch (e) { argent = { etat: 'erreur', erreur: (e as Error).message } }

  // Une seule fois par clôture : rien si l'e-mail « litige clos » est déjà parti depuis la clôture.
  const { data: full } = await db.from('disputes').select('*').eq('id', d.id).maybeSingle()
  const since = (full as any)?.closed_at || (full as any)?.decided_at || new Date(Date.now() - 3600_000).toISOString()
  const emails = await Promise.all([tx.buyer_id, tx.seller_id].map(async uid => {
    const { data: sent } = await db.from('notification_log').select('id').eq('transaction_id', tx.id).eq('user_id', uid)
      .eq('event', 'dispute_closed').gte('created_at', since).limit(1)
    if (sent?.length) return { sent: false, reason: 'deja_envoye' }
    return sendMissionEmail(db, { transactionId: tx.id, recipientId: uid, event: 'dispute_closed', disputeId: d.id }).catch(() => ({ sent: false }))
  }))
  return NextResponse.json({ argent, emails })
}
