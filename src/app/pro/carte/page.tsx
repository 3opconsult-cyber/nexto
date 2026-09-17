"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import NavDrawer from '@/components/NavDrawer'
import BottomTabBar from '@/components/BottomTabBar'
import { fetchRequestsNearby, respondToRequest, type RequestNearby } from '@/lib/services'
import { TRADES } from '@/lib/trades'
import { createClient } from '@/lib/supabase/client'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

function distanceTxt(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}
function agoTxt(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}
function budgetTxt(cents: number | null) {
  return cents ? `${Math.round(cents / 100)} €` : 'Sur devis'
}

export default function ProCartePage() {
  const router = useRouter()
  const [userPos, setUserPos] = useState({ lat: 43.6584, lng: 6.9225 })
  const [reqs, setReqs] = useState<RequestNearby[]>([])
  const [recenterTick, setRecenterTick] = useState(0)
  const [available, setAvailable] = useState(true)
  const [proId, setProId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => { }, { timeout: 5000 })
    }
  }, [])

  // Le bandeau visible/masque doit refleter (et modifier) le vrai flag qui
  // conditionne l'apparition sur providers_nearby (provider_profiles.is_active),
  // pas juste un etat visuel local — sinon un pro se croit masque alors qu'il
  // reste visible des clients (ou l'inverse).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setProId(user.id)
      supabase.from('provider_profiles').select('is_active').eq('id', user.id).single()
        .then(({ data }) => { if (data) setAvailable(!!data.is_active) })
    })
  }, [])

  async function toggleAvailable() {
    if (!proId) return
    const next = !available
    setAvailable(next)
    await createClient().from('provider_profiles').update({ is_active: next }).eq('id', proId)
  }

  const load = useCallback(() => {
    fetchRequestsNearby(userPos.lat, userPos.lng, 25000).then(setReqs)
  }, [userPos.lat, userPos.lng])
  useEffect(() => { load() }, [load])

  const selected = selectedId ? reqs.find(r => r.id === selectedId) || null : null
  const nearest = reqs.length ? Math.round(reqs[0].distance_m) : null
  const nearestTxt = nearest == null ? '—' : distanceTxt(nearest)

  async function respond(r: RequestNearby) {
    setSending(true)
    const { missionId, error } = await respondToRequest(r.id)
    setSending(false)
    if (missionId) router.push(`/mission/${missionId}/chat`)
    else if (error === 'not_authenticated') router.push('/auth/login')
    // sinon (demande deja prise, erreur reseau...) : on reste sur la fiche, rien de casse.
  }

  // Détail d'une demande sélectionnée (pin carte ou carte de la liste) : les
  // coordonnées exactes du client ne sont jamais montrées ici (masquées côté
  // API tant que la mission n'est pas confirmée) — seule la distance l'est.
  const requestDetail = selected && (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div onClick={() => setSelectedId(null)} style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--paper)', flex: '0 0 auto' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 15, color: 'var(--ink)' }}>{TRADES[selected.category] || selected.category}</b>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: 'var(--slate)' }}>Distance</span><b style={{ color: 'var(--ink)' }}>à {distanceTxt(selected.distance_m)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: 'var(--slate)' }}>Publiée</span><b style={{ color: 'var(--ink)' }}>{agoTxt(selected.created_at)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: 'var(--slate)' }}>Budget indicatif</span><b style={{ color: 'var(--ink)' }}>{budgetTxt(selected.budget_cents)}</b>
        </div>
      </div>

      <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>Description du client</div>
      <p style={{ fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.5, marginBottom: 16 }}>{selected.description || '—'}</p>

      <p style={{ fontSize: 10.5, color: '#9aa6a3', lineHeight: 1.5, marginBottom: 14 }}>
        L&apos;adresse exacte et les coordonnées du client vous seront communiquées si votre proposition est acceptée.
      </p>

      <div className="btn" style={{ background: 'var(--teal)', opacity: sending ? .6 : 1, pointerEvents: sending ? 'none' : 'auto' }} onClick={() => respond(selected)}>
        {sending ? 'Envoi…' : 'Contacter le client'}
      </div>
    </>
  )

  // Contenu partagé entre la fiche mobile (bottom sheet ".preview") et le
  // panneau desktop (".detail-panel", toujours visible a cote de la carte) :
  // meme etat, meme actions, seule la mise en page differe selon l'ecran.
  const activityPanel = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: available ? 'var(--teal)' : '#c0503a', flex: '0 0 auto' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, color: 'var(--ink)' }}>{available ? 'Disponible maintenant' : 'Hors ligne'}</div>
          <div style={{ fontSize: 12, color: 'var(--slate)' }}>Vous apparaissez sur la carte des clients autour de vous</div>
        </div>
        <div onClick={toggleAvailable} style={{ width: 44, height: 26, borderRadius: 999, background: available ? 'var(--gold)' : '#cdd6d3', position: 'relative', cursor: 'pointer', flex: '0 0 auto', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 3, left: available ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0' }}>
        <span style={{ color: 'var(--slate)' }}>Demandes ouvertes autour de vous</span><b>{reqs.length}</b>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0 12px' }}>
        <span style={{ color: 'var(--slate)' }}>Distance de la plus proche</span><b>{nearestTxt}</b>
      </div>

      {reqs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {reqs.map(r => (
            <div key={r.id} onClick={() => setSelectedId(r.id)}
              style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 13, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 13, color: 'var(--ink)' }}>{TRADES[r.category] || r.category}</b>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0C8F7E', whiteSpace: 'nowrap' }}>{budgetTxt(r.budget_cents)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 3 }}>à {distanceTxt(r.distance_m)} · {agoTxt(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="procarte-screen">
      <div className="body full nopad procarte-body">
        <div className="mapwrap">
          <div className="topbar procarte-topbar">
            <span className="mobile-only"><NavDrawer dark={false} /></span>
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
              onSelectRequest={(id: string) => setSelectedId(id)}
              recenterTick={recenterTick}
              youLabel="Vous êtes ici"
            />
          </div>

          <div className="loc" onClick={() => setRecenterTick(t => t + 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></div>

          {/* Mobile : fiche remontant du bas. Desktop : cachee (.app-shell .preview),
              remplacee par le panneau permanent ci-dessous. */}
          <div className="preview on" style={{ padding: 14, maxHeight: '70vh', overflowY: 'auto' }}>
            {selected ? requestDetail : activityPanel}
          </div>

          {/* Desktop (>=1000px) : panneau permanent a cote de la carte, cachee sur
              mobile (.detail-panel { display:none } par defaut). */}
          <div className="detail-panel">
            {!selected && (
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 15, color: 'var(--ink)' }}>Votre activité</b>
              </div>
            )}
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {selected ? requestDetail : activityPanel}
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  )
}
