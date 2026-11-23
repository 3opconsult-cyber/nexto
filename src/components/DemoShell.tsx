"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { openConversation, prefetchProDetail, type ProviderNearby, type ProviderFlags } from '@/lib/services'
import { fetchLiveZones, type LiveZonePin } from '@/lib/liveZone'
import { FALLBACK_POS, isFallbackPos, loadMapPros, readMapCache, type MapCache } from '@/lib/carteLoaders'
import { sessionUserId } from '@/lib/screenCache'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'
import { useCatalog } from '@/lib/catalog'
import NavDrawer from './NavDrawer'
import ModeSwitchPill from './ModeSwitchPill'
import MapSheet, { SHEET_LIFT, SheetFeedbackRow, sheetH, sheetPx, useSheetSnap } from './MapSheet'
import { useFeedbackBubbleSlot, useIsDesktop, useElementHeight, useBannerH } from '@/lib/mapChrome'
import { useUnreadTotal } from '@/lib/unread'
import { Ic, Stars, r1, svcIconKey, ICON } from './PingIcons'
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
  svc: string; distTxt: string; cesu: boolean; checked?: boolean; rcproChecked?: boolean
}

const HUES: Record<string, string> = {
  menage: '#12B39C,#0B8374', repassage: '#4E6470,#4c6472', nettoyage: '#F2A93B,#8A6520',
  vitres: '#12B39C,#0e7f70', remise: '#FF7A66,#e05f4b',
}
// Libellés : catalogue des services (src/lib/catalog.ts, mis à jour dans TRADES au chargement ;
// repli src/lib/trades.ts) + « remise » hérité, absent du catalogue.
const lab = (k: string) => TRADES[k] || (k === 'remise' ? 'Remise en état' : k)

export default function DemoShell({ initialView = 'v_map' }: { initialView?: string }) {
  const router = useRouter()
  // Puces et filtres de la carte : services non masqués du catalogue (repli : tous ceux de trades.ts).
  const catalog = useCatalog()
  // « Vitres » reste en base mais n'est pas proposé (REGLES-METIER) : pas de puce tant qu'il n'est pas activé au catalogue.
  const tradeKeys = catalog.visible.filter(s => s.active || s.key !== 'vitres').map(s => s.key)
  const svcIc = (k: string) => { const ic = catalog.get(k)?.icon; return ic && ICON[ic] ? ic : svcIconKey(k) }
  const [view, setViewState] = useState(initialView)
  const [prevView, setPrevView] = useState('v_map')
  // Activités choisies (plusieurs à la fois, ex. ménage + vitres). Vide = « Tous » = aucun filtre.
  // Une seule sélection pilote les épingles de la carte ET la liste de recherche.
  const [sel, setSel] = useState<string[]>([])
  // « Choisir un autre prestataire » après un refus ou une expiration (052) : /map?service=<métier> présélectionne
  // le même service (lu après le montage : le rendu serveur reste identique).
  useEffect(() => {
    try { const s = new URLSearchParams(window.location.search).get('service'); if (s && /^[a-z0-9_-]{2,40}$/i.test(s)) setSel([s]) } catch { }
  }, [])
  const [rawPros, setRawPros] = useState<ProviderNearby[]>([])
  const [acts, setActs] = useState<Record<string, string[]>>({})
  // CESU préfinancé accepté, pièces contrôlées (migration 039 ; vide tant qu'elle n'est pas appliquée).
  const [flags, setFlags] = useState<Record<string, ProviderFlags>>({})
  // Position : centrée sur l'adresse du profil si possible, sinon encart non bloquant (LocationAsk)
  // avant la fenêtre du navigateur ; repli Grasse.
  const { pos: userPos, ask: askLoc, dismiss: dismissLoc, choose: chooseLoc } = useInitialPosition(FALLBACK_POS, 'client')
  const [recenterTick, setRecenterTick] = useState(0)
  // Aperçu d'un prestataire (fiche du bas sur mobile, panneau latéral sur ordinateur).
  const [pvId, setPvId] = useState<string | null>(null)
  // Volet de la liste (mobile) : réduit (poignée + une ligne), mi-hauteur ou plein ; l'état est mémorisé pour cet écran.
  // La carte s'ouvre au maximum : réduit par défaut.
  const [sheet, setSheet] = useSheetSnap('map', 'peek')
  const bannerH = useBannerH()
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


  // Dernière liste connue (audit ergonomie 19/11 ter, correction 2) : lue dès la connexion et gardée dans
  // le cache de l'onglet (lié au compte), affichée à l'ouverture, puis remplacée par la lecture fraîche.
  // boot : compte lu dans la session locale (quelques ms) et cache appliqué avant la première lecture.
  const [boot, setBoot] = useState<{ uid: string | null; center: { lat: number; lng: number } | null } | null>(null)
  useEffect(() => {
    let off = false
    sessionUserId(createClient()).then(uid => {
      if (off) return
      const c = uid ? readMapCache(uid) : null
      if (c) { setRawPros(c.list || []); setActs(c.acts || {}); setFlags(c.flags || {}) }
      setBoot({ uid, center: c?.center ?? null })
    })
    return () => { off = true }
  }, [])
  // Chargement réel des prestataires (providers_nearby renvoie lat/lng réels), avec leurs activités
  // (métier principal + métiers des prestations, table services) et leurs pièces. Seule la dernière
  // lecture lancée s'affiche (une réponse plus ancienne, ex. autour du repli, est ignorée).
  // Zones « en intervention ici aujourd'hui » (058) : second repère à côté du domicile, tableau vide avant la migration.
  const [zones, setZones] = useState<LiveZonePin[]>([])
  const loadSeq = useRef(0)
  const loadPros = useCallback(() => {
    if (!boot) return
    // Liste en cache lue ailleurs que sur le repli : on attend la vraie position au lieu d'afficher
    // un instant les prestataires autour de Grasse.
    if (isFallbackPos(userPos) && boot.center && !isFallbackPos(boot.center)) return
    const seq = ++loadSeq.current
    loadMapPros({ lat: userPos.lat, lng: userPos.lng }, boot.uid).then((d: MapCache) => {
      if (seq !== loadSeq.current) return
      setRawPros(d.list); setActs(d.acts); setFlags(d.flags)
    }).catch(() => { })
    fetchLiveZones(userPos.lat, userPos.lng).then(z => { if (seq === loadSeq.current) setZones(z) }).catch(() => { })
  }, [userPos, boot])
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
    const nm = (x.full_name || lab(x.trade) || '').trim()
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
      svc: actsOf(x).map(lab).join(', '), distTxt, cesu: !!flags[x.id]?.cesu, checked: flags[x.id]?.checked, rcproChecked: flags[x.id]?.rcproChecked,
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
  // Réserver depuis l'aperçu (audit 19/11, correction 11) : directement l'écran de réservation
  // (mission/new, prix figé), sans passer par la fiche. Prestataire « sur devis » : la conversation.
  // Hors ligne : pas de réservation (on peut lui écrire). Le prix vient de la fiche du prestataire.
  function reserve(p: Pro) {
    const raw = rawPros.find(x => x.id === p.id)
    if (raw?.pricing_type === 'devis') { contact(p.id); return }
    closePreview()
    router.push(`/mission/new?pro=${p.id}`)
  }
  const pvActions = (p: Pro, mobile: boolean) => {
    const raw = rawPros.find(x => x.id === p.id)
    const devis = raw?.pricing_type === 'devis'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="btn ghost" role="button" style={{ flex: 1, padding: '12px 8px' }} onClick={() => contact(p.id)}>Contacter</div>
          {p.active && (
            <div className="btn" role="button" style={{ flex: 1.5, padding: '12px 8px' }} onClick={() => reserve(p)}>
              {devis ? 'Demander un devis' : `Réserver${p.p ? ` · ${p.p}` : ''}`}
            </div>
          )}
        </div>
        <button type="button" onClick={() => { if (mobile) closePreview(); router.push(`/pro/${p.id}`) }}
          style={{ minHeight: 44, border: 0, background: 'none', color: '#097A6C', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
          Voir le profil et les avis
        </button>
      </div>
    )
  }

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
  // Zones visibles : mêmes filtres de service que les épingles (le métier principal du prestataire).
  const zonesVisible = useMemo(() => zones.filter(z => sel.length === 0 || (z.trade != null && sel.includes(z.trade)) || hitsOf({ id: z.provider_id, trade: z.trade || '' }) > 0), [zones, sel, hitsOf])
  // Toucher un repère d'intervention : l'aperçu du prestataire s'il est dans la liste, sinon sa fiche.
  function onSelectZone(id: string) {
    if (pros.some(q => q.id === id)) { setContactErr(''); setPvId(id) } else router.push(`/pro/${id}`)
  }
  function onSelectPro(p: { id: string }) {
    if (pros.some(q => q.id === p.id)) { setContactErr(''); setPvId(p.id) }
  }
  // Aperçu ouvert : la fiche et l'écran de réservation sont préchargés (affichage immédiat ensuite).
  useEffect(() => {
    if (!pvId) return
    prefetchProDetail(pvId)
    try { router.prefetch(`/pro/${pvId}`); router.prefetch('/mission/new') } catch { /* rien */ }
  }, [pvId, router])
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
  // Fiches des premiers prestataires de la liste préchargées pendant un temps mort (correction 4 du
  // 19/11 ter) : « Voir le profil » s'affiche depuis le cache de l'onglet, sans attente.
  const firstIds = sheetList.slice(0, 3).map(p => p.id).join(',')
  useEffect(() => {
    if (!firstIds) return
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void }
    const run = () => { firstIds.split(',').forEach(id => prefetchProDetail(id)); try { router.prefetch(`/pro/${firstIds.split(',')[0]}`) } catch { /* rien */ } }
    if (w.requestIdleCallback) { const h = w.requestIdleCallback(run, { timeout: 2000 }); return () => w.cancelIdleCallback?.(h) }
    const t = setTimeout(run, 800); return () => clearTimeout(t)
  }, [firstIds, router])
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
  // Mobile : les trois boutons tiennent sur UNE rangée au-dessus de la feuille (et du bandeau d'action de la
  // barre du bas) : « Déposer une demande » à gauche, Recentrer puis PING à droite. Ordinateur : comme avant.
  const deskLift = 'var(--ping-install-lift, 0px)'
  const ctrlBase = isDesk ? `calc(${deskLift} + 24px)` : `calc(${sheetH(sheet)} + ${SHEET_LIFT} + 12px)`
  // Sur ordinateur, le panneau de droite est permanent (liste, ou fiche du prestataire choisi).
  const ctrlRight = isDesk ? 410 : 14
  // Bulle verte rangée au-dessus de Recentrer (distance au bas de la fenêtre, sans le bandeau).
  const wrapBottomGap = typeof window !== 'undefined' && wrapEl ? Math.max(0, window.innerHeight - wrapEl.getBoundingClientRect().bottom) : 64
  const bubbleBottom = wrapH ? wrapBottomGap + 24 + 68 + 40 + 12 : null
  // Mobile : la bulle flottante est masquée (carte libre, doublon de l'onglet Messages) ; son volet reste
  // ouvert en un appui par « Laisser un commentaire sur cette page » en bas de la feuille. Ordinateur : bulle inchangée.
  useFeedbackBubbleSlot(view === 'v_map' ? bubbleBottom : null, view === 'v_map' && !isDesk, isDesk ? 412 : null)
  // Position de l'utilisateur centrée dans la partie visible de la carte (au-dessus de la feuille et du bandeau).
  const mapInset = isDesk || !wrapH || pvShow ? 0 : sheetPx(sheet === 'full' ? 'half' : sheet, wrapH) + bannerH

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
  // Puces de service (Tous, services du catalogue, CESU préfinancé) : sous la barre sur ordinateur, dans la feuille sur mobile.
  const serviceChips = (o: { top?: number; inSheet?: boolean }) => (
    <div className="chips noscroll" role="group" aria-label="Services"
      style={o.inSheet ? { position: 'static', margin: '0 -16px 6px', padding: '2px 16px 4px', zIndex: 'auto' } : { top: o.top }}>
      <div className={`chip ${sel.length === 0 ? 'on' : ''}`} role="button" aria-pressed={sel.length === 0} onClick={() => setSel([])}>Tous</div>
      {/* Services choisis en tête (maquette). */}
      {[...tradeKeys].sort((a, b) => (sel.includes(b) ? 1 : 0) - (sel.includes(a) ? 1 : 0)).map(k => (
        <div key={k} className={`chip ${sel.includes(k) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(k)} onClick={() => toggleSel(k)}>{lab(k)}</div>
      ))}
      <div className={`chip ${cesuOnly ? 'on' : ''}`} role="button" aria-pressed={cesuOnly} onClick={() => { setCesuOnly(c => !c); setPvId(null) }}>CESU préfinancé</div>
    </div>
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
            <div className="body full nopad" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="mapwrap" ref={setWrapEl}>
                {/* Mobile : une seule ligne en haut (menu + filtre) ; logo, bascule d'espace (dans le menu) et cloche
                    (doublon de l'onglet Messages) ne sont montrés que sur ordinateur (.map-desk-only, globals.css). */}
                <div className="topbar map-topbar">
                  <span className="mobile-only"><NavDrawer dark={false} /></span>
                  <div className="pinglogo map-desk-only">
                    <div className="mark">
                      <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.2" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke="var(--teal)" strokeWidth={1.3} opacity=".6" /></svg>
                      <span className="d" />
                    </div>
                    <div><div className="wd">ping</div></div>
                  </div>
                  <div className="sp map-desk-only" />
                  <span className="map-desk-only" style={{ display: 'contents' }}><ModeSwitchPill to="pro" /></span>
                  <button type="button" className="tbell map-desk-only" onClick={() => router.push('/messages')} aria-label={unread ? `Messages, ${unread} non lu${unread > 1 ? 's' : ''}` : 'Messages'} style={{ color: 'var(--ink)', padding: 0 }}>
                    <Ic name="msg" size={18} />
                    {unread > 0 && <span className="mq-nb">{unread > 9 ? '9+' : unread}</span>}
                  </button>
                </div>

                <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
                  <LiveMap userPos={userPos} pros={rawVisible} onSelect={onSelectPro} recenterTick={recenterTick} onMapClick={closePreview} selectedId={pvId} newIds={newIds} zones={zonesVisible} onSelectZone={onSelectZone} inset={mapInset} />
                </div>

                <div className="searchbar map-search" role="button" aria-haspopup="dialog" style={{ top: 66 }} onClick={() => go('v_search')}>
                  <div className="lg" style={{ background: 'var(--btnFill)', color: '#fff' }}><Ic name="filter" size={15} /></div>
                  <div className="tx">{sel.length || cesuOnly ? [selTxt, cesuOnly ? 'CESU préfinancé' : ''].filter(Boolean).join(' · ') : 'Filtrer par service, près de vous'}</div>
                  <span className="chv"><Ic name="down" size={20} /></span>
                </div>

                {/* Ordinateur : puces sous la barre. Mobile : les mêmes puces sont dans la feuille (et dans l'écran de filtre). */}
                {isDesk && serviceChips({ top: 128 })}

                {!ctrlHidden && (<>
                  <div className="pingbtn" role="button" aria-label="PING : actualiser les prestataires autour de vous" onClick={() => loadPros()} style={{ bottom: ctrlBase, right: ctrlRight }}><span className="halo" /><span className="lbl">PING</span></div>
                  {/* Déposer une annonce (Romain 31/10 : introuvable depuis la carte). Masqué quand une fiche est ouverte. */}
                  {!pvShow && (
                    <button type="button" onClick={() => router.push('/client/demandes/new')}
                      style={{ position: 'absolute', left: 14, bottom: isDesk ? ctrlBase : `calc(${ctrlBase} + 4px)`, zIndex: 32, display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, boxSizing: 'border-box', padding: '0 18px', borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, boxShadow: '0 8px 20px rgba(20,50,60,.25)', cursor: 'pointer' }}>
                      <Ic name="plus" size={16} />
                      Déposer une demande
                    </button>
                  )}
                  <div className="loc" role="button" aria-label="Recentrer sur ma position" onClick={() => setRecenterTick(t => t + 1)} style={isDesk ? { bottom: `calc(${ctrlBase} + 68px)`, right: ctrlRight + 8, color: 'var(--ink)' } : { bottom: `calc(${ctrlBase} + 6px)`, right: ctrlRight + 56 + 10, color: 'var(--ink)' }}><Ic name="loc" size={20} /></div>
                </>)}

                {/* Volet de la liste (mobile) : remplacé par l'aperçu quand un prestataire est choisi. */}
                {!pvShow && (
                  <MapSheet snap={sheet} onSnap={setSheet} title={sheetTitle}>
                    {!isDesk && serviceChips({ inSheet: true })}
                    {listBody}
                    <SheetFeedbackRow />
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
                      {pvActions(pv, true)}
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
                        {pv.rcproChecked === true && (
                          <div className="mq-vr ok"><span className="vi"><Ic name="shieldPlain" size={15} /></span><span><b>Assurance responsabilité civile</b><small>Attestation contrôlée par PING</small></span><span className="vs"><Ic name="check" size={11} />Validée</span></div>
                        )}
                        {pv.rcproChecked !== true && pv.rcpro && (
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
                    <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>{pvActions(pv, false)}</div>
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
                {tradeKeys.map(key => (
                  <div key={key} className={`cat ${sel.includes(key) ? 'on' : ''}`} role="button" aria-pressed={sel.includes(key)} onClick={() => toggleSel(key)}>
                    <div className="ci"><Ic name={svcIc(key)} size={17} /></div>{lab(key)}{countBy[key] ? <span style={{ opacity: .7, marginLeft: 4, fontWeight: 600 }}>{countBy[key]}</span> : null}
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
