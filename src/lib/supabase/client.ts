import { createBrowserClient } from '@supabase/ssr'

// Audit ergonomie 21/11 : un écran appelait auth.getUser() 7 à 9 fois au chargement (chaque composant de la
// barre, du menu, du chat), soit autant d'allers-retours /auth/v1/user. On garde UNE réponse partagée quelques
// secondes (et les appels simultanés partagent la même requête). Le cache est vidé à toute connexion,
// déconnexion ou renouvellement de session. La RLS reste la vraie garde côté base.
const USER_TTL_MS = 15_000
let patched = false

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
  if (typeof window !== 'undefined' && !patched) {
    patched = true
    try {
      const auth = client.auth
      const original = auth.getUser.bind(auth)
      let cached: { at: number; p: ReturnType<typeof original> } | null = null
      auth.getUser = ((jwt?: string) => {
        if (jwt) return original(jwt)
        if (cached && Date.now() - cached.at < USER_TTL_MS) return cached.p
        const p = original().then(r => { if (r.error || !r.data?.user) cached = null; return r })
        cached = { at: Date.now(), p }
        return p
      }) as typeof auth.getUser
      auth.onAuthStateChange(() => { cached = null })
    } catch { /* repli : getUser d'origine */ }
  }
  return client
}
