"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchProvidersNearby, ProviderNearby } from '@/lib/services'
import { trackEvent } from '@/lib/tracking'

const DEFAULT_POS = { lat: 43.6584, lng: 6.9225 } // Grasse

const TRADES: Record<string,string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage' }

export default function MapPage() {
  const router = useRouter()
  const [pos, setPos] = useState(DEFAULT_POS)
  const [trade, setTrade] = useState<string | null>(null)
  const [pros, setPros] = useState<ProviderNearby[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProviderNearby | null>(null)

  useEffect(() => { trackEvent('page_view') }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}, { timeout: 5000 }
      )
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchProvidersNearby(pos.lat, pos.lng, 15000, trade ?? undefined)
      .then(setPros)
      .finally(() => setLoading(false))
  }, [pos, trade])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
      <div style={{ padding: '16px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #E7EDEB' }}>
        <button onClick={() => setTrade(null)} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, background: !trade ? '#123644' : '#fff', color: !trade ? '#fff' : '#123644', boxShadow: !trade ? 'none' : '0 0 0 1px #E7EDEB' }}>Tous</button>
        {Object.entries(TRADES).map(([k,label]) => (
          <button key={k} onClick={() => setTrade(k)} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, background: trade===k ? '#123644' : '#fff', color: trade===k ? '#fff' : '#123644', boxShadow: trade===k ? 'none' : '0 0 0 1px #E7EDEB' }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: '#6E8592', fontSize: 13 }}>Recherche de prestataires…</p>}
        {!loading && pros.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <p style={{ fontWeight: 700 }}>Aucun prestataire actif pour l'instant</p>
            <p style={{ color: '#6E8592', fontSize: 12.5, marginTop: 4 }}>Réel — pas de démo ici. Les inscriptions réelles apparaîtront automatiquement.</p>
          </div>
        )}
        {pros.map(p => (
          <div key={p.id} onClick={() => setSelected(p)} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong style={{ fontFamily: 'Quicksand, sans-serif' }}>{TRADES[p.trade] || p.trade}</strong>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}>{(p.base_price_cents/100).toFixed(2)} €</span>
            </div>
            <div style={{ color: '#6E8592', fontSize: 12.5 }}>{p.rating}★ ({p.reviews_count}) · {(p.distance_m/1000).toFixed(1)} km</div>
          </div>
        ))}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', borderRadius: '20px 20px 0 0', padding: 20 }}>
            <h3 style={{ fontFamily: 'Quicksand, sans-serif' }}>{TRADES[selected.trade] || selected.trade}</h3>
            <p style={{ color: '#6E8592', fontSize: 13, marginTop: 6 }}>{selected.bio}</p>
            <button onClick={() => router.push(`/pro/${selected.id}`)} style={{ width: '100%', marginTop: 14, padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}>Voir la fiche complète</button>
          </div>
        </div>
      )}
    </div>
  )
}
