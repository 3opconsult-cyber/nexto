"use client"
import { useCallback, useEffect, useState } from 'react'

// Position de l'utilisateur, demandée APRÈS une explication (qc-production B2) :
// on n'ouvre jamais la fenêtre du navigateur sans avoir dit pourquoi. Un seul relevé,
// jamais de suivi (invariant « pas de GPS »). Le choix est retenu sur l'appareil
// (localStorage 'ping_loc') : une ville choisie, ou l'accord pour la position.

export type Point = { lat: number; lng: number }
type Saved = { kind: 'gps' } | { kind: 'city'; label: string; lat: number; lng: number }
const KEY = 'ping_loc'

export function readSavedLocation(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (v?.kind === 'gps') return { kind: 'gps' }
    if (v?.kind === 'city' && Number.isFinite(v.lat) && Number.isFinite(v.lng)) return { kind: 'city', label: String(v.label || ''), lat: v.lat, lng: v.lng }
  } catch { }
  return null
}
export function saveLocationChoice(v: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { }
}

/** État de l'autorisation, sans ouvrir la fenêtre du navigateur. */
export async function geoPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const r = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return r.state
  } catch { return 'unknown' }
}

/** Un seul relevé. Rejette avec un message lisible. */
export function readPositionOnce(timeout = 8000): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('Localisation indisponible sur cet appareil.')); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(new Error(e.code === 1
        ? 'Position refusée dans le navigateur. Choisissez une ville, ou autorisez la localisation dans les réglages du navigateur.'
        : 'Position indisponible pour le moment. Choisissez une ville.')),
      { timeout },
    )
  })
}

/**
 * Position de départ d'une carte. Sans choix connu ni autorisation déjà donnée,
 * `ask` passe à true : la page affiche <LocationAsk> au lieu d'ouvrir la fenêtre du navigateur.
 */
export function useInitialPosition(fallback: Point) {
  const [pos, setPos] = useState<Point>(fallback)
  const [ask, setAsk] = useState(false)
  const [city, setCity] = useState('')
  useEffect(() => {
    let off = false
    const saved = readSavedLocation()
    if (saved?.kind === 'city') { setPos({ lat: saved.lat, lng: saved.lng }); setCity(saved.label); return }
    let dismissed = false
    try { dismissed = sessionStorage.getItem(KEY + '_later') === '1' } catch { }
    geoPermission().then(state => {
      if (off) return
      if (dismissed && state !== 'granted') return
      if (state === 'granted' || (saved?.kind === 'gps' && state !== 'denied')) {
        readPositionOnce(5000).then(p => { if (!off) setPos(p) }).catch(() => { if (!off) setAsk(true) })
      } else setAsk(true)
    })
    return () => { off = true }
  }, [])
  const choose = useCallback((p: Point, label?: string) => {
    setPos(p); setAsk(false); setCity(label || '')
  }, [])
  // « Plus tard » (croix) : l'encart ne revient pas avant la prochaine session du navigateur.
  const dismiss = useCallback(() => {
    setAsk(false)
    try { sessionStorage.setItem(KEY + '_later', '1') } catch { }
  }, [])
  return { pos, ask, setAsk, choose, city, dismiss }
}
