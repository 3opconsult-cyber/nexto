import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// Serveur uniquement : client Supabase avec la clé service (contourne la RLS). Sert aux webhooks des
// prestataires de paiement et au déblocage automatique du séquestre, qui n'ont pas de session
// utilisateur. Ne jamais importer côté client.
export function hasServiceRole() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function createAdminClient(): SupabaseClient {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
