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

const UPCOMING = ['pending', 'matched', 'en_route', 'arrived']
const DONE = ['completed', 'released']
const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }

// Date du rendez-vous quand elle existe (créneau réservé, migration 012), sinon repli sur la création.
function txDate(t: any): Date {
  if (DONE.includes(t.status)) return new Date(t.completed_at || t.scheduled_at || t.created_at)
  return new Date(t.scheduled_at || t.created_at)
}
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(2).replace('.', ',')} €` : '' }

export default function AgendaPage() {
  const router = useRouter()
  const [txs, setTxs] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState<any[]>([])
  const [freeSlots, setFreeSlots] = useState<Slot[] | null>(null)
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [uid, setUid] = useState('')
  const [mode, setMode] = useMode(isPro)

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
        const { data: rows } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: data.map((t: any) => t.id) })
        const map: Record<string, string> = {}
        ;(rows ?? []).forEach((r: any) => { if (r.full_name) map[r.transaction_id] = r.full_name })
        setNames(map)
        const { data: ds } = await supabase.from('disputes')
          .select('id, transaction_id, reason, status, created_at')
          .in('transaction_id', data.map((t: any) => t.id))
          .eq('status', 'open')
          .order('created_at', { ascending: false })
        setDisputes(ds ?? [])
      }
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
  const pendingTalks = mine.filter(t => UPCOMING.includes(t.status) && !t.price_confirmed).length
  const upcoming = mine.filter(t => UPCOMING.includes(t.status) && t.price_confirmed)
    .sort((a, b) => (a.scheduled_at ? 0 : 1) - (b.scheduled_at ? 0 : 1) || txDate(a).getTime() - txDate(b).getTime())
  const done = mine.filter(t => DONE.includes(t.status))

  // Comme la démo (v_agenda) : un statut qui dit où en est la mission, pas juste « à venir ».
  function badge(t: any): { label: string; bg: string; fg: string } {
    if (DONE.includes(t.status)) return { label: 'Effectuée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (t.status === 'arrived') return { label: 'En cours', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (t.en_route_at) return { label: 'En route', bg: 'rgba(47,208,110,.15)', fg: '#1a8f4c' }
    if (t.price_confirmed) return { label: 'Confirmé', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    return { label: 'Tarif à valider', bg: '#FFF7ED', fg: '#8a6520' }
  }

  // Calendrier partagé (même composant que les disponibilités et la réservation) : les rendez-vous
  // confirmés du mode courant, et en mode pro ses créneaux encore libres.
  const events: CalEvent[] = useMemo(() => {
    const appts: CalEvent[] = mine
      .filter(t => t.scheduled_at && (t.price_confirmed || DONE.includes(t.status)) && t.status !== 'cancelled')
      .map(t => {
        const start = new Date(t.scheduled_at)
        return {
          id: t.id, start, end: new Date(start.getTime() + (t.duration_minutes || 120) * 60000), kind: 'busy' as const,
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
  }, [mine, names, freeSlots, mode])

  const card = (t: any) => (
    <div key={t.id} onClick={() => router.push(DONE.includes(t.status) ? `/mission/${t.id}/facture` : `/mission/${t.id}/chat`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
          {names[t.id] || 'Conversation'}{t.requests?.category ? ` · ${TRAD[t.requests.category] || t.requests.category}` : ''}
        </div>
        <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.requests?.description || '—'}</div>
        <div style={{ fontSize: 11, color: t.scheduled_at && !DONE.includes(t.status) ? '#0C8F7E' : '#9aa6a3', fontWeight: t.scheduled_at && !DONE.includes(t.status) ? 700 : 400, marginTop: 3 }}>
          {t.scheduled_at && !DONE.includes(t.status)
            ? `${dayLabel(t.scheduled_at)} · ${hhmm(t.scheduled_at)}`
            : txDate(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          {t.subtotal_cents ? ` · ${eur(t.subtotal_cents)}` : ''}
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0, background: badge(t).bg, color: badge(t).fg }}>
        {badge(t).label}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Agenda</span>
      </div>

      <div style={{ padding: 16, maxWidth: 980, margin: '0 auto' }}>
        {isPro && mode && <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'missions' : 'mission'} onSwitch={() => setMode(mode === 'pro' ? 'particulier' : 'pro')} />}

        {shownDisputes.map(d => (
          <div key={d.id} onClick={() => router.push(`/mission/${d.transaction_id}/chat`)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF7ED', border: '1.5px solid #F2A93B', borderRadius: 16, padding: 14, marginBottom: 14, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: '#F2A93B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
                Litige en cours{names[d.transaction_id] ? ` · ${names[d.transaction_id]}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: '#8a6520', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.status === 'investigating' ? 'En cours d\'examen par PING' : 'Ouvert le ' + new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{d.reason ? ` · ${d.reason}` : ''}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a6520" strokeWidth={2.2} style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
          </div>
        ))}

        {/* Calendrier */}
        <div style={{ marginBottom: 20 }}>
          <Calendar events={events}
            emptyHint={mode === 'pro' ? 'Aucun rendez-vous ni créneau pour l\u2019instant. Publiez vos disponibilités pour être réservé en un clic.' : 'Aucun rendez-vous pour l\u2019instant.'} />
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>À venir</div>
            {upcoming.length ? upcoming.map(card) : <p style={{ fontSize: 12.5, color: '#9aa6a3', marginBottom: 20 }}>Rien de prévu pour l&apos;instant.</p>}
            {pendingTalks > 0 && (
              <button onClick={() => router.push('/messages')} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px dashed #DCE5E3', background: 'transparent', borderRadius: 14, padding: '11px 14px', marginBottom: 20, fontSize: 12.5, color: '#6E8592', cursor: 'pointer' }}>
                {pendingTalks} conversation{pendingTalks > 1 ? 's' : ''} en attente d&apos;un tarif validé — voir les messages
              </button>
            )}

            {isPro && mode === 'pro' && freeSlots !== null && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', margin: '22px 0 10px' }}>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em' }}>Mes créneaux libres</div>
                  <span onClick={() => router.push('/pro/disponibilites')} style={{ fontSize: 12, fontWeight: 700, color: '#0C8F7E', cursor: 'pointer' }}>Gérer</span>
                </div>
                {freeSlots.filter(x => new Date(x.starts_at) > new Date()).length ? freeSlots.filter(x => new Date(x.starts_at) > new Date()).slice(0, 3).map(x => (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px dashed #B8C9C5', borderRadius: 13, padding: '10px 14px', marginBottom: 8 }}>
                    <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 14, color: '#6E8592', width: 46 }}>{hhmm(x.starts_at)}</b>
                    <span style={{ fontSize: 12, color: '#9aa6a3' }}>{dayLabel(x.starts_at)} · disponible à la réservation</span>
                  </div>
                )) : (
                  <p onClick={() => router.push('/pro/disponibilites')} style={{ fontSize: 12.5, color: '#0C8F7E', fontWeight: 600, cursor: 'pointer' }}>Publiez vos disponibilités pour être réservé en un clic.</p>
                )}
              </>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '22px 0 10px' }}>Effectuées</div>
            {done.length ? done.map(card) : <p style={{ fontSize: 12.5, color: '#9aa6a3' }}>Aucune prestation terminée pour l&apos;instant.</p>}
          </>
        )}
      </div>
    </div>
  )
}
