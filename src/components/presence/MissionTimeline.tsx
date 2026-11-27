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

// Frise de suivi (lot 30, maquette « Suivi de mission ») : version courte, dans le billet de
// mission du chat et dans l'Agenda. La facture est posée par le trigger au passage à « terminée »
// (generate_invoices) : « Terminée » et « Facturée » se cochent donc ensemble, sauf si l'on sait
// qu'aucune facture n'existe encore (invoiced === false).
export const SUIVI_STEPS = ['Confirmée', 'En route', 'Sur place', 'Terminée', 'Facturée'] as const

export function suiviIndex(tx: any, invoiced?: boolean): number {
  if (!tx) return 0
  if (tx.completed_at || ['completed', 'released'].includes(tx.status)) return invoiced === false ? 3 : 4
  if (tx.arrived_at || tx.status === 'arrived') return 2
  if (tx.en_route_at) return 1
  return 0
}

export default function MissionTimeline({ current, times, steps = STEPS, compact = false, label = 'Étapes de la mission', airy = false }: {
  current: number
  times?: (string | null | undefined)[]
  steps?: readonly string[]
  compact?: boolean
  label?: string
  /** Lecture aérée (particulier, 24/11) : points sans légende serrée, puis une phrase « Étape en cours : X, ensuite Y ». */
  airy?: boolean
}) {
  const last = steps.length - 1
  if (airy) {
    const done0 = current >= last
    return (
      <div>
        <ol aria-label={label} style={{ listStyle: 'none', margin: 0, padding: '6px 0', display: 'flex', alignItems: 'center' }}>
          {steps.map((s, i) => {
            const done = i < current || (i === current && i === last)
            const on = i === current && i !== last
            return (
              <li key={s} aria-current={i === current ? 'step' : undefined} aria-label={`${s}${done ? ' (fait)' : on ? ' (en cours)' : ''}`} style={{ flex: i === last ? '0 0 auto' : 1, display: 'flex', alignItems: 'center' }}>
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', flex: '0 0 auto', background: done ? '#12B39C' : '#fff', border: `2px solid ${done ? '#12B39C' : on ? '#123644' : '#C5D3CF'}`, boxShadow: on ? '0 0 0 4px rgba(18,179,156,.22)' : undefined, display: 'grid', placeItems: 'center' }}>
                  {done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </span>
                {i < last && <span aria-hidden style={{ flex: 1, height: 2, margin: '0 4px', background: i < current ? '#12B39C' : '#DCE5E3' }} />}
              </li>
            )
          })}
        </ol>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.55, color: '#123644' }}>
          <b>{done0 ? steps[last] : steps[current]}</b>
          {!done0 && <span style={{ color: '#4E6470' }}>{` · ensuite : ${steps[current + 1]}`}</span>}
          {times?.[current] && <span style={{ color: '#4E6470' }}>{` · ${times[current]}`}</span>}
        </p>
      </div>
    )
  }
  const dot = compact ? 14 : 16
  return (
    <ol aria-label={label} style={{ listStyle: 'none', margin: 0, padding: '4px 0', display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((s, i) => {
        // Dernière étape atteinte = mission bouclée : tout est coché.
        const done = i < current || (i === current && i === last)
        const on = i === current && i !== last
        const color = done ? '#12B39C' : on ? '#123644' : '#C5D3CF'
        return (
          <li key={s} aria-current={i === current ? 'step' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && <span aria-hidden style={{ position: 'absolute', top: dot / 2 - 1, right: '50%', width: '100%', height: 2, background: i <= current ? '#12B39C' : '#DCE5E3' }} />}
            <span aria-hidden style={{
              position: 'relative', width: dot, height: dot, borderRadius: '50%', background: done ? '#12B39C' : '#fff',
              border: `2px solid ${color}`, boxSizing: 'border-box', display: 'grid', placeItems: 'center',
              boxShadow: on ? '0 0 0 4px rgba(18,179,156,.22)' : undefined,
            }}>
              {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </span>
            <span style={{ fontSize: compact ? 9.5 : 9.5, fontWeight: on ? 700 : 600, color: on ? '#123644' : done ? '#0B8374' : '#4E6470', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
              {s}{done ? <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> (fait)</span> : null}
            </span>
            {times?.[i] && <span style={{ fontSize: 9, color: '#4E6470', fontVariantNumeric: 'tabular-nums' }}>{times[i]}</span>}
          </li>
        )
      })}
    </ol>
  )
}

// Frise de suivi prête à poser (chat, agenda) : rien pour une mission annulée ou dont le tarif
// n'est pas encore validé (ce n'est pas encore une mission).
export function MissionSuivi({ tx, invoiced, compact, airy }: { tx: any; invoiced?: boolean; compact?: boolean; airy?: boolean }) {
  if (!tx || tx.status === 'cancelled' || !tx.price_confirmed) return null
  return <MissionTimeline steps={SUIVI_STEPS} current={suiviIndex(tx, invoiced)} compact={compact} label="Suivi de la mission" airy={airy} />
}
