import { createClient } from '@/lib/supabase/client'
import { getRates } from '@/lib/pricing'
import { tradeOfServiceName } from '@/lib/trades'
import { readScreenCache, writeScreenCache, sessionUserId } from '@/lib/screenCache'
import { fetchPrestations, type Prestation } from '@/lib/prestations'

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
  pricing_type: 'forfait' | 'horaire' | 'devis'
  hourly_rate_cents: number | null
  full_name: string | null
  avatar_hue: number | null
  has_identity: boolean
  has_rcpro: boolean
}

export interface RequestNearby {
  id: string
  category: string
  title: string | null
  description: string
  budget_cents: number | null
  budget_min_cents: number | null
  budget_max_cents: number | null
  desired_date: string | null
  desired_slot: string | null
  frequency: string | null
  urgent?: boolean
  hours_wanted?: number | null
  linen_kg?: number | null
  linen_types?: string[] | null
  household_size?: string | null
  surface_m2?: number | null
  payment_pref?: string | null
  // Pas d'adresse ici par design : elle n'est communiquée qu'une fois la
  // mission confirmée (invariant CLAUDE.md), jamais pendant le parcours
  // "demandes ouvertes autour de moi" avant toute proposition.
  lat: number
  lng: number
  distance_m: number
  created_at: string
  mine?: boolean
}

export async function fetchRequestsNearby(
  lat: number, lng: number, radiusM = 15000
): Promise<RequestNearby[]> {
  const supabase = createClient()
  // Audit ergonomie 19/11 bis, correction 1 : la demande RPC et la lecture de ses propres annonces
  // partent ensemble (compte lu dans la session locale, sans aller-retour) au lieu de trois appels
  // en file. La RLS `requests` reste la garde (auteur seulement pour la seconde lecture).
  const uid = await sessionUserId(supabase)
  const [near, own] = await Promise.all([
    supabase.rpc('requests_nearby', { p_lat: lat, p_lng: lng, radius_m: radiusM }),
    uid
      ? supabase.from('requests')
        .select('id,category,title,description,budget_cents,budget_min_cents,budget_max_cents,desired_date,desired_slot,frequency,urgent,hours_wanted,linen_kg,linen_types,household_size,surface_m2,payment_pref,lat,lng,created_at')
        .eq('requester_id', uid).eq('status', 'open').not('lat', 'is', null).not('lng', 'is', null)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])
  if (near.error) { console.error('requests_nearby', near.error); return [] }
  const list = (near.data ?? []) as RequestNearby[]
  // Ses propres annonces ouvertes (lisibles par leur auteur) : montrées, marquees « mine », sans reponse possible.
  try {
    const rad = (x: number) => x * Math.PI / 180
    for (const r of (own.data ?? []) as any[]) {
      const dLat = rad(r.lat - lat), dLng = rad(r.lng - lng)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(r.lat)) * Math.sin(dLng / 2) ** 2
      const d = 2 * 6371000 * Math.asin(Math.sqrt(a))
      if (d <= radiusM && !list.some(x => x.id === r.id)) list.push({ ...r, urgent: !!r.urgent, distance_m: d, mine: true } as RequestNearby)
    }
    list.sort((x, y) => Number(!!y.urgent) - Number(!!x.urgent) || x.distance_m - y.distance_m)
  } catch { }
  return list
}

export async function fetchProvidersNearby(
  lat: number, lng: number, radiusM = 15000, trade?: string
): Promise<ProviderNearby[]> {
  const supabase = createClient()
  const args = { p_lat: lat, p_lng: lng, radius_m: radiusM, p_trade: trade ?? null }
  // Migration 064 : position floutée à ~50 m (providers_nearby_public). Avant elle, repli sur l'ancienne fonction,
  // fermée aux clients par la même migration.
  let { data, error } = await supabase.rpc('providers_nearby_public', args)
  if (error) ({ data, error } = await supabase.rpc('providers_nearby', args))
  if (error) { console.error('providers_nearby', error); return [] }
  return (data ?? []) as ProviderNearby[]
}

// Activités d'un ensemble de prestataires = métier principal (trade) + métiers de leurs prestations
// du catalogue `services` (/pro/tarifs). La RLS de `services` n'est pas décrite dans les migrations du
// dépôt : lecture directe (celle qu'utilise déjà la fiche publique /pro/[id]) ; une RPC plus stricte
// est proposée dans supabase/a_coller/provider_services_public.sql (non appliquée). Si rien n'est lisible,
// chaque prestataire garde au moins son métier principal.
export async function fetchProviderActivities(
  pros: { id: string; trade: string }[]
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const p of pros) out[p.id] = p.trade ? [p.trade] : []
  const ids = pros.map(p => p.id)
  if (!ids.length) return out
  const supabase = createClient()
  // Lecture directe de `services` (déjà utilisée par la fiche publique /pro/[id]).
  // Avec la migration 041 : métier explicite (`trade`) et prestations masquées ignorées ; sans elle,
  // repli sur le seul nom.
  let { data, error }: { data: any[] | null; error: any } = await supabase.from('services').select('provider_id, name, trade, hidden').in('provider_id', ids)
  if (error) ({ data, error } = await supabase.from('services').select('provider_id, name').in('provider_id', ids))
  if (error) return out
  const rows = (data ?? []) as { provider_id: string; name: string; trade?: string | null; hidden?: boolean }[]
  for (const r of rows) {
    if (r.hidden === true) continue
    const k = r.trade || tradeOfServiceName(r.name)
    const list = out[r.provider_id]
    if (k && list && !list.includes(k)) list.push(k)
  }
  return out
}

export async function fetchProDetail(proId: string) {
  const supabase = createClient()
  // Le nom passe par une fonction dediee, pas par un embed sur profiles :
  // profiles est en lecture strictement personnelle (auth.uid() = id), donc
  // l'embed renvoyait toujours null et la fiche s'affichait sans nom, en repli
  // sur le libelle du metier. provider_public_name ne sort que le nom affiche
  // et la teinte d'avatar d'un prestataire actif — ni telephone, ni adresse.
  // Fiche, nom, confiance et avis lus ensemble (audit 19/11, correction 3 : les avis attendaient la fin
  // des trois premières lectures, 1,9-2,9 s mesurées pour la fiche).
  // Correction 4 du 19/11 ter : prestations visibles et pièces contrôlées lues dans la même vague et
  // gardées avec la fiche, pour qu'une fiche préchargée s'affiche entière, sans seconde attente.
  const [{ data: pro }, { data: pub }, { data: trust }, { data: reviews }, prest, flags] = await Promise.all([
    supabase.from('provider_profiles').select('*').eq('id', proId).single(),
    supabase.rpc('provider_public_name', { provider_id: proId }),
    supabase.rpc('provider_trust_stats', { provider_id: proId }),
    supabase.from('reviews').select('*').eq('ratee_id', proId).order('created_at', { ascending: false }).limit(20),
    fetchPrestations(supabase, proId, { visibleOnly: true }).catch(() => null),
    fetchProviderFlags([proId]).catch(() => null),
  ])
  if (pro && pub && pub.length) (pro as any).profiles = pub[0]
  if (pro && trust && trust.length) Object.assign(pro as any, trust[0])
  // Les avis sont publics mais profiles ne l'est pas (RLS self-read) : l'ancien
  // embed profiles!reviews_rater_id_fkey ne renvoyait jamais de nom pour un
  // vrai avis d'un autre utilisateur — repli silencieux sur "Client".
  if (reviews?.length) {
    const { data: names } = await supabase.rpc('review_rater_names', { p_review_ids: reviews.map(r => r.id) })
    const byId: Record<string, string> = {}
    ;(names ?? []).forEach((n: any) => { if (n.first_name) byId[n.review_id] = n.first_name })
    reviews.forEach((r: any) => { r.profiles = { full_name: byId[r.id] || null } })
  }
  const out: ProDetail = {
    pro, reviews: reviews ?? [],
    // null : lecture en échec (la fiche garde alors ce qu'elle affichait).
    services: prest && !prest.error ? prest.rows : null,
    flags: flags ? (flags[proId] ?? {}) : null,
  }
  // Fiche publique : gardée le temps de l'onglet pour un affichage immédiat au prochain passage.
  if (pro) writeScreenCache(`pro_${proId}`, 'pub', out)
  return out
}
export type ProDetail = { pro: any; reviews: any[]; services: Prestation[] | null; flags: ProviderFlags | null }

// Dernière fiche connue (affichée pendant la relecture) et préchargement depuis la carte (aperçu ouvert,
// ou premières lignes de la liste). Une lecture déjà en cours est partagée : la fiche ouverte pendant un
// préchargement attend celui-ci au lieu de tout relire.
export const readProDetailCache = (proId: string) => readScreenCache<ProDetail>(`pro_${proId}`, 'pub')
const inflight = new Map<string, Promise<ProDetail>>()
export function loadProDetail(proId: string): Promise<ProDetail> {
  const cur = inflight.get(proId)
  if (cur) return cur
  const p = fetchProDetail(proId).finally(() => inflight.delete(proId))
  inflight.set(proId, p)
  return p
}
export function prefetchProDetail(proId: string) {
  if (!proId || inflight.has(proId) || readProDetailCache(proId)) return
  loadProDetail(proId).catch(() => { })
}

// Ouvre (ou reutilise) une conversation avec un prestataire pour entrer
// directement dans le chat — pas de devis. Cree une requete + une transaction
// 'pending' au prix de base du pro ; le prix definitif se negocie ensuite dans
// le chat (mecanisme d'offre) et se fige au scan de sortie. Reutilise une
// conversation existante encore en negociation (pending, prix non confirme)
// pour ne pas empiler une transaction a chaque clic sur "Contacter".
// `devis` : demande de devis pour une prestation précise du catalogue (« sur devis » sur la fiche ou
// dans mission/new). La demande porte alors le métier et le nom de la prestation, et la conversation
// part sans prix (0 €) : c'est le prestataire qui chiffre avec « + Proposer un tarif ».
export async function openConversation(
  proId: string,
  devis?: { name: string; trade?: string | null },
): Promise<{ missionId: string | null; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { missionId: null, error: 'not_authenticated' }
  // Un compte ne contracte jamais avec lui-même (contrainte transactions_buyer_ne_seller).
  if (user.id === proId) return { missionId: null, error: 'own_profile' }

  // Deja une conversation en cours de negociation avec ce pro ? On ne reprend
  // qu'une conversation NON confirmee : une mission deja reservee / au prix
  // fige se retrouve par l'Agenda ou Messages, et un nouveau « Contacter »
  // ouvre une nouvelle conversation pour un nouveau besoin (lot 16 : avant,
  // « Contacter » rouvrait la mission reservee, voire une mission en cours).
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('seller_id', proId)
    .eq('status', 'pending')
    .eq('price_confirmed', false)
    .order('created_at', { ascending: false })
    .limit(1)
  if (existing && existing.length) return { missionId: existing[0].id }

  const { data: pro } = await supabase
    .from('provider_profiles')
    .select('trade, base_price_cents, hourly_rate_cents, pricing_type, included_hours')
    .eq('id', proId).single()
  if (!pro) return { missionId: null, error: 'pro_not_found' }

  // Prix indicatif de départ (le vrai se fixe dans le chat) ; base à 0 pour un pro horaire = pas de
  // prix, on prend alors son tarif horaire. Taux de commission : réglage courant (pas 5 %/11 % figés).
  const subtotal = devis ? 0 : (pro.base_price_cents ?? 0) > 0 ? pro.base_price_cents : (pro.hourly_rate_cents ?? 0)
  const rates = await getRates()
  const buyerFee = Math.round(subtotal * rates.buyer)
  const sellerFee = Math.round(subtotal * rates.seller)
  const hasOvertime = !devis && pro.pricing_type === 'forfait' && pro.included_hours != null && pro.hourly_rate_cents != null

  // description est NOT NULL en base (aucun defaut) : sans elle cet insert
  // echouait silencieusement a chaque "Contacter" depuis la carte/fiche pro —
  // trouve en executant reellement le scenario, pas juste en relisant le code.
  const { data: req, error: reqErr } = await supabase.from('requests').insert({
    requester_id: user.id, category: devis?.trade || pro.trade,
    description: devis ? `Demande de devis : ${devis.name}` : '', status: 'matched',
  }).select().single()
  if (!req) return { missionId: null, error: reqErr?.message || 'request_failed' }

  const { data: tx } = await supabase.from('transactions').insert({
    kind: 'service', buyer_id: user.id, seller_id: proId, request_id: req.id,
    subtotal_cents: subtotal, buyer_fee_cents: buyerFee, seller_fee_cents: sellerFee,
    total_charged_cents: subtotal + buyerFee, payout_cents: subtotal - sellerFee,
    hourly_rate_cents: !devis && (pro.pricing_type === 'horaire' || hasOvertime) ? pro.hourly_rate_cents : null,
    included_hours: hasOvertime ? pro.included_hours : null,
    base_forfait_cents: hasOvertime ? pro.base_price_cents : null,
    status: 'pending',
  }).select().single()
  if (!tx) return { missionId: null, error: 'tx_failed' }

  return { missionId: tx.id }
}

// Symetrique cote pro : repondre a une demande deja postee par un client
// (carte pro /pro/carte). La RLS de `transactions` n'autorise que le buyer a
// inserer une ligne, donc ca passe par une fonction serveur dediee
// (provider_respond_to_request) plutot que par un insert direct comme
// openConversation ci-dessus.
export async function respondToRequest(requestId: string): Promise<{ missionId: string | null; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { missionId: null, error: 'not_authenticated' }

  const { data, error } = await supabase.rpc('provider_respond_to_request', { p_request_id: requestId })
  if (error) return { missionId: null, error: error.message }
  return { missionId: data as string }
}

// Indicateurs de confiance et de paiement d'un ensemble de prestataires (18/11/2026, migrations 039 et 042) :
//   cesu    — le prestataire a indiqué accepter le CESU préfinancé (provider_profiles.accepts_cesu_prefinance)
//   checked — sa pièce d'identité a été validée par un admin PING et n'est pas expirée
//             (RPC provider_docs_status de la 042, sinon provider_docs_checked de la 039)
//   rcproChecked — son attestation d'assurance RC a été contrôlée par PING (042 seulement)
// Avant les migrations, colonne et RPC n'existent pas : on renvoie undefined, rien ne s'affiche.
export type ProviderFlags = { cesu?: boolean; checked?: boolean; rcproChecked?: boolean; vat?: 'franchise' | 'assujetti'; sap?: boolean }
export async function fetchProviderFlags(ids: string[]): Promise<Record<string, ProviderFlags>> {
  const out: Record<string, ProviderFlags> = {}
  const uniq = Array.from(new Set(ids)).filter(Boolean)
  if (!uniq.length) return out
  const supabase = createClient()
  const [cesu0, status] = await Promise.all([
    // Résumé de carte (bloc de repères) : CESU, régime de TVA et n° SAP (crédit d'impôt), déclaratifs.
    // Même lecture directe que la fiche ; sans ces colonnes, repli sur le seul CESU.
    supabase.from('provider_profiles').select('id, accepts_cesu_prefinance, vat_status, sap_number').in('id', uniq),
    supabase.rpc('provider_docs_status', { p_ids: uniq }),
  ])
  let cesu: { data: any[] | null; error: any } = cesu0
  if (cesu.error) cesu = await supabase.from('provider_profiles').select('id, accepts_cesu_prefinance').in('id', uniq)
  if (!cesu.error) for (const r of (cesu.data ?? []) as any[]) {
    const f = (out[r.id] ||= {})
    f.cesu = !!r.accepts_cesu_prefinance
    if (r.vat_status === 'franchise' || r.vat_status === 'assujetti') f.vat = r.vat_status
    if ('sap_number' in r) f.sap = !!r.sap_number
  }
  if (!status.error) {
    for (const r of (status.data ?? []) as any[]) {
      const f = (out[r.provider_id] ||= {})
      f.checked = !!r.identity_checked
      f.rcproChecked = !!r.rcpro_checked
    }
    return out
  }
  const docs = await supabase.rpc('provider_docs_checked', { p_ids: uniq })
  if (!docs.error) for (const r of (docs.data ?? []) as any[]) (out[r.provider_id] ||= {}).checked = !!r.docs_checked
  return out
}
