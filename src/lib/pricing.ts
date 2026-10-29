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

// Règle « heure entamée, heure due » (décision Romain 29/10) : une heure commencée n'est comptée qu'à
// partir de N minutes (15 par défaut). Réglable sur /admin/commission (clé app_settings
// `billing_hour_threshold_minutes`). Ne s'applique qu'au tarif horaire et au dépassement d'un forfait.
export const DEFAULT_HOUR_THRESHOLD_MINUTES = 15

export async function getHourThreshold(): Promise<number> {
  const { data } = await createClient().from('app_settings').select('value').eq('key', 'billing_hour_threshold_minutes').maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n >= 0 && n <= 59 ? n : DEFAULT_HOUR_THRESHOLD_MINUTES
}

// Heures facturées pour une durée réelle : 3 h 10 → 3 h, 3 h 20 → 4 h (seuil 15 min).
export function billedHours(minutes: number, thresholdMinutes: number): number {
  const full = Math.floor(minutes / 60)
  return full + (minutes % 60 >= thresholdMinutes ? 1 : 0)
}
