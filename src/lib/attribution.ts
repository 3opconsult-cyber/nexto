/**
 * Attribution — d'où vient la personne qui s'inscrit.
 *
 * La boucle complète : un support imprimé porte un QR vers /l/<code>, la route
 * redirige vers la landing avec les UTM, la landing propage la query string sur
 * son bouton, et l'inscription enregistre l'origine. L'admin peut alors dire ce
 * que chaque flyer a réellement ramené — pas ce qu'on espère qu'il a ramené.
 *
 * L'UTM est capturé dès la première page vue et gardé 30 jours : quelqu'un peut
 * scanner un flyer le lundi et créer son compte le jeudi.
 */

const KEY = 'ping_attr'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type Attribution = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  landing_path?: string
}

/** À appeler au chargement de n'importe quelle page. Ne fait rien sans UTM. */
export function captureAttribution() {
  if (typeof window === 'undefined') return
  try {
    const q = new URLSearchParams(window.location.search)
    const src = q.get('utm_source')
    if (!src) return // pas d'UTM : on ne touche pas à ce qui est déjà stocké

    const attr: Attribution & { at: number } = {
      utm_source: src,
      utm_medium: q.get('utm_medium') || undefined,
      utm_campaign: q.get('utm_campaign') || undefined,
      utm_content: q.get('utm_content') || undefined,
      landing_path: window.location.pathname,
      at: Date.now(),
    }
    window.localStorage.setItem(KEY, JSON.stringify(attr))
  } catch {
    // navigation privée, stockage refusé : l'inscription doit marcher quand même
  }
}

/** L'attribution encore valide, ou null. */
export function readAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const { at, ...attr } = JSON.parse(raw)
    if (!at || Date.now() - at > MAX_AGE_MS) return null
    return attr as Attribution
  } catch {
    return null
  }
}

export function clearAttribution() {
  try { window.localStorage.removeItem(KEY) } catch { /* sans importance */ }
}
