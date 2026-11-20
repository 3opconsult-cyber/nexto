import { NextResponse } from 'next/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { sweepBookings } from '@/lib/bookingsServer'
import { sendDocumentAlerts } from '@/lib/notifyServer'

export const dynamic = 'force-dynamic'

// GET : appelé par le cron Vercel (vercel.json), protégé par CRON_SECRET comme /api/payments/release.
// 1. expire_pending_bookings() (052) avec la clé service : réservations sans réponse du prestataire -> « expirée » ;
// 2. pour chaque réservation expirée ou refusée dont le client n'a pas eu d'e-mail (053) : e-mail au client et,
//    si elle avait été payée en ligne (séquestre actif), remboursement à 100 % via l'adaptateur du PSP ;
// 3. séquestre : litiges clos dont la répartition (remboursement partiel + versement du reste) reste à faire.
// 4. pièces (057) : expire_documents() (aussi planifiée par pg_cron) puis e-mails à PING des dépôts non encore signalés
//    (ceux retenus par la limite de 10 min par déposant). Sans la migration 057, cette étape ne fait rien.
// Sans clé service : rien (pg_cron de 052 continue d'expirer les réservations, l'app prévient à la lecture).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!hasServiceRole()) return NextResponse.json({ actif: false, raison: 'SUPABASE_SERVICE_ROLE_KEY absente' })
  try {
    const db = createAdminClient()
    const out = await sweepBookings(db)
    let pieces: Record<string, unknown> = {}
    try {
      const exp = await db.rpc('expire_documents')
      pieces = { expirees: exp.error ? null : exp.data, ...(await sendDocumentAlerts(db)) }
    } catch (e) { pieces = { erreur: (e as Error).message } }
    return NextResponse.json({ actif: true, ...out, pieces })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Erreur.' }, { status: 500 })
  }
}
