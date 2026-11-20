import { NextResponse } from 'next/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { processEndedBooking } from '@/lib/bookingsServer'
import { currentUser } from '../../payments/_auth'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { transactionId } : juste après un refus ou une expiration vue dans l'application (partie à la mission).
// Rembourse à 100 % si la réservation avait été payée en ligne, et prévient le client par e-mail (une seule fois).
// Le cron /api/bookings/expire fait la même chose pour tout ce qui n'est pas passé par ici.
export async function POST(req: Request) {
  if (!hasServiceRole()) return NextResponse.json({ actif: false })
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const { transactionId } = await req.json().catch(() => ({})) as { transactionId?: string }
  if (!transactionId || !UUID.test(transactionId)) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })
  const db = createAdminClient()
  const { data: tx } = await db.from('transactions').select('id, buyer_id, seller_id, booking_status').eq('id', transactionId).maybeSingle()
  if (!tx || (![tx.buyer_id, tx.seller_id].includes(me.id) && !me.isAdmin)) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })
  if (!['refusee', 'expiree'].includes((tx as any).booking_status)) return NextResponse.json({ etat: 'reservation_active' })
  try {
    return NextResponse.json(await processEndedBooking(db, { transaction_id: tx.id, buyer_id: tx.buyer_id, booking_status: (tx as any).booking_status }))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Erreur.' }, { status: 500 })
  }
}
