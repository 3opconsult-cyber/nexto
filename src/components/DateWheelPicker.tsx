"use client"
import { useEffect, useRef } from 'react'

/**
 * Sélecteur de date en roue (jour/mois/année qui défilent), demandé par
 * Romain à la place de l'input natif type="date" : celui-ci ouvre un
 * calendrier positionné sur AUJOURD'HUI (confusant pour une date de
 * naissance) et affiche un placeholder "jj/mm/aaaa" tant que rien n'est
 * choisi. Ici, tout est pré-rempli dès le montage (pas de placeholder) et
 * l'année démarre déjà loin dans le passé.
 */
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const ITEM_H = 38
const VISIBLE = 3
const PAD = Math.floor(VISIBLE / 2) * ITEM_H

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate()
}

function Wheel({ options, index, onChange, width }: { options: string[]; index: number; onChange: (i: number) => void; width: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmatic = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    programmatic.current = true
    el.scrollTop = index * ITEM_H
    const t = setTimeout(() => { programmatic.current = false }, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length])

  function onScroll() {
    const el = ref.current
    if (!el || programmatic.current) return
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const i = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(options.length - 1, i))
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' })
      onChange(clamped)
    }, 120)
  }

  return (
    <div style={{ position: 'relative', width, height: ITEM_H * VISIBLE }}>
      <div ref={ref} onScroll={onScroll}
        style={{
          height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
          paddingTop: PAD, paddingBottom: PAD, WebkitOverflowScrolling: 'touch',
        }}
        className="noscroll">
        {options.map((opt, i) => (
          <div key={i} onClick={() => { ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' }); onChange(i) }}
            style={{
              height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center', fontFamily: 'Quicksand, sans-serif',
              fontWeight: i === index ? 700 : 600, fontSize: i === index ? 16 : 14.5,
              color: i === index ? '#123644' : '#B7C2C6', cursor: 'pointer', transition: 'color .15s, font-size .15s',
            }}>
            {opt}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: PAD, left: 0, right: 0, height: ITEM_H, borderTop: '1.5px solid #E7EDEB', borderBottom: '1.5px solid #E7EDEB', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: PAD, background: 'linear-gradient(#fff, rgba(255,255,255,0))', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: PAD, background: 'linear-gradient(rgba(255,255,255,0), #fff)', pointerEvents: 'none' }} />
    </div>
  )
}

export default function DateWheelPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const now = new Date()
  const defaultYear = now.getFullYear() - 30
  const [y, m, d] = value
    ? value.split('-').map(Number)
    : [defaultYear, 1, 1]

  const years: number[] = []
  for (let yr = now.getFullYear() - 16; yr >= now.getFullYear() - 100; yr--) years.push(yr)

  const dim = daysInMonth(m, y)
  const days = Array.from({ length: dim }, (_, i) => i + 1)

  function set(nd: number, nm: number, ny: number) {
    const clampedDim = daysInMonth(nm, ny)
    const finalDay = Math.min(nd, clampedDim)
    onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, border: '1.5px solid #E7EDEB', borderRadius: 13, background: '#fff', padding: '0 4px' }}>
      <Wheel width={54} options={days.map(String)} index={d - 1} onChange={i => set(days[i], m, y)} />
      <Wheel width={72} options={MONTHS} index={m - 1} onChange={i => set(d, i + 1, y)} />
      <Wheel width={72} options={years.map(String)} index={years.indexOf(y)} onChange={i => set(d, m, years[i])} />
    </div>
  )
}
