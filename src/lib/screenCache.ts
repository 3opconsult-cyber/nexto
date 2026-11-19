import type { SupabaseClient } from '@supabase/supabase-js'

// Dernier état connu d'un écran (audit ergonomie 19/11, correction 3) : affiché tout de suite au
// retour sur l'écran, puis remplacé par la lecture fraîche. Gardé le temps de l'onglet
// (sessionStorage, jamais localStorage : rien ne survit à la fermeture), lié au compte qui l'a lu
// (jamais montré à un autre compte connecté ensuite dans le même onglet). Échec silencieux.
const PREFIX = 'ping_sc_'
const MAX_AGE_MS = 30 * 60 * 1000

export function readScreenCache<T>(key: string, uid: string | null | undefined): T | null {
  if (!uid || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (v?.uid !== uid || typeof v.at !== 'number' || Date.now() - v.at > MAX_AGE_MS) return null
    return v.data as T
  } catch { return null }
}

export function writeScreenCache(key: string, uid: string | null | undefined, data: unknown) {
  if (!uid || typeof window === 'undefined') return
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify({ uid, at: Date.now(), data })) } catch { /* plein ou bloqué */ }
}

// Identifiant du compte connecté lu dans la session locale (aucun aller-retour réseau, contrairement
// à auth.getUser()). Sert à lire le cache et à filtrer les requêtes : la RLS reste la vraie garde.
export async function sessionUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  } catch { return null }
}
