import { createClient } from './supabase/client'

// Taux de commission — pilotés depuis la base (table `app_settings`,
// clés `commission_buyer_rate` / `commission_seller_rate`), réglables
// par un admin sur /admin/commission sans redéploiement de code.
// Ces valeurs ne sont qu'un filet de sécurité si la base n'a jamais été
// seedée (ne doit jamais arriver en pratique — la migration 012 les pose).
export const DEFAULT_BUYER_RATE = 0.08
export const DEFAULT_SELLER_RATE = 0.17

let cache: { buyer: number; seller: number } | null = null

export async function getRates(): Promise<{ buyer: number; seller: number }> {
  if (cache) return cache
  const supabase = createClient()
  const { data } = await supabase.from('app_settings').select('key, value')
    .in('key', ['commission_buyer_rate', 'commission_seller_rate'])
  const byKey: Record<string, number> = {}
  ;(data ?? []).forEach((r: any) => { byKey[r.key] = Number(r.value) })
  cache = {
    buyer: byKey.commission_buyer_rate ?? DEFAULT_BUYER_RATE,
    seller: byKey.commission_seller_rate ?? DEFAULT_SELLER_RATE,
  }
  return cache
}
