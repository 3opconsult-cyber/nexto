import type { SupabaseClient } from '@supabase/supabase-js'

// Arrivée et départ sécurisés (migration 038). Toute validation passe par une RPC SECURITY DEFINER qui exige une
// preuve du client : QR / code à 6 chiffres affichés chez lui, ou, client absent, sa confirmation en un appui
// (ou le code qu'il dicte) après la demande à distance du prestataire.
// Tant que la migration n'est pas appliquée, `presenceAvailable()` renvoie false et l'application retombe sur
// l'ancien fonctionnement (jetons de la mission, scan direct, voie « client absent » de la migration 033).

export type Phase = 'arrivee' | 'fin'
export type Proof = 'qr' | 'code' | 'qr_sur_place' | 'distance_code' | 'distance_confirmation' | 'admin' | 'photo_gps'

export type PresenceResult = {
  ok: boolean; already?: boolean; reason?: string; message?: string; remaining?: number
  at?: string; warning?: string | null; duration_minutes?: number | null; billed_hours?: number | null; subtotal_cents?: number | null
}

export type Amounts = {
  duration_minutes: number; recalcule: boolean; threshold: number; billed_hours?: number
  subtotal_cents: number | null; buyer_fee_cents: number | null; seller_fee_cents: number | null
  total_charged_cents: number | null; payout_cents: number | null
}

export type RemoteRequest = {
  etat: 'en_attente' | 'validee' | 'refusee' | 'expiree'
  requested_at: string; code_expires_at: string; confirm_until: string
  geo_status: 'conforme' | 'non_verifiable' | null; distance_m: number | null
  code: string | null; preview: Amounts | null
}

export type PresenceState = {
  v: number; role: 'prestataire' | 'client' | 'admin'
  phase: 'annulee' | 'terminee' | 'en_cours' | 'en_route' | 'avant'
  scheduled_at: string | null; en_route_at: string | null; arrived_at: string | null; completed_at: string | null
  arrival_proof: Proof | null; completion_proof: Proof | null
  remote: Partial<Record<Phase, RemoteRequest>>
  window: { arrivee: { ok: boolean; reason?: string; message?: string; warning?: string } | null; fin: { ok: boolean; reason?: string; message?: string; warning?: string } | null }
  preview_now: Amounts | null
}

export type MissionProof = { phase: Phase; token?: string; code?: string; expires_at?: string; done?: boolean; ready?: boolean }

// Fonction absente (migration pas encore appliquée) : PostgREST répond PGRST202, Postgres 42883.
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || '')
}

let available: Promise<boolean> | null = null

/** La migration 038 est-elle en base ? (mémorisé pour la session de la page ; un échec réseau n'est pas mémorisé). */
export function presenceAvailable(supabase: SupabaseClient): Promise<boolean> {
  if (available) return available
  available = (async () => {
    // Appel sans effet : un identifiant nul ne correspond à aucune mission (« Mission introuvable »).
    const { error } = await supabase.rpc('presence_state', { p_transaction: '00000000-0000-0000-0000-000000000000' })
    if (!error) return true
    if (isMissingFunction(error)) return false
    if (/introuvable|connexion requise/i.test(error.message || '')) return true
    available = null
    return false
  })()
  return available
}

export async function getPresenceState(supabase: SupabaseClient, txId: string): Promise<PresenceState | null> {
  const { data, error } = await supabase.rpc('presence_state', { p_transaction: txId })
  if (error || !data) return null
  return data as PresenceState
}

export async function getMissionProof(supabase: SupabaseClient, txId: string, phase?: Phase): Promise<{ proof: MissionProof | null; error?: string }> {
  const { data, error } = await supabase.rpc('get_mission_proof', { p_transaction: txId, p_phase: phase ?? null })
  if (error) return { proof: null, error: error.message }
  return { proof: data as MissionProof }
}

export async function validatePresence(supabase: SupabaseClient, txId: string, phase: Phase, proof: string): Promise<PresenceResult> {
  const { data, error } = await supabase.rpc('validate_presence', { p_transaction: txId, p_phase: phase, p_proof: proof })
  if (error) return { ok: false, reason: isMissingFunction(error) ? 'unavailable' : 'error', message: error.message }
  return data as PresenceResult
}

export async function clientConfirmPresence(supabase: SupabaseClient, txId: string, phase: Phase): Promise<PresenceResult> {
  const { data, error } = await supabase.rpc('client_confirm_presence', { p_transaction: txId, p_phase: phase })
  if (error) return { ok: false, reason: 'error', message: error.message }
  return data as PresenceResult
}

export async function clientDeclinePresence(supabase: SupabaseClient, txId: string, phase: Phase): Promise<PresenceResult> {
  const { data, error } = await supabase.rpc('client_decline_presence', { p_transaction: txId, p_phase: phase })
  if (error) return { ok: false, reason: 'error', message: error.message }
  return data as PresenceResult
}

export type RemoteRequestResult =
  | { ok: true; geo: 'conforme' | 'non_verifiable'; expiresAt: string; confirmUntil?: string }
  | { ok: false; error: string; message: string; distanceM?: number }

/** Client absent : le prestataire (consentement donné) envoie sa position ; /api/arrival compare et prévient le client. */
export async function requestRemotePresence(
  txId: string, phase: Phase, pos: { lat: number; lng: number; accuracyM?: number | null },
): Promise<RemoteRequestResult> {
  try {
    const r = await fetch('/api/arrival', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId, phase, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracyM ?? null, consent: true }),
    })
    return await r.json()
  } catch {
    return { ok: false, error: 'server', message: 'Réseau indisponible, réessayez.' }
  }
}

/** Position unique, après consentement (jamais de suivi). */
export function getPositionOnce(timeoutMs = 10000): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs },
    )
  })
}

// Libellés (facture, récapitulatif, frise). Ancien arrival_method (033) accepté en repli.
export function proofLabel(p: string | null | undefined): string | null {
  switch (p) {
    case 'qr': case 'qr_client': return 'QR du client scanné sur place'
    case 'code': return 'code du client saisi sur place'
    case 'qr_sur_place': return 'QR laissé sur place par le client'
    case 'distance_code': case 'geoloc_code': return 'client absent, code de confirmation du client'
    case 'distance_confirmation': return 'client absent, confirmé par le client à distance'
    case 'admin': return 'heure fixée par PING'
    case 'photo_gps': return 'photo et position du prestataire (ancien mode)'
    default: return null
  }
}

/** Phrase de la facture : « 10:02 — 12:14, arrivée : QR…, fin : confirmée… ». */
export function presenceSentence(arrivee?: string | null, depart?: string | null, pa?: string | null, pd?: string | null): string | null {
  if (!arrivee || !depart) return null
  const a = proofLabel(pa), d = proofLabel(pd)
  if (!a && !d) return `${arrivee} — ${depart}, horodatés dans l'application`
  if (a && d && a === d) return `${arrivee} — ${depart}, ${a}`
  return `${arrivee} — ${depart} (arrivée : ${a || 'horodatée'} ; fin : ${d || 'horodatée'})`
}

export const PRESENCE_WARNING: Record<string, string> = {
  en_avance: 'Plus de 30 min avant l’heure du rendez-vous.',
  en_retard: 'Plus de 3 h après l’heure du rendez-vous.',
  sans_rdv: 'Aucune heure de rendez-vous n’a été fixée.',
  tres_court: 'Moins de 5 min sur place.',
  tres_long: 'Plus de 12 h sur place.',
}

export const durLabel = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Extrait la preuve d'un QR scanné : URL /mission/<id>/scan/<phase>?token=… ou jeton brut. */
export function parseScanned(raw: string): { txId?: string; phase?: string; token: string } {
  const s = raw.trim()
  try {
    const u = new URL(s)
    const m = u.pathname.match(/\/mission\/([0-9a-f-]{36})\/scan\/([a-z]+)/i)
    return { txId: m?.[1], phase: m?.[2], token: u.searchParams.get('token') || '' }
  } catch {
    return { token: s }
  }
}
