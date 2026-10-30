"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import Calendar, { type CalEvent } from '@/components/calendar/Calendar'
import { addDays, atMinutes, hm, minutesOfDay, sameDay, startOfDay, startOfWeek } from '@/components/calendar/dates'
import { fetchSlotsBetween, slotEnd, type Slot } from '@/lib/slots'
import { TRADES } from '@/lib/trades'

// Mes disponibilités — façon calendrier d'hôte Airbnb, sans glisser ni petite grille horaire
// (demande Romain 30/10) : un mois à grandes cases ; on touche un jour, on coche des tranches
// horaires (ou « Journée complète »), on choisit « ce jour / toute la semaine / chaque même jour
// pendant 4 semaines », on valide. Les tranches déjà ouvertes sont pré-cochées : les décocher retire
// les créneaux libres correspondants. Un créneau réservé n'est jamais retiré.

const BANDS = [8, 10, 12, 14, 16, 18].map(h => ({ a: h * 60, b: (h + 2) * 60 }))
const WEEKS = 4
type Scope = 'day' | 'week' | 'weekday'

export default function Disponibilites() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>([])
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState<Date | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [scope, setScope] = useState<Scope>('day')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const reload = useCallback(async (uid: string) => {
    const supabase = createClient()
    const from = addDays(startOfDay(new Date()), -31)
    const [list, { data: txs }] = await Promise.all([
      fetchSlotsBetween(supabase, uid, from, addDays(from, 220)),
      supabase.from('transactions').select('id, status, scheduled_at, requests(category, title)')
        .eq('seller_id', uid).eq('price_confirmed', true).not('scheduled_at', 'is', null).neq('status', 'cancelled'),
    ])
    setSlots(list)
    setMissions(txs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login?next=/pro/disponibilites'); return }
      setUserId(user.id)
      reload(user.id)
    })
  }, [router, reload])

  const events: CalEvent[] = useMemo(() => {
    const linked = new Set((slots ?? []).map(s => s.transaction_id).filter(Boolean))
    const name = (m: any) => m?.requests?.title || TRADES[m?.requests?.category] || 'Rendez-vous'
    return [
      ...(slots ?? []).map(s => ({
        id: s.id, start: new Date(s.starts_at), end: slotEnd(s), kind: (s.transaction_id ? 'busy' : 'free') as 'busy' | 'free',
        title: s.transaction_id ? name(missions.find(m => m.id === s.transaction_id)) : 'Disponible',
      })),
      ...missions.filter(m => !linked.has(m.id)).map(m => ({
        id: `tx-${m.id}`, start: new Date(m.scheduled_at), end: new Date(new Date(m.scheduled_at).getTime() + 2 * 3600000),
        kind: 'busy' as const, title: name(m),
      })),
    ]
  }, [slots, missions])

  const slotsOn = (d: Date) => (slots ?? []).filter(s => sameDay(new Date(s.starts_at), d))
  const overlaps = (s: Slot, band: { a: number; b: number }) => {
    const a = minutesOfDay(new Date(s.starts_at)), b = a + s.duration_minutes
    return a < band.b && b > band.a
  }
  // État d'une tranche ce jour-là : réservée (verrouillée), ouverte, ou fermée.
  const bandState = (d: Date, i: number) => {
    const list = slotsOn(d).filter(s => overlaps(s, BANDS[i]))
    if (list.some(s => s.transaction_id)) return 'booked'
    if (missions.some(m => sameDay(new Date(m.scheduled_at), d) && (() => { const a = minutesOfDay(new Date(m.scheduled_at)); return a < BANDS[i].b && a + 120 > BANDS[i].a })())) return 'booked'
    return list.length ? 'open' : 'closed'
  }
  const bandPast = (d: Date, i: number) => atMinutes(d, BANDS[i].a).getTime() <= Date.now()

  function openDay(d: Date) {
    if (startOfDay(d) < startOfDay(new Date())) return
    setDay(startOfDay(d))
    setPicked(new Set(BANDS.map((_, i) => i).filter(i => bandState(d, i) !== 'closed')))
    setScope('day')
    setMsg(null)
  }

  function toggle(i: number) {
    if (!day || bandState(day, i) === 'booked') return
    setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })
  }
  const allOpen = day ? BANDS.every((_, i) => picked.has(i) || bandState(day, i) === 'booked') : false
  function toggleAll() {
    if (!day) return
    setPicked(allOpen ? new Set(BANDS.map((_, i) => i).filter(i => bandState(day, i) === 'booked')) : new Set(BANDS.map((_, i) => i)))
  }

  const weekdayName = day ? day.toLocaleDateString('fr-FR', { weekday: 'long' }) : ''
  const targets = (): Date[] => {
    if (!day) return []
    if (scope === 'day') return [day]
    if (scope === 'week') { const w = startOfWeek(day); return Array.from({ length: 7 }, (_, i) => addDays(w, i)) }
    return Array.from({ length: WEEKS }, (_, i) => addDays(day, 7 * i)) // +7 jours sur la date locale (heure d'été / d'hiver)
  }

  async function save() {
    if (!userId || !day) return
    setBusy(true); setMsg(null)
    const supabase = createClient()
    const toCreate: { provider_id: string; starts_at: string; duration_minutes: number }[] = []
    const toDelete: string[] = []
    for (const d of targets()) {
      if (startOfDay(d) < startOfDay(new Date())) continue
      const list = slotsOn(d)
      BANDS.forEach((band, i) => {
        if (atMinutes(d, band.a).getTime() <= Date.now()) return
        const here = list.filter(s => overlaps(s, band))
        if (picked.has(i)) {
          if (!here.length && bandState(d, i) !== 'booked') toCreate.push({ provider_id: userId, starts_at: atMinutes(d, band.a).toISOString(), duration_minutes: band.b - band.a })
        } else {
          here.filter(s => !s.transaction_id).forEach(s => toDelete.push(s.id))
        }
      })
    }
    const del = Array.from(new Set(toDelete))
    let error = null
    if (toCreate.length) error = (await supabase.from('provider_slots').upsert(toCreate, { onConflict: 'provider_id,starts_at', ignoreDuplicates: true })).error
    if (!error && del.length) error = (await supabase.from('provider_slots').delete().in('id', del).is('transaction_id', null)).error
    setBusy(false)
    if (error) { setMsg({ text: 'Enregistrement impossible pour le moment. Réessayez.', ok: false }); return }
    setMsg({ text: toCreate.length || del.length ? 'Disponibilités enregistrées.' : 'Rien à changer.', ok: true })
    setDay(null)
    reload(userId)
  }

  const chip = (on: boolean, locked = false): React.CSSProperties => ({
    border: on ? '2px solid #12B39C' : '1.5px solid #E7EDEB', background: locked ? '#123644' : on ? 'rgba(18,179,156,.12)' : '#fff',
    color: locked ? '#fff' : on ? '#0C8F7E' : '#123644', borderRadius: 14, padding: '12px 8px', fontFamily: 'Quicksand, sans-serif',
    fontWeight: 700, fontSize: 15, cursor: locked ? 'default' : 'pointer', textAlign: 'center',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#123644', padding: '16px 20px 22px' }}>
        <NavDrawer />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.72)', margin: '18px 0 4px' }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes disponibilités</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', marginTop: 6, maxWidth: '52ch' }}>
          Touchez un jour pour choisir vos horaires. Vos clients réservent ensuite l&apos;un de ces créneaux, sans aller-retour.
        </p>
      </div>

      <div style={{ flex: 1, padding: '16px 12px 40px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

          {!loading && slots === null && (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 18, fontSize: 13, color: '#4E6470', lineHeight: 1.55 }}>
              La réservation par créneau arrive très bientôt. En attendant, vos clients vous contactent et vous convenez de l&apos;heure dans la conversation.
            </div>
          )}

          {!loading && slots !== null && (
            <>
              {msg && <p style={{ fontSize: 13, color: msg.ok ? '#0C8F7E' : '#c0503a', margin: '0 0 10px', fontWeight: 600 }}>{msg.text}</p>}
              <Calendar events={events} views={['month']} defaultView="month" bigCells onDayClick={openDay} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: '#4E6470' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(18,179,156,.14)', border: '1.5px solid #12B39C' }} />Créneaux libres</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: '#123644' }} />Rendez-vous</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fiche du jour : un toucher par tranche horaire */}
      {day && (
        <div onClick={() => setDay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <b style={{ flex: 1, fontFamily: 'Quicksand, sans-serif', fontSize: 18, color: '#123644', textTransform: 'capitalize' }}>
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </b>
              <button onClick={() => setDay(null)} aria-label="Fermer" style={{ border: 'none', background: '#F3F6F5', width: 34, height: 34, borderRadius: 999, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div onClick={toggleAll} style={{ ...chip(allOpen), marginBottom: 10 }}>
              Journée complète · {hm(BANDS[0].a)} – {hm(BANDS[BANDS.length - 1].b)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {BANDS.map((b, i) => {
                const st = bandState(day, i)
                const past = bandPast(day, i)
                return (
                  <div key={i} onClick={() => !past && toggle(i)} style={{ ...chip(picked.has(i), st === 'booked'), opacity: past ? .4 : 1, cursor: past || st === 'booked' ? 'default' : 'pointer' }}>
                    {b.a / 60} h – {b.b / 60} h
                    {st === 'booked' && <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600, opacity: .8 }}>Réservé</div>}
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 8px' }}>Appliquer à</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([['day', 'Ce jour seulement'], ['week', 'Toute la semaine, mêmes horaires'], ['weekday', `Tous les ${weekdayName}s pendant ${WEEKS} semaines`]] as const).map(([k, label]) => (
                <div key={k} onClick={() => setScope(k)} style={{ display: 'flex', alignItems: 'center', gap: 10, border: scope === k ? '2px solid #12B39C' : '1.5px solid #E7EDEB', borderRadius: 13, padding: '11px 13px', cursor: 'pointer', background: scope === k ? 'rgba(18,179,156,.06)' : '#fff' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, border: scope === k ? '6px solid #12B39C' : '2px solid #B8C9C5', boxSizing: 'border-box', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#123644' }}>{label}</span>
                </div>
              ))}
            </div>

            <button onClick={save} disabled={busy} style={{ marginTop: 16, width: '100%', border: 'none', borderRadius: 999, padding: 14, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <p style={{ fontSize: 11.5, color: '#6E8592', textAlign: 'center', margin: '10px 0 0' }}>Un créneau déjà réservé par un client n&apos;est jamais retiré.</p>
          </div>
        </div>
      )}
    </div>
  )
}
