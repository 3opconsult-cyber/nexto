import { NextResponse } from 'next/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { sweepBookings } from '@/lib/bookingsServer'

export const dynamic = 'force-dynamic'

// GET : appelé par le cron Vercel (vercel.json), protégé par CRON_SECRET comme /api/payments/release.
// 1. expire_pending_bookings() (052) avec la clé service : réservations sans réponse du prestataire -> « expirée » ;
// 2. pour chaque réservation expirée ou refusée dont le client n'a pas eu d'e-mail (053) : e-mail au client et,
//    si elle avait été payée en ligne (séquestre actif), remboursement à 100 % via l'adaptateur du PSP ;
// 3. séquestre : litiges clos dont la répartition (remboursement partiel + versement du reste) reste à faire.
// Sans clé service : rien (pg_cron de 052 continue d'expirer les réservations, l'app prévient à la lecture).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!hasServiceRole()) return NextResponse.json({ actif: false, raison: 'SUPABASE_SERVICE_ROLE_KEY absente' })
  try {
    return NextResponse.json({ actif: true, ...(await sweepBookings(createAdminClient())) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Erreur.' }, { status: 500 })
  }
}
