"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { geocodeAddress, addressLocality } from '@/lib/geocode'
import { sessionUserId } from '@/lib/screenCache'

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

/** Incertitude (m) du dernier relevé : sert à dire « position approximative » au lieu de « Vous êtes ici ». */
let lastAccuracyM: number | null = null
export const lastPositionAccuracy = () => lastAccuracyM

/**
 * Relevé précis (GPS), un seul : le relevé rapide ci-dessous est approximatif sur iPhone (Wi-Fi / antennes, parfois à
 * plusieurs kilomètres : capture du 23/11, « Vous êtes ici » au mauvais endroit). Rejette en cas d'échec ; l'appelant
 * garde alors le relevé rapide.
 */
export function readPositionPrecise(timeout = 12000): Promise<Point & { accuracyM: number }> {
  return new Promise((resolve, reject) => {
    // `reason` (même vocabulaire que src/lib/position.ts, GeoFail) : permet d'afficher le bon message (geoMessage).
    const fail = (m: string, reason: 'denied' | 'timeout' | 'unavailable' | 'unsupported') => reject(Object.assign(new Error(m), { reason }))
    if (typeof navigator === 'undefined' || !navigator.geolocation) { fail('Localisation indisponible.', 'unsupported'); return }
    navigator.geolocation.getCurrentPosition(
      p => { lastAccuracyM = p.coords.accuracy; resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }) },
      e => fail('Position précise indisponible.', e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    )
  })
}

/** Texte de précision : « ±40 m » (relevé précis) ou « ±3 km » ; au-delà de 100 m la position est dite approximative. */
export function accuracyText(m: number): string {
  if (m < 1000) return `±${Math.max(5, Math.round(m / 5) * 5)} m`
  const km = m >= 10000 ? String(Math.round(m / 1000)) : (Math.round(m / 100) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',')
  return `±${km} km`
}

/** Un seul relevé rapide (approximatif possible). Rejette avec un message lisible. */
export function readPositionOnce(timeout = 8000): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('Localisation indisponible sur cet appareil.')); return }
    navigator.geolocation.getCurrentPosition(
      p => { lastAccuracyM = p.coords.accuracy; resolve({ lat: p.coords.latitude, lng: p.coords.longitude }) },
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
    // Session locale (aucun aller-retour) : sert seulement à centrer la carte, la RLS reste la garde.
    const uid = await sessionUserId(sb)
    if (!uid) return null
    const user = { id: uid }
    if (kind === 'pro') {
      const { data } = await sb.from('provider_profiles').select('lat, lng').eq('id', user.id).maybeSingle()
      const lat = Number(data?.lat), lng = Number(data?.lng)
      if (data && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) return { point: { lat, lng }, label: 'votre adresse' }
    }
    const { data: pr } = await sb.from('profiles').select('address, city').eq('id', user.id).maybeSingle()
    const addr = (pr?.address || '').trim()
    const city = ((pr as { city?: string | null } | null)?.city || '').trim()
    // Clé du cache : adresse et ville du profil (le centre suit un changement d'adresse).
    const key = `${addr}|${city}`
    if (addr.length < 3 && city.length < 2) return null
    try {
      const c = JSON.parse(localStorage.getItem(KEY + '_profile') || 'null')
      if ((c?.key === key || (c?.addr === addr && !c?.key)) && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return { point: { lat: c.lat, lng: c.lng }, label: 'votre adresse' }
    } catch { }
    // Comme pour une demande (client/demandes/new) : adresse complète, puis code postal et ville de cette
    // adresse, puis ville du profil. Sans aucun des trois, l'encart « Où êtes-vous ? » reste le repli
    // (audit 19/11, correction 9 : il s'affichait alors que l'adresse du profil était exploitable).
    const loc = addr ? addressLocality(addr) : ''
    const g = (addr.length >= 3 ? await geocodeAddress(addr) : null)
      || (loc && loc !== addr ? await geocodeAddress(loc) : null)
      || (city.length >= 2 ? await geocodeAddress(city) : null)
    if (!g) return null
    try { localStorage.setItem(KEY + '_profile', JSON.stringify({ key, addr, ...g })) } catch { }
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
  // D'où vient le point : GPS, ville choisie, adresse du profil. Sert à ne plus écrire « Vous êtes ici » quand c'est faux.
  const [source, setSource] = useState<'fallback' | 'gps' | 'city' | 'profile'>('fallback')
  const [accuracyM, setAccuracyM] = useState<number | null>(null)
  useEffect(() => {
    let off = false
    const saved = readSavedLocation()
    if (saved?.kind === 'city') { setPos({ lat: saved.lat, lng: saved.lng }); setCity(saved.label); setSource('city'); return }
    let dismissed = false
    try { dismissed = sessionStorage.getItem(KEY + '_later') === '1' } catch { }
    // Sans position connue : centre du profil s'il existe, sinon l'encart (sauf « Plus tard »).
    const fromProfile = async (orAsk: boolean) => {
      const c = profileRef.current ? await fetchProfileCenter(profileRef.current) : null
      if (off) return
      if (c) { setPos(c.point); setCity(c.label); setSource('profile'); return }
      if (orAsk) setAsk(true)
    }
    geoPermission().then(state => {
      if (off) return
      if (state === 'granted' || (saved?.kind === 'gps' && state !== 'denied')) {
        readPositionOnce(5000).then(p => {
          if (off) return
          setPos(p); setSource('gps'); setAccuracyM(lastPositionAccuracy())
          // Affinage : relevé GPS précis ; le point ne bouge que s'il s'écarte de plus de 150 m du relevé rapide.
          readPositionPrecise(12000).then(q => {
            if (off) return
            setAccuracyM(q.accuracyM)
            const dLat = (q.lat - p.lat) * 111000, dLng = (q.lng - p.lng) * 111000 * Math.cos(p.lat * Math.PI / 180)
            if (Math.hypot(dLat, dLng) > 150) setPos({ lat: q.lat, lng: q.lng })
          }).catch(() => { /* on garde le relevé rapide, marqué approximatif */ })
        }).catch(() => { fromProfile(!dismissed) })
      } else fromProfile(!dismissed)
    })
    return () => { off = true }
  }, [])
  const choose = useCallback((p: Point, label?: string, src?: 'gps' | 'city' | 'profile') => {
    setPos(p); setAsk(false); setCity(label || '')
    if (src) setSource(src)
  }, [])
  // « Utiliser ma position » (feuille de la carte) : UN relevé précis sur demande, jamais de suivi. Le point devient
  // la position de la carte (source GPS) ; la précision est rendue à l'appelant pour l'afficher honnêtement.
  const locate = useCallback(async (): Promise<{ ok: true; accuracyM: number } | { ok: false; reason: 'denied' | 'timeout' | 'unavailable' | 'unsupported' }> => {
    try {
      const q = await readPositionPrecise(15000)
      saveLocationChoice({ kind: 'gps' })
      setPos({ lat: q.lat, lng: q.lng }); setAsk(false); setSource('gps'); setAccuracyM(q.accuracyM)
      return { ok: true, accuracyM: q.accuracyM }
    } catch (e: any) {
      return { ok: false, reason: e?.reason || 'unavailable' }
    }
  }, [])
  // « Plus tard » (croix) : l'encart ne revient pas avant la prochaine session du navigateur.
  const dismiss = useCallback(() => {
    setAsk(false)
    try { sessionStorage.setItem(KEY + '_later', '1') } catch { }
  }, [])
  return { pos, ask, setAsk, choose, city, dismiss, source, accuracyM, locate }
}
