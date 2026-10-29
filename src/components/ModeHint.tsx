"use client"
import type { Mode } from '@/lib/mode'

// Rappelle dans quel espace on se trouve et signale ce qui attend dans l'autre, comme le
// « Passer en mode hôte » d'Airbnb. N'apparaît que pour un compte à la fois client et prestataire.
export default function ModeHint({ mode, otherCount, what, onSwitch }: { mode: Mode; otherCount: number; what: string; onSwitch: () => void }) {
  const other = mode === 'pro' ? 'particulier' : 'prestataire'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '4px 9px', borderRadius: 999, background: mode === 'pro' ? '#123644' : 'rgba(18,179,156,.14)', color: mode === 'pro' ? '#fff' : '#0C8F7E', flexShrink: 0 }}>
        {mode === 'pro' ? 'Espace prestataire' : 'Espace particulier'}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#6E8592' }}>
        {otherCount > 0 ? `${otherCount} ${what} côté ${other}` : `Rien côté ${other}`}
      </span>
      {otherCount > 0 && (
        <button onClick={onSwitch} style={{ border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          Voir
        </button>
      )}
    </div>
  )
}
