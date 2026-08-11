import { createClient } from '@/lib/supabase/client'

export interface ProviderNearby {
  id: string
  trade: string
  legal_status: string
  base_price_cents: number
  rating: number
  reviews_count: number
  is_active: boolean
  distance_m: number
  bio: string
}

export async function fetchProvidersNearby(
  lat: number, lng: number, radiusM = 15000, trade?: string
): Promise<ProviderNearby[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('providers_nearby', {
    lat, lng, radius_m: radiusM, p_trade: trade ?? null,
  })
  if (error) { console.error('providers_nearby', error); return [] }
  return (data ?? []) as ProviderNearby[]
}
