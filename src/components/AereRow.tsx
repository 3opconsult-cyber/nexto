"use client"
import type { ReactNode } from 'react'

// Ligne de liste aérée (écrans du particulier, 24/11/2026) : pictogramme, titre, une ligne d'info, flèche.
// Séparateur fin dessiné par la feuille aere.css (classe .a-row), pas de cadre. Le parent porte la classe .aere.
export function AereRow({ icon, label, sub, badge, onClick }: {
  icon?: ReactNode; label: string; sub?: string
  badge?: { text: string; tone: 'ok' | 'todo' }
  onClick?: () => void
}) {
  return (
    <button type="button" className="a-row" onClick={onClick}>
      {icon && (
        <span className="a-ic" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </span>
      )}
      <span className="a-tx">
        <span className="a-t">{label}</span>
        {sub && <span className="a-s">{sub}</span>}
      </span>
      {badge && <span className={`a-pill${badge.tone === 'ok' ? ' ok' : ''}`}>{badge.text}</span>}
      {onClick && <span className="a-chev" aria-hidden>›</span>}
    </button>
  )
}
