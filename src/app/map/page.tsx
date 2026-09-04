"use client"
import { useState, useEffect } from 'react'
import nextDynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { fetchProvidersNearby, ProviderNearby, openConversation } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { TRADES } from '@/lib/trades'
import PingTopBar from '@/components/ping/PingTopBar'
import PingTabBar from '@/components/ping/PingTabBar'

export const dynamic = 'force-dynamic'

const LiveMap = nextDynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECEAE3' }}>
      <span style={{ color: '#6E8592', fontSize: 13, fontWeight: 600 }}>Chargement de la carte…</span>
    </div>
  ),
})

const DEFAULT_POS = { lat: 43.6584, lng: 6.9225 }
type SortKey = 'distance' | 'rating' | 'price'

function priceLabel(p: ProviderNearby) {
  if (p.base_price_cents > 0) return `${(p.base_price_cents / 100).toFixed(0)} €`
  if (p.hourly_rate_cents != null && p.hourly_rate_cents > 0) return `${(p.hourly_rate_cents / 100).toFixed(0)} €/h`
  return '—'
}
function effectivePriceCents(p: ProviderNearby) {
  if (p.base_price_cents > 0) return p.base_price_cents
  if (p.hourly_rate_cents != null) return p.hourly_rate_cents
  return Number.MAX_SAFE_INTEGER
}

export default function MapPage() {
  const router = useRouter()
  const [pos, setPos] = useState(DEFAULT_POS)
  const [trade, setTrade] = useState<string>('menage')
  const [pros, setPros] = useState<ProviderNearby[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProviderNearby | null>(null)
  const [locStatus, setLocStatus] = useState<'locating' | 'granted' | 'default'>('locating')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showList, setShowList] = useState(false)
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
    } else { setLocStatus('default') }
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

  function openPreview(p: ProviderNearby) {
    setSelected(p); setSheetOpen(true)
    trackEvent('map_card_click', { provider_id: p.id })
  }
  function closePreview() { setSheetOpen(false); setTimeout(() => setSelected(null), 300) }

  async function contact(proId: string) {
    const { missionId } = await openConversation(proId)
    router.push(missionId ? `/mission/${missionId}/chat` : '/auth/login')
  }

  const CHIPS: [string, string][] = [['menage', 'Ménage'], ['repassage', 'Repassage'], ['nettoyage', 'Nettoyage']]

  return (
    <div className="ping-screen" style={{ paddingBottom: 64 }}>
      <div style={{ position: 'relative', width: '100%', height: 'calc(100dvh - 64px)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <LiveMap userPos={pos} pros={visible} onSelect={openPreview} />
        </div>

        <PingTopBar />

        <div className="ping-searchbar" onClick={() => setShowList(true)}>
          <span className="si"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M6 12h12M10 18h4" /></svg></span>
          <span className="st">Filtrer par service, près de vous</span>
        </div>

        <div className="ping-chiprow">
          {CHIPS.map(([k, label]) => (
            <button key={k} className={`ping-chip ${trade === k ? 'on' : ''}`} onClick={() => setTrade(k)}>{label}</button>
          ))}
          <button className="ping-chip" onClick={() => setShowList(true)}>+ Filtres</button>
        </div>

        <div className="ping-fabcol">
          <button className="ping-fab" onClick={relocate} aria-label="Me recentrer">PING</button>
          <button className="ping-fab sm" onClick={() => setShowList(true)} aria-label="Voir la liste">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </button>
        </div>

        {!loading && (
          <div style={{ position: 'absolute', left: 14, bottom: 84, zIndex: 31, background: 'var(--ink)', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 999, boxShadow: '0 8px 20px rgba(18,54,68,.3)' }}>
            {visible.length} personne{visible.length > 1 ? 's' : ''} disponible{visible.length > 1 ? 's' : ''} autour de vous
          </div>
        )}
      </div>

      <PingTabBar onPing={relocate} />

      <div className={`ping-preview-bg ${sheetOpen ? 'open' : ''}`} onClick={closePreview} />
      <div className={`ping-preview ${sheetOpen ? 'open' : ''}`}>
        {selected && (() => {
          const name = selected.full_name?.trim() || TRADES[selected.trade] || selected.trade
          const initial = name.charAt(0).toUpperCase()
          const bg = selected.avatar_hue != null ? `hsl(${selected.avatar_hue}, 55%, 45%)` : undefined
          const dist = selected.distance_m < 1000 ? `${Math.round(selected.distance_m)} m` : `${(selected.distance_m / 1000).toFixed(1)} km`
          return (
            <>
              <div className="grab" />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="ping-av" style={bg ? { background: bg } : undefined}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 16 }}>{name}</div>
                  <div style={{ color: 'var(--slate)', fontSize: 12.5, marginTop: 1 }}>
                    {TRADES[selected.trade] || selected.trade} · {selected.rating > 0 ? `${selected.rating.toFixed(1)} (${selected.reviews_count})` : 'Nouveau'} · à {dist}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15 }}>{priceLabel(selected)}</div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {selected.has_identity && <span className="ping-attest"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>Pièce d'identité fournie</span>}
                {selected.has_rcpro && <span className="ping-attest"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>Assurance RC renseignée</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, color: 'var(--tealD)', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--teal)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
                </span>
                Disponible maintenant
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="ping-btn ghost" style={{ flex: 1 }} onClick={() => contact(selected.id)}>Contacter</button>
                <button className="ping-btn" style={{ flex: 1.3 }} onClick={() => router.push(`/pro/${selected.id}`)}>Voir le profil</button>
              </div>
            </>
          )
        })()}
      </div>

      {showList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#fff', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <div className="ping-topbar solid" style={{ position: 'relative' }}>
            <button className="ping-burger" onClick={() => setShowList(false)} aria-label="Fermer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2.4" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span className="wd" style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 17 }}>Autour de vous</span>
          </div>
          <div className="ping-body pad" style={{ paddingBottom: 40 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {CHIPS.map(([k, label]) => (
                <button key={k} onClick={() => setTrade(k)} style={{ padding: '12px 6px', borderRadius: 14, border: trade === k ? '2px solid var(--teal)' : '2px solid var(--line)', background: trade === k ? 'rgba(18,179,156,.06)' : '#fff', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>

            <div className="ping-h2">Filtres</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[['id', fIdentity, () => setFIdentity((v: boolean) => !v), "Pièce d'identité fournie"],
                ['rc', fRcpro, () => setFRcpro((v: boolean) => !v), 'Assurance RC renseignée'],
                ['near', fNear, () => setFNear((v: boolean) => !v), '≤ 1 km'],
                ['rate', fRating, () => setFRating((v: boolean) => !v), '4★ et +']].map(([id, on, fn, label]: any) => (
                <button key={id} onClick={fn} className={`ping-chip ${on ? 'on' : ''}`}>{label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#fff', boxShadow: 'inset 0 0 0 1px var(--line)', marginBottom: 18 }}>
              {([['distance', 'Plus proches'], ['rating', 'Mieux notés'], ['price', 'Prix croissant']] as [SortKey, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 12, background: sort === k ? 'var(--ink)' : 'transparent', color: sort === k ? '#fff' : 'var(--slate)', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>

            <div className="ping-h2">{loading ? 'Recherche…' : `${visible.length} personne${visible.length > 1 ? 's' : ''} disponible${visible.length > 1 ? 's' : ''}`}</div>

            {visible.map(p => {
              const name = p.full_name?.trim() || TRADES[p.trade] || p.trade
              const initial = name.charAt(0).toUpperCase()
              const bg = p.avatar_hue != null ? `hsl(${p.avatar_hue}, 55%, 45%)` : undefined
              const dist = p.distance_m < 1000 ? `${Math.round(p.distance_m)} m` : `${(p.distance_m / 1000).toFixed(1)} km`
              const fav = favIds.has(p.id)
              return (
                <div key={p.id} className="ping-provcard" onClick={() => { setShowList(false); openPreview(p) }}>
                  <div className="ping-av sm" style={bg ? { background: bg } : undefined}>{initial}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{name}</div>
                    <div className="mt">{TRADES[p.trade] || p.trade} · à {dist}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleFav(p.id) }} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? '#FF7A66' : 'none'} stroke={fav ? '#FF7A66' : '#9CA3AF'} strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                  </button>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 13 }}>{p.rating > 0 ? `${p.rating.toFixed(1)} ★` : 'Nouveau'}</div>
                    <div className="pr" style={{ color: 'var(--slate)', fontSize: 12 }}>{priceLabel(p)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
