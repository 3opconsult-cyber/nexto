import { createClient } from '@/lib/supabase/client'
import { ServiceType } from '@/types'

export interface ProNearby {
  pro_id: string
  user_id: string
  company_name: string
  hourly_rate: number
  travel_fee: number
  rating_avg: number
  rating_count: number
  distance_m: number
  is_available: boolean
  legal_form: string
  vat_regime: string
}

export async function fetchProsNearby(
  lat: number,
  lng: number,
  radiusM = 15000,
  service?: ServiceType
): Promise<ProNearby[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('pros_nearby', {
    lat, lng, radius_m: radiusM, p_service: service ?? null,
  })
  if (error) { console.error('pros_nearby', error); return [] }
  return (data ?? []) as ProNearby[]
}

export async function fetchProDetail(proId: string) {
  const supabase = createClient()
  const { data: pro } = await supabase
    .from('pro_profiles')
    .select('*, profiles(first_name, last_name, avatar_url), pro_services(service)')
    .eq('id', proId)
    .single()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profiles(first_name)')
    .eq('pro_id', proId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20)
  return { pro, reviews: reviews ?? [] }
}
