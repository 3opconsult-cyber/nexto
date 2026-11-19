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
  // Migration 048 : photo d'arrivée (client absent) et code envoyé par le client.
  photo_path?: string | null; code_sent_at?: string | null
}

export type ClientPresence = 'sur_place' | 'absent'

export type PresenceState = {
  v: number; role: 'prestataire' | 'client' | 'admin'
  phase: 'annulee' | 'terminee' | 'en_cours' | 'en_route' | 'avant'
  scheduled_at: string | null; en_route_at: string | null; arrived_at: string | null; completed_at: string | null
  arrival_proof: Proof | null; completion_proof: Proof | null
  remote: Partial<Record<Phase, RemoteRequest>>
  window: { arrivee: { ok: boolean; reason?: string; message?: string; warning?: string } | null; fin: { ok: boolean; reason?: string; message?: string; warning?: string } | null }
  preview_now: Amounts | null
  // Migration 048 (v >= 48).
  client_presence?: ClientPresence | null; client_presence_at?: string | null; arrival_photo_path?: string | null
}

/** Process de commande (migration 048) : présence annoncée, photo d'arrivée, codes envoyés par le client. */
export const hasProcess = (st: PresenceState | null | undefined): boolean => !!st && Number(st.v) >= 48

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
    // Colonne posée par la même migration que les fonctions (038). L'ancienne sonde (presence_state sur un
    // identifiant nul) répondait toujours 400 « Mission introuvable » : une erreur réseau dans la console à
    // chaque page (barre du bas, chat, agenda), relevée par le parcours e2e du 19/11.
    const { error } = await supabase.from('transactions').select('completion_proof').limit(1)
    if (!error) return true
    if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(error.message || '')) return false
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
  | { ok: true; geo: 'conforme' | 'non_verifiable'; expiresAt: string; confirmUntil?: string; distanceM?: number | null }
  | { ok: false; error: string; message: string; distanceM?: number }

/**
 * Client absent : le prestataire (consentement donné) envoie sa position ; /api/arrival compare et prévient le client.
 * Migration 048 : `photoPath` (photo prise sur place, obligatoire à l'arrivée) part avec, dans un seul message.
 */
export async function requestRemotePresence(
  txId: string, phase: Phase, pos: { lat: number; lng: number; accuracyM?: number | null }, photoPath?: string | null,
): Promise<RemoteRequestResult> {
  try {
    const r = await fetch('/api/arrival', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId, phase, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracyM ?? null, consent: true, photoPath: photoPath ?? null }),
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

// Libellés (facture, récapitulatif, frise). Ancien arrival_method (033) accepté en repli. La phase précise le mode
// réel à distance (048) : photo et position à l'arrivée, code de fin envoyé par le client à la fin.
export function proofLabel(p: string | null | undefined, phase?: Phase): string | null {
  switch (p) {
    case 'qr': case 'qr_client': return 'QR du client scanné sur place'
    case 'code': return 'code du client saisi sur place'
    case 'qr_sur_place': return 'QR laissé sur place par le client'
    case 'distance_code': case 'geoloc_code':
      return phase === 'fin' ? 'client absent, code de fin envoyé par le client et saisi par le prestataire'
        : 'client absent, code de validation du client'
    case 'distance_confirmation':
      return phase === 'fin' ? 'client absent, fin confirmée par le client' : 'client absent, arrivée confirmée par le client'
    case 'admin': return 'heure fixée par PING'
    case 'photo_gps': return 'photo et position du prestataire (ancien mode)'
    default: return null
  }
}

/** Phrase de la facture : « 10:02 — 12:14, arrivée : QR…, fin : confirmée… ». */
export function presenceSentence(arrivee?: string | null, depart?: string | null, pa?: string | null, pd?: string | null, photo?: boolean | null): string | null {
  if (!arrivee || !depart) return null
  let a = proofLabel(pa, 'arrivee')
  const d = proofLabel(pd, 'fin')
  // Migration 048 : photo d'arrivée envoyée dans la messagerie (client absent).
  if (photo && a?.startsWith('client absent, ')) a = a.replace('client absent, ', 'client absent, photo et position envoyées, ')
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

/**
 * Heures facturées d'un aperçu de fin, au bon sens : pour un forfait avec heures incluses, `billed_hours` compte
 * les heures AU-DELÀ du forfait (le parcours e2e du 19/11 affichait « → 0 h facturée, 90,00 € » pour un forfait).
 * Renvoie le fragment à placer après la durée (« → 2 h facturées », « forfait, sans dépassement »…), ou ''.
 */
export function billedLabel(a: Pick<Amounts, 'recalcule' | 'billed_hours'> | null | undefined, forfait: boolean): string {
  if (!a) return ''
  if (!a.recalcule || a.billed_hours == null) return forfait ? ' (forfait, prix inchangé)' : ''
  const n = Number(a.billed_hours)
  const h = `${String(a.billed_hours).replace('.', ',')} h`
  if (forfait) return n > 0 ? ` → forfait + ${h} au-delà des heures incluses` : ' → forfait, sans dépassement'
  return ` → ${h} facturée${n > 1 ? 's' : ''}`
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

// ---------------------------------------------------------------------------------------------------------------
// Process de commande (migration 048). Fonction absente : { ok:false, reason:'unavailable' }, l'app garde 038.

export type ProcessResult = PresenceResult & { code?: string; expires_at?: string; presence?: ClientPresence; unchanged?: boolean }

async function rpcResult(p: PromiseLike<{ data: any; error: any }>): Promise<ProcessResult> {
  const { data, error } = await p
  if (error) return { ok: false, reason: isMissingFunction(error) ? 'unavailable' : 'error', message: error.message }
  return (data ?? { ok: false, reason: 'error', message: 'Réponse vide.' }) as ProcessResult
}

/** Le client annonce « Je serai sur place » / « Je ne serai pas sur place » (modifiable jusqu'à l'arrivée). */
export const setClientPresence = (supabase: SupabaseClient, txId: string, presence: ClientPresence) =>
  rpcResult(supabase.rpc('set_client_presence', { p_transaction: txId, p_presence: presence }))

/** Client absent : le client envoie son code (validation d'arrivée ou code de fin), affiché et posté dans le fil. */
export const clientSendPresenceCode = (supabase: SupabaseClient, txId: string, phase: Phase) =>
  rpcResult(supabase.rpc('client_send_presence_code', { p_transaction: txId, p_phase: phase }))

/** Client absent, fin : le prestataire demande le code de fin (aucune position). */
export const requestEndCode = (supabase: SupabaseClient, txId: string) =>
  rpcResult(supabase.rpc('request_end_code', { p_transaction: txId }))

export const PRESENCE_PHOTO_BUCKET = 'presence-photos'

/** Photo d'arrivée (client absent) : bucket privé, `<uid>/<mission>/<horodatage>.<ext>`. */
export async function uploadPresencePhoto(supabase: SupabaseClient, uid: string, txId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (file.size > 10 * 1024 * 1024) return { error: 'Photo trop lourde (10 Mo au plus).' }
  const ext = ((file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')) || 'jpg'
  const path = `${uid}/${txId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(PRESENCE_PHOTO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (error) return { error: 'Photo non envoyée : vérifiez votre connexion et réessayez.' }
  return { path }
}

export async function presencePhotoUrl(supabase: SupabaseClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from(PRESENCE_PHOTO_BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Pastille de présence : « Client sur place » / « Client absent » côté pro, « Vous serez… » côté client. */
export function presenceTagLabel(p: ClientPresence | null | undefined, asSeller: boolean): { text: string; warn: boolean; none: boolean } {
  if (p === 'sur_place') return { text: asSeller ? 'Client sur place' : 'Vous serez sur place', warn: false, none: false }
  if (p === 'absent') return { text: asSeller ? 'Client absent' : 'Vous serez absent', warn: true, none: false }
  return { text: asSeller ? 'Présence non indiquée' : 'Serez-vous sur place ?', warn: false, none: true }
}

/** Colonne présente sur une ligne lue avec `select('*')` : la migration 048 est appliquée. */
export const rowHasPresence = (tx: any): boolean => !!tx && Object.prototype.hasOwnProperty.call(tx, 'client_presence')
