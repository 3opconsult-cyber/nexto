import { NextResponse } from 'next/server'
import { startCheckout } from '@/lib/payments'
import { currentUser, fail, originOf } from '../_auth'

export const dynamic = 'force-dynamic'

// POST { transactionId } : le client est renvoyé vers la page de paiement hébergée du PSP
// (montant restant dû : la réservation, puis le complément éventuel d'un dépassement horaire).
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const { transactionId } = await req.json().catch(() => ({})) as { transactionId?: string }
  if (!transactionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })
  try { return NextResponse.json(await startCheckout(me.id, transactionId, originOf(req))) }
  catch (e) { return fail(e) }
}
