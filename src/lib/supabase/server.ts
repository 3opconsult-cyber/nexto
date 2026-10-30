import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// @supabase/ssr 0.3 : l'API de cookies est get / set / remove (getAll / setAll n'existe qu'à partir
// de 0.4 et serait ignorée en silence — les routes serveur ne voyaient alors jamais l'utilisateur).
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch { /* Server Component : lecture seule */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch { /* Server Component : lecture seule */ }
        },
      },
    }
  )
}
