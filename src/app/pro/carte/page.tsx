"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { geocodeAddress } from '@/lib/geocode'
import LocationAsk from '@/components/LocationAsk'
import { useInitialPosition } from '@/lib/location'
import ModeSwitchPill from '@/components/ModeSwitchPill'
import NavDrawer from '@/components/NavDrawer'
import { requestDetailRows } from '@/components/RequestDetails'
import { Ic, svcIconKey } from '@/components/PingIcons'
import { useUnreadTotal } from '@/lib/unread'
import { addressUsable, maskAddress } from '@/lib/address'
import { fetchRequestsNearby, respondToRequest, type RequestNearby } from '@/lib/services'
import { TRADES } from '@/lib/trades'
import { fetchProTrades, proRadiusKm, proRequestMatches } from '@/lib/proNearby'
import { createClient } from '@/lib/supabase/client'
import { readScreenCache, writeScreenCache, sessionUserId } from '@/lib/screenCache'
import { FALLBACK_POS, PRO_CARTE_CACHE, fetchCarteMissions, fetchCarteSent, fetchCarteDone, type CarteCache } from '@/lib/carteLoaders'
import MapSheet, { SHEET_H, SHEET_LIFT, sheetPx, type SheetSnap } from '@/components/MapSheet'
import { useFeedbackBubbleSlot, useIsDesktop, useElementHeight } from '@/lib/mapChrome'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

function distanceTxt(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`
}
function agoTxt(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}
function UrgentTag() {
  return <span className="mq-tag urg" style={{ marginRight: 6, verticalAlign: 1 }}>Urgent</span>
}
function budgetTxt(cents: number | null) {
  return cents ? `${Math.round(cents / 100)} €` : 'Sur devis'
}
function budgetRangeTxt(r: RequestNearby) {
  if (r.budget_min_cents || r.budget_max_cents) {
    const min = r.budget_min_cents ? `${Math.round(r.budget_min_cents / 100)} €` : null
    const max = r.budget_max_cents ? `${Math.round(r.budget_max_cents / 100)} €` : null
    // Fourchette compacte comme la maquette : « 80 – 120 € ».
    if (min && max) return min === max ? max : `${Math.round(r.budget_min_cents! / 100)} – ${max}`
    return min || max || 'Sur devis'
  }
  return budgetTxt(r.budget_cents)
}
const SLOT_LABELS: Record<string, string> = { matin: 'Matin', 'apres-midi': 'Après-midi', soir: 'Soir' }
// Repli de position (Grasse) ; tant que la carte n'a que ce repli, le centre de la dernière lecture sert.
// Dernière liste connue (audit ergonomie 19/11 bis, correction 1) : affichée dès l'ouverture, puis
// remplacée par la lecture fraîche. Cache de l'onglet lié au compte, rempli aussi dès la connexion
// (19/11 ter, correction 2 : src/lib/carteLoaders.ts).

export default function ProCartePage() {
  const router = useRouter()
  const unread = useUnreadTotal('pro', 'pro-carte')
  // Position : expliquée avant la fenêtre du navigateur (LocationAsk), repli Grasse.
  // Position déclarée du prestataire (onboarding) avant toute fenêtre ; encart non bloquant sinon.
  const { pos: userPos, ask: askLoc, dismiss: dismissLoc, choose: chooseLoc } = useInitialPosition(FALLBACK_POS, 'pro')
  const [allReqs, setAllReqs] = useState<RequestNearby[]>([])
  // boot : compte lu dans la session locale et cache appliqué (quelques ms) ; loaded : une liste
  // (cache ou lecture) est affichée, « 0 demande » ne s'écrit plus pendant la première lecture.
  const [boot, setBoot] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [cacheCenter, setCacheCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [recenterTick, setRecenterTick] = useState(0)
  const [available, setAvailable] = useState(true)
  const [proId, setProId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // Deux vues de la carte : les demandes ouvertes autour de soi, ou ses propres interventions
  // confirmées (adresse connue, le tarif est validé).
  const [view, setView] = useState<'demandes' | 'interventions'>('demandes')
  const [missions, setMissions] = useState<any[]>([])
  const [sendError, setSendError] = useState('')
  // Zone couverte : rayon autour de soi, ou autour d'une ville choisie.
  const [radiusKm, setRadiusKm] = useState(25)
  const [zoneCenter, setZoneCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [zoneCity, setZoneCity] = useState('')
  const [zoneOpen, setZoneOpen] = useState(false)
  // Volet du bas (mobile) : replié, mi-hauteur (par défaut, comme la maquette) ou plein.
  const [sheet, setSheet] = useState<SheetSnap>('half')
  const isDesk = useIsDesktop()
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null)
  const wrapH = useElementHeight(wrapEl)
  // Métiers du pro (métier principal + prestations de /pro/tarifs) : la carte ne montre par
  // défaut que les demandes de ses métiers ; « Autres métiers » élargit à la demande.
  const [myTrades, setMyTrades] = useState<string[]>([])
  const [tradeSel, setTradeSel] = useState<string[] | null>(null) // null = tous mes métiers
  const [showOthers, setShowOthers] = useState(false)
  const [zoneErr, setZoneErr] = useState('')
  const posIsFallback = userPos.lat === FALLBACK_POS.lat && userPos.lng === FALLBACK_POS.lng
  const center = zoneCenter || (posIsFallback && cacheCenter ? cacheCenter : userPos)
  async function chooseRadius(km: number) {
    setRadiusKm(km)
    if (proId) await createClient().from('provider_profiles').update({ service_radius_km: km }).eq('id', proId)
  }
  async function chooseCity() {
    setZoneErr('')
    const g = await geocodeAddress(zoneCity)
    if (!g) { setZoneErr('Ville introuvable.'); return }
    setZoneCenter(g); setRecenterTick(t => t + 1); setZoneOpen(false)
  }


  // Le bandeau visible/masque doit refleter (et modifier) le vrai flag qui
  // conditionne l'apparition sur providers_nearby (provider_profiles.is_active),
  // pas juste un etat visuel local — sinon un pro se croit masque alors qu'il
  // reste visible des clients (ou l'inverse).
  // Ouverture (audit 19/11 bis, correction 1) : compte lu dans la session locale, dernière liste
  // affichée tout de suite, puis la lecture des demandes part en premier (effet `load` dès `boot`),
  // en parallèle du profil (disponibilité, rayon, métiers) et des interventions (effets sur proId).
  useEffect(() => {
    const supabase = createClient()
    let off = false
    sessionUserId(supabase).then(uid => {
      if (off) return
      if (!uid) { setBoot(true); return }
      const c = readScreenCache<CarteCache>(PRO_CARTE_CACHE, uid)
      if (c) {
        setAllReqs(c.reqs || []); setRadiusKm(c.radiusKm || 25); setMyTrades(c.trades || []); setAvailable(c.available !== false)
        setMissions(c.missions || []); setSent(c.sent || []); setDone(c.done || [])
        if (c.center) setCacheCenter(c.center)
        setLoaded(true)
      }
      setProId(uid); setBoot(true)
      supabase.from('provider_profiles').select('is_active, service_radius_km, trade').eq('id', uid).single()
        .then(async ({ data }) => {
          if (off || !data) return
          // Même rayon et mêmes métiers que le compteur du tableau de bord (src/lib/proNearby.ts).
          setAvailable(!!data.is_active); setRadiusKm(proRadiusKm(data.service_radius_km))
          const t = await fetchProTrades(supabase, uid, data.trade)
          if (!off) setMyTrades(t)
        })
    })
    return () => { off = true }
  }, [])

  async function toggleAvailable() {
    if (!proId) return
    const next = !available
    setAvailable(next)
    const { error } = await createClient().from('provider_profiles').update({ is_active: next }).eq('id', proId)
    if (error) setAvailable(!next)
  }

  useEffect(() => {
    if (!proId) return
    fetchCarteMissions(createClient(), proId).then(setMissions)
  }, [proId])
  // Propositions envoyées (lot 16) : réponses du pro à une demande ouverte, pas encore au tarif
  // validé. Sans ça, une réponse abandonnée disparaissait et la demande restait listée comme
  // si de rien n'était. La demande répondue reste « open » (elle est toujours publique) ; une
  // conversation ouverte par le client (« Contacter ») a une demande « matched » et vit dans Messages.
  const [sent, setSent] = useState<any[]>([])
  useEffect(() => {
    if (!proId) return
    fetchCarteSent(createClient(), proId).then(setSent)
  }, [proId])
  const sentByRequest: Record<string, string> = {}
  sent.forEach(t => { if (t.request_id && !sentByRequest[t.request_id]) sentByRequest[t.request_id] = t.id })
  // Missions terminees : gardees dans « Mes interventions », sous les a-venir.
  const [done, setDone] = useState<any[]>([])
  useEffect(() => {
    if (!proId) return
    fetchCarteDone(createClient(), proId).then(setDone)
  }, [proId])
  const missionWhen = (m: any) => m.scheduled_at
    ? new Date(m.scheduled_at).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Date à fixer'

  // Nouvelle demande à proximité : bandeau « Nouvelle demande à … », comme les notifications de
  // l'animation /animation. Relecture toutes les 60 s ; la première lecture ne déclenche rien.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<RequestNearby | null>(null)
  // Filtre par métier : ses propres annonces toujours visibles ; sans métier connu, tout est montré.
  const activeTrades = tradeSel ?? myTrades
  const matches = (r: RequestNearby) => proRequestMatches(r, myTrades, activeTrades, showOthers)
  const matchRef = useRef(matches)
  matchRef.current = matches
  const reqs = allReqs.filter(matches)
  const othersCount = allReqs.filter(r => !r.mine && myTrades.length > 0 && !myTrades.includes(r.category)).length
  function toggleTrade(k: string) {
    const cur = tradeSel ?? myTrades
    const next = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]
    if (!next.length) return // au moins un métier reste affiché
    setTradeSel(next.length === myTrades.length && myTrades.every(x => next.includes(x)) ? null : next)
    setSelectedId(null)
  }
  // zoneGen : numéro de la dernière lecture faite pour une nouvelle zone (ouverture, rayon, ville,
  // position) ; la carte se recadre sur ces lectures-là, pas sur la relecture périodique.
  const [zoneGen, setZoneGen] = useState(0)
  // Une lecture lancée avant un changement de zone (rayon, ville, position) est ignorée à son
  // retour : seule la dernière zone s'affiche, même si une réponse plus ancienne arrive après.
  const zoneSeq = useRef(0)
  const load = useCallback((newZone = false) => {
    if (newZone) zoneSeq.current += 1
    const seq = zoneSeq.current
    fetchRequestsNearby(center.lat, center.lng, radiusKm * 1000).then(list => {
      if (seq !== zoneSeq.current) return
      setAllReqs(list); setLoaded(true)
      if (newZone) setZoneGen(g => g + 1)
      if (seen.current && !newZone) {
        const nouveau = list.find(r => !seen.current!.has(r.id) && matchRef.current(r))
        if (nouveau) setFresh(nouveau)
      }
      seen.current = new Set(list.map(r => r.id))
    })
  }, [center.lat, center.lng, radiusKm])
  useEffect(() => { if (boot) load(true) }, [load, boot])
  // Mémorise la dernière liste (et les compteurs) pour la prochaine ouverture ; pas une zone
  // choisie par ville (elle n'est pas gardée à la réouverture).
  useEffect(() => {
    if (!proId || !loaded || zoneCenter) return
    writeScreenCache(PRO_CARTE_CACHE, proId, { reqs: allReqs, radiusKm, center: posIsFallback ? cacheCenter : userPos, trades: myTrades, available, missions, sent, done } satisfies CarteCache)
  }, [proId, loaded, zoneCenter, allReqs, radiusKm, posIsFallback, cacheCenter, userPos, myTrades, available, missions, sent, done])
  useEffect(() => {
    if (!available) return
    const t = setInterval(() => load(false), 60000)
    return () => clearInterval(t)
  }, [load, available])
  useEffect(() => {
    if (!fresh) return
    const t = setTimeout(() => setFresh(null), 9000)
    return () => clearTimeout(t)
  }, [fresh])

  const selected = selectedId ? reqs.find(r => r.id === selectedId) || null : null
  const nearest = reqs.length ? Math.round(reqs[0].distance_m) : null
  const nearestTxt = nearest == null ? '—' : distanceTxt(nearest)

  // « Contacter le client » ouvre la conversation ; « Proposer mon tarif » l'ouvre sur le formulaire de
  // tarif du chat (même mécanisme de devis, ?tarif).
  async function respond(r: RequestNearby, withOffer = false) {
    setSending(true)
    const { missionId, error } = await respondToRequest(r.id)
    setSending(false)
    if (missionId) router.push(`/mission/${missionId}/chat${withOffer ? '?tarif' : ''}`)
    else if (error === 'not_authenticated') router.push('/auth/login?next=/pro/carte')
    else setSendError('Impossible de contacter ce client pour le moment (demande peut-être déjà prise). Réessayez.')
  }

  // Détail d'une demande sélectionnée (pin carte ou carte de la liste) : les
  // coordonnées exactes du client ne sont jamais montrées ici (masquées côté
  // API tant que la mission n'est pas confirmée) — seule la distance l'est.
  const requestDetail = selected && (
    <>
      <button type="button" onClick={() => setSelectedId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: '0 8px 4px 0', marginBottom: 4, minHeight: 44, color: 'var(--ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
        <Ic name="back" size={18} />Toutes les demandes
      </button>
      {/* Carte de la demande (maquette, écran « Demande ») */}
      <div className="mq-card">
        <b style={{ fontFamily: 'var(--fh)', fontSize: 15, color: 'var(--ink)', display: 'block' }}>{selected.urgent && <UrgentTag />}{selected.title || TRADES[selected.category] || selected.category}</b>
        <p style={{ color: 'var(--slate)', margin: '6px 0', fontSize: 13 }}>
          {TRADES[selected.category] || selected.category} · à {distanceTxt(selected.distance_m)}{zoneCenter && zoneCity ? ` de ${zoneCity}` : ''} · budget <b style={{ color: '#097A6C' }}>{budgetRangeTxt(selected)}</b> · {agoTxt(selected.created_at)}
        </p>
        {selected.desired_date && (
          <div className="mq-dl"><span>Pour quand</span><b>{new Date(selected.desired_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{selected.desired_slot ? ` · ${SLOT_LABELS[selected.desired_slot] || selected.desired_slot}` : ''}</b></div>
        )}
        {requestDetailRows(selected).map(([k, v]) => <div key={k} className="mq-dl"><span>{k}</span><b>{v}</b></div>)}
        {selected.description?.trim() && <div className="mq-dl" style={{ alignItems: 'flex-start' }}><span>Précisions</span><b style={{ fontWeight: 600, maxWidth: '68%' }}>{selected.description}</b></div>}
        <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>L&apos;adresse exacte vous est donnée quand le tarif est validé et le rendez-vous fixé. Position floutée à 500 m.</p>
      </div>
    </>
  )
  // Boutons de la demande : sur mobile, posés en pied du volet (toujours visibles dès la
  // mi-hauteur, sans « Agrandir ») ; sur ordinateur, sous la carte de la demande.
  const requestActions = selected && (
    <>
      {sendError && <p style={{ color: '#c0503a', fontSize: 12, marginBottom: 10 }}>{sendError}</p>}
      {!selected.mine && sentByRequest[selected.id] ? (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--ink)', background: 'rgba(18,179,156,.08)', borderRadius: 12, padding: 12, lineHeight: 1.5, marginBottom: 10 }}>
            Vous avez déjà contacté ce client pour cette demande.
          </p>
          <div className="btn" role="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => router.push(`/mission/${sentByRequest[selected.id]}/chat`)}>
            <Ic name="msg" />Voir la conversation
          </div>
        </>
      ) : selected.mine ? (
        <div className="mq-card"><b style={{ color: 'var(--ink)' }}>C&apos;est votre propre demande</b><p style={{ color: 'var(--slate)', fontSize: 13 }}>Un compte ne répond pas à sa propre annonce.</p></div>
      ) : (
        <>
          {/* Côte à côte : la paire tient en pied de volet sans réduire la liste. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="btn" role="button" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, opacity: sending ? .6 : 1, pointerEvents: sending ? 'none' : 'auto' }} onClick={() => respond(selected, true)}>
              <Ic name="tag" />Proposer mon tarif
            </div>
            <div className="btn ghost" role="button" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, opacity: sending ? .6 : 1, pointerEvents: sending ? 'none' : 'auto' }} onClick={() => respond(selected)}>
              <Ic name="msg" />{sending ? 'Envoi…' : 'Contacter'}
            </div>
          </div>
        </>
      )}
    </>
  )

  // Contenu partagé entre la fiche mobile (bottom sheet ".preview") et le
  // panneau desktop (".detail-panel", toujours visible a cote de la carte) :
  // meme etat, meme actions, seule la mise en page differe selon l'ecran.
  const urgentCount = reqs.filter(r => r.urgent).length
  const toggle = (
    <div onClick={toggleAvailable} role="switch" aria-checked={available} aria-label="Disponible maintenant" tabIndex={0}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAvailable() } }}
      style={{ width: 52, height: 30, borderRadius: 999, background: available ? 'var(--gold)' : '#cdd6d3', position: 'relative', cursor: 'pointer', flex: '0 0 auto', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: available ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
    </div>
  )
  // Ligne secondaire (propositions envoyées, interventions) : même forme qu'une ligne de liste.
  const linkRow = (label: string, sub: string, onClick: () => void, icon: string) => (
    <button type="button" className="mq-row" onClick={onClick} style={{ padding: '10px 0' }}>
      <span className="mq-rico"><Ic name={icon} size={16} /></span>
      <span className="grow"><b>{label}</b><small>{sub}</small></span>
      <span className="chev"><Ic name="chev" size={18} /></span>
    </button>
  )
  const activityPanel = (
    <>
      {/* Disponibilité (maquette) : titre, sous-titre, interrupteur doré */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{available ? 'Disponible maintenant' : 'Hors ligne'}</b>
          <small style={{ display: 'block', fontSize: 11.5, color: 'var(--slate)', marginTop: 2 }}>{available ? 'Les clients vous voient sur la carte' : 'Les clients ne vous voient plus sur la carte'}</small>
        </div>
        {toggle}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink)', marginBottom: 8 }}>
        {!loaded ? 'Recherche des demandes autour de vous…' : <>{reqs.length} demande{reqs.length > 1 ? 's' : ''} ouverte{reqs.length > 1 ? 's' : ''} · {urgentCount} urgente{urgentCount > 1 ? 's' : ''}</>}
      </p>
      {loaded && reqs.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '2px 0 10px' }}>
          {allReqs.length > 0 ? 'Aucune demande pour ces services dans votre zone.' : 'Aucune demande ouverte dans votre zone pour le moment. Élargissez la zone pour en voir davantage.'}
        </p>
      )}

      {/* Cartes de demandes (maquette, .rcard) : urgence et titre, budget, puis service · distance · âge */}
      {reqs.map(r => (
        <button type="button" key={r.id} className="mq-rcard" onClick={() => selectRequest(r.id)}>
          {r.urgent && <UrgentTag />}<b style={{ display: 'inline' }}>{r.title || TRADES[r.category] || r.category}</b>
          <span className="bud">{budgetRangeTxt(r)}</span>
          <small>{TRADES[r.category] || r.category} · à {distanceTxt(r.distance_m)} · {agoTxt(r.created_at)}
            {sentByRequest[r.id] && <span className="mq-tag" style={{ marginLeft: 6 }}>Déjà contactée</span>}</small>
        </button>
      ))}

      <div style={{ marginTop: 6 }}>
        {sent.length > 0 && linkRow(`Propositions envoyées (${sent.length})`, 'Demandes auxquelles vous avez répondu, tarif pas encore validé', () => { setView('interventions'); setSelectedId(null) }, 'tag')}
        {linkRow(`Mes interventions (${missions.length + done.length})`, missions.length ? `${missions.length} à venir, avec leur adresse` : 'Missions au tarif validé', () => { setView('interventions'); setSelectedId(null) }, 'ag')}
      </div>
    </>
  )

  const sentBlock = sent.length > 0 && (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>Propositions envoyées ({sent.length})</div>
      <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 10 }}>Demandes auxquelles vous avez répondu, tarif pas encore validé.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sent.map(t => (
          <div key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
            style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 13, padding: 11, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 13, color: 'var(--ink)' }}>{t.requests?.title || TRADES[t.requests?.category] || 'Demande'}</b>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8a6520', whiteSpace: 'nowrap' }}>En attente</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 3 }}>Contactée {agoTxt(t.created_at)} · ouvrir la conversation</div>
          </div>
        ))}
      </div>
    </div>
  )

  const missionsPanel = (
    <>
      <button type="button" onClick={() => setView('demandes')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: '0 8px 4px 0', marginBottom: 4, minHeight: 44, color: 'var(--ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
        <Ic name="back" size={18} />Demandes autour de moi
      </button>
      {sentBlock}
      <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>Mes interventions à venir</div>
      <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 12 }}>Missions au tarif validé, avec leur adresse.</div>
      {missions.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--slate)' }}>Aucune intervention confirmée pour l&apos;instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missions.map(m => (
            <div key={m.id} onClick={() => router.push(`/mission/${m.id}/chat`)}
              style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 13, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 13, color: 'var(--ink)' }}>{m.requests?.title || TRADES[m.requests?.category] || 'Intervention'}</b>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: m.status === 'arrived' ? '#1a8f4c' : '#0C8F7E', whiteSpace: 'nowrap' }}>{m.status === 'arrived' ? 'En cours' : missionWhen(m)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 3 }}>{!m.requests?.address ? 'Adresse à fixer par le client'
                : addressUsable(m.address_status) ? m.requests.address
                : m.address_status === 'a_valider' ? `${maskAddress(m.requests.address)} · autre adresse à valider dans la conversation`
                : 'Adresse refusée : le client en propose une autre'}</div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: '18px 0 8px' }}>Interventions terminées ({done.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {done.map(m => (
              <div key={m.id} onClick={() => router.push(`/mission/${m.id}/chat`)}
                style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 13, padding: 11, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontFamily: 'Quicksand,sans-serif', fontSize: 13, color: 'var(--ink)' }}>{m.requests?.title || TRADES[m.requests?.category] || 'Intervention'}</b>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate)', whiteSpace: 'nowrap' }}>Terminée</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 3 }}>{new Date(m.completed_at || m.scheduled_at || m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{m.subtotal_cents ? ` · ${(m.subtotal_cents / 100).toLocaleString('fr-FR')} €` : ''}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
  const sidePanel = view === 'interventions' ? missionsPanel : (selected ? requestDetail : activityPanel)
  const sideActions = view !== 'interventions' && selected ? requestActions : null
  const mapPins = view === 'interventions'
    ? missions.filter(m => m.requests?.lat != null && m.requests?.lng != null && addressUsable(m.address_status)).map(m => ({
        id: m.id, lat: m.requests.lat, lng: m.requests.lng, color: '#12B39C',
        label: m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null,
      }))
    // Épingle de demande (maquette) : pictogramme du service dans la goutte, fourchette de budget au-dessus.
    : reqs.map(r => { const b = r.budget_max_cents ?? r.budget_cents ?? r.budget_min_cents; return { id: r.id, lat: r.lat, lng: r.lng, color: r.urgent ? '#E8743B' : undefined, icon: svcIconKey(r.category), label: b ? budgetRangeTxt(r) : (r.urgent ? 'Urgent' : null) } })

  // Les demandes dans le champ dès l'ouverture : la carte cadre la position ET les épingles
  // (zoom plafonné au quartier), en laissant la place de la barre du haut et des puces (~155 px, plus la hauteur d’une épingle et de son prix), du volet
  // à mi-hauteur sur mobile et du panneau de détail sur ordinateur. Recadrée quand le filtre,
  // la zone ou la vue changent, pas à la relecture des demandes toutes les 60 s.
  const fitKey = `${view}|${activeTrades.join(',')}|${showOthers}|${zoneGen}`
  const fitPad = isDesk
    ? { top: 215, right: 420, bottom: 40, left: 40 }
    : { top: 215, right: 48, bottom: (wrapH ? sheetPx('half', wrapH) : 300) + 24, left: 48 }
  function selectRequest(id: string) {
    setSelectedId(id)
    if (sheet === 'peek') setSheet('half')
  }
  // Recentrer : posé au-dessus du volet (et du bandeau d'installation), caché quand il est plein.
  const locHidden = !isDesk && sheet === 'full'
  const locBottom = isDesk ? `calc(${SHEET_LIFT} + 24px)` : `calc(${SHEET_H[sheet]} + ${SHEET_LIFT} + 12px)`
  const locRight = isDesk ? 418 : 22
  const wrapBottomGap = typeof window !== 'undefined' && wrapEl ? Math.max(0, window.innerHeight - wrapEl.getBoundingClientRect().bottom) : 64
  // Bulle verte au-dessus de Recentrer ; sur ordinateur, à gauche du panneau permanent (pas dessus).
  useFeedbackBubbleSlot(wrapH ? wrapBottomGap + (isDesk ? 24 : sheetPx(sheet, wrapH) + 12) + 40 + 12 : null, !isDesk && sheet === 'full', isDesk ? 412 : null)
  const reqWord = `demande${reqs.length > 1 ? 's' : ''}`
  const sheetTitle = view === 'interventions'
    ? `${missions.length} intervention${missions.length > 1 ? 's' : ''} à venir`
    : selected ? (selected.title || TRADES[selected.category] || 'Demande')
      : !loaded ? 'Demandes autour de vous'
      : available ? `${reqs.length} ${reqWord} autour de vous` : `Hors ligne · ${reqs.length} ${reqWord}`

  return (
    <div className="procarte-screen">
      {askLoc && <LocationAsk onChoose={chooseLoc} onClose={dismissLoc}
        text="Pour vous montrer les demandes près de vous, PING a besoin de votre position (jamais suivie, jamais partagée)." />}
      <div className="body full nopad procarte-body">
        <div className="mapwrap" ref={setWrapEl}>
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
            <ModeSwitchPill to="particulier" />
            <button type="button" className="tbell" onClick={() => router.push('/messages')} aria-label={unread ? `Messages, ${unread} non lu${unread > 1 ? 's' : ''}` : 'Messages'} style={{ color: 'var(--ink)', padding: 0 }}>
              <Ic name="bell" size={19} />
              {unread > 0 && <span className="mq-nb">{unread > 9 ? '9+' : unread}</span>}
            </button>
          </div>

          {/* Barre de zone (maquette, .searchbar.pro) : soleil doré, état et rayon, « Zone » */}
          <div className="searchbar" role="button" aria-expanded={zoneOpen} onClick={() => setZoneOpen(o => !o)} style={{ background: '#fff', top: 66, padding: '11px 14px', minHeight: 44 }}>
            <Ic name="sun" size={20} style={{ color: '#F2A93B' }} />
            <span style={{ flex: 1, minWidth: 0, color: 'var(--slate)', fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{available ? `Visible · demandes à moins de ${radiusKm} km${zoneCenter ? ' de ' + (zoneCity || 'la ville') : ''}` : `Hors ligne · demandes à moins de ${radiusKm} km`}</span>
            <span style={{ color: '#8A6520', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', paddingLeft: 8 }}>Zone</span>
          </div>

          {zoneOpen && (
            <div style={{ position: 'absolute', zIndex: 30, left: 12, right: 12, top: 118, background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 10px 30px rgba(18,54,68,.25)', border: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>Zone couverte</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[5, 10, 15, 25, 50].map(km => (
                  <div key={km} onClick={() => chooseRadius(km)} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: radiusKm === km ? 'var(--ink)' : 'var(--paper)', color: radiusKm === km ? '#fff' : 'var(--ink)' }}>{km} km</div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 6 }}>Centre de la zone</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div onClick={() => { setZoneCenter(null); setZoneCity(''); setRecenterTick(t => t + 1); setZoneOpen(false) }} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: zoneCenter ? 'var(--paper)' : 'var(--gold)', color: zoneCenter ? 'var(--ink)' : '#fff' }}>Autour de moi</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={zoneCity} onChange={e => setZoneCity(e.target.value)} placeholder="Ou une ville (ex. Cannes)" autoComplete="off" style={{ flex: 1, minHeight: 44, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 16 }} />
                <div onClick={chooseCity} role="button" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'var(--tealD)', color: '#fff' }}>OK</div>
              </div>
              {zoneErr && <p style={{ color: '#c0503a', fontSize: 12, marginTop: 6 }}>{zoneErr}</p>}
            </div>
          )}

          {/* Puces de métiers sur la carte (maquette) : tous mes métiers, chacun, puis les autres. */}
          {view === 'demandes' && myTrades.length > 0 && (
            <div className="chips noscroll" style={{ top: 116 }} role="group" aria-label="Métiers affichés">
              <div className={`chip ${tradeSel == null ? 'on' : ''}`} role="button" aria-pressed={tradeSel == null} onClick={() => { setTradeSel(null); setSelectedId(null) }}>Tous mes métiers</div>
              {myTrades.map(k => (
                <div key={k} className={`chip ${activeTrades.includes(k) ? 'on' : ''}`} role="button" aria-pressed={activeTrades.includes(k)} onClick={() => toggleTrade(k)}>{TRADES[k] || k}</div>
              ))}
              {othersCount > 0 && (
                <div className={`chip ${showOthers ? 'on' : ''}`} role="button" aria-pressed={showOthers} onClick={() => { setShowOthers(o => !o); setSelectedId(null) }}>Autres métiers ({othersCount})</div>
              )}
            </div>
          )}
          {view === 'interventions' && (
            <div className="chips noscroll" style={{ top: 116 }}>
              <div className="chip" role="button" onClick={() => { setView('demandes'); setSelectedId(null) }}><Ic name="back" size={15} />Demandes autour de moi</div>
              <div className="chip on" role="button" aria-pressed="true">Mes interventions ({missions.length + done.length})</div>
            </div>
          )}

          <div className="mapscene" id="mapscene" style={{ isolation: 'isolate' }}>
            <LiveMap
              userPos={center}
              pros={[]}
              onSelect={() => { }}
              requests={mapPins}
              onSelectRequest={(id: string) => view === 'interventions' ? router.push(`/mission/${id}/chat`) : selectRequest(id)}
              recenterTick={recenterTick}
              youLabel="Vous êtes ici"
              echo={available}
              selectedId={selectedId}
              fit
              fitKey={fitKey}
              fitPad={fitPad}
            />
          </div>

          {fresh && (
            <div role="status" onClick={() => { setView('demandes'); selectRequest(fresh.id); setFresh(null) }}
              style={{ position: 'absolute', left: 12, right: 12, top: 170, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: '12px 14px', boxShadow: '0 8px 24px rgba(18,54,68,.18)', cursor: 'pointer', animation: 'pinIn .35s ease-out', maxWidth: 460, margin: '0 auto' }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, background: fresh.urgent ? '#E8743B' : '#12B39C', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Nouvelle demande à {distanceTxt(fresh.distance_m)}{fresh.urgent ? ' · urgent' : ''}</b>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--slate)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fresh.title || TRADES[fresh.category] || fresh.category}</span>
              </span>
            </div>
          )}

          {!locHidden && (
            <div className="loc" role="button" aria-label="Recentrer sur ma position et les demandes" onClick={() => setRecenterTick(t => t + 1)} style={{ bottom: locBottom, right: locRight, color: 'var(--ink)' }}><Ic name="loc" size={20} /></div>
          )}

          {/* Mobile : volet à 3 positions. Desktop : caché (.app-shell .map-sheet),
              remplacé par le panneau permanent ci-dessous. */}
          <MapSheet snap={sheet} onSnap={setSheet} title={sheetTitle} footer={sideActions}>
            {sidePanel}
          </MapSheet>

          {/* Desktop (>=1000px) : panneau permanent a cote de la carte, cachee sur
              mobile (.detail-panel { display:none } par defaut). */}
          <div className="detail-panel">
            {!selected && (
              <div style={{ padding: '14px 16px 4px' }}>
                <b style={{ fontFamily: 'var(--fh)', fontSize: 16, color: 'var(--ink)' }}>{sheetTitle}</b>
              </div>
            )}
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {sidePanel}
              {sideActions && <div style={{ marginTop: 12 }}>{sideActions}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
