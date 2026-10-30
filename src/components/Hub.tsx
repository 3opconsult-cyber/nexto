"use client"
import type { ReactNode } from 'react'

// Rubriques de « Mon entreprise » (pro) et « Mon profil » (particulier) : même présentation des deux
// côtés, comme le menu Profil d'Airbnb — un titre de groupe, puis des lignes pictogramme + titre +
// sous-titre + chevron. Le menu latéral ne garde que l'essentiel ; tout le reste est rangé ici.
export function HubGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px 2px' }}>{title}</div>
      <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

export function HubRow({ icon, label, sub, badge, onClick }: {
  icon: ReactNode; label: string; sub?: string
  badge?: { text: string; tone: 'ok' | 'todo' }
  onClick?: () => void
}) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid #EEF2F1', cursor: onClick ? 'pointer' : 'default', marginTop: -1 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, flexShrink: 0, background: badge.tone === 'ok' ? 'rgba(18,179,156,.14)' : 'rgba(242,169,59,.16)', color: badge.tone === 'ok' ? '#0C8F7E' : '#9A6712' }}>{badge.text}</span>
      )}
      {onClick && <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>}
    </div>
  )
}

// Pictogrammes partagés (tracés SVG, jamais d'emoji).
export const HUB_ICONS = {
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  alert: <><path d="M12 2 2 21h20z" /><path d="M12 9v5M12 18h.01" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></>,
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  card: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  pin: <><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h4M7 14h7" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  gift: <><path d="M20 12v9H4v-9" /><path d="M2 7h20v5H2zM12 22V7" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>,
  list: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /></>,
  heart: <path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  euro: <path d="M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9" />,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
}
