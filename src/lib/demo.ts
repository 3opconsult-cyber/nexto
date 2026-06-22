import { createClient } from '@/lib/supabase/client'
import { ServiceType } from '@/types'

export interface DemoPro {
  id: string
  company_name: string
  first_name: string
  legal_form: string
  vat_regime: string
  bio: string
  hourly_rate: number
  travel_fee: number
  rating_avg: number
  rating_count: number
  mission_count: number
  radius_km: number
  is_available: boolean
  lat: number
  lng: number
  services: ServiceType[]
  is_premium: boolean
}

export interface DemoReview {
  id: string
  pro_id: string
  author: string
  rating: number
  comment: string
  service: ServiceType
}

const GRASSE = { lat: 43.6584, lng: 6.9225 }

export async function fetchDemoPros(service?: ServiceType): Promise<DemoPro[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_pros_nearby', {
    lat: GRASSE.lat, lng: GRASSE.lng, radius_m: 30000, p_service: service ?? null,
  })
  if (error) { console.error('demo_pros_nearby', error); return [] }
  return (data ?? []) as DemoPro[]
}

export async function fetchDemoPro(id: string): Promise<{ pro: DemoPro | null; reviews: DemoReview[] }> {
  const supabase = createClient()
  const { data: pro } = await supabase.from('demo_pros').select('*').eq('id', id).single()
  const { data: reviews } = await supabase.from('demo_reviews').select('*').eq('pro_id', id)
  return { pro: pro as DemoPro, reviews: (reviews ?? []) as DemoReview[] }
}
