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
    p_lat: lat, p_lng: lng, radius_m: radiusM, p_trade: trade ?? null,
  })
  if (error) { console.error('providers_nearby', error); return [] }
  return (data ?? []) as ProviderNearby[]
}

export async function fetchProDetail(proId: string) {
  const supabase = createClient()
  // Le nom passe par une fonction dediee, pas par un embed sur profiles :
  // profiles est en lecture strictement personnelle (auth.uid() = id), donc
  // l'embed renvoyait toujours null et la fiche s'affichait sans nom, en repli
  // sur le libelle du metier. provider_public_name ne sort que le nom affiche
  // et la teinte d'avatar d'un prestataire actif — ni telephone, ni adresse.
  const [{ data: pro }, { data: pub }, { data: trust }] = await Promise.all([
    supabase.from('provider_profiles').select('*').eq('id', proId).single(),
    supabase.rpc('provider_public_name', { provider_id: proId }),
    supabase.rpc('provider_trust_stats', { provider_id: proId }),
  ])
  if (pro && pub && pub.length) (pro as any).profiles = pub[0]
  if (pro && trust && trust.length) Object.assign(pro as any, trust[0])
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profiles!reviews_rater_id_fkey(full_name)')
    .eq('ratee_id', proId)
    .order('created_at', { ascending: false })
    .limit(20)
  return { pro, reviews: reviews ?? [] }
}
