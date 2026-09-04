"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import NavDrawer from '@/components/NavDrawer'
import BottomTabBar from '@/components/BottomTabBar'
import { fetchRequestsNearby, type RequestNearby } from '@/lib/services'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

export default function ProCartePage() {
  const router = useRouter()
  const [userPos, setUserPos] = useState({ lat: 43.6584, lng: 6.9225 })
  const [reqs, setReqs] = useState<RequestNearby[]>([])
  const [recenterTick, setRecenterTick] = useState(0)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => { }, { timeout: 5000 })
    }
  }, [])

  const load = useCallback(() => {
    fetchRequestsNearby(userPos.lat, userPos.lng, 15000).then(setReqs)
  }, [userPos.lat, userPos.lng])
  useEffect(() => { load() }, [load])

  const nearest = reqs.length ? Math.round(reqs[0].distance_m) : null
  const nearestTxt = nearest == null ? '—' : nearest < 1000 ? `${nearest} m` : `${(nearest / 1000).toFixed(1)} km`

  return (
    <div className="stage">
      <div className="device"><div className="frame"><div className="screen" style={{ background: '#fff' }}>
        <div className="body full nopad">
          <div className="mapwrap">
            <div className="topbar">
              <NavDrawer dark={false} />
              <div className="pinglogo">
                <div className="mark">
                  <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.2" fill="none" stroke="var(--gold)" strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke="var(--gold)" strokeWidth={1.3} opacity=".6" /></svg>
                  <span className="d" style={{ background: 'var(--gold)' }} />
                </div>
                <span className="wd">ping</span>
              </div>
              <div className="sp" />
              <div className="tbell" onClick={() => router.push('/messages')}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                <span className="dot" />
              </div>
            </div>

            <div className="searchbar" style={{ background: '#fff' }}>
              <div className="si" style={{ background: 'rgba(242,169,59,.14)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
              </div>
              <span style={{ color: 'var(--slate)', fontWeight: 600 }}>Vous êtes visible · rayon 5 km</span>
            </div>

            <div className="chips">
              <div className="chip on" style={{ background: 'var(--ink)', color: '#fff' }}>Demandes ouvertes</div>
              <div className="chip">Mes interventions</div>
              <div className="chip">Autres pros</div>
            </div>

            <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
              <LiveMap
                userPos={userPos}
                pros={[]}
                onSelect={() => { }}
                requests={reqs.map(r => ({ id: r.id, lat: r.lat, lng: r.lng }))}
                onSelectRequest={() => router.push('/pro/dashboard')}
                recenterTick={recenterTick}
                youLabel="Vous êtes ici"
              />
            </div>

            <div className="loc" onClick={() => setRecenterTick(t => t + 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></div>

            <div className="preview on" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: available ? 'var(--teal)' : '#c0503a', flex: '0 0 auto' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, color: 'var(--ink)' }}>{available ? 'Disponible maintenant' : 'Hors ligne'}</div>
                  <div style={{ fontSize: 12, color: 'var(--slate)' }}>Vous apparaissez sur la carte des clients autour de vous</div>
                </div>
                <div onClick={() => setAvailable(a => !a)} style={{ width: 44, height: 26, borderRadius: 999, background: available ? 'var(--gold)' : '#cdd6d3', position: 'relative', cursor: 'pointer', flex: '0 0 auto', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: available ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0' }}>
                <span style={{ color: 'var(--slate)' }}>Demandes ouvertes autour de vous</span><b>{reqs.length}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0 12px' }}>
                <span style={{ color: 'var(--slate)' }}>Distance de la plus proche</span><b>{nearestTxt}</b>
              </div>
              <div className="btn" style={{ background: 'var(--teal)' }} onClick={() => router.push('/pro/dashboard')}>Voir les demandes</div>
            </div>
          </div>
        </div>
        <BottomTabBar />
      </div></div></div>
    </div>
  )
}
