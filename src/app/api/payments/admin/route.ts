import { NextResponse } from 'next/server'
import { adminOverview, AUTO_RELEASE, paymentsProvider, readiness, RELEASE_DELAY_HOURS } from '@/lib/payments'
import { firewallOverview, markAlertHandled, suspendProvider, unsuspendProvider } from '@/lib/payments/firewall'
import { hasServiceRole } from '@/lib/supabase/admin'
import { currentUser, fail } from '../_auth'

export const dynamic = 'force-dynamic'

// Admin OpConsult : missions dont l'argent est bloqué, ce qui manque pour allumer le paiement, et le
// pare-feu des commissions (alertes, prestataires suspendus). Le pare-feu marche même paiement éteint.
export async function GET() {
  const me = await currentUser()
  if (!me?.isAdmin) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 })
  const reglage = readiness()
  try {
    const pareFeu = hasServiceRole() ? await firewallOverview() : null
    if (!paymentsProvider()) return NextResponse.json({ reglage, missions: [], pareFeu })
    return NextResponse.json({ reglage, auto: AUTO_RELEASE, delaiHeures: RELEASE_DELAY_HOURS, missions: await adminOverview(), pareFeu })
  } catch (e) { return fail(e) }
}

// POST { action: 'suspend' | 'unsuspend' | 'handled', providerId?, alertId?, reason? }
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me?.isAdmin) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 })
  if (!hasServiceRole()) return NextResponse.json({ error: 'Clé service Supabase absente côté serveur.' }, { status: 503 })
  const b = await req.json().catch(() => ({})) as { action?: string; providerId?: string; alertId?: string; reason?: string }
  try {
    if (b.action === 'unsuspend' && b.providerId) return NextResponse.json(await unsuspendProvider(b.providerId, me.id))
    if (b.action === 'suspend' && b.providerId) return NextResponse.json(await suspendProvider(b.providerId, b.reason?.trim() || 'Suspension décidée par PING.'))
    if (b.action === 'handled' && b.alertId) { await markAlertHandled(b.alertId); return NextResponse.json({ ok: true }) }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  } catch (e) { return fail(e) }
}
