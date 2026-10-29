import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentError } from '@/lib/payments'

// Utilisateur connecté (session Supabase) pour les routes de paiement appelées depuis l'app.
export async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return { id: user.id, isAdmin: !!prof?.is_admin }
}

export function fail(e: unknown) {
  const err = e as PaymentError
  const status = err instanceof PaymentError ? (err.status >= 500 ? 502 : err.status) : 500
  return NextResponse.json({ error: err?.message || 'Erreur de paiement.' }, { status: status === 503 ? 503 : status })
}

export const originOf = (req: Request) => new URL(req.url).origin
