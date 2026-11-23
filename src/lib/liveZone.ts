import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isNetworkMessage } from '@/lib/netError'
import { ZONE_ATTEMPTS, geoMessage, isGeoFail, readPositionOnce } from '@/lib/position'

// Position d'intervention « Je suis en intervention ici (visible aujourd'hui) » — décision Romain 20/11/2026, migration 058.
// Le prestataire reste visible à son domicile ET, s'il le choisit, à l'endroit où il intervient. Règle « pas de GPS » levée
// pour cette seule option volontaire : consentement enregistré, position arrondie à ~2 km PAR LA BASE (la position
// exacte n'est jamais stockée), 12 h au plus, arrêt à tout moment ou à la fin de la mission, jamais l'adresse du client.
// Avant la migration, la table et les RPC n'existent pas : l'option n'apparaît pas et la carte reste inchangée.

export const LIVE_ZONE_HOURS = 12

export type LiveZone = {
  lat: number; lng: number; label: string | null
  started_at: string; expires_at: string; ended_at: string | null; source: 'manual' | 'mission'
}
export type LiveZoneState = { available: boolean; consent: boolean; zone: LiveZone | null }

/** Zone publique (version floutée) renvoyée par providers_live_zones. */
export type LiveZonePin = {
  provider_id: string; lat: number; lng: number; label: string | null
  started_at: string; expires_at: string; distance_m: number
  trade: string | null; full_name: string | null; avatar_hue: number | null
}

export const zoneActive = (z: LiveZone | null | undefined, now = Date.now()) =>
  !!z && !z.ended_at && new Date(z.expires_at).getTime() > now

export async function fetchLiveZoneState(supabase: SupabaseClient, uid: string): Promise<LiveZoneState> {
  const none: LiveZoneState = { available: false, consent: false, zone: null }
  const [z, c] = await Promise.all([
    supabase.from('provider_live_zone').select('lat, lng, label, started_at, expires_at, ended_at, source').eq('provider_id', uid).maybeSingle(),
    supabase.from('provider_private').select('live_zone_consent_at').eq('id', uid).maybeSingle(),
  ])
  // Table ou colonne absente (migration 058 non collée), ou toute autre erreur de lecture : l'option n'est pas proposée.
  if (z.error || c.error) return none
  return { available: true, consent: !!(c.data as any)?.live_zone_consent_at, zone: (z.data as LiveZone | null) ?? null }
}

export async function setLiveZoneConsent(supabase: SupabaseClient, accept: boolean): Promise<string | null> {
  const { error } = await supabase.rpc('set_live_zone_consent', { p_accept: accept })
  return error ? error.message : null
}

export async function startLiveZone(supabase: SupabaseClient, a: { lat: number; lng: number; label?: string | null; transactionId?: string | null }):
  Promise<{ zone?: { lat: number; lng: number; label: string | null; expires_at: string }; error?: string }> {
  const { data, error } = await supabase.rpc('set_live_zone', {
    p_lat: a.lat, p_lng: a.lng, p_label: a.label ?? null,
    p_source: a.transactionId ? 'mission' : 'manual', p_transaction_id: a.transactionId ?? null,
  })
  if (error) return { error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  return { zone: row }
}

export async function stopLiveZone(supabase: SupabaseClient): Promise<string | null> {
  const { error } = await supabase.rpc('clear_live_zone')
  return error ? error.message : null
}

// « Arrêter » sans réseau (audit 23/11, correction 5) : la demande d'arrêt est gardée sur le téléphone et rejouée
// au retour de la connexion (renvoi automatique toutes les 15 s tant qu'elle attend). Jusque-là, la zone reste visible
// des clients : l'écran le dit. Le renvoi n'agit que pour le compte qui a demandé l'arrêt, et expire au bout de 12 h
// (durée maximale d'une zone).
const ZONE_STOP_KEY = 'ping_zone_stop_pending'
export const ZONE_STOP_EVENT = 'ping:zone-stop'

type PendingStop = { uid: string; at: number }

export function pendingZoneStop(uid?: string | null, now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(ZONE_STOP_KEY)
    if (!raw) return false
    const p = JSON.parse(raw) as PendingStop
    if (now - p.at > LIVE_ZONE_HOURS * 3600 * 1000) { localStorage.removeItem(ZONE_STOP_KEY); return false }
    return !uid || p.uid === uid
  } catch { return false }
}
function setPendingZoneStop(uid: string | null) {
  try {
    if (uid) localStorage.setItem(ZONE_STOP_KEY, JSON.stringify({ uid, at: Date.now() } satisfies PendingStop))
    else localStorage.removeItem(ZONE_STOP_KEY)
    window.dispatchEvent(new CustomEvent(ZONE_STOP_EVENT))
  } catch { /* stockage indisponible : l'arrêt reste à refaire à la main */ }
}
/** Un nouvel « Activer » annule un arrêt resté en attente. */
export const cancelPendingZoneStop = () => setPendingZoneStop(null)

/** Arrête la zone ; sans réseau, met l'arrêt en attente. 'queued' : en attente ; sinon texte d'erreur ou null (arrêtée). */
export async function stopLiveZoneOrQueue(supabase: SupabaseClient, uid: string): Promise<'queued' | string | null> {
  const e = await stopLiveZone(supabase)
  if (!e) { setPendingZoneStop(null); return null }
  if (isNetworkMessage(e)) { setPendingZoneStop(uid); return 'queued' }
  return e
}

/** Rejoue l'arrêt en attente du compte connecté. Renvoie true si la zone est arrêtée. */
export async function flushZoneStop(supabase: SupabaseClient, uid: string): Promise<boolean> {
  if (!pendingZoneStop(uid)) return false
  const e = await stopLiveZone(supabase)
  if (e) return false
  setPendingZoneStop(null)
  return true
}

/** Mission en cours du prestataire (arrivée posée, pas terminée) : la zone s'arrête avec elle. */
export async function currentMissionId(supabase: SupabaseClient, uid: string): Promise<string | null> {
  const { data } = await supabase.from('transactions').select('id').eq('seller_id', uid).eq('status', 'arrived').limit(1)
  return (data as { id: string }[] | null)?.[0]?.id ?? null
}

/** Secteur (ville ou quartier) d'une position : la requête part arrondie au km, jamais la position exacte. */
export async function sectorLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const q = (n: number) => n.toFixed(2)
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=13&lat=${q(lat)}&lon=${q(lng)}`, { headers: { 'Accept-Language': 'fr' } })
    if (!res.ok) return null
    const a = (await res.json())?.address || {}
    return a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city || null
  } catch { return null }
}

/**
 * Position de l'appareil, une seule fois, à la demande du prestataire (après son consentement) : basse précision
 * (cache de 60 s), puis haute précision en repli. Lève une Error dont le texte dit la cause (refus, délai,
 * indisponible) et où réactiver la localisation ; `reason` porte la cause.
 */
export async function devicePosition(): Promise<{ lat: number; lng: number }> {
  const r = await readPositionOnce(ZONE_ATTEMPTS)
  if (isGeoFail(r)) throw Object.assign(new Error(geoMessage(r.reason)), { reason: r.reason })
  return { lat: r.lat, lng: r.lng }
}

/** Zones d'intervention visibles autour d'un point (carte client). Tableau vide si la migration 058 n'est pas collée. */
export async function fetchLiveZones(lat: number, lng: number, radiusM = 15000, trade?: string): Promise<LiveZonePin[]> {
  try {
    const { data, error } = await createClient().rpc('providers_live_zones', { p_lat: lat, p_lng: lng, radius_m: radiusM, p_trade: trade ?? null })
    if (error) return []
    return (data ?? []) as LiveZonePin[]
  } catch { return [] }
}

export function untilText(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
