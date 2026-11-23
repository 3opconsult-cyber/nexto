import { createClient } from './supabase/client'

// Taux de commission — pilotés depuis la base (table `app_settings`,
// clés `commission_buyer_rate` / `commission_seller_rate`), réglables
// par un admin sur /admin/commission sans redéploiement de code.
// Ces valeurs ne sont qu'un filet de sécurité si la base n'a jamais été
// seedée (ne doit jamais arriver en pratique — la migration 012 les pose).
export const DEFAULT_BUYER_RATE = 0.08
export const DEFAULT_SELLER_RATE = 0.17

// Cache de 60 s : un taux modifié sur /admin/commission est repris par un onglet déjà ouvert (A-037, 23/11).
let cache: { buyer: number; seller: number } | null = null
let cacheAt = 0
const RATES_TTL_MS = 60_000

export async function getRates(): Promise<{ buyer: number; seller: number }> {
  if (cache && Date.now() - cacheAt < RATES_TTL_MS) return cache
  const supabase = createClient()
  const { data } = await supabase.from('app_settings').select('key, value')
    .in('key', ['commission_buyer_rate', 'commission_seller_rate'])
  const byKey: Record<string, number> = {}
  ;(data ?? []).forEach((r: any) => { byKey[r.key] = Number(r.value) })
  cache = {
    buyer: byKey.commission_buyer_rate ?? DEFAULT_BUYER_RATE,
    seller: byKey.commission_seller_rate ?? DEFAULT_SELLER_RATE,
  }
  cacheAt = Date.now()
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

// Calcul pur dans ./billing (testé par scripts/tests/facturation/run.cjs).
export { billedHours, computeFinalAmounts } from './billing'
export type { BillingTx, FinalAmounts } from './billing'
