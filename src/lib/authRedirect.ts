import type { SupabaseClient } from '@supabase/supabase-js'

// Chemin de retour après connexion : interne au site seulement (pas de « //hote »,
// pas d'antislash, pas de caractère de contrôle), et jamais une page de connexion,
// d'inscription ou de rappel (boucle). Renvoie chemin + requête + ancre, ou null.
export function safeNext(raw: string | null): string | null {
  if (typeof window === 'undefined') return null
  if (!raw || raw.length > 2000) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const u = new URL(raw, window.location.origin)
    if (u.origin !== window.location.origin) return null
    if (u.pathname === '/auth/login' || u.pathname === '/auth/signup' || u.pathname === '/auth/callback') return null
    return u.pathname + u.search + u.hash
  } catch { return null }
}

// Espace d'arrivée après connexion quand aucun ?next= n'est donné : admin, pro, sinon la carte.
// Filtre sur l'utilisateur connecté : sans lui, un admin (qui peut lire plusieurs profils)
// recevait une erreur de .single() et finissait sur /map.
export async function homeFor(supabase: SupabaseClient, userId: string | null): Promise<string> {
  if (!userId) return '/map'
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_pro').eq('id', userId).maybeSingle()
  if (profile?.is_admin) return '/admin'
  if (profile?.is_pro) return '/pro/dashboard'
  return '/map'
}

// /admin (et ses sous-pages) est servi par un rewrite vers public/admin.html, hors du
// routeur App Router : navigation complète plutôt que router.push.
export const isAdminPath = (path: string) =>
  path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?') || path.startsWith('/admin#')

// Journal de connexion (table login_log) : date et heure de chaque connexion. N'échoue jamais.
export async function logLogin(supabase: SupabaseClient, userId: string) {
  try {
    let m: string | null = null
    try { m = localStorage.getItem('ping_mode') } catch { }
    await supabase.from('login_log').insert({ user_id: userId, kind: 'login', mode: m, user_agent: navigator.userAgent.slice(0, 200) })
  } catch { }
}
