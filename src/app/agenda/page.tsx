"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { fetchSlotsBetween, slotEnd, dayLabel, hhmm, type Slot } from '@/lib/slots'
import Calendar, { type CalEvent } from '@/components/calendar/Calendar'
import { addDays, startOfDay } from '@/components/calendar/dates'
import { useMode, roleColumn } from '@/lib/mode'
import ModeHint from '@/components/ModeHint'
import { UPCOMING, DONE, txDate, durationMinutes } from '@/lib/agenda'
import { isTodayMission } from '@/lib/todayMission'
import { MissionSuivi } from '@/components/presence/MissionTimeline'
import PresenceTag from '@/components/presence/PresenceTag'
import { rowHasPresence } from '@/lib/presence'

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
const INV_KIND: Record<string, string> = { prestation: 'Prestation', commission_client: 'Frais de service', commission_pro: 'Commission PING' }

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

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUid(user.id)
      const { data } = await supabase.from('transactions')
        .select('*, requests(description, category)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      setTxs(data ?? [])

      const { data: pp } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setIsPro(!!pp)
      if (pp) {
        const from = addDays(startOfDay(new Date()), -7)
        const list = await fetchSlotsBetween(supabase, user.id, from, addDays(from, 130))
        setFreeSlots(list ? list.filter(x => !x.transaction_id) : null)
      }

      // Le nom de l'interlocuteur remplace l'adresse comme titre (comme la
      // demo, "Sofia M. · Menage") : l'adresse ne s'affiche jamais ici, meme
      // une fois confirmee — inutile de l'exposer dans une liste d'apercu.
      if (data?.length) {
        const ids = data.map((t: any) => t.id)
        const [{ data: rows }, { data: ds }, { data: inv }] = await Promise.all([
          supabase.rpc('transaction_counterparts', { p_transaction_ids: ids }),
          supabase.from('disputes')
            .select('id, transaction_id, reason, status, created_at')
            .in('transaction_id', ids)
            .eq('status', 'open')
            .order('created_at', { ascending: false }),
          supabase.from('invoices')
            .select('id, transaction_id, kind, template, number, issued_at, net_cents, issuer_id, client_id')
            .in('transaction_id', ids)
            .order('issued_at', { ascending: false }),
        ])
        const map: Record<string, string> = {}
        ;(rows ?? []).forEach((r: any) => { if (r.full_name) map[r.transaction_id] = r.full_name })
        setNames(map)
        setDisputes(ds ?? [])
        setInvoices(inv ?? [])

        // Propositions reçues en attente, sur les conversations où l'on est client, au tarif pas encore validé.
        const buyerOpen = data.filter((t: any) => t.buyer_id === user.id && t.seller_id !== user.id && t.status === 'pending' && !t.price_confirmed)
        const sellerOf = new Map(buyerOpen.map((t: any) => [t.id, t.seller_id]))
        const doneIds = data.filter((t: any) => DONE.includes(t.status)).map((t: any) => t.id)
        const [{ data: offers }, { data: revs }, { data: crevs }] = await Promise.all([
          buyerOpen.length
            ? supabase.from('messages').select('transaction_id, sender_id').eq('kind', 'offer').eq('offer_status', 'pending').in('transaction_id', buyerOpen.map((t: any) => t.id))
            : Promise.resolve({ data: [] as any[] }),
          doneIds.length ? supabase.from('reviews').select('transaction_id').eq('rater_id', user.id).in('transaction_id', doneIds) : Promise.resolve({ data: [] as any[] }),
          doneIds.length ? supabase.from('client_reviews').select('transaction_id').eq('rater_id', user.id).in('transaction_id', doneIds) : Promise.resolve({ data: [] as any[] }),
        ])
        setOffersWaiting(new Set((offers ?? []).filter((o: any) => o.sender_id && o.sender_id === sellerOf.get(o.transaction_id)).map((o: any) => o.transaction_id)).size)
        setRated(new Set([...(revs ?? []), ...(crevs ?? [])].map((r: any) => r.transaction_id)))
      }
      const { count } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', user.id).eq('status', 'open')
      setOpenRequests(count || 0)
      setLoading(false)
    }
    load()
  }, [router])

  // Un seul rôle à la fois : missions achetées en mode particulier, vendues en mode pro.
  const mine = mode ? txs.filter(t => t[roleColumn(mode)] === uid) : []
  const otherCount = mode ? txs.filter(t => t[roleColumn(mode === 'pro' ? 'particulier' : 'pro')] === uid && t.buyer_id !== t.seller_id).length : 0
  const shownDisputes = disputes.filter(d => mine.some(t => t.id === d.transaction_id))
  // L'agenda ne montre que de vrais rendez-vous : une simple conversation (tarif pas encore validé)
  // reste dans Messages, sinon chaque « Contacter » ajoutait une fausse date au calendrier.
  const disputedIds = new Set(disputes.map(d => d.transaction_id))
  const pendingTalks = mine.filter(t => UPCOMING.includes(t.status) && !t.price_confirmed).length
  const upcoming = mine.filter(t => UPCOMING.includes(t.status) && t.price_confirmed)
    .sort((a, b) => (a.scheduled_at ? 0 : 1) - (b.scheduled_at ? 0 : 1) || txDate(a).getTime() - txDate(b).getTime())
  // Terminées : effectuées, et réservations annulées (comme la maquette), de la plus récente à la plus ancienne.
  const done = mine.filter(t => DONE.includes(t.status) || (t.status === 'cancelled' && t.price_confirmed))
    .sort((a, b) => txDate(b).getTime() - txDate(a).getTime())
  // « Aujourd'hui » : missions en cours ou du jour, avec un bouton vers l'écran « Mission du jour ».
  const todayList = upcoming.filter(t => isTodayMission(t))
  const later = upcoming.filter(t => !isTodayMission(t))
  const mineById = new Map(mine.map(t => [t.id, t]))
  const shownInvoices = mode ? invoices.filter(r => mineById.has(r.transaction_id) && MODE_KINDS[mode].includes(r.kind)) : []
  const invoicedIds = new Set(invoices.map(r => r.transaction_id))

  // Comme la démo (v_agenda) : un statut qui dit où en est la mission, pas juste « à venir ».
  function badge(t: any): { label: string; bg: string; fg: string } {
    if (t.status === 'cancelled') return { label: 'Annulée', bg: '#EEF2F1', fg: '#4E6470' }
    if (DONE.includes(t.status)) return { label: 'Effectuée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (t.status === 'arrived') return { label: 'En cours', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (t.en_route_at) return { label: 'En route', bg: 'rgba(47,208,110,.15)', fg: '#1a7a43' }
    if (t.price_confirmed) return { label: 'Confirmé', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    return { label: 'Tarif à valider', bg: '#FFF7ED', fg: '#8a6520' }
  }

  // Calendrier partagé (même composant que les disponibilités et la réservation) : les rendez-vous
  // confirmés du mode courant, et en mode pro ses créneaux encore libres.
  const events: CalEvent[] = useMemo(() => {
    const appts: CalEvent[] = mine
      .filter(t => t.scheduled_at && ((t.price_confirmed || DONE.includes(t.status)) && t.status !== 'cancelled' || disputedIds.has(t.id)))
      .map(t => {
        const start = new Date(t.scheduled_at)
        return {
          id: t.id, start, end: new Date(start.getTime() + durationMinutes(t) * 60000), kind: 'busy' as const,
          title: `${names[t.id] || 'Rendez-vous'}${t.requests?.category ? ' · ' + (TRAD[t.requests.category] || t.requests.category) : ''}`,
          subtitle: badge(t).label,
          onClick: () => router.push(DONE.includes(t.status) ? `/mission/${t.id}/facture` : `/mission/${t.id}/chat`),
        }
      })
    const free: CalEvent[] = mode === 'pro' && freeSlots ? freeSlots.map(x => ({
      id: x.id, start: new Date(x.starts_at), end: slotEnd(x), kind: 'free' as const, title: 'Disponible',
      onClick: () => router.push('/pro/disponibilites'),
    })) : []
    return [...appts, ...free]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, names, freeSlots, mode, disputedIds])

  const open = (t: any) => router.push(DONE.includes(t.status) ? `/mission/${t.id}/facture` : `/mission/${t.id}/chat`)

  const card = (t: any, withSuivi = false, withActions = false) => (
    <div key={t.id} role="link" tabIndex={0} onClick={() => open(t)} aria-label={`${names[t.id] || 'Mission'}, ${badge(t).label}`}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(t) }}
      style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
            {names[t.id] || 'Conversation'}{t.requests?.category ? ` · ${TRAD[t.requests.category] || t.requests.category}` : ''}
          </div>
          <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.requests?.description || '—'}</div>
          <div style={{ fontSize: 11, color: t.scheduled_at && UPCOMING.includes(t.status) ? '#0C8F7E' : '#4E6470', fontWeight: t.scheduled_at && UPCOMING.includes(t.status) ? 700 : 400, marginTop: 3 }}>
            {t.scheduled_at && UPCOMING.includes(t.status)
              ? `${dayLabel(t.scheduled_at)} · ${hhmm(t.scheduled_at)}`
              : txDate(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {t.subtotal_cents ? ` · ${eur(t.subtotal_cents)}` : ''}
          </div>
          {/* Présence annoncée par le client (migration 048), sur le billet de mission. */}
          {rowHasPresence(t) && t.price_confirmed && t.status === 'pending' && !t.arrived_at && (
            <div style={{ marginTop: 6 }}><PresenceTag presence={t.client_presence} asSeller={t.seller_id === uid} /></div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: badge(t).bg, color: badge(t).fg }}>
            {badge(t).label}
          </span>
          {isTodayMission(t) && (
            <button onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/jour`) }} style={{
              border: 'none', borderRadius: 999, padding: '0 14px', minHeight: 44, background: '#0C8F7E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Mission du jour</button>
          )}
          {!isTodayMission(t) && rowHasPresence(t) && t.buyer_id === uid && t.price_confirmed && t.status === 'pending' && !t.client_presence && t.scheduled_at && (
            <button onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/commande`) }} style={{
              border: '1.5px solid #0C8F7E', borderRadius: 999, padding: '0 12px', minHeight: 44, background: '#fff', color: '#0C8F7E', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Répondre</button>
          )}
        </div>
      </div>
      {/* Frise de suivi (lot 30) : Confirmée → En route → Sur place → Terminée → Facturée. */}
      {withSuivi && <div style={{ marginTop: 10 }}><MissionSuivi tx={t} invoiced={invoicedIds.has(t.id)} compact /></div>}
      {/* Terminées (audit ergonomie 18/11, amélioration 8) : avis et litige en un appui. */}
      {withActions && DONE.includes(t.status) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {!rated.has(t.id) && (
            <button type="button" onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/chat?avis`) }}
              style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {mode === 'pro' ? 'Noter le client' : 'Noter'}
            </button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); router.push(`/mission/${t.id}/chat?signaler`) }}
            style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Signaler un problème
          </button>
        </div>
      )}
    </div>
  )

  const empty = (text: string) => <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 20 }}>{text}</p>

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff', margin: 0 }}>Agenda</h1>
      </div>

      <div style={{ padding: 16, maxWidth: 980, margin: '0 auto' }}>
        {isPro && mode && <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'missions' : 'mission'} />}

        {/* Litige en tête, quel que soit l'onglet. */}
        {shownDisputes.map(d => (
          <div key={d.id} role="link" tabIndex={0} onClick={() => router.push(`/mission/${d.transaction_id}/chat`)}
            onKeyDown={e => { if (e.key === 'Enter') router.push(`/mission/${d.transaction_id}/chat`) }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF7ED', border: '1.5px solid #F2A93B', borderRadius: 16, padding: 14, marginBottom: 14, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: '#F2A93B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
                Litige en cours{names[d.transaction_id] ? ` · ${names[d.transaction_id]}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: '#8a6520', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {'Ouvert le ' + new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{d.reason ? ` · ${d.reason}` : ''}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a6520" strokeWidth={2.2} style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
          </div>
        ))}

        <div className="ping-tabs" role="tablist" aria-label="Agenda">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" id={`ag-tab-${k}`} aria-selected={tab === k} aria-controls={`ag-panel-${k}`} onClick={() => pickTab(k)}>
              {label}
              {k === 'cours' && todayList.length > 0 ? ` (${todayList.length})` : ''}
              {k === 'cours' && mode === 'particulier' && offersWaiting > 0 && (
                <span aria-label={`${offersWaiting} proposition${offersWaiting > 1 ? 's' : ''} reçue${offersWaiting > 1 ? 's' : ''}`}
                  style={{ display: 'inline-block', minWidth: 18, height: 18, lineHeight: '18px', padding: '0 5px', marginLeft: 6, borderRadius: 999, background: '#E8743B', color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center', verticalAlign: 1 }}>
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
                <Calendar events={events}
                  emptyHint={mode === 'pro' ? 'Aucun rendez-vous ni créneau pour l’instant. Publiez vos disponibilités pour être réservé en un clic.' : 'Aucun rendez-vous pour l’instant.'} />
              </div>
              {isPro && mode === 'pro' && freeSlots !== null && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0 6px' }}>
                    <div style={{ ...sectionTitle, flex: 1, marginBottom: 0 }}>Mes créneaux libres</div>
                    <button onClick={() => router.push('/pro/disponibilites')} style={{ border: 'none', background: 'none', minHeight: 44, padding: '0 4px', fontSize: 12.5, fontWeight: 700, color: '#0C8F7E', cursor: 'pointer' }}>Gérer</button>
                  </div>
                  {freeSlots.filter(x => new Date(x.starts_at) > new Date()).length ? freeSlots.filter(x => new Date(x.starts_at) > new Date()).slice(0, 3).map(x => (
                    <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px dashed #B8C9C5', borderRadius: 13, padding: '10px 14px', marginBottom: 8 }}>
                      <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 14, color: '#4E6470', width: 46 }}>{hhmm(x.starts_at)}</b>
                      <span style={{ fontSize: 12, color: '#4E6470' }}>{dayLabel(x.starts_at)} · disponible à la réservation</span>
                    </div>
                  )) : (
                    <button onClick={() => router.push('/pro/disponibilites')} style={{ border: 'none', background: 'none', padding: 0, minHeight: 44, textAlign: 'left', fontSize: 12.5, color: '#0C8F7E', fontWeight: 600, cursor: 'pointer' }}>Publiez vos disponibilités pour être réservé en un clic.</button>
                  )}
                </>
              )}
            </>
          )}

          {tab !== 'calendrier' && loading && <div style={{ textAlign: 'center', padding: 30, color: '#4E6470', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

          {tab === 'cours' && !loading && (
            <>
              {/* Mes demandes sans passer par Profil (espace client seulement). */}
              {mode === 'particulier' && (
                <button type="button" onClick={() => router.push('/client/demandes')}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, textAlign: 'left', background: offersWaiting ? '#FFF7ED' : '#fff', border: offersWaiting ? '1.5px solid #F2A93B' : '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px', marginBottom: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Mes demandes</span>
                    <span style={{ display: 'block', fontSize: 12, color: offersWaiting ? '#8a6520' : '#4E6470', fontWeight: offersWaiting ? 700 : 400, marginTop: 2 }}>
                      {offersWaiting
                        ? `${offersWaiting} proposition${offersWaiting > 1 ? 's' : ''} de tarif à examiner`
                        : openRequests ? `${openRequests} demande${openRequests > 1 ? 's' : ''} publiée${openRequests > 1 ? 's' : ''}, en attente de propositions` : 'Vos annonces et les propositions reçues'}
                    </span>
                  </span>
                  {offersWaiting > 0 && (
                    <span aria-hidden="true" style={{ minWidth: 22, height: 22, lineHeight: '22px', padding: '0 6px', borderRadius: 999, background: '#E8743B', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{offersWaiting > 9 ? '9+' : offersWaiting}</span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              )}
              {todayList.length > 0 && (
                <>
                  <div style={{ ...sectionTitle, color: '#0C8F7E' }}>Aujourd&apos;hui</div>
                  {todayList.map(t => card(t, true))}
                  <div style={{ height: 10 }} />
                </>
              )}
              <div style={sectionTitle}>À venir</div>
              {later.length ? later.map(t => card(t, true)) : empty(todayList.length ? 'Rien d’autre de prévu.' : 'Rien de prévu pour l’instant.')}
              {pendingTalks > 0 && (
                <button onClick={() => router.push('/messages')} style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', border: '1px dashed #DCE5E3', background: 'transparent', borderRadius: 14, padding: '11px 14px', marginBottom: 20, fontSize: 12.5, color: '#4E6470', cursor: 'pointer' }}>
                  {pendingTalks} conversation{pendingTalks > 1 ? 's' : ''} en attente d&apos;un tarif validé — voir les messages
                </button>
              )}
            </>
          )}

          {tab === 'terminees' && !loading && (
            done.length ? done.map(t => card(t, false, true)) : empty('Aucune prestation terminée pour l’instant.')
          )}

          {tab === 'factures' && !loading && (
            <>
              {shownInvoices.length ? (
                <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
                  {shownInvoices.map((r, i) => (
                    <button key={r.id} onClick={() => router.push(`/mission/${r.transaction_id}/facture`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, textAlign: 'left', border: 'none', borderTop: i ? '1px solid #EEF2F1' : 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(18,179,156,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 13.5, color: '#123644' }}>
                          {INV_TITLE[r.template] || 'Document'} · {eur(r.net_cents)}
                        </b>
                        <small style={{ display: 'block', fontSize: 11.5, color: '#4E6470', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[r.number, new Date(r.issued_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }), INV_KIND[r.kind], r.kind === 'prestation' ? names[r.transaction_id] : null, mode === 'pro' && r.kind === 'prestation' && r.issuer_id === uid ? 'émise à votre en-tête' : null].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2} style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>
              ) : empty('Aucune facture pour l’instant. Elles apparaissent ici à la fin de chaque mission.')}
              <button onClick={() => router.push('/documents')} style={{ display: 'block', width: '100%', minHeight: 44, border: '1px solid #DCE5E3', background: '#fff', borderRadius: 999, padding: '0 16px', fontWeight: 700, fontSize: 13, color: '#123644', cursor: 'pointer' }}>
                Relevé annuel, export et partage
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
