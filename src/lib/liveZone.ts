import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

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

/** Position de l'appareil, une seule fois, à la demande du prestataire (après son consentement). */
export function devicePosition(timeoutMs = 12000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('Position indisponible sur cet appareil.')); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Position refusée ou indisponible. Autorisez la localisation dans votre navigateur, puis réessayez.')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 })
  })
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
