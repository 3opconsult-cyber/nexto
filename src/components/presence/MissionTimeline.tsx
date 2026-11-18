"use client"

// Frise de la mission du jour : où on en est, d'un coup d'œil.
export const STEPS = ['Rendez-vous', 'En route', 'Arrivée', 'Intervention', 'Fin', 'Facture'] as const

export function stepIndex(tx: any): number {
  if (!tx) return 0
  if (tx.completed_at || ['completed', 'released'].includes(tx.status)) return 5
  if (tx.arrived_at) return 3
  if (tx.en_route_at) return 1
  return 0
}

export default function MissionTimeline({ current, times }: { current: number; times?: (string | null | undefined)[] }) {
  return (
    <ol aria-label="Étapes de la mission" style={{ listStyle: 'none', margin: 0, padding: '4px 0', display: 'flex', alignItems: 'flex-start' }}>
      {STEPS.map((s, i) => {
        const done = i < current || (i === current && i === STEPS.length - 1)
        const on = i === current
        const color = done ? '#12B39C' : on ? '#123644' : '#C5D3CF'
        return (
          <li key={s} aria-current={on ? 'step' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && <span aria-hidden style={{ position: 'absolute', top: 7, right: '50%', width: '100%', height: 2, background: i <= current ? '#12B39C' : '#DCE5E3' }} />}
            <span aria-hidden style={{
              position: 'relative', width: 16, height: 16, borderRadius: '50%', background: done ? '#12B39C' : '#fff',
              border: `2px solid ${color}`, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
            }}>
              {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 600, color: on ? '#123644' : '#6E8592', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{s}</span>
            {times?.[i] && <span style={{ fontSize: 9, color: '#6E8592', fontVariantNumeric: 'tabular-nums' }}>{times[i]}</span>}
          </li>
        )
      })}
    </ol>
  )
}
