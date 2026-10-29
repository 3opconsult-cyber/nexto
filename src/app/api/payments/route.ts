import { NextResponse } from 'next/server'
import { paymentsProvider, readiness } from '@/lib/payments'
import { currentUser } from './_auth'

export const dynamic = 'force-dynamic'

// Le front demande ici si le paiement en ligne est actif (et lequel), sans jamais voir de clé.
// Un admin voit en plus ce qui manque pour l'allumer.
export async function GET() {
  const p = paymentsProvider()
  const me = await currentUser().catch(() => null)
  return NextResponse.json({ actif: !!p, prestataire: p?.label ?? null, ...(me?.isAdmin ? { reglage: readiness() } : {}) })
}
