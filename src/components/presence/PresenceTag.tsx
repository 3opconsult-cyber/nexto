"use client"
import { presenceTagLabel, type ClientPresence } from '@/lib/presence'

/**
 * Pastille « Client sur place » / « Client absent » (prestataire) ou « Vous serez sur place / absent » (client),
 * sur le billet de mission : chat, Agenda, Messages, Mission du jour (migration 048).
 */
export default function PresenceTag({ presence, asSeller, onDark = false }: { presence: ClientPresence | null | undefined; asSeller: boolean; onDark?: boolean }) {
  const l = presenceTagLabel(presence, asSeller)
  const bg = l.warn ? '#FFF1DC' : l.none ? (onDark ? 'rgba(255,255,255,.16)' : '#EEF2F1') : '#DDF5F0'
  const fg = l.warn ? '#8A5A10' : l.none ? (onDark ? '#fff' : '#4E6470') : '#0A6F62'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        {presence === 'absent'
          ? <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>
          : presence === 'sur_place'
            ? <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>
            : <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>}
      </svg>
      {l.text}
    </span>
  )
}
