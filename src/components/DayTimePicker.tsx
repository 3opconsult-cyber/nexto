"use client"
import { useEffect, useMemo, useState } from 'react'

/**
 * Choix d'une date et d'une heure au doigt, à la place du sélecteur natif « jj/mm/aaaa --:-- »
 * (jugé peu ergonomique par Romain le 31/10) : une bande des 21 prochains jours, puis une grille
 * d'horaires toutes les 30 min. Même format de valeur qu'un <input type="datetime-local">
 * (« AAAA-MM-JJTHH:MM », heure locale), pour rester compatible avec le code existant.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// Délai minimal avant un rendez-vous : une heure plus proche est grisée.
const LEAD_MS = 30 * 60000

function nextDays(days: number) {
  const out: Date[] = []; const d0 = new Date(); d0.setHours(0, 0, 0, 0)
  for (let i = 0; i < days; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); out.push(d) }
  return out
}
function timesOf(fromHour: number, toHour: number) {
  const out: string[] = []
  for (let h = fromHour; h < toHour; h++) for (const m of [0, 30]) out.push(`${pad(h)}:${pad(m)}`)
  return out
}

/**
 * Premier horaire encore réservable de la grille (audit ergonomie 19/11 bis, correction 4) :
 * « AAAA-MM-JJTHH:MM », ou '' si aucun. Le soir, c'est demain matin, pas « Auj. » tout grisé.
 */
export function firstFreeTime(fromHour = 8, toHour = 20, days = 21, now = Date.now()): string {
  const times = timesOf(fromHour, toHour)
  for (const d of nextDays(days)) {
    const k = dayKey(d)
    const t = times.find(x => new Date(`${k}T${x}`).getTime() >= now + LEAD_MS)
    if (t) return `${k}T${t}`
  }
  return ''
}

export default function DayTimePicker({ value, onChange, fromHour = 8, toHour = 20, days = 21 }: {
  value: string; onChange: (v: string) => void; fromHour?: number; toHour?: number; days?: number
}) {
  const now = new Date()
  const list = useMemo(() => nextDays(days), [days])
  const [selDay, selTime] = value ? value.split('T') : ['', '']
  // Le jour choisi est gardé ici : la valeur n'est émise que complète (jour ET heure), sinon ''.
  // Sans valeur, le premier jour qui a encore un horaire libre (demain quand tout aujourd'hui est passé).
  const [day, setDay] = useState(() => selDay || (firstFreeTime(fromHour, toHour, days).split('T')[0]) || dayKey(list[0]))
  // Valeur posée de l'extérieur après l'ouverture (préremplissage) : la bande suit son jour.
  useEffect(() => { if (selDay) setDay(selDay) }, [selDay])
  const times = timesOf(fromHour, toHour)
  const isPast = (t: string) => new Date(`${day}T${t}`).getTime() < now.getTime() + LEAD_MS
  const chip = (on: boolean, disabled = false): React.CSSProperties => ({
    border: on ? 'none' : '1px solid #DCE5E3', background: on ? '#12B39C' : disabled ? '#F3F6F5' : '#fff',
    color: on ? '#fff' : disabled ? '#A5B3B9' : '#123644', borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 700,
  })
  const label = value ? new Date(value).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>
        {list.map((d, i) => {
          const k = dayKey(d); const on = k === day
          return (
            <button key={k} type="button" onClick={() => { setDay(k); onChange(selTime && new Date(`${k}T${selTime}`).getTime() >= now.getTime() + LEAD_MS ? `${k}T${selTime}` : '') }}
              style={{ ...chip(on), flex: '0 0 auto', width: 58, padding: '8px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, opacity: .85, textTransform: 'capitalize' }}>{i === 0 ? 'Auj.' : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</div>
              <div style={{ fontSize: 17, lineHeight: 1.2 }}>{d.getDate()}</div>
              <div style={{ fontSize: 10, fontWeight: 600, opacity: .85 }}>{d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</div>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
        {times.filter(t => !isPast(t) || (selTime === t && selDay === day)).map(t => {
          const disabled = isPast(t); const on = selTime === t && selDay === day
          return (
            <button key={t} type="button" disabled={disabled} onClick={() => onChange(`${day}T${t}`)}
              style={{ ...chip(on, disabled), padding: '10px 0', minHeight: 44, fontSize: 13.5 }}>{t.replace(':', ' h ')}</button>
          )
        })}
      </div>
      <div style={{ fontSize: 12.5, color: label && selTime ? '#0B8374' : '#4E6470', fontWeight: 700, marginTop: 8, minHeight: 18, textTransform: 'none' }}>
        {selTime && label ? `Le ${label}` : 'Choisissez un jour puis une heure.'}
      </div>
    </div>
  )
}
