import { NextResponse } from 'next/server'
import { refund } from '@/lib/payments'
import { currentUser, fail } from '../_auth'

export const dynamic = 'force-dynamic'

// POST { transactionId, montantCents?, motif? }
// - partie à la mission : seulement l'annulation avant que le prestataire soit en route (tout revient
//   au client) ; une annulation tardive attend la décision de PING ;
// - admin OpConsult : tout ou partie, à tout moment avant le versement (litige, geste, annulation tardive).
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { transactionId?: string; montantCents?: number; motif?: string }
  if (!b.transactionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })
  try {
    return NextResponse.json(await refund({ userId: me.id, isAdmin: me.isAdmin }, b.transactionId, {
      amountCents: b.montantCents != null ? Math.max(0, Math.round(b.montantCents)) : undefined, reason: b.motif || '',
    }))
  } catch (e) { return fail(e) }
}
