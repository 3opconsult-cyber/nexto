"use client"
import type { CancellationState } from '@/lib/cancellation'

/** Styles et petits éléments partagés par MissionActions et MissionSheets (fenêtres chargées à la demande). */
export const C = { navy: '#123644', teal: '#0B8374', danger: '#C0503A', slate: '#4E6470', line: '#DCE5E3', amber: '#B54708', amberBg: '#FFF7ED', amberLine: '#F2A93B' }
export const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  minHeight: 44, padding: '0 16px', borderRadius: 999, border: border ? `1.5px solid ${border}` : 'none', background: bg, color: fg,
  fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})
export const card: React.CSSProperties = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '12px 14px' }
export const p: React.CSSProperties = { fontSize: 13, color: C.navy, lineHeight: 1.5, margin: '0 0 10px' }

export const patchOf = (st: CancellationState): Record<string, unknown> => ({
  status: st.status, scheduled_at: st.scheduled_at,
  ...(st.cancelled ? { cancel_tier: st.cancelled.tier, cancel_reason_kind: st.cancelled.reason_kind, cancel_reason_text: st.cancelled.reason_text, cancel_fee_cents: st.cancelled.fee_cents, cancelled_at: st.cancelled.at } : {}),
})

export const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>{children}</div>
