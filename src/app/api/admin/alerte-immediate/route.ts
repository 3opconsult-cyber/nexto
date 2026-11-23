import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { sendImmediateAdminAlert } from '@/lib/notifyServer'
import { isImmediateKind } from '@/lib/adminAlerts'

export const dynamic = 'force-dynamic'

// POST {transactionId, kind} : appelé par l'app juste après une action grave (annulation après l'arrivée ou tardive à frais,
// prestataire absent, litige, intervention de PING, virement non reçu). Envoie UN e-mail court à PING (ADMIN_NOTIFY_EMAIL,
// repli info@opconsult.co), au plus une fois par alerte. Jamais de donnée personnelle. Voir sendImmediateAdminAlert.
// Éteint tant que RESEND_API_KEY ou la clé service manque : {sent:false, reason:'off'}.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY || !hasServiceRole()) return NextResponse.json({ sent: false, reason: 'off' })
    let b: { transactionId?: string; kind?: string } = {}
    try { b = await req.json() } catch { }
    if (!b.transactionId || !UUID.test(b.transactionId) || !isImmediateKind(b.kind)) return NextResponse.json({ sent: false, reason: 'invalid' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ sent: false, reason: 'auth' }, { status: 401 })
    const r = await sendImmediateAdminAlert(createAdminClient(), { transactionId: b.transactionId, callerId: user.id, kind: b.kind })
    return NextResponse.json(r, { status: r.reason === 'forbidden' ? 403 : 200 })
  } catch {
    return NextResponse.json({ sent: false, reason: 'error' })
  }
}
