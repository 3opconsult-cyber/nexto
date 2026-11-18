"use client"
import { createClient } from '@/lib/supabase/client'
import { fetchRequestsNearby, type RequestNearby } from '@/lib/services'
import { tradeOfServiceName } from '@/lib/trades'
import { geoPermission, readPositionOnce, readSavedLocation, type Point } from '@/lib/location'

// Demandes autour d'un prestataire : une seule règle pour la carte (/pro/carte) et le compteur du
// tableau de bord (audit ergonomie 18/11 : le tableau de bord disait 5-6, la carte en montrait 3).
// Même centre, même rayon (zone couverte), même filtre de métiers.

type Sb = ReturnType<typeof createClient>

/** Rayon de la zone couverte (km) : celui du profil, plafonné à 50, 25 par défaut. */
export function proRadiusKm(serviceRadiusKm?: number | null) {
  return serviceRadiusKm ? Math.min(50, serviceRadiusKm) : 25
}

/** Métiers du prestataire : métier principal + métiers de ses prestations (/pro/tarifs). */
export async function fetchProTrades(supabase: Sb, proId: string, trade?: string | null): Promise<string[]> {
  const t: string[] = trade ? [trade] : []
  const { data: svc } = await supabase.from('services').select('name').eq('provider_id', proId)
  for (const r of (svc ?? []) as { name: string }[]) {
    const k = tradeOfServiceName(r.name)
    if (k && !t.includes(k)) t.push(k)
  }
  return t
}

/** Filtre par défaut de la carte : ses propres annonces, sinon ses métiers (tout si aucun métier connu). */
export function proRequestMatches(r: RequestNearby, myTrades: string[], activeTrades: string[] = myTrades, showOthers = false) {
  return !!r.mine || myTrades.length === 0
    || activeTrades.includes(r.category) || (showOthers && !myTrades.includes(r.category))
}

/**
 * Centre de la carte pro sans rien demander : ville choisie sur l'appareil, sinon la position si
 * elle est déjà autorisée, sinon la position déclarée du prestataire (comme useInitialPosition).
 */
export async function proCenterQuiet(pro: { lat?: number | null; lng?: number | null }): Promise<Point | null> {
  const saved = readSavedLocation()
  if (saved?.kind === 'city') return { lat: saved.lat, lng: saved.lng }
  try {
    const st = await geoPermission()
    if (st === 'granted') return await readPositionOnce(5000)
  } catch { }
  return pro.lat != null && pro.lng != null ? { lat: pro.lat, lng: pro.lng } : null
}

/** Nombre de demandes que la carte montre par défaut ; null si aucune position n'est connue. */
export async function countProNearby(pro: { id: string; lat?: number | null; lng?: number | null; trade?: string | null; service_radius_km?: number | null }): Promise<number | null> {
  const c = await proCenterQuiet(pro)
  if (!c) return null
  const supabase = createClient()
  const [list, trades] = await Promise.all([
    fetchRequestsNearby(c.lat, c.lng, proRadiusKm(pro.service_radius_km) * 1000),
    fetchProTrades(supabase, pro.id, pro.trade),
  ])
  return list.filter(r => proRequestMatches(r, trades)).length
}
