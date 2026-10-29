import { NextResponse } from 'next/server'
import { adminOverview, AUTO_RELEASE, paymentsProvider, readiness, RELEASE_DELAY_HOURS } from '@/lib/payments'
import { currentUser, fail } from '../_auth'

export const dynamic = 'force-dynamic'

// Admin OpConsult : missions dont l'argent est bloqué, et ce qui manque pour allumer le paiement.
export async function GET() {
  const me = await currentUser()
  if (!me?.isAdmin) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 })
  const reglage = readiness()
  if (!paymentsProvider()) return NextResponse.json({ reglage, missions: [] })
  try {
    return NextResponse.json({ reglage, auto: AUTO_RELEASE, delaiHeures: RELEASE_DELAY_HOURS, missions: await adminOverview() })
  } catch (e) { return fail(e) }
}
