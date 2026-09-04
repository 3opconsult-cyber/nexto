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

export interface RequestNearby {
  id: string
  category: string
  description: string
  budget_cents: number | null
  address: string | null
  lat: number
  lng: number
  distance_m: number
  created_at: string
}

export async function fetchRequestsNearby(
  lat: number, lng: number, radiusM = 15000
): Promise<RequestNearby[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('requests_nearby', {
    p_lat: lat, p_lng: lng, radius_m: radiusM,
  })
  if (error) { console.error('requests_nearby', error); return [] }
  return (data ?? []) as RequestNearby[]
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

// Ouvre (ou reutilise) une conversation avec un prestataire pour entrer
// directement dans le chat — pas de devis. Cree une requete + une transaction
// 'pending' au prix de base du pro ; le prix definitif se negocie ensuite dans
// le chat (mecanisme d'offre) et se fige au scan de sortie. Reutilise une
// conversation existante encore ouverte (pending/held) pour ne pas empiler une
// transaction a chaque clic sur "Contacter".
export async function openConversation(proId: string): Promise<{ missionId: string | null; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { missionId: null, error: 'not_authenticated' }

  // Deja une conversation ouverte avec ce pro ?
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('seller_id', proId)
    .in('status', ['pending', 'held', 'arrived'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (existing && existing.length) return { missionId: existing[0].id }

  const { data: pro } = await supabase
    .from('provider_profiles')
    .select('trade, base_price_cents, hourly_rate_cents, pricing_type')
    .eq('id', proId).single()
  if (!pro) return { missionId: null, error: 'pro_not_found' }

  const subtotal = pro.base_price_cents ?? pro.hourly_rate_cents ?? 0
  const buyerFee = Math.round(subtotal * (5 / 100))
  const sellerFee = Math.round(subtotal * (11 / 100))

  const { data: req } = await supabase.from('requests').insert({
    requester_id: user.id, category: pro.trade, status: 'matched',
  }).select().single()
  if (!req) return { missionId: null, error: 'request_failed' }

  const { data: tx } = await supabase.from('transactions').insert({
    kind: 'service', buyer_id: user.id, seller_id: proId, request_id: req.id,
    subtotal_cents: subtotal, buyer_fee_cents: buyerFee, seller_fee_cents: sellerFee,
    total_charged_cents: subtotal + buyerFee, payout_cents: subtotal - sellerFee,
    hourly_rate_cents: pro.pricing_type === 'horaire' ? pro.hourly_rate_cents : null,
    status: 'pending',
  }).select().single()
  if (!tx) return { missionId: null, error: 'tx_failed' }

  return { missionId: tx.id }
}
