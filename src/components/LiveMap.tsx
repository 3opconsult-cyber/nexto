"use client"
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ProviderNearby } from '@/lib/services'

import { TRADES } from '@/lib/trades'

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

function proIcon(priceLabel: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;background:${active ? '#123644' : '#9CA3AF'};color:#fff;font-family:Quicksand,sans-serif;font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(18,54,68,.35);border:2px solid #fff">${priceLabel}</div>`,
    iconSize: undefined,
    iconAnchor: [30, 14],
  })
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng, map])
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
    <MapContainer
      center={[userPos.lat, userPos.lng]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%' }}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Recenter lat={userPos.lat} lng={userPos.lng} />
      <Marker position={[userPos.lat, userPos.lng]} icon={userIcon()} />
      {pros.filter(p => p.lat != null && p.lng != null).map(p => {
        const price = p.pricing_type === 'horaire'
          ? `${(p.hourly_rate_cents ?? 0) / 100}€/h`
          : `${(p.base_price_cents / 100).toFixed(0)}€`
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={proIcon(`${TRADES[p.trade] || p.trade} · ${price}`, p.is_active)}
            eventHandlers={{ click: () => onSelect(p) }}
          />
        )
      })}
    </MapContainer>
  )
}
