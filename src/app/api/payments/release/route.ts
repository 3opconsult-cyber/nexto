import { NextResponse } from 'next/server'
import { paymentsProvider, releaseDue, settle } from '@/lib/payments'
import { currentUser, fail } from '../_auth'

export const dynamic = 'force-dynamic'

// GET : appelé par le cron Vercel (vercel.json). Verse au prestataire les missions terminées depuis
// plus de 24 h, payées, sans litige ouvert. Protégé par CRON_SECRET (en-tête envoyé par Vercel).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!paymentsProvider()) return NextResponse.json({ actif: false, traites: [] })
  try { return NextResponse.json({ actif: true, traites: await releaseDue() }) }
  catch (e) { return fail(e) }
}

// POST { transactionId, immediat? } : un admin débloque une mission (par ex. litige clos à l'amiable).
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me?.isAdmin) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 })
  const { transactionId, immediat } = await req.json().catch(() => ({})) as { transactionId?: string; immediat?: boolean }
  if (!transactionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 })
  try { return NextResponse.json(await settle(transactionId, { force: !!immediat })) }
  catch (e) { return fail(e) }
}
