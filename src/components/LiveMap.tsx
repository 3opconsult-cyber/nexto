"use client"
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
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

const TRADE_ICON_PATHS: Record<string, string> = {
  menage: '<path d="M19 5l-7 7M3 21l3-1 12-12a2 2 0 0 0-3-3L3 17z"/>',
  repassage: '<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-5h4v5"/>',
  nettoyage: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/>',
}

function proIcon(trade: string, active: boolean) {
  const iconPath = TRADE_ICON_PATHS[trade] || TRADE_ICON_PATHS.menage
  const bg = active ? '#12B39C' : '#9CA3AF'
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:${bg};transform:rotate(-45deg);box-shadow:0 3px 8px rgba(18,54,68,.35);border:2px solid #fff;display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(45deg);display:flex;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">${iconPath}</svg>
      </div>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  })
}

function FitAll({ userPos, pros }: { userPos: { lat: number; lng: number }; pros: ProviderNearby[] }) {
  const map = useMap()
  useEffect(() => {
    const pts: [number, number][] = [[userPos.lat, userPos.lng]]
    pros.forEach(p => { if (p.lat != null && p.lng != null) pts.push([p.lat, p.lng]) })
    if (pts.length === 1) {
      map.setView(pts[0], 13)
    } else {
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 })
    }
  }, [userPos.lat, userPos.lng, pros, map])
  return null
}

export default function LiveMap({
  userPos, pros, onSelect,
}: {
  userPos: { lat: number; lng: number }
  pros: ProviderNearby[]
  onSelect: (p: ProviderNearby) => void
}) {
  return (
    <>
      <style>{`.leaflet-top.leaflet-left{top:70px}`}</style>
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
        <FitAll userPos={userPos} pros={pros} />
        <Marker position={[userPos.lat, userPos.lng]} icon={userIcon()} />
        {pros.filter(p => p.lat != null && p.lng != null).map(p => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={proIcon(p.trade, p.is_active)}
            eventHandlers={{ click: () => onSelect(p) }}
          />
        ))}
      </MapContainer>
    </>
  )
}
