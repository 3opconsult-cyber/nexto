import { NextResponse } from 'next/server'
import { handleWebhook, PROVIDERS } from '@/lib/payments'
import type { ProviderName } from '@/lib/payments/types'
import { hasServiceRole } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Notifications des PSP. Stripe signe (vérifié) ; Mangopay et Lemonway non : leur URL porte une clé
// secrète et on relit toujours la ressource chez eux, jamais le contenu du message.
async function handle(req: Request, { params }: { params: { provider: string } }) {
  const p = PROVIDERS[params.provider as ProviderName]
  if (!p || !p.configured() || !hasServiceRole()) return NextResponse.json({ error: 'Inconnu ou inactif.' }, { status: 404 })
  try {
    await handleWebhook(p.name, await p.parseWebhook(req))
    return NextResponse.json({ ok: true })
  } catch (e) {
    const status = (e as { status?: number }).status
    return NextResponse.json({ error: (e as Error).message }, { status: status && status < 500 ? status : 500 })
  }
}

export { handle as GET, handle as POST }
