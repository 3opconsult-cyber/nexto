"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { fetchProvidersNearby, fetchProviderActivities, openConversation, type ProviderNearby } from '@/lib/services'
import { TRADES, ALL_TRADE_KEYS } from '@/lib/trades'
import NavDrawer from './NavDrawer'
import ModeSwitchPill from './ModeSwitchPill'

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
  reviews: number; active: boolean; identity: boolean; rcpro: boolean
  acts: string[]; hits: number
}

const CHK = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
)
const HUES: Record<string, string> = {
  menage: '#12B39C,#0C8F7E', repassage: '#4E6470,#4c6472', nettoyage: '#F2A93B,#8A6520',
  vitres: '#12B39C,#0e7f70', remise: '#FF7A66,#e05f4b',
}
// Libellés : catalogue unique src/lib/trades.ts (+ « remise » hérité, absent du catalogue).
const TRAD: Record<string, string> = { remise: 'Remise en état', ...TRADES }
const lab = (k: string) => TRAD[k] || k

export default function DemoShell({ initialView = 'v_map' }: { initialView?: string }) {
  const router = useRouter()
  const [view, setViewState] = useState(initialView)
  const [prevView, setPrevView] = useState('v_map')
  // Activités choisies (plusieurs à la fois, ex. ménage + vitres). Vide = « Tous » = aucun filtre.
  // Une seule sélection pilote les épingles de la carte ET la liste de recherche.
  const [sel, setSel] = useState<string[]>([])
  const [rawPros, setRawPros] = useState<ProviderNearby[]>([])
  const [acts, setActs] = useState<Record<string, string[]>>({})
  const [userPos, setUserPos] = useState({ lat: 43.6584, lng: 6.9225 })
  const [recenterTick, setRecenterTick] = useState(0)
  const [pvIndex, setPvIndex] = useState(0)
  const [pvShow, setPvShow] = useState(false)
  const [sortMode, setSortMode] = useState<'near' | 'rated' | 'price'>('near')
  const [flt, setFlt] = useState<Set<string>>(() => new Set())
  const [contactErr, setContactErr] = useState('')

  const go = useCallback((v: string) => { setPrevView(view); setViewState(v) }, [view])
  const back = useCallback((v: string) => { setViewState(v) }, [])

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
    fetchProvidersNearby(userPos.lat, userPos.lng, 15000).then(list => {
      setRawPros(list)
      // Activités = métier principal + métiers des prestations (table services).
      fetchProviderActivities(list).then(setActs).catch(() => { })
    })
  }, [userPos.lat, userPos.lng])
  const actsOf = useCallback((x: { id: string; trade: string }) => acts[x.id] || (x.trade ? [x.trade] : []), [acts])
  const hitsOf = useCallback((x: { id: string; trade: string }) => {
    const a = actsOf(x); return sel.filter(k => a.includes(k)).length
  }, [actsOf, sel])
  function toggleSel(k: string) {
    setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])
  }
  useEffect(() => { loadPros() }, [loadPros])

  // Forme d'affichage (fiche + liste) dérivée des vraies lignes.
  const pros: Pro[] = useMemo(() => rawPros.map(x => {
    const nm = (x.full_name || TRAD[x.trade] || x.trade || '').trim()
    const price = x.pricing_type === 'devis' ? 'Sur devis'
      : x.base_price_cents > 0 ? `${(x.base_price_cents / 100).toFixed(0)} €`
        : (x.hourly_rate_cents ? `${(x.hourly_rate_cents / 100).toFixed(0)} €/h` : '')
    const distTxt = x.distance_m < 1000 ? `${Math.round(x.distance_m)} m` : `${(x.distance_m / 1000).toFixed(1).replace(".", ",")} km`
    const rateTxt = x.rating > 0 ? `${x.rating.toFixed(1)} (${x.reviews_count || 0})` : 'Nouveau'
    const chips: string[] = []
    if (x.has_identity) chips.push('Pièce d’identité fournie')
    if (x.has_rcpro) chips.push('Assurance RC renseignée')
    return {
      id: x.id, av: (nm.charAt(0) || '?').toUpperCase(), n: nm,
      m: `${actsOf(x).map(lab).join(', ')} · ${rateTxt} · à ${distTxt}`, p: price,
      d: x.is_active ? 'Disponible' : 'Hors ligne pour le moment', c: chips, g: HUES[x.trade] || HUES.menage, cat: x.trade,
      dist: x.distance_m ?? 0, rate: x.rating ?? 0,
      priceN: x.base_price_cents > 0 ? x.base_price_cents : (x.hourly_rate_cents ?? 0),
      reviews: x.reviews_count || 0, active: !!x.is_active, identity: !!x.has_identity, rcpro: !!x.has_rcpro,
      acts: actsOf(x), hits: hitsOf(x),
    }
  }), [rawPros, actsOf, hitsOf])

  function closePreview() { setPvShow(false) }

  const pv = pros[pvIndex]
  // Prestataires réels qui font au moins une des activités choisies, passés à la carte Leaflet.
  const rawVisible = useMemo(
    () => rawPros.filter(p => sel.length === 0 || hitsOf(p) > 0),
    [rawPros, sel, hitsOf])
  // Nombre de prestataires proches par activité (compteur des puces).
  const countBy = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of rawPros) for (const k of actsOf(p)) c[k] = (c[k] || 0) + 1
    return c
  }, [rawPros, actsOf])
  const selTxt = sel.map(lab).join(' + ')
  function onSelectPro(p: ProviderNearby) {
    const i = pros.findIndex(q => q.id === p.id)
    if (i >= 0) { setPvIndex(i); setPvShow(true) }
  }
  // Contacter depuis la carte : pas connecté → connexion puis retour sur la fiche du pro ;
  // toute autre erreur est affichée au lieu d'un renvoi silencieux.
  async function contact(proId: string) {
    setContactErr('')
    const { missionId, error } = await openConversation(proId)
    if (missionId) { closePreview(); router.push(`/mission/${missionId}/chat`); return }
    if (error === 'not_authenticated') { router.push(`/auth/login?next=${encodeURIComponent(`/pro/${proId}`)}`); return }
    if (error === 'own_profile') { setContactErr('C’est votre propre profil prestataire.'); return }
    setContactErr('La conversation n’a pas pu s’ouvrir. Réessayez dans un instant.')
  }
  const searchList = [...pros]
    .filter(p => sel.length === 0 || p.hits > 0)
    .filter(p => !flt.has('Disponible') || p.active)
    .filter(p => !flt.has('Pièce d’identité fournie') || p.identity)
    .filter(p => !flt.has('Assurance RC renseignée') || p.rcpro)
    .filter(p => !flt.has('≤ 1 km') || p.dist <= 1000)
    .filter(p => !flt.has('4★ et +') || p.rate >= 4)
    .sort((a, b) =>
      sortMode === 'rated' ? b.rate - a.rate
        : sortMode === 'price' ? a.priceN - b.priceN
          : a.dist - b.dist)
  // D'abord ceux qui font TOUTES les activités choisies, puis ceux qui en font une partie.
  const fullList = searchList.filter(p => p.hits === sel.length)
  const partList = sel.length > 1 ? searchList.filter(p => p.hits < sel.length) : []
  const missingOf = (p: Pro) => sel.filter(k => !p.acts.includes(k))
  const pvMissing = pv ? missingOf(pv) : []
  const row = (p: Pro) => (
    <div key={p.id} className="row" onClick={() => router.push(`/pro/${p.id}`)}>
      <div className="av" style={{ background: `linear-gradient(160deg,${p.g})` }}>{p.av}</div>
      <div className="m"><div className="nm">{p.n}</div><div className="ds">{p.m}</div>
        {p.hits < sel.length && <div className="ds" style={{ color: '#8A6520' }}>Ne fait pas : {missingOf(p).map(lab).join(', ').toLowerCase()}</div>}
      </div>
      <div className="rt"><b>{p.rate > 0 ? p.rate.toFixed(1) : 'Nouveau'}</b>{p.p}</div>
    </div>
  )
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
                  <span className="mobile-only"><NavDrawer dark={false} /></span>
                  <div className="pinglogo">
                    <div className="mark">
                      <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.2" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".6" /></svg>
                      <span className="d" />
                    </div>
                    <div><div className="wd">ping</div></div>
                  </div>
                  <div className="sp" />
                  <ModeSwitchPill to="pro" />
                  <div className="tbell" onClick={() => router.push('/messages')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
                  </div>
                </div>

                <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
                  <LiveMap userPos={userPos} pros={rawVisible} onSelect={onSelectPro} recenterTick={recenterTick} />
                </div>

                <div className="searchbar" style={{ top: 66 }} onClick={() => go('v_search')}>
                  <div className="lg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}><path d="M4 6h16M7 12h10M10 18h4" /></svg></div>
                  <div className="tx">{sel.length ? selTxt : 'Filtrer par service, près de vous'}</div>
                </div>

                <div className="chips" style={{ top: 118 }}>
                  <div className={`chip ${sel.length === 0 ? 'on' : ''}`} role="button" aria-pressed={sel.length === 0} onClick={() => setSel([])}>Tous</div>
                  {ALL_TRADE_KEYS.map(k => (
                    <div key={k} className={`chip ${sel.includes(k) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(k)} onClick={() => toggleSel(k)}>
                      {lab(k)}{countBy[k] ? <span style={{ opacity: .7, marginLeft: 5 }}>{countBy[k]}</span> : null}
                    </div>
                  ))}
                </div>

                <div className="pingbtn" onClick={() => loadPros()}><span className="halo" /><span className="lbl">PING</span></div>
                {/* Déposer une annonce (Romain 31/10 : introuvable depuis la carte). Masqué quand une fiche est ouverte. */}
                {!pvShow && (
                  <button type="button" onClick={() => router.push('/client/demandes/new')}
                    style={{ position: 'absolute', left: 14, bottom: 80, zIndex: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, boxShadow: '0 8px 20px rgba(20,50,60,.25)', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Déposer une demande
                  </button>
                )}
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
                      {pvMissing.length > 0 && <p style={{ fontSize: 12, color: '#8A6520', fontWeight: 600, margin: '8px 0 0' }}>Ne fait pas : {pvMissing.map(lab).join(', ').toLowerCase()}</p>}
                      <div className="dispo" style={{ marginTop: 11 }}><span className={`livedot ${pv.active ? 'on' : ''}`} /> <span>{pv.d}</span></div>
                      {contactErr && <p style={{ color: '#c0503a', fontSize: 12, margin: '8px 0 0' }}>{contactErr}</p>}
                      <div style={{ display: 'flex', gap: 9, marginTop: 10 }}>
                        <div className="btn ghost" style={{ flex: 1 }} onClick={() => contact(pv.id)}>Contacter</div>
                        <div className="btn" style={{ flex: 1.3 }} onClick={() => { closePreview(); router.push(`/pro/${pv.id}`) }}>Voir le profil</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Panneau de detail desktop : la carte reste visible, on passe d'un pro a l'autre en cliquant les pins */}
                {pv && pvShow && (
                  <div className="detail-panel on">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 15, color: 'var(--ink)', flex: 1 }}>Profil du prestataire</b>
                      <div onClick={closePreview} aria-label="Fermer" style={{ cursor: 'pointer', color: 'var(--slate)', display: 'grid', placeItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      <div style={{ background: 'linear-gradient(160deg,var(--teal),var(--tealD))', padding: '18px 16px', color: '#fff' }}>
                        <div className="pvav" style={{ background: `linear-gradient(160deg,${pv.g})`, width: 54, height: 54, fontSize: 20, marginBottom: 10 }}>{pv.av}</div>
                        <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 20 }}>{pv.n}</div>
                        <div style={{ fontSize: 13, opacity: .9 }}>{pv.m}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 13, fontWeight: 600 }}><span className={`livedot ${pv.active ? 'on' : ''}`} /> {pv.d}</div>
                      </div>
                      <div style={{ padding: 16 }}>
                        <div className="h2" style={{ marginTop: 0 }}>Informations déclarées par le pro</div>
                        {pv.c.length ? pv.c.map((x, i) => (
                          <div key={i} className="vrow ok" style={{ marginBottom: 8 }}>
                            <div className="vi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6 9 17l-5-5" /></svg></div>
                            <div className="vt"><b>{x}</b></div>
                            <div className="vs">✓</div>
                          </div>
                        )) : <p className="sub">Aucune information déclarée pour l&apos;instant.</p>}
                        <p className="sub" style={{ fontSize: 11, color: '#6E8592' }}>Place de marché : informations déclarées par le prestataire et collectées par PING, sans garantie.</p>
                        <div className="h2">Compétences</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pv.acts.map(k => <span key={k} className={`chip ${!sel.length || sel.includes(k) ? 'on' : ''}`} style={{ display: 'inline-block' }}>{lab(k)}</span>)}
                        </div>
                        {pvMissing.length > 0 && <p className="sub" style={{ fontSize: 12, color: '#8A6520', fontWeight: 600 }}>Ne fait pas : {pvMissing.map(lab).join(', ').toLowerCase()}</p>}
                        <div className="h2">Avis <span className="chip" style={{ fontSize: 10 }}>après prestation</span></div>
                        {pv.reviews > 0
                          ? <p className="sub" style={{ color: 'var(--ink)' }}><b>{pv.rate.toFixed(1)} / 5</b> · {pv.reviews} avis — <span style={{ color: 'var(--teal)', cursor: 'pointer', fontWeight: 700 }} onClick={() => router.push(`/pro/${pv.id}`)}>les lire sur le profil</span></p>
                          : <p className="sub" style={{ color: 'var(--slate)' }}>Pas encore d&apos;avis — ils apparaîtront après les premières prestations.</p>}
                      </div>
                    </div>
                    {contactErr && <p style={{ color: '#c0503a', fontSize: 12, margin: '10px 14px 0' }}>{contactErr}</p>}
                    <div style={{ display: 'flex', gap: 9, padding: 14, borderTop: '1px solid var(--line)' }}>
                      <div className="btn ghost" style={{ flex: 1 }} onClick={() => contact(pv.id)}>Contacter</div>
                      <div className="btn" style={{ flex: 1.3 }} onClick={() => router.push(`/pro/${pv.id}`)}>Réserver{pv.p ? ` · ${pv.p}` : ''}</div>
                    </div>
                  </div>
                )}
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
              <div className="h2" style={{ marginTop: 0 }}>Que recherchez-vous&nbsp;?<span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600 }}>plusieurs choix possibles</span></div>
              <div className="catgrid">
                <div className={`cat ${sel.length === 0 ? 'on' : ''}`} role="button" aria-pressed={sel.length === 0} onClick={() => setSel([])}>
                  <div className="ci"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg></div>Tous
                </div>
                {ALL_TRADE_KEYS.map(key => (
                  <div key={key} className={`cat ${sel.includes(key) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(key)} onClick={() => toggleSel(key)}>
                    <div className="ci"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 5l-7 7M3 21l3-1 12-12a2 2 0 0 0-3-3L3 17z" /></svg></div>{lab(key)}
                  </div>
                ))}
              </div>
              <p className="sub" style={{ fontSize: 11, color: '#6E8592' }}>Choisissez une ou plusieurs activités : d&apos;abord ceux qui font tout, puis ceux qui en font une partie.</p>
              <div className="h2">Filtres</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Disponible', 'Pièce d’identité fournie', 'Assurance RC renseignée', '≤ 1 km', '4★ et +'].map(f => (
                  <div key={f} className={`chip ${flt.has(f) ? 'on' : ''}`} onClick={() => tglFlt(f)}>{f}</div>
                ))}
              </div>
              <div className="seg" id="sortSeg">
                <div className={sortMode === 'near' ? 'on' : ''} onClick={() => setSortMode('near')}>Plus proches</div>
                <div className={sortMode === 'rated' ? 'on' : ''} onClick={() => setSortMode('rated')}>Mieux notés</div>
                <div className={sortMode === 'price' ? 'on' : ''} onClick={() => setSortMode('price')}>Prix croissant</div>
              </div>
              <div className="h2">{sel.length > 1 ? `${fullList.length} font ${selTxt.toLowerCase()}` : `${searchList.length} prestataire${searchList.length > 1 ? 's' : ''} à proximité`}<span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, marginLeft: 6 }}>triées par {sortMode === 'rated' ? 'note' : sortMode === 'price' ? 'prix' : 'distance'}</span></div>
              {fullList.map(row)}
              {sel.length > 1 && searchList.length > 0 && fullList.length === 0 && (
                <p className="sub" style={{ color: 'var(--slate)' }}>Personne ne fait {selTxt.toLowerCase()} à la fois près de vous.</p>
              )}
              {partList.length > 0 && (<>
                <div className="h2">Font une partie de vos choix</div>
                {partList.map(row)}
              </>)}
              {searchList.length === 0 && <p className="sub" style={{ color: 'var(--slate)' }}>{flt.size ? 'Aucun prestataire ne correspond à ces filtres. Retirez-en un pour élargir.' : 'Aucun prestataire pour ce choix pour le moment. Déposez une demande : les prestataires proches la verront.'}</p>}
            </div>
          </section>

          {/* Barre d'onglets : commune à toute l'app (DesktopShell → BottomTabBar). */}

        </div></div>
      </div>
    </div>
  )
}
