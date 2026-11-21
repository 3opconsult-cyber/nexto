import { NextResponse } from 'next/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { sendControlAlert } from '@/lib/notifyServer'

export const dynamic = 'force-dynamic'

// Alerte e-mail des contrôles de nuit (migration 061). Protégée par CRON_SECRET (Authorization: Bearer ...).
// Lit controles_resultats avec la clé service ; envoie UN e-mail court seulement s'il y a du rouge dans le dernier
// passage, une seule fois. Sans clé Resend ou sans clé service : { sent: false } (rien ne casse).
async function run(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!hasServiceRole()) return NextResponse.json({ sent: false, reason: 'off' })
  try { return NextResponse.json(await sendControlAlert(createAdminClient())) }
  catch (e) { return NextResponse.json({ sent: false, error: (e as Error).message || 'Erreur.' }, { status: 500 }) }
}
export const GET = run
export const POST = run
