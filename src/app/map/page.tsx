"use client"
import { useState, useEffect } from 'react'
import nextDynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { fetchProvidersNearby, ProviderNearby } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { TRADES } from '@/lib/trades'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'
import { Sign } from '@/components/Brand'

// Sans ca, Next.js traite cette page comme statique (aucun fetch cote
// serveur, tout se passe en useEffect côté client) et la met en cache de
// facon persistante - un nouveau déploiement ne suffit alors pas a la
// rafraichir, elle continue de servir l'ancien HTML pendant un bon moment.
export const dynamic = 'force-dynamic'

const LiveMap = nextDynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F6F5' }}>
      <span style={{ color: '#6E8592', fontSize: 13, fontWeight: 600 }}>Chargement de la carte…</span>
    </div>
  ),
})

const DEFAULT_POS = { lat: 43.6584, lng: 6.9225 } // Grasse

const TRADE_ICONS: Record<string, JSX.Element> = {
  menage: <path d="M19 5l-7 7M3 21l3-1 12-12a2 2 0 0 0-3-3L3 17z" />,
  repassage: <><path d="M4 20h16M6 20V9l6-5 6 5v11" /><path d="M10 20v-5h4v5" /></>,
  nettoyage: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M12 4v16M4 12h16" /></>,
}

type SortKey = 'distance' | 'rating' | 'price'

function effectivePriceCents(p: ProviderNearby) {
  if (p.base_price_cents > 0) return p.base_price_cents
  if (p.hourly_rate_cents != null) return p.hourly_rate_cents
  return Number.MAX_SAFE_INTEGER
}

function priceLabel(p: ProviderNearby) {
  const hasFlat = p.base_price_cents > 0
  const hasHourly = p.hourly_rate_cents != null && p.hourly_rate_cents > 0
  if (hasFlat) return `${(p.base_price_cents / 100).toFixed(0)} €`
  if (hasHourly) return `${(p.hourly_rate_cents! / 100).toFixed(0)} €/h`
  return '—'
}

export default function MapPage() {
  const router = useRouter()
  const [pos, setPos] = useState(DEFAULT_POS)
  const [trade, setTrade] = useState<string>('menage')
  const [pros, setPros] = useState<ProviderNearby[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProviderNearby | null>(null)
  const [locStatus, setLocStatus] = useState<'locating' | 'granted' | 'default'>('locating')

  const [fIdentity, setFIdentity] = useState(false)
  const [fRcpro, setFRcpro] = useState(false)
  const [fNear, setFNear] = useState(false)
  const [fRating, setFRating] = useState(false)
  const [sort, setSort] = useState<SortKey>('distance')
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { trackEvent('page_view') }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('favorites').select('provider_id').eq('user_id', user.id)
        .then(({ data }) => setFavIds(new Set((data ?? []).map((f: any) => f.provider_id))))
    })
  }, [])

  async function toggleFav(providerId: string) {
    if (!userId) { router.push('/auth/login'); return }
    const supabase = createClient()
    if (favIds.has(providerId)) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('provider_id', providerId)
      setFavIds(s => { const n = new Set(s); n.delete(providerId); return n })
    } else {
      await supabase.from('favorites').insert({ user_id: userId, provider_id: providerId })
      setFavIds(s => new Set(s).add(providerId))
    }
  }

  function relocate() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocStatus('granted') },
        () => setLocStatus('default'),
        { timeout: 5000 }
      )
    } else {
      setLocStatus('default')
    }
  }

  useEffect(() => { relocate() }, [])

  useEffect(() => {
    setLoading(true)
    fetchProvidersNearby(pos.lat, pos.lng, 15000, trade)
      .then(setPros)
      .finally(() => setLoading(false))
  }, [pos, trade])

  const visible = pros
    .filter(p => !fIdentity || p.has_identity)
    .filter(p => !fRcpro || p.has_rcpro)
    .filter(p => !fNear || p.distance_m <= 1000)
    .filter(p => !fRating || p.rating >= 4)
    .sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating
      if (sort === 'price') return effectivePriceCents(a) - effectivePriceCents(b)
      return a.distance_m - b.distance_m
    })

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12.5, background: on ? '#123644' : '#fff', color: on ? '#fff' : '#123644', boxShadow: on ? 'none' : '0 0 0 1px #E7EDEB', flexShrink: 0, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', paddingBottom: 60 }}>

      {/* Carte réelle, plein cadre — la barre du haut flotte par-dessus, comme /demo */}
      <div style={{ position: 'relative', width: '100%', height: '62vh', minHeight: 360, background: '#F3F6F5' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <LiveMap userPos={pos} pros={pros} onSelect={setSelected} />
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 34, height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'rgba(255,255,255,.97)', borderBottom: '1px solid #E7EDEB' }}>
          <NavDrawer dark={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Sign size={22} />
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>ping</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => router.push('/messages')} aria-label="Messages"
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
          </button>
        </div>

        <div style={{ position: 'absolute', bottom: 4, right: 6, zIndex: 900, fontSize: 9, color: 'rgba(18,54,68,.4)', background: 'rgba(255,255,255,.6)', padding: '1px 5px', borderRadius: 4, pointerEvents: 'none' }}>
          © OpenStreetMap © CARTO
        </div>
        {locStatus === 'default' && (
          <div style={{ position: 'absolute', top: 66, left: 10, right: 10, zIndex: 1000, background: 'rgba(18,54,68,.92)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '8px 12px', borderRadius: 10, textAlign: 'center' }}>
            Localisation non partagée — carte centrée sur Grasse par défaut
          </div>
        )}
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* Categories */}
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Que recherchez-vous ?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          {Object.entries(TRADES).map(([k, label]) => (
            <button key={k} onClick={() => setTrade(k)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px', borderRadius: 14, border: trade === k ? '2px solid #12B39C' : '2px solid #E7EDEB', background: trade === k ? 'rgba(18,179,156,.06)' : '#fff', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={trade === k ? '#12B39C' : '#123644'} strokeWidth="2">{TRADE_ICONS[k]}</svg>
              <span style={{ fontWeight: 700, fontSize: 12.5, color: '#123644' }}>{label}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 20 }}>D'autres services seront ouverts progressivement sur PING.</p>

        {/* Filtres */}
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Filtres</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {chip(fIdentity, 'Pièce d\u2019identité fournie', () => setFIdentity(v => !v))}
          {chip(fRcpro, 'Assurance RC renseignée', () => setFRcpro(v => !v))}
          {chip(fNear, '\u2264 1 km', () => setFNear(v => !v))}
          {chip(fRating, '4\u2605 et +', () => setFRating(v => !v))}
        </div>

        {/* Tri */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#fff', boxShadow: '0 0 0 1px #E7EDEB', marginBottom: 20 }}>
          {([['distance', 'Plus proches'], ['rating', 'Mieux notés'], ['price', 'Prix croissant']] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 12, background: sort === k ? '#123644' : 'transparent', color: sort === k ? '#fff' : '#6E8592' }}>{label}</button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
          {loading ? 'Recherche…' : `${visible.length} personne${visible.length > 1 ? 's' : ''} disponible${visible.length > 1 ? 's' : ''}`}
          {!loading && visible.length > 0 && <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, color: '#6E8592', marginLeft: 8 }}>triées par {sort === 'distance' ? 'distance' : sort === 'rating' ? 'note' : 'prix'}</span>}
        </div>

        <div style={{ paddingBottom: 24 }}>
          {!loading && pros.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 20, textAlign: 'center', marginTop: 12 }}>
              <p style={{ fontWeight: 700 }}>Aucun prestataire actif pour l'instant</p>
              <p style={{ color: '#6E8592', fontSize: 12.5, marginTop: 4 }}>Réel — pas de démo ici. Les inscriptions réelles apparaîtront automatiquement.</p>
            </div>
          )}
          {!loading && pros.length > 0 && visible.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 20, textAlign: 'center', marginTop: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 13 }}>Personne ne correspond à ces filtres</p>
            </div>
          )}
          {visible.map(p => {
            const name = p.full_name?.trim() || TRADES[p.trade] || p.trade
            const initial = name.charAt(0).toUpperCase()
            const bg = p.avatar_hue != null ? `hsl(${p.avatar_hue}, 55%, 45%)` : '#12B39C'
            const badges = [p.has_identity && 'identité fournie', p.has_rcpro && 'assurance RC renseignée'].filter(Boolean).join(' · ')
            const fav = favIds.has(p.id)
            return (
              <div key={p.id} onClick={() => { setSelected(p); trackEvent('map_card_click', { provider_id: p.id }) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 12, marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>{name}</div>
                  <div style={{ color: '#6E8592', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {TRADES[p.trade] || p.trade}{badges ? ` · ${badges}` : ''} · à {p.distance_m < 1000 ? `${Math.round(p.distance_m)} m` : `${(p.distance_m / 1000).toFixed(1)} km`}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleFav(p.id) }} style={{ border: 'none', background: 'none', padding: 4, flexShrink: 0, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? '#FF7A66' : 'none'} stroke={fav ? '#FF7A66' : '#9CA3AF'} strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                </button>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>{p.rating > 0 ? p.rating.toFixed(1) : 'Nouveau'}{p.rating > 0 && <span style={{ color: '#F59E0B' }}> ★</span>}</div>
                  <div style={{ color: '#6E8592', fontSize: 12 }}>{priceLabel(p)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (() => {
        const name = selected.full_name?.trim() || TRADES[selected.trade] || selected.trade
        const initial = name.charAt(0).toUpperCase()
        const bg = selected.avatar_hue != null ? `hsl(${selected.avatar_hue}, 55%, 45%)` : '#12B39C'
        const badges = [selected.has_identity && 'Identité fournie', selected.has_rcpro && 'Assurance RC'].filter(Boolean) as string[]
        return (
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: '#E7EDEB', margin: '0 auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17 }}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>{name}</h3>
                  <div style={{ color: '#6E8592', fontSize: 12, marginTop: 2 }}>{TRADES[selected.trade] || selected.trade} · à {selected.distance_m < 1000 ? `${Math.round(selected.distance_m)} m` : `${(selected.distance_m / 1000).toFixed(1)} km`}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>{priceLabel(selected)}</div>
                  <div style={{ fontSize: 11, color: '#6E8592' }}>{selected.rating > 0 ? `${selected.rating.toFixed(1)} ★` : 'Nouveau'}</div>
                </div>
              </div>
              {badges.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {badges.map(b => (
                    <span key={b} style={{ fontSize: 10.5, fontWeight: 700, color: '#0C8F7E', background: 'rgba(18,179,156,.1)', padding: '3px 9px', borderRadius: 999 }}>{b}</span>
                  ))}
                </div>
              )}
              {selected.bio && <p style={{ color: '#6E8592', fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{selected.bio}</p>}
              <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
                <button onClick={() => router.push(`/pro/${selected.id}`)} style={{ flex: 1, padding: 13, borderRadius: 999, border: '1.5px solid #E7EDEB', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>Voir le profil</button>
                <button onClick={() => router.push(`/mission/new?pro=${selected.id}`)} style={{ flex: 1.3, padding: 13, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>Demander un devis</button>
              </div>
            </div>
          </div>
        )
      })()}
      <BottomTabBar onPing={relocate} />
    </div>
  )
}
