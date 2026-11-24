"use client"
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ProviderNearby } from '@/lib/services'
import { iconSvg } from './PingIcons'
import { pickMapStyle, MAP_ATTRIBUTION, hasWebGL } from '@/lib/mapStyle'

// Fond de carte : vectoriel aux couleurs PING (MapLibre GL + tuiles OpenFreeMap) rendu sous
// Leaflet via @maplibre/maplibre-gl-leaflet — Leaflet garde la main sur les gestes, les
// épingles et les clics. Repli automatique sur les tuiles raster OpenStreetMap si WebGL est
// absent, si le style ou ses tuiles ne chargent pas, ou si le contexte WebGL est perdu.
const STYLE_TIMEOUT_MS = 25000
function PingBaseLayer() {
  const map = useMap()
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    if (fallback) return
    if (!hasWebGL()) { setFallback(true); return }
    let cancelled = false
    let layer: L.Layer | null = null
    let loaded = false
    const fail = () => { if (!cancelled && !loaded) setFallback(true) }
    const timer = window.setTimeout(fail, STYLE_TIMEOUT_MS)
    map.attributionControl?.addAttribution(MAP_ATTRIBUTION)
    ;(async () => {
      try {
        await import('maplibre-gl')
        await import('@maplibre/maplibre-gl-leaflet')
        if (cancelled) return
        const gl = L.maplibreGL({ style: pickMapStyle(), attributionControl: false })
        layer = gl
        gl.addTo(map)
        const glMap = gl.getMaplibreMap()
        // « load » part même quand AUCUNE tuile n'a pu être lue (réseau mobile, bloqueur de contenu, serveur de tuiles
        // indisponible) : on voit alors un fond vide (capture iPhone du 23/11). Contrôle réel : au moins un objet
        // dessiné (route, eau, parc) dans les 14 s après le chargement, sinon retour à la carte OpenStreetMap.
        let probes = 0
        const probe = () => {
          if (cancelled) return
          let n = 0
          try { n = glMap.queryRenderedFeatures().length } catch { /* contexte perdu */ }
          if (n > 0) return
          probes += 1
          // Réseau mobile intermittent : une fois, on recharge le style (nouveau lot de tuiles) avant de renoncer.
          if (probes === 3) { try { glMap.setStyle(pickMapStyle(), { diff: false }) } catch { /* sans objet */ } }
          if (probes >= 8) { if (!cancelled) setFallback(true); return }
          window.setTimeout(probe, 2000)
        }
        glMap.on('load', () => { loaded = true; window.clearTimeout(timer); map.getContainer().dataset.basemap = 'ping'; window.setTimeout(probe, 1500) })
        // Une erreur isolée (une tuile, une police, un coup de réseau sur mobile) ne doit PAS faire revenir à l'ancienne
        // carte : seule l'absence totale de chargement au bout de STYLE_TIMEOUT_MS ou la perte du contexte WebGL le font.
        glMap.on('error', (e: any) => { if (!loaded && /style|sprite|\.json/i.test(String(e?.error?.url || e?.error?.message || '')) && (e?.error?.status === 404 || e?.error?.status === 403)) fail() })
        gl.getCanvas()?.addEventListener('webglcontextlost', () => { loaded = false; fail() })
      } catch {
        fail()
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      map.attributionControl?.removeAttribution(MAP_ATTRIBUTION)
      if (layer) map.removeLayer(layer)
    }
  }, [map, fallback])
  useEffect(() => {
    if (fallback) map.getContainer().dataset.basemap = 'osm'
  }, [fallback, map])
  if (!fallback) return null
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      maxZoom={19}
    />
  )
}

function AttributionPrefix() {
  const map = useMap()
  useEffect(() => { map.attributionControl?.setPrefix(false) }, [map])
  return null
}

// Icônes en divIcon (HTML/CSS inline) : évite le piège classique de Leaflet sous
// webpack/Next.js où les PNG de marqueurs par défaut ne se résolvent pas et où
// les pins deviennent invisibles.
// echo : anneaux d'écho radar autour du point (le signe PING, comme dans l'animation /animation),
// pour un prestataire « Disponible » : il voit qu'il est visible.
function userIcon(echo = false) {
  const rings = echo
    ? '<span class="ping-echo"></span><span class="ping-echo" style="animation-delay:1.1s"></span>'
    : ''
  return L.divIcon({
    className: '',
    // Point de 30 px inchangé, centré dans une zone de 44 px (cible tactile, audit 19/11 bis n° 12).
    // Point de 26 px (30 avant) : posé au-dessus des épingles (zIndexOffset) sans cacher l'initiale d'une
    // épingle voisine, et sans prendre le toucher (marqueur non interactif).
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center"><div style="position:relative;width:26px;height:26px">${rings}<div class="you-dot" style="position:relative;width:26px;height:26px;border-radius:50%;background:#12B39C;border:4px solid #fff;box-sizing:border-box;box-shadow:0 0 0 6px rgba(18,179,156,.28),0 3px 10px rgba(0,0,0,.3)"></div></div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

// Prix au-dessus du pin (façon Booking/Airbnb) : la décision se prend sur la
// carte, sans avoir à ouvrir chaque fiche pour comparer un tarif.
function pinPriceLabel(p: { pricing_type: string; base_price_cents: number; hourly_rate_cents: number | null }) {
  if (p.pricing_type === 'devis') return 'Devis'
  if (p.base_price_cents > 0) return `${Math.round(p.base_price_cents / 100)} €`
  if (p.hourly_rate_cents) return `${Math.round(p.hourly_rate_cents / 100)} €/h`
  return null
}

// Épingle commune à toutes les cartes, dessinée comme la maquette (.pind) : le prix (ou budget)
// dans une étiquette AU-DESSUS de la goutte, jamais recouvert par elle ; dans la goutte, l'initiale
// du prestataire (carte client) ou le pictogramme du service demandé (carte prestataire).
// États : sélectionnée (étiquette teal + halo), nouveau (goutte plus claire), hors ligne (gris,
// étiquette blanche). Les icônes sont mises en cache : une épingle inchangée garde le même objet,
// Leaflet ne la redessine pas (et ne rejoue pas son animation d'apparition) à chaque rendu.
const PIN_W = 96
const PIN_H = 78
// live : prestataire en ligne maintenant (goutte pleine, anneau qui pulse doucement) ; off : disponible plus tard (goutte claire).
type PinState = 'normal' | 'sel' | 'off' | 'live'
const iconCache = new Map<string, L.DivIcon>()
function pinIcon(color: string, label: string | null, i = 0, inner = '', state: PinState = 'normal') {
  const key = `${color}|${label}|${inner}|${state}|${Math.min(i, 12)}`
  const hit = iconCache.get(key)
  if (hit) return hit
  const labBg = state === 'sel' ? '#12B39C' : state === 'off' ? '#fff' : '#123644'
  const labFg = state === 'off' ? '#4E6470' : '#fff'
  const labBd = state === 'off' ? '#DCE5E3' : '#fff'
  const tag = label
    ? `<div style="background:${labBg};color:${labFg};font-family:Quicksand,sans-serif;font-weight:700;font-size:12px;line-height:1;padding:5px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(18,54,68,.3);border:1px solid ${labBd};margin-bottom:2px" class="pin-tag">${label}</div>`
    : ''
  const ring = state === 'sel' ? '0 0 0 4px rgba(18,179,156,.35),' : ''
  const liveRing = state === 'live' ? '<span class="pin-live"></span>' : ''
  const light = color === '#CFE8E3'
  const inFg = light ? '#0C6F61' : '#fff'
  const dropBd = light ? '#12B39C' : '#fff'
  // Zone tactile (audit 19/11 bis n° 12) : la goutte (40 px, inchangée) est posée dans un carré
  // transparent de 48 px (.pin-hit) ; seuls ce carré et l'étiquette de prix réagissent au toucher,
  // le reste du cadre de 96 × 78 laisse passer le geste à la carte (épingles voisines comprises).
  const icon = L.divIcon({
    className: 'ping-pin',
    html: `<div style="width:${PIN_W}px;height:${PIN_H}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;animation:pinIn .45s cubic-bezier(.22,1.2,.36,1) both;animation-delay:${(Math.min(i, 12) * 0.08).toFixed(2)}s;opacity:${state === 'off' ? '.9' : '1'}">
      ${tag}
      <div class="pin-hit" style="position:relative;width:48px;height:48px;margin-bottom:2px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
      ${liveRing}
      <div style="width:40px;height:40px;flex-shrink:0;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:${ring}0 3px 8px rgba(18,54,68,.35);border:2px solid ${dropBd};box-sizing:border-box;display:flex;align-items:center;justify-content:center">
        <div style="transform:rotate(45deg);color:${inFg};font-family:Quicksand,sans-serif;font-weight:700;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center">${inner || '<div style="width:9px;height:9px;border-radius:50%;background:currentColor"></div>'}</div>
      </div>
      </div>
    </div>`,
    iconSize: [PIN_W, PIN_H],
    // Pointe de la goutte : centre horizontal, bas de la goutte.
    iconAnchor: [PIN_W / 2, PIN_H - 6],
  })
  iconCache.set(key, icon)
  return icon
}

const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
function proIcon(p: ProviderNearby, i = 0, selected = false, isNew = false) {
  const initial = esc(((p.full_name || '').trim().charAt(0) || '?').toUpperCase())
  // Pas en ligne maintenant : « Plus tard » (goutte claire), le détail « Hors ligne pour le moment » reste dans l'aperçu.
  if (!p.is_active) return pinIcon('#CFE8E3', 'Plus tard', i, initial, selected ? 'sel' : 'off')
  const price = pinPriceLabel(p)
  const label = price ? `${price}${isNew ? ' · Nouveau' : ''}` : (isNew ? 'Nouveau' : null)
  return pinIcon(isNew ? '#7FA9A1' : '#12B39C', label, i, initial, selected ? 'sel' : 'live')
}
function reqIcon(label: string | null | undefined, i = 0, color = '#F2A93B', inner = '', selected = false) {
  return pinIcon(color, label ?? null, i, inner, selected ? 'sel' : 'normal')
}

// Second repère d'un prestataire qui a activé « Je suis en intervention ici » (058) : secteur flouté à ~500 m,
// en plus de son domicile. Teal foncé et cible au centre, étiquette « Ici aujourd'hui » (jamais une adresse).
const ZONE_INNER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="#fff"/></svg>'
function zoneIcon(i = 0) { return pinIcon('#0B8374', 'Ici aujourd’hui', i, ZONE_INNER, 'normal') }

type FitPad = { top: number; right: number; bottom: number; left: number }
function FitAll({ userPos, pts, recenterTick, fit = false, fitKey, fitPad, inset = 0 }: {
  userPos: { lat: number; lng: number }; pts: { lat: number; lng: number }[]; recenterTick?: number
  fit?: boolean; fitKey?: string; fitPad?: FitPad; inset?: number
}) {
  const map = useMap()
  // inset : hauteur (px) cachée en bas par la feuille. La position de l'utilisateur est centrée dans la partie
  // visible : décalée de inset / 2 au centrage, puis suivie quand la feuille change de position (sans recharger).
  const appliedInset = useRef(inset)
  const insetNow = useRef(inset)
  insetNow.current = inset
  // Par défaut (carte client) : la carte pointe sur la position de l'utilisateur (zoom de quartier),
  // sans dézoomer sur tous les prestataires ; elle ne bouge plus quand la liste se rafraîchit.
  // Mode `fit` (carte pro) : la position ET les épingles tiennent dans le champ, zoom plafonné au
  // quartier, en laissant la place de la barre du haut et du volet (`fitPad`). Recalé à
  // l'ouverture (premières épingles), au recentrage et quand `fitKey` change (filtre, zone) —
  // jamais à la simple relecture périodique de la liste.
  const live = useRef({ userPos, pts, fitPad })
  live.current = { userPos, pts, fitPad }
  const fittedKey = useRef<string | null>(null)
  // Recadrage automatique sur la position : seulement à l'ouverture et au bouton « Recentrer » (recenterTick).
  // Dès que l'utilisateur déplace ou zoome la carte (doigt, souris, molette), ou qu'un cadrage « les plus proches »
  // a eu lieu, un changement de position (GPS qui se précise, adresse du profil lue) ne la recadre plus.
  const interacted = useRef(false)
  const lastTick = useRef(recenterTick)
  const opening = useRef(true)
  useEffect(() => {
    const el = map.getContainer()
    const mark = () => { interacted.current = true }
    const evs = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const
    evs.forEach(e => el.addEventListener(e, mark, { passive: true, capture: true }))
    return () => { evs.forEach(e => el.removeEventListener(e, mark, { capture: true })) }
  }, [map])
  function place() {
    const { userPos: u, pts: p, fitPad: pad } = live.current
    const valid = p.filter(x => x.lat != null && x.lng != null)
    if (fit && valid.length) {
      // Leaflet ignore tout changement de vue pendant une animation de zoom (celle du
      // positionnement initial, par exemple) : on recadre à la fin de l'animation.
      if ((map as unknown as { _animatingZoom?: boolean })._animatingZoom) { map.once('zoomend', place); return true }
      // Taille réelle du conteneur d'abord : au montage, Leaflet peut encore la croire nulle,
      // et un cadrage calculé sur une taille nulle part au zoom maximal.
      map.invalidateSize({ pan: false })
      const size = map.getSize()
      const b = L.latLngBounds([[u.lat, u.lng], ...valid.map(x => [x.lat, x.lng] as [number, number])])
      const pd = pad || { top: 24, right: 24, bottom: 24, left: 24 }
      // Marges ramenées à la taille de la carte (petit écran, fenêtre basse) : il reste toujours
      // au moins 20 % de la carte pour les épingles.
      const k = (avail: number, a: number, c: number) => (a + c > avail * 0.8 ? (avail * 0.8) / (a + c) : 1)
      const kx = k(size.x, pd.left, pd.right), ky = k(size.y, pd.top, pd.bottom)
      map.fitBounds(b, {
        paddingTopLeft: [pd.left * kx, pd.top * ky], paddingBottomRight: [pd.right * kx, pd.bottom * ky], maxZoom: 15, animate: false,
      })
      return true
    }
    // Carte pro : positionnement sans animation, pour qu'un recadrage qui suit de près ne soit pas perdu.
    map.setView([u.lat, u.lng], 15, { animate: false })
    if (insetNow.current) map.panBy([0, insetNow.current / 2], { animate: false })
    appliedInset.current = insetNow.current
    return false
  }
  useEffect(() => {
    if (fit) return
    const d = inset - appliedInset.current
    appliedInset.current = inset
    if (Math.abs(d) > 1) map.panBy([0, d / 2], { animate: true })
  }, [inset, fit, map])
  useEffect(() => {
    const tickChanged = lastTick.current !== recenterTick
    lastTick.current = recenterTick
    if (tickChanged) interacted.current = false
    else if (!opening.current && interacted.current) return
    opening.current = false
    if (place()) fittedKey.current = fitKey ?? ''
    const t = setTimeout(() => { map.invalidateSize(); if (fit && !interacted.current) place() }, 100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos.lat, userPos.lng, map, recenterTick])
  useEffect(() => {
    if (!fit || !pts.length || fittedKey.current === (fitKey ?? '')) return
    if (place()) fittedKey.current = fitKey ?? ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, fitKey, pts.length])
  return null
}

// Cadre une fois (par `focusKey`) un ensemble de points : utilisé quand personne n'est dans le rayon, pour montrer
// les prestataires les plus proches même à 20-30 km au lieu d'une carte vide. Jamais répété tant que la clé ne
// change pas. Un changement de position ensuite recadre à nouveau sur la position (sauf si l'utilisateur a exploré).
function FocusPts({ pts, focusKey, inset }: { pts: { lat: number; lng: number }[]; focusKey?: string; inset: number }) {
  const map = useMap()
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!focusKey || !pts.length || done.current === focusKey) return
    done.current = focusKey
    map.invalidateSize({ pan: false })
    const b = L.latLngBounds(pts.map(x => [x.lat, x.lng] as [number, number]))
    map.fitBounds(b, { paddingTopLeft: [40, 110], paddingBottomRight: [40, 90 + inset], maxZoom: 15, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, pts.length, map])
  return null
}

// Double appui (ou double clic) : zoome d'un cran sur l'endroit touché, pas sur la position de l'utilisateur.
// Fait ici plutôt que par le double-clic de Leaflet (désactivé) pour que le tactile et la souris se comportent pareil.
function DoubleTapZoom() {
  const map = useMap()
  const last = useRef<{ t: number; x: number; y: number } | null>(null)
  useMapEvents({
    click: e => {
      const now = Date.now(), p = e.containerPoint, l = last.current
      if (l && now - l.t < 380 && Math.hypot(p.x - l.x, p.y - l.y) < 40) {
        last.current = null
        map.setZoomAround(e.latlng, Math.min(map.getZoom() + 1, map.getMaxZoom()))
      } else last.current = { t: now, x: p.x, y: p.y }
    },
  })
  return null
}

// Toucher le fond de carte (pas une épingle : Leaflet ne fait pas remonter leur clic) ; un
// glisser ou un pincement n'est jamais compté comme un toucher.
function MapClick({ onClick }: { onClick?: () => void }) {
  useMapEvents({ click: () => onClick?.() })
  return null
}

// Étiquettes de prix sans chevauchement : quand deux étiquettes (ou une étiquette et le point « Vous êtes
// ici » avec sa bulle) se recouvrent à l'écran, la plus prioritaire reste (épingle choisie, puis plus proche
// de l'utilisateur dans l'ordre de la liste), l'autre est masquée ; l'épingle reste visible et cliquable,
// le prix reste lisible dans la liste et à l'ouverture de la fiche. Recalculé à chaque zoom / déplacement.
function DeclutterTags({ sig }: { sig: string }) {
  const map = useMap()
  useEffect(() => {
    let raf = 0
    const run = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const root = map.getContainer()
        const pins = Array.from(root.querySelectorAll<HTMLElement>('.ping-pin'))
        pins.forEach(p => { const t = p.querySelector<HTMLElement>('.pin-tag'); if (t) t.style.visibility = '' })
        const placed: DOMRect[] = []
        const dot = root.querySelector('.you-dot')?.getBoundingClientRect()
        const tip = root.querySelector('.you-tip')?.getBoundingClientRect()
        if (dot && dot.width) placed.push(new DOMRect(dot.x - 6, dot.y - 6, dot.width + 12, dot.height + 12))
        if (tip && tip.width) placed.push(tip)
        const over = (r: DOMRect, p: DOMRect, m = 2) => r.x < p.x + p.width + m && p.x < r.x + r.width + m && r.y < p.y + p.height + m && p.y < r.y + r.height + m
        // Ordre : l'épingle choisie (étiquette teal) d'abord, puis celle dessinée au-dessus (z-index Leaflet) :
        // l'étiquette gardée est toujours celle de l'épingle qu'on voit.
        const isSel = (p: HTMLElement) => (p.querySelector<HTMLElement>('.pin-tag')?.style.background || '').includes('rgb(18, 179, 156)')
        const zOf = (p: HTMLElement) => parseInt((p.closest('.leaflet-marker-icon') as HTMLElement | null)?.style.zIndex || p.style.zIndex || '0', 10) || 0
        // À z-index égal, la dernière épingle du DOM est dessinée par-dessus.
        const ordered = [...pins.filter(isSel), ...pins.filter(p => !isSel(p)).sort((a, b) => zOf(b) - zOf(a) || pins.indexOf(b) - pins.indexOf(a))]
        const bodies: DOMRect[] = []
        for (const p of ordered) {
          const body = p.querySelector<HTMLElement>('.pin-hit')?.getBoundingClientRect()
          const t = p.querySelector<HTMLElement>('.pin-tag')
          const r = t?.getBoundingClientRect()
          // Goutte recouverte par une goutte déjà gardée (deux prestataires au même endroit) : son prix serait lu sur l'autre.
          const covered = !!body && body.width > 0 && bodies.some(b => over(body, new DOMRect(b.x + 12, b.y + 12, b.width - 24, b.height - 24), 0))
          if (t && r && r.width) {
            if (covered || placed.some(q => over(r, q))) t.style.visibility = 'hidden'
            else placed.push(r)
          }
          if (body && body.width) bodies.push(body)
        }
      })
    }
    map.on('zoomend moveend', run)
    const ts = [200, 800, 1700].map(ms => window.setTimeout(run, ms))
    run()
    return () => { map.off('zoomend moveend', run); ts.forEach(clearTimeout); cancelAnimationFrame(raf) }
  }, [map, sig])
  return null
}

type ReqPin = { id: string; lat: number; lng: number; label?: string | null; color?: string; icon?: string }
export default function LiveMap({
  userPos, pros, onSelect, recenterTick, requests = [], onSelectRequest, youLabel = 'Vous êtes ici', echo = false,
  onMapClick, fit = false, fitKey, fitPad, selectedId = null, newIds, zones = [], onSelectZone, inset = 0,
  focusPts, focusKey,
}: {
  userPos: { lat: number; lng: number }
  pros: ProviderNearby[]
  onSelect: (p: ProviderNearby) => void
  recenterTick?: number
  requests?: ReqPin[]
  onSelectRequest?: (id: string) => void
  youLabel?: string
  echo?: boolean
  onMapClick?: () => void
  fit?: boolean
  fitKey?: string
  fitPad?: FitPad
  /** Épingle mise en avant (aperçu ouvert). */
  selectedId?: string | null
  /** Prestataires « Nouveau · pièces en cours de contrôle » (goutte plus claire). */
  newIds?: Set<string>
  /** Zones d'intervention du jour (providers_live_zones) : second repère « en intervention près de <secteur> ». */
  zones?: { provider_id: string; lat: number; lng: number; label: string | null; full_name: string | null }[]
  onSelectZone?: (providerId: string) => void
  /** Hauteur (px) du bas de la carte cachée par la feuille : la position reste centrée dans la partie visible. */
  inset?: number
  /** Points à cadrer une fois (prestataires les plus proches quand personne n'est dans le rayon) ; `focusKey` = déclencheur. */
  focusPts?: { lat: number; lng: number }[]
  focusKey?: string
}) {
  return (
    <>
      <style>{`.leaflet-top.leaflet-left{top:158px}
        @media (max-width:999px){.leaflet-control-zoom{display:none !important}}
        .leaflet-container{background:#E9F1EA}
        .leaflet-control-attribution{font:9.5px/1.4 Inter,sans-serif !important;color:#6E8592 !important;background:rgba(255,255,255,.55) !important;padding:0 5px !important;border-radius:6px 0 0 0}
        .leaflet-control-attribution a{color:#6E8592 !important;text-decoration:none}.leaflet-control-zoom{z-index:400 !important}
        @keyframes pinIn{0%{opacity:0;transform:translateY(-14px) scale(.7)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .you-tip{background:#fff;border:none;box-shadow:0 2px 8px rgba(18,54,68,.2);border-radius:999px;padding:3px 10px;font-family:Quicksand,sans-serif;font-weight:700;font-size:11px;color:#123644}
        .you-tip::before{display:none}
        @keyframes pingEcho{0%{transform:scale(1);opacity:.55}100%{transform:scale(6);opacity:0}}
        .leaflet-marker-icon.ping-pin{pointer-events:none !important}
        .ping-pin .pin-hit,.ping-pin .pin-tag{pointer-events:auto;cursor:pointer}
        @keyframes pinLive{0%{transform:scale(.85);opacity:.55}70%,100%{transform:scale(1.55);opacity:0}}
        .pin-live{position:absolute;left:4px;top:4px;width:40px;height:40px;border-radius:50%;border:2px solid #12B39C;animation:pinLive 2.6s ease-out infinite;pointer-events:none}
        @media (prefers-reduced-motion: reduce){.pin-live{animation:none;display:none}}
        .ping-echo{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;border:2px solid #12B39C;animation:pingEcho 2.2s ease-out infinite;pointer-events:none}
        @media (prefers-reduced-motion: reduce){.ping-echo{animation:none;display:none}}`}</style>
      <MapContainer
        center={[userPos.lat, userPos.lng]}
        zoom={13}
        scrollWheelZoom={true}
        // Zoom au doigt (pincement) explicitement actif sur /map et /pro/carte : aucun CSS de l'app
        // ne pose de touch-action sur la carte ; Leaflet gère lui-même les gestes (leaflet.css).
        touchZoom={true}
        // Zoom libre partout : molette et pincement sur le point touché, double appui géré par DoubleTapZoom.
        doubleClickZoom={false}
        style={{ width: '100%', height: '100%' }}
        maxZoom={19}
        minZoom={4}
      >
        <AttributionPrefix />
        <PingBaseLayer />
        <FitAll userPos={userPos} pts={requests} recenterTick={recenterTick} fit={fit} fitKey={fitKey} fitPad={fitPad} inset={inset} />
        <MapClick onClick={onMapClick} />
        <DoubleTapZoom />
        <FocusPts pts={focusPts ?? []} focusKey={focusKey} inset={inset} />
        <DeclutterTags sig={`${pros.length}|${requests.length}|${zones.length}|${selectedId ?? ''}|${requests.map(r => r.label).join(',')}`} />
        {/* Position de l'utilisateur : toujours au-dessus des épingles, jamais cliquable (le toucher passe à l'épingle dessous). */}
        <Marker position={[userPos.lat, userPos.lng]} icon={userIcon(echo)} zIndexOffset={2000} interactive={false} keyboard={false}>
          <Tooltip permanent direction="bottom" offset={[0, 8]} className="you-tip">{youLabel}</Tooltip>
        </Marker>
        {pros.filter(p => p.lat != null && p.lng != null).map((p, i) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={proIcon(p, i, p.id === selectedId, !!newIds?.has(p.id))}
            zIndexOffset={p.id === selectedId ? 1000 : p.is_active ? 0 : -500}
            eventHandlers={{ click: () => onSelect(p) }}
          />
        ))}
        {zones.filter(z => z.lat != null && z.lng != null).map((z, i) => (
          <Marker
            key={`zone-${z.provider_id}`}
            position={[z.lat, z.lng]}
            icon={zoneIcon(i)}
            zIndexOffset={-100}
            eventHandlers={{ click: () => onSelectZone?.(z.provider_id) }}
          >
            <Tooltip direction="top" offset={[0, -62]} className="you-tip">
              {`${(z.full_name || 'Un prestataire').split(' ')[0]} en intervention près de ${z.label || 'ce secteur'}`}
            </Tooltip>
          </Marker>
        ))}
        {requests.filter(r => r.lat != null && r.lng != null).map((r, i) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={reqIcon(r.label, i, r.color, r.icon ? iconSvg(r.icon, 18) : '', r.id === selectedId)}
            zIndexOffset={r.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelectRequest?.(r.id) }}
          />
        ))}
      </MapContainer>
    </>
  )
}
