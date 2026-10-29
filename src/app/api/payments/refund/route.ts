import { NextResponse } from 'next/server'
import { refund } from '@/lib/payments'
import { currentUser, fail } from '../_auth'

export const dynamic = 'force-dynamic'

// POST { transactionId, montantCents?, motif? }
// - mission annulée : client ou prestataire déclenche le remboursement (moins les frais d'annulation
//   tardive, versés au prestataire) ;
// - sinon : le prestataire (geste commercial) ou un admin (litige tranché) rembourse tout ou partie.
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
