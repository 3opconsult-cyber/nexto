"use client"

// Première action réussie (réservation, demande publiée, message ou tarif envoyé) : le bandeau
// « Installer le raccourci PING » n'apparaît qu'après (audit ergonomie 18/11, amélioration 2),
// jamais au premier écran. Retenu sur l'appareil ; un événement prévient le bandeau déjà monté.
const KEY = 'ping_first_action'
export const FIRST_ACTION_EVENT = 'ping-first-action'

export function hasFirstAction(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

export function markFirstAction(what: string) {
  try {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, what || '1')
  } catch { return }
  try { window.dispatchEvent(new Event(FIRST_ACTION_EVENT)) } catch { /* rien */ }
}
