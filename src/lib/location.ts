"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { geocodeAddress } from '@/lib/geocode'

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
 * Centre déduit du profil (audit ergonomie 18/11, amélioration 1) : l'adresse du profil client
 * (géocodée, mise en cache sur l'appareil) ou la position déclarée du prestataire
 * (provider_profiles.lat/lng, posée à l'onboarding). Sert seulement à CENTRER la carte : rien
 * n'est enregistré comme choix de position, et une annonce n'est jamais déplacée par ce centre.
 */
export async function fetchProfileCenter(kind: 'client' | 'pro'): Promise<{ point: Point; label: string } | null> {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    if (kind === 'pro') {
      const { data } = await sb.from('provider_profiles').select('lat, lng').eq('id', user.id).maybeSingle()
      const lat = Number(data?.lat), lng = Number(data?.lng)
      if (data && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) return { point: { lat, lng }, label: 'votre adresse' }
    }
    const { data: pr } = await sb.from('profiles').select('address').eq('id', user.id).maybeSingle()
    const addr = (pr?.address || '').trim()
    if (addr.length < 3) return null
    try {
      const c = JSON.parse(localStorage.getItem(KEY + '_profile') || 'null')
      if (c?.addr === addr && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return { point: { lat: c.lat, lng: c.lng }, label: 'votre adresse' }
    } catch { }
    const g = await geocodeAddress(addr)
    if (!g) return null
    try { localStorage.setItem(KEY + '_profile', JSON.stringify({ addr, ...g })) } catch { }
    return { point: g, label: 'votre adresse' }
  } catch { return null }
}

/**
 * Position de départ d'une carte. Sans choix connu ni autorisation déjà donnée,
 * la carte se centre sur l'adresse du profil si `profile` est donné (aucune fenêtre) ; sinon
 * `ask` passe à true : la page affiche <LocationAsk> (encart non bloquant) au lieu d'ouvrir la
 * fenêtre du navigateur.
 */
export function useInitialPosition(fallback: Point, profile?: 'client' | 'pro') {
  const profileRef = useRef(profile)
  const [pos, setPos] = useState<Point>(fallback)
  const [ask, setAsk] = useState(false)
  const [city, setCity] = useState('')
  useEffect(() => {
    let off = false
    const saved = readSavedLocation()
    if (saved?.kind === 'city') { setPos({ lat: saved.lat, lng: saved.lng }); setCity(saved.label); return }
    let dismissed = false
    try { dismissed = sessionStorage.getItem(KEY + '_later') === '1' } catch { }
    // Sans position connue : centre du profil s'il existe, sinon l'encart (sauf « Plus tard »).
    const fromProfile = async (orAsk: boolean) => {
      const c = profileRef.current ? await fetchProfileCenter(profileRef.current) : null
      if (off) return
      if (c) { setPos(c.point); setCity(c.label); return }
      if (orAsk) setAsk(true)
    }
    geoPermission().then(state => {
      if (off) return
      if (state === 'granted' || (saved?.kind === 'gps' && state !== 'denied')) {
        readPositionOnce(5000).then(p => { if (!off) setPos(p) }).catch(() => { fromProfile(!dismissed) })
      } else fromProfile(!dismissed)
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
