import { NextResponse } from 'next/server'
import { isConfigured } from '@/lib/urssaf/avanceImmediate'

export const dynamic = 'force-dynamic'

// Le front demande ici si le branchement Urssaf est actif, sans jamais voir les identifiants.
export function GET() {
  return NextResponse.json({ disponible: isConfigured() })
}
