"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { fetchProvidersNearby, fetchProviderActivities, fetchProviderFlags, openConversation, type ProviderNearby, type ProviderFlags } from '@/lib/services'
import { TRADES, ALL_TRADE_KEYS } from '@/lib/trades'
import NavDrawer from './NavDrawer'
import ModeSwitchPill from './ModeSwitchPill'
import MapSheet, { SHEET_H, SHEET_LIFT, sheetPx, type SheetSnap } from './MapSheet'
import { useFeedbackBubbleSlot, useIsDesktop, useElementHeight } from '@/lib/mapChrome'
import { useUnreadTotal } from '@/lib/unread'
import { Ic, Stars, r1, svcIconKey } from './PingIcons'
import LocationAsk from './LocationAsk'
import { useInitialPosition } from '@/lib/location'

// LiveMap = react-leaflet + tuiles OSM (comme la carte du Super Admin).
// Chargé côté client uniquement : Leaflet touche window au chargement.
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false })

// ============================================================
// COQUE /demo — reproduit le mecanisme .view/.view.on d'app.html.
// (mode, view) = etat ; go/back/setMode = setState. CSS verbatim inchange.
// ============================================================

type Pro = {
  id: string; av: string; n: string; m: string; p: string;
  d: string; c: string[]; g: string; cat: string; pend?: boolean;
  dist: number; rate: number; priceN: number
  reviews: number; active: boolean; identity: boolean; rcpro: boolean
  acts: string[]; hits: number
  // Présentation de la maquette : services, note, distance, CESU, pièces contrôlées par PING
  // (true : pièce d'identité validée par un admin ; false : en cours de contrôle ; undefined : inconnu).
  svc: string; distTxt: string; cesu: boolean; checked?: boolean
}

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
  // CESU préfinancé accepté, pièces contrôlées (migration 039 ; vide tant qu'elle n'est pas appliquée).
  const [flags, setFlags] = useState<Record<string, ProviderFlags>>({})
  // Position : expliquée avant la fenêtre du navigateur (LocationAsk), repli Grasse.
  const { pos: userPos, ask: askLoc, dismiss: dismissLoc, choose: chooseLoc } = useInitialPosition({ lat: 43.6584, lng: 6.9225 })
  const [recenterTick, setRecenterTick] = useState(0)
  // Aperçu d'un prestataire (fiche du bas sur mobile, panneau latéral sur ordinateur).
  const [pvId, setPvId] = useState<string | null>(null)
  // Volet de la liste (mobile) : replié, mi-hauteur ou plein.
  const [sheet, setSheet] = useState<SheetSnap>('peek')
  const isDesk = useIsDesktop()
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null)
  const wrapH = useElementHeight(wrapEl)
  const [sortMode, setSortMode] = useState<'near' | 'rated' | 'price'>('near')
  const [flt, setFlt] = useState<Set<string>>(() => new Set())
  // Puce « CESU préfinancé » de la carte (maquette) : seulement les prestataires qui l'acceptent.
  const [cesuOnly, setCesuOnly] = useState(false)
  const unread = useUnreadTotal('particulier', 'map')
  const [contactErr, setContactErr] = useState('')

  const go = useCallback((v: string) => { setPrevView(view); setViewState(v) }, [view])
  const back = useCallback((v: string) => { setViewState(v) }, [])


  // Chargement réel des prestataires (providers_nearby renvoie lat/lng réels).
  const loadPros = useCallback(() => {
    fetchProvidersNearby(userPos.lat, userPos.lng, 15000).then(list => {
      setRawPros(list)
      // Activités = métier principal + métiers des prestations (table services).
      fetchProviderActivities(list).then(setActs).catch(() => { })
      fetchProviderFlags(list.map(p => p.id)).then(setFlags).catch(() => { })
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
    if (flags[x.id]?.cesu) chips.push('Accepte le CESU préfinancé')
    return {
      svc: actsOf(x).map(lab).join(', '), distTxt, cesu: !!flags[x.id]?.cesu, checked: flags[x.id]?.checked,
      id: x.id, av: (nm.charAt(0) || '?').toUpperCase(), n: nm,
      m: `${actsOf(x).map(lab).join(', ')} · ${rateTxt} · à ${distTxt}`, p: price,
      d: x.is_active ? 'Disponible' : 'Hors ligne pour le moment', c: chips, g: HUES[x.trade] || HUES.menage, cat: x.trade,
      dist: x.distance_m ?? 0, rate: x.rating ?? 0,
      priceN: x.base_price_cents > 0 ? x.base_price_cents : (x.hourly_rate_cents ?? 0),
      reviews: x.reviews_count || 0, active: !!x.is_active, identity: !!x.has_identity, rcpro: !!x.has_rcpro,
      acts: actsOf(x), hits: hitsOf(x),
      // Réservable tout de suite, mais signalé tant qu'un admin PING n'a pas validé ses pièces.
      pend: flags[x.id]?.checked === false,
    }
  }), [rawPros, actsOf, hitsOf, flags])

  function closePreview() { setPvId(null) }

  const pv = pvId ? pros.find(q => q.id === pvId) : undefined
  const pvShow = !!pv
  // Prestataires réels qui font au moins une des activités choisies, passés à la carte Leaflet.
  const rawVisible = useMemo(
    () => rawPros.filter(p => (sel.length === 0 || hitsOf(p) > 0) && (!cesuOnly || !!flags[p.id]?.cesu)),
    [rawPros, sel, hitsOf, cesuOnly, flags])
  // Épingles « Nouveau » : pièces pas encore contrôlées par PING (goutte plus claire, comme la maquette).
  const newIds = useMemo(() => new Set(pros.filter(p => p.pend).map(p => p.id)), [pros])
  // Nombre de prestataires proches par activité (compteur des puces).
  const countBy = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of rawPros) for (const k of actsOf(p)) c[k] = (c[k] || 0) + 1
    return c
  }, [rawPros, actsOf])
  const selTxt = sel.map(lab).join(' + ')
  function onSelectPro(p: { id: string }) {
    if (pros.some(q => q.id === p.id)) { setContactErr(''); setPvId(p.id) }
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
    .filter(p => !cesuOnly || p.cesu)
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
  // Précédent / suivant dans l'aperçu : on parcourt la liste en cours (même ordre que le volet).
  // Un prestataire ouvert depuis une épingle hors de cette liste (filtres de recherche) : on
  // parcourt alors les épingles de la carte, de la plus proche à la plus lointaine.
  const sheetList = [...fullList, ...partList]
  const navList = pv && sheetList.some(p => p.id === pv.id)
    ? sheetList
    : pros.filter(p => (sel.length === 0 || p.hits > 0) && (!cesuOnly || p.cesu)).sort((a, b) => a.dist - b.dist)
  const navIdx = pv ? navList.findIndex(p => p.id === pv.id) : -1
  function step(d: number) {
    if (navList.length < 2 || navIdx < 0) return
    setContactErr('')
    setPvId(navList[(navIdx + d + navList.length) % navList.length].id)
  }
  // Disponibles d'abord, puis « Hors ligne pour le moment » (maquette), dans l'ordre choisi.
  const onlineFull = fullList.filter(p => p.active)
  const onlinePart = partList.filter(p => p.active)
  const offList = [...fullList, ...partList].filter(p => !p.active)
  const onlineCount = searchList.filter(p => p.active).length
  const sheetTitle = sel.length > 1
    ? `${onlineFull.length} font ${selTxt.toLowerCase()}`
    : `${onlineCount} prestataire${onlineCount > 1 ? 's' : ''} près de vous`

  // Boutons de la carte (Déposer une demande, PING, Recentrer) : posés au-dessus du volet et du
  // bandeau d'installation, jamais dessous. Cachés quand le volet est plein ou qu'un aperçu est
  // ouvert sur mobile (comme la maquette). Sur ordinateur, PING et Recentrer se décalent à gauche
  // du panneau de détail au lieu de passer dessous.
  const ctrlHidden = !isDesk && (sheet === 'full' || pvShow)
  const ctrlBase = isDesk ? `calc(${SHEET_LIFT} + 24px)` : `calc(${SHEET_H[sheet]} + ${SHEET_LIFT} + 12px)`
  // Sur ordinateur, le panneau de droite est permanent (liste, ou fiche du prestataire choisi).
  const ctrlRight = isDesk ? 410 : 14
  // Bulle verte rangée au-dessus de Recentrer (distance au bas de la fenêtre, sans le bandeau).
  const wrapBottomGap = typeof window !== 'undefined' && wrapEl ? Math.max(0, window.innerHeight - wrapEl.getBoundingClientRect().bottom) : 64
  const bubbleBottom = wrapH ? wrapBottomGap + (isDesk ? 24 : sheetPx(sheet, wrapH) + 12) + 68 + 40 + 12 : null
  useFeedbackBubbleSlot(view === 'v_map' ? bubbleBottom : null, view === 'v_map' && !isDesk && (pvShow || sheet === 'full'), isDesk ? 412 : null)

  // Aperçu mobile : glisser vers le bas pour fermer, à gauche ou à droite pour passer au suivant.
  const pvRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const swiped = useRef(false)
  function pvDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('input,textarea')) return
    swipe.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }
  }
  function pvMove(e: React.PointerEvent) {
    const s = swipe.current, el = pvRef.current
    if (!s || !el) return
    s.dx = e.clientX - s.x; s.dy = e.clientY - s.y
    if (s.dy > 8 && s.dy > Math.abs(s.dx)) { el.style.transition = 'none'; el.style.transform = `translateY(${s.dy}px)` }
  }
  function pvUp() {
    const s = swipe.current, el = pvRef.current
    swipe.current = null
    if (!s || !el) return
    el.style.transition = ''; el.style.transform = ''
    const moved = Math.abs(s.dx) > 10 || Math.abs(s.dy) > 10
    if (moved) { swiped.current = true; setTimeout(() => { swiped.current = false }, 300) }
    if (s.dy > 70 && s.dy > Math.abs(s.dx)) closePreview()
    else if (Math.abs(s.dx) > 60 && Math.abs(s.dx) > Math.abs(s.dy)) step(s.dx < 0 ? 1 : -1)
  }
  // Ligne de liste (maquette, .row) : avatar, nom, « services · prix · distance », puis les étoiles
  // et le nombre d'avis (ou « Nouveau »), le CESU accepté, et un chevron.
  const row = (p: Pro, onOpen: (p: Pro) => void = q => router.push(`/pro/${q.id}`)) => (
    <button type="button" key={p.id} className="mq-row" onClick={() => onOpen(p)} aria-label={`${p.n}, ${p.active ? p.p || 'disponible' : 'hors ligne pour le moment'}`}>
      <span className="mq-av" style={{ background: p.active ? `linear-gradient(160deg,${p.g})` : '#6E8592' }}>{p.av}</span>
      <span className="grow">
        <b>{p.n}</b>
        <small>{[p.svc, p.active ? p.p : 'hors ligne pour le moment', `à ${p.distTxt}`].filter(Boolean).join(' · ')}</small>
        <small>{p.reviews > 0
          ? <><Stars r={p.rate} /> {r1(p.rate)} ({p.reviews} avis)</>
          : (p.pend ? 'Nouveau · pièces en cours de contrôle' : 'Nouveau')}
          {p.cesu ? ' · Accepte le CESU préfinancé' : ''}</small>
        {p.hits < sel.length && <small style={{ color: '#8A6520', fontWeight: 600 }}>Ne fait pas : {missingOf(p).map(lab).join(', ').toLowerCase()}</small>}
      </span>
      <span className="chev"><Ic name="chev" size={18} /></span>
    </button>
  )
  // Étiquettes de l'aperçu (maquette) : services faits, puis profil vérifié par PING (pièce d'identité
  // validée par un admin) ou « Nouveau · pièces en cours de contrôle », puis CESU. Tant que l'état du
  // contrôle est inconnu (migration absente), on garde le langage déclaratif (pièce fournie, assurance
  // renseignée), jamais « vérifié ».
  const tagsOf = (p: Pro) => (
    <div className="mq-tags">
      {p.acts.map(k => <span key={k} className="mq-tag"><Ic name="check" size={12} />{lab(k)}</span>)}
      {p.checked === true && <span className="mq-tag"><Ic name="shield" size={12} />Profil vérifié par PING</span>}
      {p.checked === false && <span className="mq-tag warn">Nouveau · pièces en cours de contrôle</span>}
      {p.checked === undefined && p.identity && <span className="mq-tag"><Ic name="id" size={12} />Pièce d’identité fournie</span>}
      {p.checked === undefined && p.rcpro && <span className="mq-tag"><Ic name="shieldPlain" size={12} />Assurance RC renseignée</span>}
      {p.cesu && <span className="mq-tag gray">Accepte le CESU préfinancé</span>}
    </div>
  )
  const navArrows = navList.length > 1 && navIdx >= 0 && (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
      <button type="button" className="mq-ib" onClick={() => step(-1)} aria-label="Prestataire précédent"><Ic name="back" /></button>
      <span style={{ fontSize: 12, color: '#6E8592', minWidth: 34, textAlign: 'center' }}>{navIdx + 1} / {navList.length}</span>
      <button type="button" className="mq-ib" onClick={() => step(1)} aria-label="Prestataire suivant"><Ic name="chev" /></button>
    </span>
  )
  const listBody = (
    <>
      {onlineFull.map(p => row(p, q => onSelectPro(q)))}
      {sel.length > 1 && searchList.length > 0 && fullList.length === 0 && (
        <p className="sub" style={{ color: 'var(--slate)', padding: '8px 0' }}>Personne ne fait {selTxt.toLowerCase()} à la fois près de vous.</p>
      )}
      {onlinePart.length > 0 && (<>
        <div className="mq-hubt">Font une partie de vos choix</div>
        {onlinePart.map(p => row(p, q => onSelectPro(q)))}
      </>)}
      {offList.length > 0 && (<>
        <div className="mq-hubt">Hors ligne pour le moment</div>
        {offList.map(p => row(p, q => onSelectPro(q)))}
      </>)}
      {searchList.length === 0 && <p className="sub" style={{ color: 'var(--slate)', padding: '10px 0' }}>{flt.size ? 'Aucun prestataire ne correspond à vos filtres. Retirez-en un dans la recherche pour élargir.' : 'Aucun prestataire disponible pour ce choix. Déposez une demande : les prestataires proches la verront.'}</p>}
    </>
  )
  function tglFlt(f: string) {
    setFlt(s => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n })
  }

  return (
    <div className="stage" id="stage">
      {askLoc && <LocationAsk onChoose={chooseLoc} onClose={dismissLoc} />}
      <div className="device">
        <div className="frame"><div className="screen" id="screen">

          {/* ===================== v_map ===================== */}
          <section className={`view ${view === 'v_map' ? 'on' : ''}`} id="v_map" data-tab="map">
            <div className="body full nopad">
              <div className="mapwrap" ref={setWrapEl}>
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
                  <button type="button" className="tbell" onClick={() => router.push('/messages')} aria-label={unread ? `Messages, ${unread} non lu${unread > 1 ? 's' : ''}` : 'Messages'} style={{ color: 'var(--ink)', padding: 0 }}>
                    <Ic name="msg" size={18} />
                    {unread > 0 && <span className="mq-nb">{unread > 9 ? '9+' : unread}</span>}
                  </button>
                </div>

                <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
                  <LiveMap userPos={userPos} pros={rawVisible} onSelect={onSelectPro} recenterTick={recenterTick} onMapClick={closePreview} selectedId={pvId} newIds={newIds} />
                </div>

                <div className="searchbar" role="button" aria-haspopup="dialog" style={{ top: 66 }} onClick={() => go('v_search')}>
                  <div className="lg" style={{ background: 'var(--btnFill)', color: '#fff' }}><Ic name="filter" size={15} /></div>
                  <div className="tx">{sel.length ? selTxt : 'Filtrer par service, près de vous'}</div>
                  <span className="chv"><Ic name="down" size={20} /></span>
                </div>

                <div className="chips noscroll" style={{ top: 128 }}>
                  <div className={`chip ${sel.length === 0 ? 'on' : ''}`} role="button" aria-pressed={sel.length === 0} onClick={() => setSel([])}>Tous</div>
                  {/* Services choisis en tête (maquette). */}
                  {[...ALL_TRADE_KEYS].sort((a, b) => (sel.includes(b) ? 1 : 0) - (sel.includes(a) ? 1 : 0)).map(k => (
                    <div key={k} className={`chip ${sel.includes(k) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(k)} onClick={() => toggleSel(k)}>{lab(k)}</div>
                  ))}
                  <div className={`chip ${cesuOnly ? 'on' : ''}`} role="button" aria-pressed={cesuOnly} onClick={() => { setCesuOnly(c => !c); setPvId(null) }}>CESU préfinancé</div>
                </div>

                {!ctrlHidden && (<>
                  <div className="pingbtn" role="button" aria-label="PING : actualiser les prestataires autour de vous" onClick={() => loadPros()} style={{ bottom: ctrlBase, right: ctrlRight }}><span className="halo" /><span className="lbl">PING</span></div>
                  {/* Déposer une annonce (Romain 31/10 : introuvable depuis la carte). Masqué quand une fiche est ouverte. */}
                  {!pvShow && (
                    <button type="button" onClick={() => router.push('/client/demandes/new')}
                      style={{ position: 'absolute', left: 14, bottom: ctrlBase, zIndex: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, boxShadow: '0 8px 20px rgba(20,50,60,.25)', cursor: 'pointer' }}>
                      <Ic name="plus" size={16} />
                      Déposer une demande
                    </button>
                  )}
                  <div className="loc" role="button" aria-label="Recentrer sur ma position" onClick={() => setRecenterTick(t => t + 1)} style={{ bottom: `calc(${ctrlBase} + 68px)`, right: ctrlRight + 8, color: 'var(--ink)' }}><Ic name="loc" size={20} /></div>
                </>)}

                {/* Volet de la liste (mobile) : remplacé par l'aperçu quand un prestataire est choisi. */}
                {!pvShow && (
                  <MapSheet snap={sheet} onSnap={setSheet} title={sheetTitle}>
                    {listBody}
                  </MapSheet>
                )}

                <div ref={pvRef} className={`preview ${pvShow ? 'show' : ''}`} id="preview" role="dialog" aria-label={pv ? `Aperçu de ${pv.n}` : 'Aperçu'}
                  style={{ bottom: SHEET_LIFT, touchAction: 'pan-y' }}
                  onPointerDown={pvDown} onPointerMove={pvMove} onPointerUp={pvUp} onPointerCancel={pvUp}
                  onClickCapture={e => { if (swiped.current) { e.stopPropagation(); e.preventDefault(); swiped.current = false } }}>
                  <div className="pvh" style={{ touchAction: 'none' }} />
                  {pv && (
                    <>
                      {/* Carte de présentation (maquette, .preview) */}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="pvav" style={{ background: pv.active ? `linear-gradient(160deg,${pv.g})` : '#6E8592' }}>{pv.av}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b className="pvname" style={{ display: 'block' }}>{pv.n}</b>
                          <div className="pvmeta" style={{ fontWeight: 500 }}>{[pv.svc, pv.reviews > 0 ? `${r1(pv.rate)} (${pv.reviews})` : 'Nouveau', `à ${pv.distTxt}`].filter(Boolean).join(' · ')}</div>
                        </div>
                        <b style={{ fontFamily: 'var(--fh)', fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{pv.p}</b>
                        <button type="button" className="mq-ib box" onClick={closePreview} aria-label="Fermer l’aperçu" style={{ background: 'none', marginTop: -6 }}><Ic name="close" /></button>
                      </div>
                      {tagsOf(pv)}
                      {pvMissing.length > 0 && <p style={{ fontSize: 12, color: '#8A6520', fontWeight: 600, margin: '0 0 4px' }}>Ne fait pas : {pvMissing.map(lab).join(', ').toLowerCase()}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        {pv.active
                          ? <span className="mq-avail">● Disponible</span>
                          : <span className="mq-off">○ Hors ligne pour le moment : pas de réservation, vous pouvez lui écrire</span>}
                        {navArrows}
                      </div>
                      {contactErr && <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 8px' }}>{contactErr}</p>}
                      <div style={{ display: 'flex', gap: 9 }}>
                        <div className="btn ghost" role="button" style={{ flex: 1 }} onClick={() => contact(pv.id)}>Contacter</div>
                        <div className="btn" role="button" style={{ flex: 1.3 }} onClick={() => { closePreview(); router.push(`/pro/${pv.id}`) }}>Voir le profil</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Panneau ordinateur, permanent comme sur /pro/carte : la liste (titre du volet) tant
                    qu'aucun prestataire n'est choisi, sinon sa carte de présentation (maquette : en-tête
                    teal, étiquettes, vérifications, avis). La carte reste visible et cliquable à côté. */}
                {isDesk && !pv && (
                  <div className="detail-panel on">
                    <div style={{ padding: '14px 16px 6px' }}>
                      <b style={{ fontFamily: 'var(--fh)', fontSize: 16, color: 'var(--ink)' }}>{sheetTitle}</b>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 14px' }}>{listBody}</div>
                  </div>
                )}
                {pv && pvShow && (
                  <div className="detail-panel on">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 16px', borderBottom: '1px solid var(--line)' }}>
                      <b style={{ fontFamily: 'var(--fh)', fontSize: 16, color: 'var(--ink)', flex: 1 }}>Profil du pro</b>
                      {navArrows}
                      <button type="button" className="mq-ib" onClick={closePreview} aria-label="Fermer"><Ic name="close" /></button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      <div className="mq-hero">
                        <span className="mq-av">{pv.av}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b className="nm">{pv.n}</b>
                          <div style={{ fontSize: 12 }}>{pv.reviews > 0 ? `★ ${r1(pv.rate)} (${pv.reviews} avis)` : 'Nouveau sur PING'} · à {pv.distTxt}</div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{pv.active ? '● Disponible' : '○ Hors ligne'}</div>
                        </div>
                        <b style={{ fontFamily: 'var(--fh)', fontSize: 15, whiteSpace: 'nowrap' }}>{pv.p}</b>
                      </div>
                      <div style={{ padding: '4px 16px 16px' }}>
                        {tagsOf(pv)}
                        {pvMissing.length > 0 && <p style={{ fontSize: 12, color: '#8A6520', fontWeight: 600 }}>Ne fait pas : {pvMissing.map(lab).join(', ').toLowerCase()}</p>}
                        <div className="mq-sect">Vérifications</div>
                        {pv.checked === true && (
                          <div className="mq-vr ok"><span className="vi"><Ic name="id" size={15} /></span><span><b>Pièce d’identité</b><small>Contrôlée par PING</small></span><span className="vs"><Ic name="check" size={11} />Validée</span></div>
                        )}
                        {pv.checked !== true && pv.identity && (
                          <div className={`mq-vr ${pv.checked === false ? 'w' : 'ok'}`}><span className="vi"><Ic name="id" size={15} /></span><span><b>Pièce d’identité</b><small>{pv.checked === false ? 'Envoyée, en contrôle par PING' : 'Fournie par le prestataire'}</small></span><span className="vs">{pv.checked === false ? 'En contrôle' : <><Ic name="check" size={11} />Fournie</>}</span></div>
                        )}
                        {pv.rcpro && (
                          <div className="mq-vr ok"><span className="vi"><Ic name="shieldPlain" size={15} /></span><span><b>Assurance responsabilité civile</b><small>Renseignée par le prestataire</small></span><span className="vs"><Ic name="check" size={11} />Renseignée</span></div>
                        )}
                        {pv.cesu && (
                          <div className="mq-vr ok"><span className="vi"><Ic name="card" size={15} /></span><span><b>CESU préfinancé</b><small>Accepté par le prestataire</small></span><span className="vs"><Ic name="check" size={11} />Oui</span></div>
                        )}
                        {!pv.identity && !pv.rcpro && !pv.cesu && pv.checked !== true && <p className="sub">Aucune information renseignée pour l&apos;instant.</p>}
                        <p className="mq-muted">PING contrôle les pièces marquées « Validée ». Les autres informations sont déclarées par le prestataire. PING est une plateforme de mise en relation : PING ne garantit ni la solvabilité ni la qualité des prestations ; vous choisissez librement votre prestataire.</p>
                        <div className="mq-sect">Avis</div>
                        {pv.reviews > 0
                          ? <p style={{ fontSize: 13, color: 'var(--ink)' }}><Stars r={pv.rate} size={13} /> <b>{r1(pv.rate)}</b> · {pv.reviews} avis · <button type="button" onClick={() => router.push(`/pro/${pv.id}`)} style={{ border: 0, background: 'none', padding: 0, color: '#097A6C', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>les lire sur le profil</button></p>
                          : <p className="sub" style={{ color: 'var(--slate)' }}>Nouveau, pas encore d&apos;avis.</p>}
                      </div>
                    </div>
                    {contactErr && <p style={{ color: '#c0503a', fontSize: 12, margin: '10px 14px 0' }}>{contactErr}</p>}
                    <div style={{ display: 'flex', gap: 9, padding: 14, borderTop: '1px solid var(--line)' }}>
                      <div className="btn ghost" role="button" style={{ flex: 1 }} onClick={() => contact(pv.id)}>Contacter</div>
                      <div className="btn" role="button" style={{ flex: 1.3 }} onClick={() => router.push(`/pro/${pv.id}`)}>Voir le profil</div>
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
                  <div className="ci"><Ic name="list" size={17} /></div>Tous
                </div>
                {ALL_TRADE_KEYS.map(key => (
                  <div key={key} className={`cat ${sel.includes(key) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(key)} onClick={() => toggleSel(key)}>
                    <div className="ci"><Ic name={svcIconKey(key)} size={17} /></div>{lab(key)}{countBy[key] ? <span style={{ opacity: .7, marginLeft: 4, fontWeight: 600 }}>{countBy[key]}</span> : null}
                  </div>
                ))}
              </div>
              <p className="sub" style={{ fontSize: 11, color: '#6E8592' }}>Choisissez une ou plusieurs activités : d&apos;abord ceux qui font tout, puis ceux qui en font une partie.</p>
              <div className="h2">Filtres</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Disponible', 'Pièce d’identité fournie', 'Assurance RC renseignée', '≤ 1 km', '4★ et +'].map(f => (
                  <div key={f} className={`chip ${flt.has(f) ? 'on' : ''}`} role="button" aria-pressed={flt.has(f)} onClick={() => tglFlt(f)}>{f}</div>
                ))}
                <div className={`chip ${cesuOnly ? 'on' : ''}`} role="button" aria-pressed={cesuOnly} onClick={() => setCesuOnly(c => !c)}>CESU préfinancé</div>
              </div>
              <div className="seg" id="sortSeg">
                <div className={sortMode === 'near' ? 'on' : ''} onClick={() => setSortMode('near')}>Plus proches</div>
                <div className={sortMode === 'rated' ? 'on' : ''} onClick={() => setSortMode('rated')}>Mieux notés</div>
                <div className={sortMode === 'price' ? 'on' : ''} onClick={() => setSortMode('price')}>Prix croissant</div>
              </div>
              <div className="h2">{sel.length > 1 ? `${fullList.length} font ${selTxt.toLowerCase()}` : `${searchList.length} prestataire${searchList.length > 1 ? 's' : ''} à proximité`}<span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, marginLeft: 6 }}>triées par {sortMode === 'rated' ? 'note' : sortMode === 'price' ? 'prix' : 'distance'}</span></div>
              {fullList.map(p => row(p))}
              {sel.length > 1 && searchList.length > 0 && fullList.length === 0 && (
                <p className="sub" style={{ color: 'var(--slate)' }}>Personne ne fait {selTxt.toLowerCase()} à la fois près de vous.</p>
              )}
              {partList.length > 0 && (<>
                <div className="h2">Font une partie de vos choix</div>
                {partList.map(p => row(p))}
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
