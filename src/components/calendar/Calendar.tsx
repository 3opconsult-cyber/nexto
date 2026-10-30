"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMonths, atMinutes, minutesOfDay, sameDay, startOfDay, startOfWeek, timeLabel } from './dates'

/**
 * Calendrier partagé (agenda, disponibilités du pro, réservation) — façon Airbnb.
 *
 * Trois vues : Jour / Semaine / Mois, navigation précédent / suivant / aujourd'hui, semaine du lundi.
 * Deux sortes d'éléments : les disponibilités (créneaux libres, teal clair) et les rendez-vous
 * (missions et créneaux réservés, plein). Sélection facultative :
 *  - Jour / Semaine : glisser à la souris sur les heures (ou toucher une heure puis une autre sur
 *    téléphone) pour choisir une plage dans une journée ;
 *  - Mois : toucher plusieurs jours (Maj + clic pour une suite de jours).
 */

export type CalView = 'day' | 'week' | 'month'

export type CalEvent = {
  id: string
  start: Date
  end: Date
  kind: 'free' | 'busy'
  title?: string
  subtitle?: string
  selected?: boolean
  onClick?: () => void
}

export type CalSelection =
  | { type: 'range'; start: Date; end: Date }
  | { type: 'days'; days: Date[] }

const VIEW_LABEL: Record<CalView, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' }
const WD = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const PX_PER_MIN = 0.8 // 48 px par heure

const C = {
  ink: '#123644', slate: '#6E8592', line: '#E7EDEB', teal: '#12B39C', tealD: '#0C8F7E', gold: '#F2A93B', paper: '#F3F6F5',
}

// Compact selon la largeur réelle du calendrier (il vit parfois dans une colonne étroite).
function useNarrow(ref: React.RefObject<HTMLElement>, limit = 560) {
  const [narrow, setNarrow] = useState<boolean | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const f = () => setNarrow(el.getBoundingClientRect().width < limit)
    f()
    const ro = new ResizeObserver(f)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, limit])
  return narrow
}

function Chevron({ dir }: { dir: 'l' | 'r' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'l' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

export default function Calendar({
  events, views = ['day', 'week', 'month'], defaultView, initialDate, selectable = false, selection = null, onSelect,
  minHour = 7, maxHour = 21, stepMinutes = 30, emptyHint, onDayClick, bigCells = false,
}: {
  events: CalEvent[]
  views?: CalView[]
  defaultView?: CalView
  initialDate?: Date
  selectable?: boolean
  selection?: CalSelection | null
  onSelect?: (s: CalSelection | null) => void
  minHour?: number
  maxHour?: number
  stepMinutes?: number
  emptyHint?: string
  // Vue Mois : action propre à la page au toucher d'un jour (sinon ouverture de la vue Jour).
  onDayClick?: (d: Date) => void
  // Vue Mois à grandes cases (page des disponibilités).
  bigCells?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const measured = useNarrow(root)
  const narrow = !!measured
  const [view, setView] = useState<CalView | null>(defaultView ?? null)
  const [cursor, setCursor] = useState(() => startOfDay(initialDate ?? new Date()))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id) }, [])

  // Vue par défaut selon l'écran : jour sur téléphone, semaine sur ordinateur.
  useEffect(() => {
    if (view || measured === null) return
    const v: CalView = narrow ? 'day' : 'week'
    setView(views.includes(v) ? v : views[0])
  }, [narrow, measured, view, views])
  const v: CalView = view ?? (views.includes('week') ? 'week' : views[0])

  // Une nouvelle date initiale (ex. premier créneau chargé) recentre le calendrier une fois.
  const initKey = initialDate ? startOfDay(initialDate).getTime() : 0
  useEffect(() => { if (initKey) setCursor(new Date(initKey)) }, [initKey])

  // Plage horaire affichée : 7 h – 21 h, élargie si un élément en sort.
  const [h0, h1] = useMemo(() => {
    let lo = minHour * 60, hi = maxHour * 60
    events.forEach(e => {
      lo = Math.min(lo, Math.floor(minutesOfDay(e.start) / 60) * 60)
      const endMin = sameDay(e.start, e.end) ? minutesOfDay(e.end) : 24 * 60
      hi = Math.max(hi, Math.ceil(endMin / 60) * 60)
    })
    return [lo, Math.min(hi, 24 * 60)]
  }, [events, minHour, maxHour])

  const days = v === 'day' ? [cursor] : v === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)) : []

  function move(n: number) {
    setCursor(c => v === 'day' ? addDays(c, n) : v === 'week' ? addDays(c, 7 * n) : addMonths(c, n))
  }

  const title = v === 'day'
    ? cursor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : v === 'week'
      ? `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const btn: React.CSSProperties = { border: `1px solid ${C.line}`, background: '#fff', color: C.ink, borderRadius: 10, height: 32, minWidth: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0 10px', fontSize: 12.5, fontWeight: 700, fontFamily: 'Inter, sans-serif' }

  return (
    <div ref={root} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 18, padding: 12, fontFamily: 'Inter, sans-serif', color: C.ink, minWidth: 0 }}>
      {/* En-tête : navigation + choix de la vue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-label="Précédent" onClick={() => move(-1)} style={btn}><Chevron dir="l" /></button>
          <button type="button" onClick={() => setCursor(startOfDay(new Date()))} style={btn}>Aujourd&apos;hui</button>
          <button type="button" aria-label="Suivant" onClick={() => move(1)} style={btn}><Chevron dir="r" /></button>
        </div>
        <b style={{ flex: 1, minWidth: 140, fontFamily: 'Quicksand, sans-serif', fontSize: 15.5, textTransform: 'capitalize' }}>{title}</b>
        {views.length > 1 && (
          <div style={{ display: 'flex', background: C.paper, borderRadius: 11, padding: 3 }}>
            {views.map(x => (
              <button key={x} type="button" onClick={() => setView(x)} style={{
                border: 'none', borderRadius: 9, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: x === v ? '#fff' : 'transparent', color: x === v ? C.ink : C.slate,
                boxShadow: x === v ? '0 1px 3px rgba(18,54,68,.15)' : 'none',
              }}>{VIEW_LABEL[x]}</button>
            ))}
          </div>
        )}
      </div>

      {v === 'month'
        ? <MonthGrid cursor={cursor} events={events} now={now} selectable={selectable} selection={selection} onSelect={onSelect}
            bigCells={bigCells}
            onOpenDay={d => { if (onDayClick) { onDayClick(d); return } setCursor(d); if (views.includes('day')) setView('day') }} />
        : <TimeGrid days={days} events={events} now={now} h0={h0} h1={h1} step={stepMinutes} narrow={narrow && v === 'week'}
            selectable={selectable} selection={selection} onSelect={onSelect} />}

      {emptyHint && events.length === 0 && (
        <p style={{ fontSize: 12, color: C.slate, margin: '10px 2px 0', lineHeight: 1.5 }}>{emptyHint}</p>
      )}
    </div>
  )
}

// ---------- Jour / Semaine ----------
function TimeGrid({ days, events, now, h0, h1, step, narrow, selectable, selection, onSelect }: {
  days: Date[]; events: CalEvent[]; now: Date; h0: number; h1: number; step: number; narrow: boolean
  selectable: boolean; selection: CalSelection | null; onSelect?: (s: CalSelection | null) => void
}) {
  const height = (h1 - h0) * PX_PER_MIN
  const hours = Array.from({ length: (h1 - h0) / 60 + 1 }, (_, i) => h0 + i * 60)
  const [drag, setDrag] = useState<{ day: Date; a: number; b: number } | null>(null)
  const tap = useRef<{ x: number; y: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Au premier affichage, on fait défiler jusqu'à 8 h (ou au premier élément).
  useEffect(() => {
    const first = events.filter(e => days.some(d => sameDay(d, e.start))).map(e => minutesOfDay(e.start)).sort((a, b) => a - b)[0]
    const target = Math.max(0, ((first ?? 8 * 60) - h0 - 30) * PX_PER_MIN)
    scroller.current?.scrollTo({ top: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]?.getTime(), days.length])

  function slotAt(e: React.PointerEvent, el: HTMLElement) {
    const y = e.clientY - el.getBoundingClientRect().top
    const m = h0 + Math.floor(y / PX_PER_MIN / step) * step
    return Math.min(Math.max(m, h0), h1 - step)
  }

  function emit(day: Date, a: number, b: number) {
    let lo = Math.min(a, b), hi = Math.max(a, b) + step
    // Jamais dans le passé.
    const nowMin = sameDay(day, now) ? minutesOfDay(now) : (startOfDay(day) < startOfDay(now) ? 24 * 60 : 0)
    if (lo < nowMin) lo = Math.ceil(nowMin / step) * step
    if (hi <= lo) { onSelect?.(null); return }
    onSelect?.({ type: 'range', start: atMinutes(day, lo), end: atMinutes(day, hi) })
  }

  const sel = selection?.type === 'range' ? selection : null
  const cols = `${narrow ? 30 : 44}px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div>
      {/* Jours */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>
        <div />
        {days.map(d => {
          const today = sameDay(d, now)
          return (
            <div key={d.getTime()} style={{ textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: C.slate, fontWeight: 600 }}>{narrow ? WD[(d.getDay() + 6) % 7].slice(0, 1).toUpperCase() : WD[(d.getDay() + 6) % 7]}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, marginTop: 2, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, background: today ? C.teal : 'transparent', color: today ? '#fff' : C.ink }}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Grille horaire */}
      <div ref={scroller} style={{ maxHeight: 460, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, position: 'relative', height }}>
          <div style={{ position: 'relative' }}>
            {hours.slice(0, -1).map(h => (
              <div key={h} style={{ position: 'absolute', top: (h - h0) * PX_PER_MIN - 6, right: 6, fontSize: 10, color: C.slate }}>{narrow ? `${h / 60}` : `${String(h / 60).padStart(2, '0')}:00`}</div>
            ))}
          </div>
          {days.map(d => {
            const dayEvents = layout(events.filter(e => sameDay(e.start, d)))
            const past = startOfDay(d) < startOfDay(now)
            const dragHere = drag && sameDay(drag.day, d) ? drag : null
            const selHere = sel && sameDay(sel.start, d) ? sel : null
            return (
              <div key={d.getTime()}
                onPointerDown={e => {
                  if (!selectable || !onSelect) return
                  const m = slotAt(e, e.currentTarget)
                  if (e.pointerType === 'mouse') {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setDrag({ day: d, a: m, b: m })
                  } else tap.current = { x: e.clientX, y: e.clientY }
                }}
                onPointerMove={e => { if (drag && e.pointerType === 'mouse') setDrag({ ...drag, b: slotAt(e, e.currentTarget) }) }}
                onPointerUp={e => {
                  if (!selectable || !onSelect) return
                  const m = slotAt(e, e.currentTarget)
                  if (drag && e.pointerType === 'mouse') { emit(d, drag.a, drag.b); setDrag(null); return }
                  // Téléphone : un toucher choisit 1 h ; un second toucher plus tard le même jour étend la plage.
                  const t = tap.current; tap.current = null
                  if (!t || Math.abs(e.clientX - t.x) > 8 || Math.abs(e.clientY - t.y) > 8) return
                  if (selHere && m >= minutesOfDay(selHere.start)) emit(d, minutesOfDay(selHere.start), m)
                  else emit(d, m, Math.min(m + 60 - step, h1 - step))
                }}
                style={{ position: 'relative', borderLeft: `1px solid ${C.line}`, background: past ? '#FAFBFB' : '#fff', cursor: selectable ? 'cell' : 'default', userSelect: 'none', minWidth: 0 }}>
                {hours.slice(0, -1).map(h => (
                  <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: (h - h0) * PX_PER_MIN, borderTop: `1px solid ${C.line}` }} />
                ))}
                {dayEvents.map(({ e, lane, lanes }) => {
                  const top = (Math.max(minutesOfDay(e.start), h0) - h0) * PX_PER_MIN
                  const endMin = sameDay(e.start, e.end) ? minutesOfDay(e.end) : 24 * 60
                  const h = Math.max(18, (Math.min(endMin, h1) - Math.max(minutesOfDay(e.start), h0)) * PX_PER_MIN - 2)
                  const free = e.kind === 'free'
                  const bg = e.selected ? C.gold : free ? 'rgba(18,179,156,.14)' : C.ink
                  const fg = e.selected ? '#3a2a06' : free ? C.tealD : '#fff'
                  return (
                    <div key={e.id}
                      onPointerDown={ev => ev.stopPropagation()} onPointerUp={ev => ev.stopPropagation()}
                      onClick={ev => { ev.stopPropagation(); e.onClick?.() }}
                      title={`${timeLabel(e.start)} – ${timeLabel(e.end)}${e.title ? ' · ' + e.title : ''}`}
                      style={{
                        position: 'absolute', top: top + 1, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`,
                        background: bg, color: fg, border: free && !e.selected ? `1.5px solid ${C.teal}` : 'none', borderRadius: 8,
                        padding: narrow ? '2px 3px' : '3px 6px', overflow: 'hidden', cursor: e.onClick ? 'pointer' : 'default', zIndex: 2,
                        fontSize: narrow ? 9.5 : 11, lineHeight: 1.25, boxSizing: 'border-box',
                      }}>
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeLabel(e.start)}</div>
                      {!narrow && e.title && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>}
                      {!narrow && e.subtitle && h > 44 && <div style={{ opacity: .8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.subtitle}</div>}
                    </div>
                  )
                })}
                {(dragHere || selHere) && (() => {
                  const a = dragHere ? Math.min(dragHere.a, dragHere.b) : minutesOfDay(selHere!.start)
                  const b = dragHere ? Math.max(dragHere.a, dragHere.b) + step : minutesOfDay(selHere!.end)
                  return (
                    <div style={{ position: 'absolute', left: 2, right: 2, top: (a - h0) * PX_PER_MIN, height: (b - a) * PX_PER_MIN, background: 'rgba(242,169,59,.28)', border: `2px solid ${C.gold}`, borderRadius: 8, zIndex: 3, pointerEvents: 'none' }} />
                  )
                })()}
                {sameDay(d, now) && minutesOfDay(now) >= h0 && minutesOfDay(now) <= h1 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: (minutesOfDay(now) - h0) * PX_PER_MIN, borderTop: '2px solid #c0503a', zIndex: 4, pointerEvents: 'none' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Éléments qui se chevauchent : côte à côte dans la colonne du jour.
function layout(list: CalEvent[]) {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime())
  const laneEnds: number[] = []
  const placed = sorted.map(e => {
    let lane = laneEnds.findIndex(end => end <= e.start.getTime())
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
    laneEnds[lane] = e.end.getTime()
    return { e, lane }
  })
  const lanes = Math.max(1, laneEnds.length)
  return placed.map(p => ({ ...p, lanes }))
}

// ---------- Mois ----------
function MonthGrid({ cursor, events, now, selectable, selection, onSelect, onOpenDay, bigCells }: {
  cursor: Date; events: CalEvent[]; now: Date; selectable: boolean; bigCells?: boolean
  selection: CalSelection | null; onSelect?: (s: CalSelection | null) => void; onOpenDay: (d: Date) => void
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const anchor = useRef<Date | null>(null)
  const selDays = selection?.type === 'days' ? selection.days : []
  const isSel = (d: Date) => selDays.some(x => sameDay(x, d))

  function click(d: Date, shift: boolean) {
    if (!selectable || !onSelect) { onOpenDay(d); return }
    if (startOfDay(d) < startOfDay(now)) return
    let next: Date[]
    if (shift && anchor.current) {
      const [a, b] = anchor.current < d ? [anchor.current, d] : [d, anchor.current]
      const run: Date[] = []
      for (let x = startOfDay(a); x <= b; x = addDays(x, 1)) run.push(x)
      next = [...selDays.filter(x => !run.some(r => sameDay(r, x))), ...run]
    } else {
      next = isSel(d) ? selDays.filter(x => !sameDay(x, d)) : [...selDays, startOfDay(d)]
      anchor.current = startOfDay(d)
    }
    onSelect(next.length ? { type: 'days', days: next.sort((a, b) => a.getTime() - b.getTime()) } : null)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
        {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: C.slate, textTransform: 'capitalize' }}>{w.slice(0, 3)}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {cells.map(d => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const dayEv = events.filter(e => sameDay(e.start, d))
          const free = dayEv.filter(e => e.kind === 'free').length
          const busy = dayEv.length - free
          const today = sameDay(d, now)
          const past = startOfDay(d) < startOfDay(now)
          const on = isSel(d)
          return (
            <button key={d.getTime()} type="button" onClick={e => click(d, e.shiftKey)}
              style={{
                minHeight: bigCells ? 76 : 56, borderRadius: 11, padding: '5px 4px', cursor: selectable && past ? 'default' : 'pointer', textAlign: 'left',
                border: on ? `2px solid ${C.gold}` : today ? `1.5px solid ${C.teal}` : `1px solid ${C.line}`,
                background: on ? 'rgba(242,169,59,.18)' : past ? '#FAFBFB' : '#fff', opacity: inMonth ? 1 : .45,
                display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, fontFamily: 'Inter, sans-serif',
              }}>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: today ? C.tealD : C.ink }}>{d.getDate()}</span>
              {busy > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: C.ink, borderRadius: 999, padding: '1px 5px', alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>{busy} RDV</span>}
              {free > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: C.tealD, background: 'rgba(18,179,156,.14)', borderRadius: 999, padding: '1px 5px', alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>{free} libre{free > 1 ? 's' : ''}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
