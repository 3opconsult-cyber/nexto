"use client"
import type { Mode } from '@/lib/mode'

// Compte à la fois client et prestataire (comme voyageur / hôte sur Airbnb) : la page n'affiche que
// l'espace courant. Quand quelque chose attend dans l'autre espace, une cloche avec point rouge le
// signale — sans bouton : on change d'espace uniquement depuis le menu, qui bascule toute l'interface
// (décision Romain 30/10, « sinon on va perdre le navigant »).
export default function ModeHint({ mode, otherCount, what }: { mode: Mode; otherCount: number; what: string; onSwitch?: () => void }) {
  if (otherCount <= 0) return null
  const other = mode === 'pro' ? 'particulier' : 'prestataire'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
      <span style={{ position: 'relative', display: 'inline-flex', color: '#123644', flexShrink: 0 }} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 999, background: '#E5484D', border: '1.5px solid #fff' }} />
      </span>
      <span style={{ fontSize: 12.5, color: '#123644', lineHeight: 1.45 }}>
        <b>{otherCount} {what}</b> dans votre espace {other}. Passez-y depuis le menu.
      </span>
    </div>
  )
}
