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
  lat: number
  lng: number
  pricing_type: 'forfait' | 'horaire'
  hourly_rate_cents: number | null
  full_name: string | null
  avatar_hue: number | null
  has_identity: boolean
  has_rcpro: boolean
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

export async function fetchProDetail(proId: string) {
  const supabase = createClient()
  const { data: pro } = await supabase
    .from('provider_profiles')
    .select('*, profiles!provider_profiles_id_fkey(full_name, avatar_hue)')
    .eq('id', proId)
    .single()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profiles!reviews_rater_id_fkey(full_name)')
    .eq('ratee_id', proId)
    .order('created_at', { ascending: false })
    .limit(20)
  return { pro, reviews: reviews ?? [] }
}
