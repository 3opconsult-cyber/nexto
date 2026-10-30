"use client"
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ProviderNearby } from '@/lib/services'

// Icônes en divIcon (HTML/CSS inline) : évite le piège classique de Leaflet sous
// webpack/Next.js où les PNG de marqueurs par défaut ne se résolvent pas et où
// les pins deviennent invisibles.
function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#12B39C;border:3px solid #fff;box-shadow:0 0 0 4px rgba(18,179,156,.25),0 2px 6px rgba(0,0,0,.25)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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

// Épingle commune à toutes les cartes : le prix (ou budget) dans une étiquette AU-DESSUS de la
// goutte, jamais recouvert par elle, et une goutte pleine avec un point blanc au centre.
const PIN_W = 84
function pinIcon(color: string, label: string | null, i = 0) {
  const tag = label
    ? `<div style="background:#123644;color:#fff;font-family:Quicksand,sans-serif;font-weight:700;font-size:12px;line-height:1;padding:5px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(18,54,68,.3);border:1.5px solid #fff;margin-bottom:4px">${label}</div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="width:${PIN_W}px;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;animation:pinIn .45s cubic-bezier(.22,1.2,.36,1) both;animation-delay:${(i * 0.12).toFixed(2)}s">
      ${tag}
      <div style="width:28px;height:28px;margin-bottom:9px;flex-shrink:0;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:0 3px 8px rgba(18,54,68,.35);border:2px solid #fff;display:flex;align-items:center;justify-content:center">
        <div style="width:9px;height:9px;border-radius:50%;background:#fff"></div>
      </div>
    </div>`,
    iconSize: [PIN_W, 62],
    // Pointe de la goutte : centre horizontal, bas du conteneur.
    iconAnchor: [PIN_W / 2, 57],
  })
}

function proIcon(p: { trade: string; is_active: boolean; pricing_type: string; base_price_cents: number; hourly_rate_cents: number | null }, i = 0) {
  return pinIcon(p.is_active ? '#12B39C' : '#9CA3AF', pinPriceLabel(p), i)
}
function reqIcon(label: string | null | undefined, i = 0, color = '#F2A93B') {
  return pinIcon(color, label ?? null, i)
}

function FitAll({ userPos, pros, pts: extra, recenterTick }: { userPos: { lat: number; lng: number }; pros: ProviderNearby[]; pts?: { lat: number; lng: number }[]; recenterTick?: number }) {
  const map = useMap()
  useEffect(() => {
    const pts: [number, number][] = [[userPos.lat, userPos.lng]]
    pros.forEach(p => { if (p.lat != null && p.lng != null) pts.push([p.lat, p.lng]) })
    ;(extra || []).forEach(p => { if (p.lat != null && p.lng != null) pts.push([p.lat, p.lng]) })
    if (pts.length === 1) {
      map.setView(pts[0], 13)
    } else {
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 })
    }
    setTimeout(() => map.invalidateSize(), 100)
  }, [userPos.lat, userPos.lng, pros, extra, map, recenterTick])
  return null
}

type ReqPin = { id: string; lat: number; lng: number; label?: string | null; color?: string }
export default function LiveMap({
  userPos, pros, onSelect, recenterTick, requests = [], onSelectRequest, youLabel = 'Vous êtes ici',
}: {
  userPos: { lat: number; lng: number }
  pros: ProviderNearby[]
  onSelect: (p: ProviderNearby) => void
  recenterTick?: number
  requests?: ReqPin[]
  onSelectRequest?: (id: string) => void
  youLabel?: string
}) {
  return (
    <>
      <style>{`.leaflet-top.leaflet-left{top:158px}.leaflet-control-zoom{z-index:400 !important}
        @keyframes pinIn{0%{opacity:0;transform:translateY(-14px) scale(.7)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .you-tip{background:#fff;border:none;box-shadow:0 2px 8px rgba(18,54,68,.2);border-radius:999px;padding:3px 10px;font-family:Quicksand,sans-serif;font-weight:700;font-size:11px;color:#123644}
        .you-tip::before{display:none}`}</style>
      <MapContainer
        center={[userPos.lat, userPos.lng]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
          maxZoom={19}
        />
        <FitAll userPos={userPos} pros={pros} pts={requests} recenterTick={recenterTick} />
        <Marker position={[userPos.lat, userPos.lng]} icon={userIcon()}>
          <Tooltip permanent direction="bottom" offset={[0, 8]} className="you-tip">{youLabel}</Tooltip>
        </Marker>
        {pros.filter(p => p.lat != null && p.lng != null).map((p, i) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={proIcon(p, i)}
            eventHandlers={{ click: () => onSelect(p) }}
          />
        ))}
        {requests.filter(r => r.lat != null && r.lng != null).map((r, i) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={reqIcon(r.label, i, r.color)}
            eventHandlers={{ click: () => onSelectRequest?.(r.id) }}
          />
        ))}
      </MapContainer>
    </>
  )
}
