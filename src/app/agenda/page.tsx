"use client"
import '../aere.css'
import { incidentOpen } from '@/lib/incident'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slotEnd, dayLabel, hhmm, type Slot } from '@/lib/slots'
import { readScreenCache } from '@/lib/screenCache'
import { AGENDA_CACHE, loadAgendaSnap, type AgendaCache } from '@/lib/agendaLoader'
import Calendar, { type CalEvent } from '@/components/calendar/Calendar'
import { useMode, roleColumn } from '@/lib/mode'
import { UPCOMING, DONE, txDate, durationMinutes } from '@/lib/agenda'
import { isTodayMission } from '@/lib/todayMission'
import { MissionSuivi } from '@/components/presence/MissionTimeline'
import PresenceTag from '@/components/presence/PresenceTag'
import { rowHasPresence } from '@/lib/presence'
import BookingCard from '@/components/BookingCard'
import MissionActions from '@/components/MissionActions'
import '../aere.css'
import '../aere-pro.css'
import { bookingPending, bookingEnded, bookingLapsed, expireBookings } from '@/lib/booking'
import { DaySheet, MissionLineRow, type MissionLine } from '@/components/agenda/MissionLines'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }

function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(2).replace('.', ',')} €` : '' }

// Lot 28 (validé par Romain le 18/11/2026, maquette « Agenda ») : la mission n'est plus éclatée entre
// plusieurs menus. Quatre onglets, dans les deux espaces (séparation par mode conservée) ; le litige
// reste en tête, au-dessus des onglets. Messages et Litiges restent accessibles par ailleurs.
type Tab = 'cours' | 'calendrier' | 'terminees' | 'factures'
const TABS: [Tab, string][] = [['cours', 'En cours'], ['calendrier', 'Calendrier'], ['terminees', 'Terminées'], ['factures', 'Factures']]

// Factures du mode courant (même règle que /documents) : en particulier, la facture reçue et SES frais
// de service ; en prestataire, la facture émise et SA commission. Jamais la commission de l'autre partie.
const MODE_KINDS = { particulier: ['prestation', 'commission_client'], pro: ['prestation', 'commission_pro'] }
const INV_TITLE: Record<string, string> = { recapitulatif: "Récapitulatif d'intervention", facture: 'Facture', commission: 'Frais de mise en relation' }
const INV_KIND: Record<string, string> = { prestation: 'Prestation', commission_client: 'Frais de service PING', commission_pro: 'Commission PING' }

// Dernier état connu de l'agenda, par compte (cache de l'onglet, src/lib/agendaLoader.ts), affiché pendant le rechargement.

const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }

export default function AgendaPage() {
  const router = useRouter()
  const [txs, setTxs] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [freeSlots, setFreeSlots] = useState<Slot[] | null>(null)
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [uid, setUid] = useState('')
  const [mode] = useMode(isPro)
  // Lecture aérée (24/11) : espace particulier seulement ; l'espace prestataire garde ses tailles (autre chantier).
  const A = mode === 'particulier'
  const z = (old: number, nw: number) => A ? nw : old
  const sectionTitle: React.CSSProperties = A
    ? { fontSize: 15, fontWeight: 700, color: '#4E6470', letterSpacing: '.01em', margin: '28px 0 12px' }
    : { fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }
  const [tab, setTab] = useState<Tab>('cours')
  // Accès direct à « Mes demandes » (audit ergonomie 18/11, amélioration 7) : demandes publiées
  // ouvertes et propositions de tarif reçues en attente (pastille).
  const [openRequests, setOpenRequests] = useState(0)
  const [offersWaiting, setOffersWaiting] = useState(0)
  // Missions terminées déjà notées par soi (client : reviews ; prestataire : client_reviews).
  const [rated, setRated] = useState<Set<string>>(() => new Set())

  // Onglet demandé par l'URL (?onglet=terminees, ex. depuis « Historique »), sinon le dernier ouvert.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('onglet') as Tab | null
      const saved = sessionStorage.getItem('ping_agenda_tab') as Tab | null
      const want = q || saved
      if (want && TABS.some(([k]) => k === want)) setTab(want)
    } catch { /* stockage indisponible : onglet par défaut */ }
  }, [])
  function pickTab(t: Tab) {
    setTab(t)
    try { sessionStorage.setItem('ping_agenda_tab', t) } catch { /* rien */ }
  }

  // Chargement < 1 s (audit ergonomie 19/11) : le dernier état connu (sessionStorage, même compte) s'affiche
  // tout de suite pendant le rechargement, et les requêtes partent groupées en deux vagues parallèles au lieu
  // de six allers-retours en chaîne. La session est lue localement (getSession), sans appel réseau.
  function apply(c: AgendaCache) {
    setTxs(c.txs); setNames(c.names); setDisputes(c.disputes); setInvoices(c.invoices)
    setFreeSlots(c.freeSlots); setIsPro(c.isPro); setOpenRequests(c.openRequests); setOffersWaiting(c.offersWaiting)
    setRated(new Set(c.rated))
  }
  useEffect(() => {
    const supabase = createClient()
    let alive = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      setUid(user.id)
      // Préchargé à la connexion ou par TabPrefetch (correction 3 du 19/11 ter) : affiché tout de suite.
      const c = readScreenCache<AgendaCache>(AGENDA_CACHE, user.id)
      if (c) { apply(c); setLoading(false) }
      try {
        // Réservations à accepter (052) : un délai dépassé passe en « expirée » avant l'affichage.
        await expireBookings(supabase, user.id)
        const next = await loadAgendaSnap(supabase, user.id)
        if (!alive) return
        apply(next)
      } catch { /* réseau : on garde le dernier état connu */ }
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [router])

  // Un seul rôle à la fois : missions achetées en mode particulier, vendues en mode pro.
  const mine = mode ? txs.filter(t => t[roleColumn(mode)] === uid) : []
  const shownDisputes = disputes.filter(d => mine.some(t => t.id === d.transaction_id))
  // L'agenda ne montre que de vrais rendez-vous : une simple conversation (tarif pas encore validé)
  // reste dans Messages, sinon chaque « Contacter » ajoutait une fausse date au calendrier.
  const disputedIds = new Set(disputes.map(d => d.transaction_id))
  const pendingTalks = mine.filter(t => UPCOMING.includes(t.status) && !t.price_confirmed).length
  // Réservation au délai de réponse dépassé (pas encore passée « expirée » par le cron) : comme une expirée,
  // elle quitte « En cours » et rejoint l'historique « Terminées » (demande Romain 20/11).
  const upcoming = mine.filter(t => UPCOMING.includes(t.status) && t.price_confirmed && !bookingLapsed(t))
    .sort((a, b) => (a.scheduled_at ? 0 : 1) - (b.scheduled_at ? 0 : 1) || txDate(a).getTime() - txDate(b).getTime())
  // Terminées (audit ergonomie 19/11, correction 7) : missions effectuées d'abord, la plus récemment terminée en
  // tête (son « Noter » est le premier visible) ; les réservations annulées ensuite, en bas.
  const doneTime = (t: any) => new Date(t.completed_at || t.scheduled_at || t.created_at).getTime()
  const done = [
    ...mine.filter(t => DONE.includes(t.status)).sort((a, b) => doneTime(b) - doneTime(a)),
    ...mine.filter(t => (t.status === 'cancelled' || bookingLapsed(t)) && t.price_confirmed).sort((a, b) => new Date(b.scheduled_at || b.created_at).getTime() - new Date(a.scheduled_at || a.created_at).getTime()),
  ]
  // « Aujourd'hui » : missions en cours ou du jour, avec un bouton vers l'écran « Mission du jour ».
  const todayList = upcoming.filter(t => isTodayMission(t))
  // En cours (correction 7) : une mission dont l'heure est passée (hors mission du jour) et jamais clôturée
  // n'est plus « à venir » : reléguée en bas, repliée, sans « Répondre ». « À venir » est trié par date de
  // rendez-vous, la plus proche en tête.
  const nowMs = Date.now()
  const isStale = (t: any) => !isTodayMission(t) && (!!t.arrived_at || (!!t.scheduled_at && new Date(t.scheduled_at).getTime() < nowMs))
  const later = upcoming.filter(t => !isTodayMission(t) && !isStale(t))
  const stale = upcoming.filter(t => isStale(t)).sort((a, b) => txDate(b).getTime() - txDate(a).getTime())
  const [showStale, setShowStale] = useState(false)
  const [allLater, setAllLater] = useState(false)
  const [allToday, setAllToday] = useState(false)
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set())
  const mineById = new Map(mine.map(t => [t.id, t]))
  const shownInvoices = mode ? invoices.filter(r => mineById.has(r.transaction_id) && MODE_KINDS[mode].includes(r.kind)) : []
  const invoicedIds = new Set(invoices.map(r => r.transaction_id))

  // Comme la démo (v_agenda) : un statut qui dit où en est la mission, pas juste « à venir ».
  function badge(t: any): { label: string; bg: string; fg: string } {
    if (bookingLapsed(t)) return { label: 'Expirée', bg: '#EEF2F1', fg: '#4E6470' }
    if (t.status === 'cancelled') return t.booking_status === 'refusee' ? { label: 'Refusée', bg: '#EEF2F1', fg: '#4E6470' }
      : t.booking_status === 'expiree' ? { label: 'Expirée', bg: '#EEF2F1', fg: '#4E6470' }
        : { label: 'Annulée', bg: '#EEF2F1', fg: '#4E6470' }
    if (bookingPending(t)) return t.seller_id === uid ? { label: 'À accepter', bg: '#FFF7ED', fg: '#8a6520' } : { label: 'En attente du prestataire', bg: '#FFF7ED', fg: '#8a6520' }
    if (DONE.includes(t.status)) return { label: 'Effectuée', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    if (t.status === 'arrived') return { label: 'En cours', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    if (t.en_route_at) return { label: 'En route', bg: 'rgba(47,208,110,.15)', fg: '#1a7a43' }
    if (t.price_confirmed) return { label: 'Confirmé', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    return { label: 'Tarif à valider', bg: '#FFF7ED', fg: '#8a6520' }
  }

  // Calendrier partagé (même composant que les disponibilités et la réservation) : les rendez-vous
  // confirmés du mode courant, et en mode pro ses créneaux encore libres.
  // Réservations en attente de réponse (prestataire : « À accepter », client : « En attente ») et missions en
  // cours (en route, sur place) s'affichent aussi, avec un style distinct ; les expirées, refusées et annulées non.
  const shortLabel = (t: any) => bookingPending(t) ? (t.seller_id === uid ? 'À accepter' : 'En attente')
    : t.status === 'arrived' ? 'Sur place' : t.en_route_at && t.status === 'pending' ? 'En route' : badge(t).label
  const [dayPick, setDayPick] = useState<Date | null>(null)
  const events: CalEvent[] = useMemo(() => {
    const appts: CalEvent[] = mine
      .filter(t => t.scheduled_at && (disputedIds.has(t.id) || (t.status !== 'cancelled' && !bookingLapsed(t) && !bookingEnded(t) && (t.price_confirmed || DONE.includes(t.status) || bookingPending(t)))))
      .map(t => {
        const start = new Date(t.scheduled_at)
        const tone: CalEvent['tone'] = bookingPending(t) ? 'pending' : (t.status === 'arrived' || (t.en_route_at && t.status === 'pending')) ? 'live' : undefined
        return {
          id: t.id, start, end: new Date(start.getTime() + durationMinutes(t) * 60000), kind: 'busy' as const, tone,
          title: `${names[t.id] || 'Rendez-vous'}${t.requests?.category ? ' · ' + (TRAD[t.requests.category] || t.requests.category) : ''}`,
          subtitle: shortLabel(t),
          onClick: () => router.push(DONE.includes(t.status) ? `/mission/${t.id}/facture` : `/mission/${t.id}/chat`),
        }
      })
    const free: CalEvent[] = mode === 'pro' && freeSlots ? freeSlots.map(x => ({
      id: x.id, start: new Date(x.starts_at), end: slotEnd(x), kind: 'free' as const, title: 'Disponible',
      onClick: () => router.push('/pro/disponibilites'),
    })) : []
    return [...appts, ...free]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, names, freeSlots, mode, disputedIds, uid])
  // Historique (24/11) : une ligne par mission, 3 actions d'un appui (Conversation, Facture si elle existe, Mission).
  const invoiceTx = new Set(shownInvoices.map(r => r.transaction_id))
  const lineOf = (t: any, when: 'time' | 'date'): MissionLine => {
    const ended = t.status === 'cancelled' || bookingLapsed(t)
    const pend = bookingPending(t)
    const [state, tone]: [string, MissionLine['tone']] = disputedIds.has(t.id) ? ['Litige', 'alert']
      : ended ? [badge(t).label, 'muted']
      : pend ? [t.seller_id === uid ? 'À accepter' : 'En attente', 'warn']
      : DONE.includes(t.status) ? ['Terminée', 'muted']
      : t.status === 'arrived' ? ['En cours', 'ok']
      : ['Confirmée', 'ok']
    const iso = DONE.includes(t.status) && when === 'date' ? (t.completed_at || t.scheduled_at || t.created_at) : (t.scheduled_at || t.created_at)
    return {
      id: t.id, name: names[t.id] || (mode === 'pro' ? 'Client' : 'Prestataire'),
      service: t.requests?.category ? (TRAD[t.requests.category] || t.requests.category) : 'Mission',
      time: when === 'time' ? hhmm(iso) : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      state, tone, hasInvoice: invoiceTx.has(t.id),
    }
  }
  const dayLines: MissionLine[] = dayPick
    ? mine.filter(t => t.scheduled_at && new Date(t.scheduled_at).toDateString() === dayPick.toDateString()
        && (disputedIds.has(t.id) || t.price_confirmed || DONE.includes(t.status) || bookingPending(t)))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .map(t => lineOf(t, 'time'))
    : []
  // Terminées : recherche par nom de l'autre partie, rangement par mois, 10 lignes puis « Voir plus ».
  const [doneQuery, setDoneQuery] = useState('')
  const [doneShown, setDoneShown] = useState(10)

  const open = (t: any) => router.push(DONE.includes(t.status) ? `/mission/${t.id}/facture` : `/mission/${t.id}/chat`)

  // lean : carte « Aujourd'hui » allégée (heure seule, sans report/annulation/frise : tout est dans « Mission du jour » et la
  // conversation) ; 'first' garde le bouton « Mission du jour », 'more' ouvre directement l'écran du jour.
  // fold : report, annulation et frise derrière un seul bouton (cartes « À venir »).
  const card = (t: any, withSuivi = false, withActions = false, muted = false, lean: false | 'first' | 'more' = false, fold = false) => {
    const actionsOk = !muted && !lean && !!t.price_confirmed && t.status === 'pending' && !t.arrived_at && !bookingPending(t) && !bookingEnded(t) && t.buyer_id !== t.seller_id
    const foldable = fold && (actionsOk || (withSuivi && !bookingPending(t)))
    const shown = !foldable || openCards.has(t.id)
    return (
    <div key={t.id} role="link" tabIndex={0} onClick={() => lean === 'more' ? router.push(`/mission/${t.id}/jour`) : open(t)} aria-label={`${names[t.id] || 'Mission'}, ${badge(t).label}`}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) { lean === 'more' ? router.push(`/mission/${t.id}/jour`) : open(t) } }}
      style={A ? { background: 'transparent', borderTop: '1px solid #E3EAE8', padding: '20px 0', marginBottom: 0, cursor: 'pointer', opacity: muted ? .75 : 1 } : { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer', opacity: muted ? .75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: z(13.5, 17), color: '#123644' }}>
            {names[t.id] || 'Conversation'}{t.requests?.category ? ` · ${TRAD[t.requests.category] || t.requests.category}` : ''}
          </div>
          {t.requests?.description && <div style={{ fontSize: z(11.5, 15), color: '#4E6470', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.requests.description}</div>}
          <div style={{ fontSize: z(11, 15), color: t.scheduled_at && UPCOMING.includes(t.status) ? '#0B8374' : '#4E6470', fontWeight: t.scheduled_at && UPCOMING.includes(t.status) ? 700 : 400, marginTop: 3 }}>
            {t.scheduled_at && UPCOMING.includes(t.status)
              ? (lean ? hhmm(t.scheduled_at) : `${dayLabel(t.scheduled_at)} · ${hhmm(t.scheduled_at)}`)
              : txDate(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {t.subtotal_cents ? ` · ${eur(t.subtotal_cents)}` : ''}
          </div>
          {/* Présence annoncée par le client (migration 048), sur le billet de mission. */}
          {rowHasPresence(t) && t.price_confirmed && t.status === 'pending' && !t.arrived_at && (
            <div style={{ marginTop: 6 }}><PresenceTag presence={t.client_presence} asSeller={t.seller_id === uid} /></div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span className="a-mini" style={{ fontSize: z(10.5, 13), fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: badge(t).bg, color: badge(t).fg }}>
            {badge(t).label}
          </span>
          {isTodayMission(t) && lean !== 'more' && (
            <button onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/jour`) }} style={{
              border: 'none', borderRadius: 999, padding: '0 14px', minHeight: 44, background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: z(12, 15), cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Mission du jour</button>
          )}
          {!muted && !isTodayMission(t) && !bookingPending(t) && rowHasPresence(t) && t.buyer_id === uid && t.price_confirmed && t.status === 'pending' && !t.client_presence && t.scheduled_at && (
            <button onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/commande`) }} style={{
              border: '1.5px solid #0B8374', borderRadius: 999, padding: '0 12px', minHeight: 44, background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: z(12, 15), cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Répondre</button>
          )}
        </div>
      </div>
      {/* Réservation directe à accepter (052) : Accepter / Refuser sur la carte même, ou « Choisir un autre prestataire ». */}
      {((bookingPending(t) && !bookingLapsed(t)) || bookingEnded(t)) && (
        <div style={{ marginTop: 10 }}>
          <BookingCard tx={t} userId={uid} counterpart={names[t.id]} compact
            onChange={patch => setTxs(list => list.map(x => x.id === t.id ? { ...x, ...patch } : x))} />
        </div>
      )}
      {/* Annuler ou reporter un rendez-vous à venir (056) : deux boutons, les règles s'affichent à l'ouverture. */}
      {actionsOk && shown && (
        <MissionActions tx={t} userId={uid} compact style={{ marginTop: 10 }}
          onChange={patch => setTxs(list => list.map(x => x.id === t.id ? { ...x, ...patch } : x))} />
      )}
      {/* Frise de suivi (lot 30) : Confirmée → En route → Sur place → Terminée → Facturée. */}
      {withSuivi && shown && !lean && !bookingPending(t) && <div style={{ marginTop: 10 }}><MissionSuivi tx={t} invoiced={invoicedIds.has(t.id)} compact airy={A} /></div>}
      {foldable && (
        <button type="button" aria-expanded={shown} onClick={e => { e.stopPropagation(); setOpenCards(set => { const n = new Set(set); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n }) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 44, marginTop: 8, border: 'none', background: 'none', color: '#0B8374', fontWeight: 700, fontSize: z(13, 15), cursor: 'pointer', fontFamily: 'inherit' }}>
          {shown ? 'Masquer' : 'Reporter, annuler, suivi'}
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ transform: shown ? 'rotate(-90deg)' : 'rotate(90deg)' }}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
      {/* Terminées (audit ergonomie 18/11, amélioration 8) : avis et litige en un appui. */}
      {withActions && DONE.includes(t.status) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {!rated.has(t.id) && (
            <button type="button" onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/chat?avis`) }}
              style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: z(13, 15), cursor: 'pointer' }}>
              {mode === 'pro' ? 'Noter le client' : 'Noter'}
            </button>
          )}
{incidentOpen(t) && (
          <button type="button" onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/chat?signaler`) }}
            style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: z(13, 15), cursor: 'pointer' }}>
            Signaler un problème
          </button>
          )}
        </div>
      )}
    </div>
  )
  }

  // Mes demandes sans passer par Profil (espace client seulement) : en tête s'il y a une proposition à examiner, sinon après les rendez-vous.
  const demandesRow = mode === 'particulier' ? (
            <button type="button" onClick={() => router.push('/client/demandes')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, textAlign: 'left', background: offersWaiting ? '#FFF7ED' : (A ? 'transparent' : '#fff'), border: offersWaiting ? '1.5px solid #F2A93B' : (A ? 'none' : '1px solid #E7EDEB'), borderTop: A && !offersWaiting ? '1px solid #E3EAE8' : undefined, borderRadius: 14, padding: A ? '16px 14px 16px 0' : '10px 14px', marginBottom: 16, marginTop: A ? 12 : 0, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: z(14, 17), color: '#123644' }}>Mes demandes en ligne</span>
                <span style={{ display: 'block', fontSize: z(12, 15), color: offersWaiting ? '#8a6520' : '#4E6470', fontWeight: offersWaiting ? 700 : 400, marginTop: 2 }}>
                  {offersWaiting
                    ? `${offersWaiting} proposition${offersWaiting > 1 ? 's' : ''} de tarif à examiner`
                    : openRequests ? `${openRequests} demande${openRequests > 1 ? 's' : ''} publiée${openRequests > 1 ? 's' : ''}, en attente de propositions` : 'Vos annonces et les propositions reçues'}
                </span>
              </span>
              {offersWaiting > 0 && (
                <span aria-hidden="true" style={{ minWidth: 22, height: 22, lineHeight: '22px', padding: '0 6px', borderRadius: 999, background: '#E8743B', color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{offersWaiting > 9 ? '9+' : offersWaiting}</span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
  ) : null

  const empty = (text: string) => <p style={{ fontSize: z(12.5, 16), lineHeight: 1.55, color: '#4E6470', marginBottom: 20 }}>{text}</p>

  return (
    // Lecture aérée du 24/11 : particulier (A) et prestataire (mode pro) ont chacun leurs classes.
    <div className={A ? 'aere a-lift' : mode === 'pro' ? 'aere aere-pro a-lift' : undefined} style={{ minHeight: '100vh', background: A ? '#fff' : '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: A ? 70 : 100 }}>
      {/* Racine d'onglet : titre sur une ligne, décompte des missions de l'espace à droite (plus de bandeau séparé). */}
      <div style={{ padding: '0 16px', minHeight: z(52, 56), background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        {A && (
          <button type="button" onClick={() => router.push('/map')} aria-label="Retour à la carte"
            style={{ width: 44, height: 44, marginLeft: -8, border: 'none', borderRadius: 14, background: 'rgba(255,255,255,.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        )}
        <h1 style={{ flex: 1, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: z(17, 20), color: '#fff', margin: 0 }}>Agenda</h1>
      </div>

      <div style={{ padding: A ? '20px 20px 16px' : mode === 'pro' ? '24px 16px 16px' : '12px 16px 16px', maxWidth: 980, margin: '0 auto' }}>
        {/* Une seule ligne d'état (24/11) : plus de double décompte, plus de « (via le menu) ». */}
        {!loading && mode && (
          <p data-agenda-state style={{ margin: '0 0 24px', fontSize: 17, lineHeight: 1.5, fontWeight: 700, color: '#123644' }}>
            {todayList.length ? `Aujourd’hui : ${todayList.length} mission${todayList.length > 1 ? 's' : ''}` : 'Aujourd’hui : aucune mission'}
          </p>
        )}

        {/* Un seul bandeau litige, quel que soit l'onglet (maquette) : un litige ouvre son dossier, plusieurs ouvrent la liste. */}
        {shownDisputes.length > 0 && (() => {
          const n = shownDisputes.length
          const first = shownDisputes[0]
          const href = n > 1 ? '/litiges' : `/litiges/${first.id}`
          return (
            <div role="link" tabIndex={0} onClick={() => router.push(href)}
              onKeyDown={e => { if (e.key === 'Enter') router.push(href) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, background: '#FFF7ED', border: 'none', borderRadius: 16, padding: A ? '14px 16px' : '8px 14px', marginBottom: A ? 28 : 16, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F2A93B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: z(13.5, 17), color: '#123644' }}>
                  {n} litige{n > 1 ? 's' : ''} en cours
                </div>
                {n === 1 ? <div style={{ fontSize: z(11.5, 15), color: '#8a6520', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {'Ouvert le ' + new Date(first.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + (names[first.transaction_id] ? ` · ${names[first.transaction_id]}` : '')}
                </div> : A && <div style={{ fontSize: 15, color: '#8a6520', marginTop: 2 }}>Ouvrir la liste des litiges</div>}
                {/* Maquette : « Échéance dépassée : lun. 16 nov. » (échéance du dossier, lue en base). */}
                {A && first.deadline_at && <div style={{ fontSize: 15, color: '#8a6520', marginTop: 2 }}>
                  {(new Date(first.deadline_at).getTime() < Date.now() ? 'Échéance dépassée : ' : 'Échéance : ') + new Date(first.deadline_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a6520" strokeWidth={2.2} style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
            </div>
          )
        })()}

        <div className="ping-tabs ag-tabs" role="tablist" aria-label="Agenda">
          {TABS.map(([k, label]) => (
            <button key={k} style={{ fontSize: 15, minHeight: 48 }} role="tab" id={`ag-tab-${k}`} aria-selected={tab === k} aria-controls={`ag-panel-${k}`} onClick={() => pickTab(k)}>
              {label}
              {k === 'cours' && mode === 'particulier' && offersWaiting > 0 && (
                <span aria-label={`${offersWaiting} proposition${offersWaiting > 1 ? 's' : ''} reçue${offersWaiting > 1 ? 's' : ''}`}
                  style={{ display: 'inline-block', minWidth: 18, height: 18, lineHeight: '18px', padding: '0 5px', marginLeft: 6, borderRadius: 999, background: '#E8743B', color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center', verticalAlign: 1 }}>
                  {offersWaiting > 9 ? '9+' : offersWaiting}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`ag-panel-${tab}`} aria-labelledby={`ag-tab-${tab}`}>
          {tab === 'calendrier' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <Calendar aere={mode === 'pro'} events={events} onDayClick={d => setDayPick(d)}
                  emptyHint={mode === 'pro' ? 'Aucun rendez-vous ni créneau pour l’instant. Publiez vos disponibilités pour être réservé en un clic.' : 'Aucun rendez-vous pour l’instant.'} />
              </div>
              {/* Légende ; le détail du jour touché s'ouvre dans la feuille « jour » (DaySheet), Mois et Semaine. */}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, lineHeight: 1.5, color: '#4E6470', margin: '-8px 4px 20px' }}>
                <span><span aria-hidden style={{ display: 'inline-block', width: 22, height: 12, borderRadius: 6, background: '#123644', verticalAlign: -1, marginRight: 8 }} />Confirmé</span>
                <span><span aria-hidden style={{ display: 'inline-block', width: 22, height: 12, borderRadius: 6, border: '1.5px dashed #F2A93B', background: '#FFF7ED', verticalAlign: -1, marginRight: 8 }} />{mode === 'pro' ? 'À accepter' : 'En attente de réponse'}</span>
              </div>
              <DaySheet day={dayPick} lines={dayLines} onClose={() => setDayPick(null)} />
              {isPro && mode === 'pro' && freeSlots !== null && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0 6px' }}>
                    <div style={{ ...sectionTitle, flex: 1, marginBottom: 0 }}>Mes créneaux libres</div>
                    <button onClick={() => router.push('/pro/disponibilites')} style={{ border: 'none', background: 'none', minHeight: 44, padding: '0 4px', fontSize: 12.5, fontWeight: 700, color: '#0B8374', cursor: 'pointer' }}>Gérer</button>
                  </div>
                  {freeSlots.filter(x => new Date(x.starts_at) > new Date()).length ? freeSlots.filter(x => new Date(x.starts_at) > new Date()).slice(0, 3).map(x => (
                    <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderBottom: '1px solid #E3EAE8', borderRadius: 0, padding: '14px 0', marginBottom: 0 }}>
                      <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 14, color: '#4E6470', width: 46 }}>{hhmm(x.starts_at)}</b>
                      <span style={{ fontSize: 12, color: '#4E6470' }}>{dayLabel(x.starts_at)} · disponible à la réservation</span>
                    </div>
                  )) : (
                    <button onClick={() => router.push('/pro/disponibilites')} style={{ border: 'none', background: 'none', padding: 0, minHeight: 44, textAlign: 'left', fontSize: 12.5, color: '#0B8374', fontWeight: 600, cursor: 'pointer' }}>Publiez vos disponibilités pour être réservé en un clic.</button>
                  )}
                </>
              )}
            </>
          )}

          {tab !== 'calendrier' && loading && <div style={{ textAlign: 'center', padding: 30, color: '#4E6470', fontWeight: 600, fontSize: z(13, 15) }}>Chargement…</div>}

          {tab === 'cours' && !loading && (
            <>
              {offersWaiting > 0 && demandesRow}
              {todayList.length > 0 && (
                <>
                  <div style={{ ...sectionTitle, color: '#0B8374' }}>Aujourd&apos;hui</div>
                  {/* Cartes allégées : report, annulation et frise de suivi sont dans « Mission du jour » et dans la conversation, à un appui. */}
                  {(allToday ? todayList : todayList.slice(0, 2)).map((t, i) => card(t, false, false, false, i === 0 ? 'first' : 'more'))}
                  {!allToday && todayList.length > 2 && (
                    <button type="button" onClick={() => setAllToday(true)}
                      style={{ width: '100%', minHeight: 52, marginBottom: 10, borderRadius: 14, border: A ? 'none' : '1.5px solid #12B39C', background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: z(14, 16), cursor: 'pointer' }}>
                      Voir les {todayList.length - 2} autres du jour
                    </button>
                  )}
                  <div style={{ height: 10 }} />
                </>
              )}
              <div style={sectionTitle}>À venir</div>
              {later.length ? (allLater ? later : later.slice(0, 2)).map(t => card(t, true, false, false, false, true)) : empty(todayList.length ? 'Rien d’autre de prévu.' : 'Rien de prévu pour l’instant.')}
              {!allLater && later.length > 2 && (
                <button type="button" onClick={() => setAllLater(true)}
                  style={{ width: '100%', minHeight: 52, marginBottom: 14, borderRadius: 14, border: A ? 'none' : '1.5px solid #12B39C', background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: z(14, 16), cursor: 'pointer' }}>
                  Voir les {later.length - 2} autres rendez-vous
                </button>
              )}
              {stale.length > 0 && (
                <>
                  <button type="button" onClick={() => setShowStale(v => !v)} aria-expanded={showStale}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, textAlign: 'left', border: A ? 'none' : '1px dashed #DCE5E3', background: 'transparent', borderRadius: 14, padding: '10px 14px', marginBottom: 10, fontSize: z(12.5, 15), fontWeight: 600, color: '#4E6470', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ flex: 1 }}>{stale.length} mission{stale.length > 1 ? 's' : ''} passée{stale.length > 1 ? 's' : ''} sans clôture</span>
                    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} style={{ transform: showStale ? 'rotate(90deg)' : 'none' }}><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  {showStale && stale.map(t => card(t, false, false, true))}
                </>
              )}
              {pendingTalks > 0 && (
                <button onClick={() => router.push('/messages')} style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', border: A ? 'none' : '1px dashed #DCE5E3', background: 'transparent', borderRadius: 14, padding: '11px 14px', marginBottom: 20, fontSize: z(12.5, 15), lineHeight: 1.5, color: '#4E6470', cursor: 'pointer' }}>
                  {pendingTalks} conversation{pendingTalks > 1 ? 's' : ''} en attente d&apos;un tarif validé — voir les messages
                </button>
              )}
              {offersWaiting === 0 && demandesRow}
            </>
          )}

          {tab === 'terminees' && !loading && (
            done.length ? (() => {
              const dd = (t: any) => new Date(DONE.includes(t.status) ? (t.completed_at || t.scheduled_at || t.created_at) : (t.scheduled_at || t.created_at))
              const q = doneQuery.trim().toLowerCase()
              const found = done.filter(t => !q || (names[t.id] || '').toLowerCase().includes(q)).sort((a, b) => dd(b).getTime() - dd(a).getTime())
              const shownDone = found.slice(0, doneShown)
              const months: { label: string; items: any[] }[] = []
              shownDone.forEach(t => {
                const l = dd(t).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                const label = l.charAt(0).toUpperCase() + l.slice(1)
                const last = months[months.length - 1]
                if (last && last.label === label) last.items.push(t); else months.push({ label, items: [t] })
              })
              return (
                <>
                  <input type="search" value={doneQuery} onChange={e => { setDoneQuery(e.target.value); setDoneShown(10) }} placeholder="Rechercher par nom" aria-label="Rechercher une mission terminée par nom"
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 16px', borderRadius: 14, border: '1.5px solid #CFDAD7', background: '#fff', fontSize: 16, fontFamily: 'Inter, sans-serif', color: '#123644', outline: 'none', marginBottom: 20 }} />
                  {found.length === 0 && empty(`Aucune mission terminée pour « ${doneQuery.trim()} ».`)}
                  {months.map(g => (
                    <div key={g.label} data-done-month={g.label}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#4E6470', margin: '16px 0 0' }}>{g.label}</div>
                      {g.items.map((t, i) => (
                        <MissionLineRow key={t.id} first={i === 0} m={{ ...lineOf(t, 'date'), extra: !(((bookingPending(t) && !bookingLapsed(t)) || bookingEnded(t)) || (DONE.includes(t.status) && (!rated.has(t.id) || incidentOpen(t)))) ? undefined : (
                          <>
                            {(((bookingPending(t) && !bookingLapsed(t)) || bookingEnded(t))) && (
                              <div style={{ marginBottom: 10 }}>
                                <BookingCard tx={t} userId={uid} counterpart={names[t.id]} compact
                                  onChange={patch => setTxs(list => list.map(x => x.id === t.id ? { ...x, ...patch } : x))} />
                              </div>
                            )}
                            {DONE.includes(t.status) && (!rated.has(t.id) || incidentOpen(t)) && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                {!rated.has(t.id) && (
                                  <button type="button" onClick={() => router.push(`/mission/${t.id}/chat?avis`)}
                                    style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                                    {mode === 'pro' ? 'Noter le client' : 'Noter'}
                                  </button>
                                )}
                                {incidentOpen(t) && (
                                  <button type="button" onClick={() => router.push(`/mission/${t.id}/chat?signaler`)}
                                    style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                                    Signaler un problème
                                  </button>
                                )}
                              </div>
                            )}
                          </>) }} />
                      ))}
                    </div>
                  ))}
                  {found.length > doneShown && (
                    <button type="button" onClick={() => setDoneShown(n => n + 10)}
                      style={{ width: '100%', minHeight: 52, marginTop: 16, borderRadius: 14, border: '1.5px solid #12B39C', background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                      Voir plus ({found.length - doneShown} autre{found.length - doneShown > 1 ? 's' : ''})
                    </button>
                  )}
                </>
              )
            })() : empty('Aucune prestation terminée pour l’instant.')
          )}

          {tab === 'factures' && !loading && (
            <>
              {shownInvoices.length ? (
                <div style={{ background: '#fff', border: A ? 'none' : '1px solid #E7EDEB', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
                  {shownInvoices.map((r, i) => (
                    <button key={r.id} onClick={() => router.push(`/mission/${r.transaction_id}/facture`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: z(56, 68), textAlign: 'left', border: 'none', borderTop: i ? '1px solid #EEF2F1' : 'none', background: '#fff', padding: A ? '14px 0' : '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(18,179,156,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: z(13.5, 16), color: '#123644' }}>
                          {INV_TITLE[r.template] || 'Document'} · {eur(r.net_cents)}
                        </b>
                        <small style={{ display: 'block', fontSize: z(11.5, 15), color: '#4E6470', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[r.number, new Date(r.issued_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }), INV_KIND[r.kind], r.kind === 'prestation' ? names[r.transaction_id] : null, mode === 'pro' && r.kind === 'prestation' && r.issuer_id === uid ? 'émise à votre en-tête' : null].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2} style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>
              ) : empty('Aucune facture pour l’instant. Elles apparaissent ici à la fin de chaque mission.')}
              <button onClick={() => router.push('/documents')} style={{ display: 'block', width: '100%', minHeight: 44, border: '1px solid #DCE5E3', background: '#fff', borderRadius: 999, padding: '0 16px', fontWeight: 700, fontSize: z(13, 16), color: '#123644', cursor: 'pointer' }}>
                Relevé annuel, export et partage
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
