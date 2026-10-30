"use client"
import type { Mode } from '@/lib/mode'

// Bascule d'espace pour un compte à la fois client et prestataire (comme voyageur / hôte sur Airbnb) :
// deux onglets, et une cloche avec point rouge sur l'autre espace quand quelque chose l'y attend.
// Chaque espace reste séparé : basculer change ce que la page affiche, rien n'est mélangé.
export default function ModeHint({ mode, otherCount, what, onSwitch }: { mode: Mode; otherCount: number; what: string; onSwitch: () => void }) {
  const tab = (m: Mode, label: string) => {
    const on = mode === m
    const alert = !on && otherCount > 0
    return (
      <button onClick={on ? undefined : onSwitch} aria-pressed={on}
        title={alert ? `${otherCount} ${what} côté ${m === 'pro' ? 'prestataire' : 'particulier'}` : undefined}
        style={{
          flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none',
          borderRadius: 999, padding: '7px 12px', cursor: on ? 'default' : 'pointer',
          background: on ? (m === 'pro' ? '#123644' : '#12B39C') : 'transparent',
          color: on ? '#fff' : '#6E8592', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5,
        }}>
        {label}
        {alert && (
          <span style={{ position: 'relative', display: 'inline-flex' }} aria-label={`${otherCount} en attente`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            <span style={{ position: 'absolute', top: -2, right: -3, minWidth: 8, height: 8, borderRadius: 999, background: '#E5484D', border: '1.5px solid #fff' }} />
          </span>
        )}
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 999, width: '100%', maxWidth: 320 }}>
        {tab('particulier', 'Particulier')}
        {tab('pro', 'Prestataire')}
      </div>
    </div>
  )
}
