"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchProsNearby, ProNearby } from '@/lib/services'
import { ServiceType, SERVICE_LABELS } from '@/types'

// Coordonnées par défaut : Grasse (06)
const DEFAULT_POS = { lat: 43.6584, lng: 6.9225 }

export default function MapPage() {
  const router = useRouter()
  const [pos, setPos] = useState(DEFAULT_POS)
  const [activeService, setActiveService] = useState<ServiceType | null>(null)
  const [pros, setPros] = useState<ProNearby[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPro, setSelectedPro] = useState<ProNearby | null>(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { timeout: 5000 }
      )
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchProsNearby(pos.lat, pos.lng, 15000, activeService ?? undefined)
      .then(setPros)
      .finally(() => setLoading(false))
  }, [pos, activeService])

  const services = Object.entries(SERVICE_LABELS) as [ServiceType, { label: string; emoji: string }][]

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--cream)' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2"
        style={{ background: 'linear-gradient(180deg, rgba(26,16,51,0.95) 60%, transparent)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-fredoka text-2xl text-white">Nexto</div>
          <button onClick={() => router.push('/client/profil')}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white text-sm">👤</span>
          </button>
        </div>

        {/* Filtres services — chips horizontales, RESTENT VISIBLES */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button onClick={() => setActiveService(null)}
            className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap transition-all flex-shrink-0"
            style={activeService === null
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'rgba(255,255,255,0.15)', color: 'white' }}>
            Tous
          </button>
          {services.map(([key, { label, emoji }]) => (
            <button key={key} onClick={() => setActiveService(key)}
              className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap transition-all flex-shrink-0"
              style={activeService === key
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone carte (placeholder visuel — pins) */}
      <div className="relative h-screen w-full overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #E8E4F0 0%, #F0EDE8 100%)' }}>
        {/* Grille décorative facon carte */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7C5CFC" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Position centrale (utilisateur) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-5 h-5 rounded-full border-4 border-white shadow-lg"
            style={{ background: 'var(--accent)' }} />
          <div className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'var(--accent)', opacity: 0.3 }} />
        </div>

        {/* Pins des pros — positionnés autour, RESTENT sur la carte */}
        {pros.map((pro, i) => {
          const angle = (i / Math.max(pros.length, 1)) * 2 * Math.PI
          const radius = 80 + (i % 3) * 50
          const x = 50 + Math.cos(angle) * (radius / 6)
          const y = 50 + Math.sin(angle) * (radius / 8)
          const initials = pro.company_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
          return (
            <button key={pro.pro_id}
              onClick={() => setSelectedPro(pro)}
              className="absolute z-10 transition-transform hover:scale-110"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-fredoka text-sm text-white shadow-lg border-2 border-white"
                  style={{ background: selectedPro?.pro_id === pro.pro_id ? 'var(--accent-d)' : 'var(--accent)' }}>
                  {initials}
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                  style={{ background: selectedPro?.pro_id === pro.pro_id ? 'var(--accent-d)' : 'var(--accent)' }} />
              </div>
            </button>
          )
        })}

        {loading && (
          <div className="absolute left-1/2 bottom-32 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-black text-white"
            style={{ background: 'rgba(26,16,51,0.8)' }}>
            Recherche de pros...
          </div>
        )}

        {!loading && pros.length === 0 && (
          <div className="absolute left-1/2 bottom-32 -translate-x-1/2 px-5 py-3 rounded-2xl text-center"
            style={{ background: 'white', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <div className="text-2xl mb-1">🔍</div>
            <div className="text-sm font-black text-navy">Aucun pro disponible ici</div>
            <div className="text-xs font-bold text-gray-400">Élargis ta recherche ou réessaie plus tard</div>
          </div>
        )}
      </div>

      {/* Compteur résultats */}
      {!loading && pros.length > 0 && !selectedPro && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-5 py-3 rounded-full font-black text-sm text-white whitespace-nowrap"
          style={{ background: 'var(--navy)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
          {pros.length} pro{pros.length > 1 ? 's' : ''} {activeService ? SERVICE_LABELS[activeService].label.toLowerCase() : ''} autour de vous
        </div>
      )}

      {/* Bottom sheet pro sélectionné (preview, PAS la fiche complète direct) */}
      {selectedPro && (
        <div className="fixed inset-0 z-30" onClick={() => setSelectedPro(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.2)' }} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-fredoka text-lg text-white"
                style={{ background: 'var(--accent)' }}>
                {selectedPro.company_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-fredoka text-lg text-navy">{selectedPro.company_name}</div>
                <div className="text-sm font-bold text-gray-400">
                  ⭐ {selectedPro.rating_avg?.toFixed(1) ?? '—'} ({selectedPro.rating_count}) · {(selectedPro.distance_m / 1000).toFixed(1)} km
                </div>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'var(--cream)' }}>
                <div className="font-fredoka text-lg" style={{ color: 'var(--accent)' }}>{selectedPro.hourly_rate ?? '—'} €</div>
                <div className="text-xs font-black text-gray-400">/ heure</div>
              </div>
              <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'var(--cream)' }}>
                <div className="font-fredoka text-lg" style={{ color: 'var(--accent)' }}>{selectedPro.travel_fee ?? 0} €</div>
                <div className="text-xs font-black text-gray-400">déplacement</div>
              </div>
            </div>
            <button onClick={() => router.push(`/pro/${selectedPro.pro_id}`)}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg"
              style={{ background: 'var(--accent)' }}>
              Voir la fiche complète →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
