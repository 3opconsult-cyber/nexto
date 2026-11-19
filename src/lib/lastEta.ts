// Durée de trajet annoncée à « Je pars » (audit ergonomie 19/11 ter, correction 5) : la dernière
// choisie sur cet appareil est présélectionnée (15 min la première fois), pour que « Je pars » →
// « Prévenir le client » suffise. Simple confort local (localStorage), échec silencieux.
const KEY = 'ping_last_eta'
export const DEFAULT_ETA = 15

export function readLastEta(allowed: number[]): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    if (allowed.includes(v)) return v
  } catch { /* stockage indisponible */ }
  return DEFAULT_ETA
}

export function saveLastEta(v: number) {
  try { localStorage.setItem(KEY, String(v)) } catch { /* stockage indisponible */ }
}
