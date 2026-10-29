import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inscrireParticulier, isConfigured, UrssafError, type Particulier } from '@/lib/urssaf/avanceImmediate'

export const dynamic = 'force-dynamic'

const REQUIRED: (keyof Particulier)[] = ['civilite', 'nomNaissance', 'prenoms', 'dateNaissance', 'lieuNaissance', 'numeroTelephonePortable', 'adresseMail', 'adressePostale', 'coordonneeBancaire']

// Inscrit le particulier connecté auprès de l'Urssaf. Les coordonnées bancaires partent directement
// à l'Urssaf et ne sont jamais enregistrées chez PING.
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "L'avance immédiate n'est pas encore active." }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const body = await req.json().catch(() => null) as Particulier | null
  const missing = body ? REQUIRED.filter(k => !body[k]) : REQUIRED
  if (missing.length) return NextResponse.json({ error: 'Champs manquants.', champs: missing }, { status: 400 })

  try {
    const { idClient } = await inscrireParticulier(body!)
    await supabase.from('avance_immediate_clients').upsert({
      user_id: user.id, urssaf_id_client: idClient, date_naissance: body!.dateNaissance,
      statut: 'inscrit', message: null, updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ statut: 'inscrit' })
  } catch (e) {
    const err = e as UrssafError
    await supabase.from('avance_immediate_clients').upsert({
      user_id: user.id, statut: 'refuse', message: err.message, updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ error: err.message, details: err.details ?? null }, { status: err.status && err.status < 500 ? 422 : 502 })
  }
}
