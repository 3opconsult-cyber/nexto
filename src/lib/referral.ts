import { createClient } from '@/lib/supabase/client'

/**
 * Parrainage : le code du parrain (?ref=) est gardé dans le navigateur dès l'arrivée sur l'inscription,
 * puis enregistré via la RPC `register_referral` (SECURITY DEFINER : la RLS interdit de lire le code
 * d'un autre profil) dès qu'une session existe, que ce soit juste après l'inscription ou, si l'e-mail
 * doit d'abord être confirmé, à la première connexion / première visite de la carte.
 */
const KEY = 'ping_ref'

export function rememberReferral(code: string | null | undefined) {
  if (typeof window === 'undefined' || !code) return
  try { window.localStorage.setItem(KEY, code.trim().slice(0, 40)) } catch { /* stockage indisponible */ }
}

export function pendingReferral(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(KEY) } catch { return null }
}

/** Enregistre le parrain s'il y a un code en attente et une session. Renvoie le prénom du parrain, ou null. */
export async function flushReferral(): Promise<string | null> {
  const code = pendingReferral()
  if (!code) return null
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null // pas encore connecté : on garde le code pour plus tard
    const { error, data } = await supabase.rpc('register_referral', { p_code: code })
    if (error) return null // erreur réseau : on garde le code, nouvel essai à la prochaine visite
    try { window.localStorage.removeItem(KEY) } catch { /* ignore */ }
    return (data as string | null) ?? null
  } catch { return null }
}
