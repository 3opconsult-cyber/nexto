import { NextResponse } from 'next/server'
import { onboardSeller, paymentsProvider, sellerAccount } from '@/lib/payments'
import { currentUser, fail, originOf } from '../_auth'

export const dynamic = 'force-dynamic'

// GET : état du compte de paiement du prestataire connecté (relu chez le PSP).
export async function GET() {
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const p = paymentsProvider()
  if (!p) return NextResponse.json({ actif: false })
  const a = await sellerAccount(me.id, true).catch(() => null)
  return NextResponse.json({
    actif: true, prestataire: p.label, nom: p.name,
    // Stripe collecte identité et IBAN sur sa propre page ; Mangopay et Lemonway reçoivent l'IBAN saisi ici.
    saisieIban: p.name !== 'stripe',
    compte: a ? { statut: a.status, message: a.message, iban: !!a.bank_account_id } : null,
  })
}

// POST { iban?, bic?, titulaire?, adresse?, dateNaissance? } : ouvre ou complète le compte.
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as {
    iban?: string; bic?: string; titulaire?: string; dateNaissance?: string
    adresse?: { ligne: string; ville: string; codePostal: string }
  }
  try {
    const r = await onboardSeller(me.id, {
      origin: originOf(req),
      birthDate: b.dateNaissance,
      iban: b.iban ? {
        iban: b.iban, bic: b.bic, holder: b.titulaire || '',
        address: b.adresse ? { line1: b.adresse.ligne, city: b.adresse.ville, postalCode: b.adresse.codePostal, country: 'FR' } : undefined,
      } : undefined,
    })
    return NextResponse.json({ redirectUrl: r.redirectUrl ?? null, statut: r.account?.status ?? 'pending' })
  } catch (e) { return fail(e) }
}
