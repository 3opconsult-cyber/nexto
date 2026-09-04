"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { fetchProvidersNearby, type ProviderNearby } from '@/lib/services'

// LiveMap = react-leaflet + tuiles OSM (comme la carte du Super Admin).
// Chargé côté client uniquement : Leaflet touche window au chargement.
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false })

// ============================================================
// COQUE /demo — reproduit le mecanisme .view/.view.on d'app.html.
// (mode, view) = etat ; go/back/setMode = setState. CSS verbatim inchange.
// ============================================================

type Pro = {
  id: string; av: string; n: string; m: string; p: string;
  d: string; c: string[]; g: string; cat: string;
  dist: number; rate: number; priceN: number
}

const CHK = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
)
const HUES: Record<string, string> = {
  menage: '#12B39C,#0C8F7E', repassage: '#6E8592,#4c6472', nettoyage: '#F2A93B,#d98a1f',
  vitres: '#12B39C,#0e7f70', remise: '#FF7A66,#e05f4b',
}
const TRAD: Record<string, string> = {
  menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres', remise: 'Remise en état',
}

export default function DemoShell({ initialView = 'v_map' }: { initialView?: string }) {
  const router = useRouter()
  const [view, setViewState] = useState(initialView)
  const [prevView, setPrevView] = useState('v_map')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mapCat, setMapCat] = useState('tous')
  const [rawPros, setRawPros] = useState<ProviderNearby[]>([])
  const [userPos, setUserPos] = useState({ lat: 43.6584, lng: 6.9225 })
  const [recenterTick, setRecenterTick] = useState(0)
  const [pvIndex, setPvIndex] = useState(0)
  const [pvShow, setPvShow] = useState(false)
  const [searchCat, setSearchCat] = useState('tous')
  const [sortMode, setSortMode] = useState<'near' | 'rated' | 'price'>('near')
  const [flt, setFlt] = useState<Set<string>>(() => new Set(['Dispo maintenant']))

  const go = useCallback((v: string) => { setPrevView(view); setViewState(v); setMenuOpen(false) }, [view])
  const back = useCallback((v: string) => { setViewState(v); setMenuOpen(false) }, [])

  // Position de l'utilisateur : géoloc réelle, repli Grasse.
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => { }, { timeout: 5000 })
    }
  }, [])

  // Chargement réel des prestataires (providers_nearby renvoie lat/lng réels).
  const loadPros = useCallback(() => {
    fetchProvidersNearby(userPos.lat, userPos.lng, 15000).then(setRawPros)
  }, [userPos.lat, userPos.lng])
  useEffect(() => { loadPros() }, [loadPros])

  // Forme d'affichage (fiche + liste) dérivée des vraies lignes.
  const pros: Pro[] = useMemo(() => rawPros.map(x => {
    const nm = (x.full_name || TRAD[x.trade] || x.trade || '').trim()
    const price = x.base_price_cents > 0 ? `${(x.base_price_cents / 100).toFixed(0)} €`
      : (x.hourly_rate_cents ? `${(x.hourly_rate_cents / 100).toFixed(0)} €/h` : '')
    const distTxt = x.distance_m < 1000 ? `${Math.round(x.distance_m)} m` : `${(x.distance_m / 1000).toFixed(1)} km`
    const rateTxt = x.rating > 0 ? `${x.rating.toFixed(1)} (${x.reviews_count || 0})` : 'Nouveau'
    const chips: string[] = []
    if (x.has_identity) chips.push('Pièce d’identité fournie')
    if (x.has_rcpro) chips.push('Assurance RC renseignée')
    return {
      id: x.id, av: (nm.charAt(0) || '?').toUpperCase(), n: nm,
      m: `${TRAD[x.trade] || x.trade} · ${rateTxt} · à ${distTxt}`, p: price,
      d: 'Disponible maintenant', c: chips, g: HUES[x.trade] || HUES.menage, cat: x.trade,
      dist: x.distance_m ?? 0, rate: x.rating ?? 0,
      priceN: x.base_price_cents > 0 ? x.base_price_cents : (x.hourly_rate_cents ?? 0),
    }
  }), [rawPros])

  function closePreview() { setPvShow(false) }

  const pv = pros[pvIndex]
  // Prestataires réels filtrés par catégorie, passés à la carte Leaflet.
  const rawVisible = useMemo(
    () => rawPros.filter(p => mapCat === 'tous' || p.trade === mapCat),
    [rawPros, mapCat])
  function onSelectPro(p: ProviderNearby) {
    const i = pros.findIndex(q => q.id === p.id)
    if (i >= 0) { setPvIndex(i); setPvShow(true) }
  }
  const searchList = [...pros]
    .filter(p => searchCat === 'tous' || p.cat === searchCat)
    .sort((a, b) =>
      sortMode === 'rated' ? b.rate - a.rate
        : sortMode === 'price' ? a.priceN - b.priceN
          : a.dist - b.dist)
  function tglFlt(f: string) {
    setFlt(s => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n })
  }

  return (
    <div className="stage" id="stage">
      <div className="device">
        <div className="frame"><div className="screen" id="screen">

          {/* ===================== v_map ===================== */}
          <section className={`view ${view === 'v_map' ? 'on' : ''}`} id="v_map" data-tab="map">
            <div className="body full nopad">
              <div className="mapwrap">
                <div className="topbar">
                  <div className="burger" onClick={() => setMenuOpen(true)}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                  </div>
                  <div className="pinglogo">
                    <div className="mark">
                      <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.2" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".6" /></svg>
                      <span className="d" />
                    </div>
                    <div><div className="wd">ping</div></div>
                  </div>
                  <div className="sp" />
                  <div className="tbell" onClick={() => router.push('/messages')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
                    <span className="bdg" />
                  </div>
                </div>

                <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
                  <LiveMap userPos={userPos} pros={rawVisible} onSelect={onSelectPro} recenterTick={recenterTick} />
                </div>

                <div className="searchbar" style={{ top: 66 }} onClick={() => go('v_search')}>
                  <div className="lg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}><path d="M4 6h16M7 12h10M10 18h4" /></svg></div>
                  <div className="tx">Filtrer par service, près de vous</div>
                </div>

                <div className="chips" style={{ top: 118 }}>
                  <div className={`chip ${mapCat === 'tous' ? 'on' : ''}`} onClick={() => setMapCat('tous')}>Tous</div>
                  <div className={`chip ${mapCat === 'menage' ? 'on' : ''}`} onClick={() => setMapCat('menage')}>Ménage</div>
                  <div className={`chip ${mapCat === 'repassage' ? 'on' : ''}`} onClick={() => setMapCat('repassage')}>Repassage</div>
                  <div className={`chip ${mapCat === 'nettoyage' ? 'on' : ''}`} onClick={() => setMapCat('nettoyage')}>Nettoyage</div>
                </div>

                <div className="pingbtn" onClick={() => loadPros()}><span className="halo" /><span className="lbl">PING</span></div>
                <div className="zoomctl"><div className="zb">+</div><div className="zb">−</div></div>
                <div className="loc" onClick={() => setRecenterTick(t => t + 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></div>

                <div className={`preview ${pvShow ? 'show' : ''}`} id="preview">
                  <div className="pvh" />
                  {pv && (
                    <>
                      <div className="pvrow">
                        <div className="pvav" style={{ background: `linear-gradient(160deg,${pv.g})` }}>{pv.av}</div>
                        <div style={{ flex: 1 }}>
                          <div className="pvname">{pv.n}</div>
                          <div className="pvmeta">{pv.m}</div>
                          <div className="chipset">{pv.c.map((x, i) => <span key={i} className="vchip ok">{CHK}{x}</span>)}</div>
                        </div>
                        <div className="pvprice">{pv.p}</div>
                      </div>
                      <div className="dispo" style={{ marginTop: 11 }}><span className="livedot on" /> <span>{pv.d}</span></div>
                      <div style={{ display: 'flex', gap: 9, marginTop: 10 }}>
                        <div className="btn ghost" style={{ flex: 1 }} onClick={() => { closePreview(); router.push(`/pro/${pv.id}`) }}>Contacter</div>
                        <div className="btn" style={{ flex: 1.3 }} onClick={() => { closePreview(); router.push(`/pro/${pv.id}`) }}>Voir le profil</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ===================== v_search ===================== */}
          <section className={`view ${view === 'v_search' ? 'on' : ''}`} id="v_search" data-tab="map">
            <div className="appbar">
              <div className="burger" onClick={() => back('v_map')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </div>
              <b>Recherche</b>
            </div>
            <div className="body">
              <div className="h2" style={{ marginTop: 0 }}>Que recherchez-vous&nbsp;?</div>
              <div className="catgrid">
                {([['menage', 'Ménage'], ['nettoyage', 'Nettoyage'], ['repassage', 'Blanchisserie'], ['vitres', 'Vitres']] as const).map(([key, label]) => (
                  <div key={key} className={`cat ${searchCat === key ? 'on' : ''}`} onClick={() => setSearchCat(searchCat === key ? 'tous' : key)}>
                    <div className="ci"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 5l-7 7M3 21l3-1 12-12a2 2 0 0 0-3-3L3 17z" /></svg></div>{label}
                  </div>
                ))}
              </div>
              <p className="sub" style={{ fontSize: 11, color: '#9aa6a3' }}>D&apos;autres services seront ouverts progressivement sur PING.</p>
              <div className="h2">Filtres</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Dispo maintenant', 'Pièce d’identité fournie', 'Assurance RC renseignée', '≤ 1 km', '4★ et +'].map(f => (
                  <div key={f} className={`chip ${flt.has(f) ? 'on' : ''}`} onClick={() => tglFlt(f)}>{f}</div>
                ))}
              </div>
              <div className="seg" id="sortSeg">
                <div className={sortMode === 'near' ? 'on' : ''} onClick={() => setSortMode('near')}>Plus proches</div>
                <div className={sortMode === 'rated' ? 'on' : ''} onClick={() => setSortMode('rated')}>Mieux notés</div>
                <div className={sortMode === 'price' ? 'on' : ''} onClick={() => setSortMode('price')}>Prix croissant</div>
              </div>
              <div className="h2">{searchList.length} personne{searchList.length > 1 ? 's' : ''} disponible{searchList.length > 1 ? 's' : ''}<span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, marginLeft: 6 }}>triées par {sortMode === 'rated' ? 'note' : sortMode === 'price' ? 'prix' : 'distance'}</span></div>
              {searchList.map(p => (
                <div key={p.id} className="row" onClick={() => router.push(`/pro/${p.id}`)}>
                  <div className="av" style={{ background: `linear-gradient(160deg,${p.g})` }}>{p.av}</div>
                  <div className="m"><div className="nm">{p.n}</div><div className="ds">{p.m}</div></div>
                  <div className="rt"><b>{p.rate > 0 ? p.rate.toFixed(1) : 'Nouveau'}</b>{p.p}</div>
                </div>
              ))}
              {searchList.length === 0 && <p className="sub" style={{ color: 'var(--slate)' }}>Aucun prestataire dans cette catégorie pour le moment.</p>}
            </div>
          </section>

          {/* ===================== TABBAR ===================== */}
          <nav className="tabbar" id="tabbar_part">
            <div className={`tab ${view === 'v_map' ? 'on' : ''}`} data-t="map" onClick={() => go('v_map')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>Carte
            </div>
            <div className="tab tping" data-t="ping" onClick={() => loadPros()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9" strokeLinecap="round" /><path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 19.4a10.4 10.4 0 0 0 0-14.8" strokeLinecap="round" opacity=".55" /></svg>PING
            </div>
          </nav>

          {/* ===================== DRAWER ===================== */}
          <div className={`scrim ${menuOpen ? 'on' : ''}`} id="scrim" onClick={() => setMenuOpen(false)} />
          <aside className={`drawer ${menuOpen ? 'on' : ''}`} id="drawer">
            <div className="dh">
              <div className="pinglogo"><div className="mark"><svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.2" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".6" /></svg><span className="d" /></div><div><div className="wd">ping</div><div className="tg">Services de proximité</div></div></div>
              <div className="du">
                <div className="av2">J</div>
                <div><div className="nm">Vous</div><div className="ds">Grasse · membre</div></div>
              </div>
            </div>
            <nav className="dnav">
              <div className="dlink on" onClick={() => go('v_map')}>Carte</div>
              <div className="dlink" onClick={() => router.push('/messages')}>Messages</div>
              <div className="dlink" onClick={() => router.push('/agenda')}>Agenda</div>
              <div className="dlink" onClick={() => router.push('/documents')}>Mes documents</div>
              <div className="dlink" onClick={() => router.push('/client/profil')}>Profil</div>
              <div className="dsep" />
              <div className="dlink" onClick={() => router.push('/comment-ca-marche')}>Comment ça marche</div>
              <div className="dlink" onClick={() => router.push('/client/parrainage')}>Mon parrainage</div>
            </nav>
            <div className="dfoot">
              <div className="modeswitch" onClick={() => router.push('/pro/dashboard')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></svg>
                <div className="t"><b>Passer en mode pro</b><small>Proposer mes services</small></div>
                <div className="sw"><span /></div>
              </div>
            </div>
          </aside>

        </div></div>
      </div>
    </div>
  )
}
