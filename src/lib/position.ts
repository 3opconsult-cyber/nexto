// Lecture de position, UNE fois, jamais de suivi (règle GPS : seulement « client absent » et « Je suis en intervention
// ici »). Audit du 23/11/2026, correction 4 : refus, délai dépassé et position indisponible sont distingués, un
// second essai moins exigeant est tenté, et le message dit où réactiver la localisation.

export type GeoFail = 'denied' | 'timeout' | 'unavailable' | 'unsupported'
export type GeoOk = { ok: true; lat: number; lng: number; accuracyM: number; approx: boolean }
export type GeoErr = { ok: false; reason: GeoFail }
export type GeoResult = GeoOk | GeoErr
/** Garde de type (le projet n'est pas en mode strict : `!r.ok` ne suffit pas à distinguer les deux cas). */
export const isGeoFail = (r: GeoResult): r is GeoErr => r.ok !== true

export type GeoAttempt = { highAccuracy: boolean; timeoutMs: number; maximumAgeMs: number }

/** Arrivée client absent : d'abord haute précision (sans cache), puis repli basse précision (cache de 30 s au plus). */
export const ARRIVAL_ATTEMPTS: GeoAttempt[] = [
  { highAccuracy: true, timeoutMs: 8000, maximumAgeMs: 0 },
  { highAccuracy: false, timeoutMs: 8000, maximumAgeMs: 30000 },
]
/** Zone « en intervention ici » (secteur à 2 km près) : basse précision d'abord, haute précision en repli. */
export const ZONE_ATTEMPTS: GeoAttempt[] = [
  { highAccuracy: false, timeoutMs: 8000, maximumAgeMs: 60000 },
  { highAccuracy: true, timeoutMs: 8000, maximumAgeMs: 0 },
]

/** Au-delà de ce rayon d'incertitude, la position est dite « approximative » à l'écran. */
export const APPROX_ACCURACY_M = 100

function once(a: GeoAttempt): Promise<GeoResult> {
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        ok: true, lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy,
        approx: !a.highAccuracy || p.coords.accuracy > APPROX_ACCURACY_M,
      }),
      e => resolve({ ok: false, reason: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: a.highAccuracy, timeout: a.timeoutMs, maximumAge: a.maximumAgeMs },
    )
  })
}

/** Position unique, après consentement. Un refus de permission n'est pas retenté (ce serait inutile). */
export async function readPositionOnce(attempts: GeoAttempt[] = ARRIVAL_ATTEMPTS): Promise<GeoResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return { ok: false, reason: 'unsupported' }
  let last: GeoResult = { ok: false, reason: 'unavailable' }
  for (const a of attempts) {
    last = await once(a)
    if (!isGeoFail(last) || last.reason === 'denied') return last
  }
  return last
}

/** Phrase française par cause, avec l'endroit où réactiver la localisation (réglages du téléphone). */
export function geoMessage(reason: GeoFail): string {
  switch (reason) {
    case 'denied':
      return 'La localisation est refusée pour PING. Pour la réactiver :\n'
        + 'iPhone : Réglages, Confidentialité et sécurité, Service de localisation, puis votre navigateur (Safari…) : « Lors de l’utilisation ».\n'
        + 'Android (Chrome) : touchez le cadenas à gauche de l’adresse, Autorisations, Position, Autoriser.\n'
        + 'Puis touchez « Réessayer ».'
    case 'timeout':
      return 'La position n’a pas été trouvée à temps. Approchez-vous d’une fenêtre ou sortez sur le pas de la porte, vérifiez que la localisation est activée, puis touchez « Réessayer ».'
    case 'unsupported':
      return 'Ce navigateur ne peut pas donner la position. Ouvrez PING dans Safari (iPhone) ou Chrome (Android), puis réessayez.'
    default:
      return 'Votre téléphone n’arrive pas à déterminer sa position. Activez la localisation dans les réglages du téléphone (iPhone : Service de localisation ; Android : Position), puis touchez « Réessayer ».'
  }
}
