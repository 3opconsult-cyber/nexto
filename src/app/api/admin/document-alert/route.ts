import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { sendDocumentAlerts } from '@/lib/notifyServer'

export const dynamic = 'force-dynamic'

// POST : appelé par l'app juste après le dépôt d'une pièce (prestataire ou client). Le trigger de la migration 057 a
// déjà posé l'alerte dans l'admin ; cette route envoie l'e-mail à PING pour CE déposant (session obligatoire, on ne
// lit que ses propres alertes), au plus 1 e-mail toutes les 10 min. Jamais le contenu de la pièce.
// Éteint tant que RESEND_API_KEY ou la clé service manque : réponse {sent:0, reason:'off'}, rien ne casse.
export async function POST() {
  try {
    if (!process.env.RESEND_API_KEY || !hasServiceRole()) return NextResponse.json({ sent: 0, reason: 'off' })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ sent: 0, reason: 'auth' }, { status: 401 })
    return NextResponse.json(await sendDocumentAlerts(createAdminClient(), { userId: user.id }))
  } catch {
    return NextResponse.json({ sent: 0, reason: 'error' })
  }
}
