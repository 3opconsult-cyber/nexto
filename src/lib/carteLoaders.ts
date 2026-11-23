"use client"
import type { SupabaseClient } from '@supabase/supabase-js'
import { readScreenCache, writeScreenCache } from '@/lib/screenCache'
import { bookingLive } from '@/lib/booking'
import {
  fetchProvidersNearby, fetchProviderActivities, fetchProviderFlags, fetchRequestsNearby,
  type ProviderNearby, type ProviderFlags, type RequestNearby,
} from '@/lib/services'
import { fetchProTrades, proCenterQuiet, proRadiusKm } from '@/lib/proNearby'
import { fetchProfileCenter, geoPermission, readPositionOnce, readSavedLocation, type Point } from '@/lib/location'

// Listes des deux cartes (/pro/carte et /map), partagées entre l'écran et la connexion (audit ergonomie
// 19/11 ter, correction 2) : dès la connexion réussie, la liste de l'espace d'arrivée est lue et gardée
// dans le cache de l'onglet (sessionStorage, lié au compte, src/lib/screenCache.ts). La carte l'affiche
// à l'ouverture puis relit comme avant. Aucune donnée en plus : les mêmes lectures, sous la RLS du compte
// (requests_nearby ne renvoie jamais l'adresse exacte). Jamais de fenêtre de localisation ici : la
// position n'est relue que si elle est déjà autorisée, sinon la ville choisie ou l'adresse du profil.

/** Repli de position (Grasse), le même pour les deux cartes. */
export const FALLBACK_POS: Point = { lat: 43.6584, lng: 6.9225 }
export const isFallbackPos = (p: Point | null | undefined) => !!p && p.lat === FALLBACK_POS.lat && p.lng === FALLBACK_POS.lng

// ---- Carte du prestataire (/pro/carte) ----
export const PRO_CARTE_CACHE = 'pro_carte'
export type CarteCache = {
  reqs: RequestNearby[]; radiusKm: number; center: Point | null
  trades: string[]; available: boolean; missions: any[]; sent: any[]; done: any[]
}

/** Interventions confirmées (vue « Mes interventions »). */
export async function fetchCarteMissions(supabase: SupabaseClient, uid: string): Promise<any[]> {
  const { data } = await supabase.from('transactions')
    // « * » : booking_status / accept_deadline (052) arrivent seuls une fois la migration collée.
    .select('*, requests(category, title, address, lat, lng)')
    .eq('seller_id', uid).eq('price_confirmed', true).in('status', ['pending', 'arrived'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
  // Réservation refusée, expirée ou au délai de réponse dépassé : jamais dans les interventions à venir.
  return (data ?? []).filter((t: any) => bookingLive(t))
}
/** Propositions envoyées sur une demande encore ouverte (lot 16). */
export async function fetchCarteSent(supabase: SupabaseClient, uid: string): Promise<any[]> {
  const { data } = await supabase.from('transactions')
    .select('id, created_at, request_id, requests(id, title, category, status)')
    .eq('seller_id', uid).eq('price_confirmed', false).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(30)
  return (data ?? []).filter((t: any) => t.request_id && t.requests?.status === 'open')
}
/** Missions terminées, sous les à-venir. */
export async function fetchCarteDone(supabase: SupabaseClient, uid: string): Promise<any[]> {
  const { data } = await supabase.from('transactions')
    .select('id, status, scheduled_at, created_at, completed_at, subtotal_cents, requests(category, title)')
    .eq('seller_id', uid).eq('status', 'completed')
    .order('created_at', { ascending: false }).limit(20)
  return data ?? []
}

/** Demandes autour du prestataire + compteurs de la carte, mis en cache. null : pas de fiche prestataire. */
export async function warmProCarte(supabase: SupabaseClient, uid: string): Promise<CarteCache | null> {
  const { data: pp } = await supabase.from('provider_profiles')
    .select('id, is_active, service_radius_km, trade, lat, lng').eq('id', uid).maybeSingle()
  if (!pp) return null
  const radiusKm = proRadiusKm(pp.service_radius_km)
  const center = (await proCenterQuiet(pp).catch(() => null)) || FALLBACK_POS
  const [reqs, trades, missions, sent, done] = await Promise.all([
    fetchRequestsNearby(center.lat, center.lng, radiusKm * 1000),
    fetchProTrades(supabase, uid, pp.trade).catch(() => [] as string[]),
    fetchCarteMissions(supabase, uid).catch(() => []),
    fetchCarteSent(supabase, uid).catch(() => []),
    fetchCarteDone(supabase, uid).catch(() => []),
  ])
  const snap: CarteCache = { reqs, radiusKm, center, trades, available: !!pp.is_active, missions, sent, done }
  writeScreenCache(PRO_CARTE_CACHE, uid, snap)
  return snap
}

// ---- Carte du particulier (/map) ----
export const MAP_CACHE = 'map_pros'
export type MapCache = { center: Point; list: ProviderNearby[]; acts: Record<string, string[]>; flags: Record<string, ProviderFlags> }
export const readMapCache = (uid: string | null) => readScreenCache<MapCache>(MAP_CACHE, uid)

/** Prestataires autour d'un point, avec leurs activités et pièces ; mis en cache si `uid` est donné. */
export const MAP_RADIUS_M = 15000
/** Rayons essayés, dans l'ordre, quand personne n'est dans le rayon habituel (la carte ne reste jamais vide). */
export const MAP_WIDER_RADII_M = [30000, 60000]
export async function loadMapPros(center: Point, uid: string | null, radiusM = MAP_RADIUS_M): Promise<MapCache> {
  const list = await fetchProvidersNearby(center.lat, center.lng, radiusM)
  const [acts, flags] = await Promise.all([
    fetchProviderActivities(list).catch(() => ({} as Record<string, string[]>)),
    fetchProviderFlags(list.map(p => p.id)).catch(() => ({} as Record<string, ProviderFlags>)),
  ])
  const snap: MapCache = { center, list, acts, flags }
  if (uid) writeScreenCache(MAP_CACHE, uid, snap)
  return snap
}

/** Centre de /map sans rien demander (même ordre que useInitialPosition, sans jamais ouvrir de fenêtre). */
async function clientCenterQuiet(): Promise<Point> {
  const saved = readSavedLocation()
  if (saved?.kind === 'city') return { lat: saved.lat, lng: saved.lng }
  try {
    if (await geoPermission() === 'granted') return await readPositionOnce(5000)
  } catch { /* position indisponible : adresse du profil */ }
  const c = await fetchProfileCenter('client')
  return c?.point || FALLBACK_POS
}

export async function warmClientMap(uid: string): Promise<MapCache> {
  return loadMapPros(await clientCenterQuiet(), uid)
}
