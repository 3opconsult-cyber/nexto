import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncTransaction } from '@/lib/payments'
import { fail } from '../_auth'

export const dynamic = 'force-dynamic'

// POST { transactionId } : au retour de la page de paiement, relit l'état réel chez le PSP
// (le webhook fait la même chose, celui-ci évite d'attendre). Réservé aux parties de la mission.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const { transactionId } = await req.json().catch(() => ({})) as { transactionId?: string }
  // La RLS ne renvoie la transaction qu'à ses parties.
  const { data: tx } = await supabase.from('transactions').select('id').eq('id', transactionId ?? '').maybeSingle()
  if (!tx) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })
  try { return NextResponse.json({ statut: await syncTransaction(tx.id) }) }
  catch (e) { return fail(e) }
}
