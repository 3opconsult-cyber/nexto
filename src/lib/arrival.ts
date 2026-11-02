// Arrivée du prestataire quand le client n'est pas sur place (migration 033).
// Voie A : QR unique laissé sur place (`/mission/[id]/scan/onsite?token=`), RPC arrive_with_onsite_token.
// Voie B : position (consentement explicite) comparée à l'adresse, puis code à 6 chiffres lu par le client
// dans l'application et saisi par le prestataire (`/api/arrival` + RPC arrive_with_code).
// Aucun suivi : un seul relevé de position, uniquement dans ce cas.
import { distanceKm } from '@/lib/geo'

export const ARRIVAL_RADIUS_M = 300        // rayon toléré autour de l'adresse du rendez-vous
export const ARRIVAL_ACCURACY_MARGIN_M = 100 // marge max ajoutée pour l'imprécision du GPS
export const ARRIVAL_CODE_TTL_MIN = 15
export const ARRIVAL_CODE_MAX_ATTEMPTS = 5

export type GeoVerdict =
  | { status: 'conforme'; distanceM: number }
  | { status: 'trop_loin'; distanceM: number }
  | { status: 'non_verifiable' }

/** Compare la position du prestataire à celle du rendez-vous. `target` null = comparaison impossible. */
export function judgeProximity(
  pos: { lat: number; lng: number; accuracyM?: number | null },
  target: { lat: number; lng: number } | null,
): GeoVerdict {
  if (!target) return { status: 'non_verifiable' }
  const distanceM = Math.round(distanceKm(pos.lat, pos.lng, target.lat, target.lng) * 1000)
  const margin = Math.min(Math.max(pos.accuracyM ?? 0, 0), ARRIVAL_ACCURACY_MARGIN_M)
  return distanceM <= ARRIVAL_RADIUS_M + margin ? { status: 'conforme', distanceM } : { status: 'trop_loin', distanceM }
}

/**
 * Envoi de SMS : DÉSACTIVÉ. Aucun fournisseur n'est configuré, le code est donc remis au client
 * uniquement dans l'application (message du fil + page « Codes QR »).
 * Pour l'activer : implémenter l'appel au fournisseur ici (clé en variable d'environnement serveur,
 * ex. SMS_API_KEY), l'appeler depuis `/api/arrival` APRÈS la RPC, avec un texte sans le code si possible,
 * et ne JAMAIS renvoyer le code au prestataire. Le numéro du client est chiffré (`profiles.phone_enc`) :
 * le déchiffrement doit se faire côté serveur seulement.
 */
export async function sendSms(_to: string, _body: string): Promise<{ sent: false; reason: 'off' }> {
  return { sent: false, reason: 'off' }
}

export type ArrivalRequestResult =
  | { ok: true; geo: 'conforme' | 'non_verifiable'; expiresAt: string }
  | { ok: false; error: 'too_far' | 'throttled' | 'too_many' | 'not_ready' | 'consent' | 'auth' | 'forbidden' | 'invalid' | 'server'; message: string; distanceM?: number }

/** Appel client de /api/arrival (le prestataire a déjà donné son consentement et fourni sa position). */
export async function requestArrivalCode(
  transactionId: string, pos: { lat: number; lng: number; accuracyM?: number | null },
): Promise<ArrivalRequestResult> {
  try {
    const r = await fetch('/api/arrival', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracyM ?? null, consent: true }),
    })
    return await r.json()
  } catch {
    return { ok: false, error: 'server', message: 'Réseau indisponible, réessayez.' }
  }
}
