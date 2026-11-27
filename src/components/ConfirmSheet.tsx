"use client"
import { useEffect, useRef, useState } from 'react'

/**
 * Fenêtre de confirmation PING (remplace confirm() / prompt() natifs, carnet A-026).
 * Au-dessus de la barre du bas (z-index 3000), deux boutons de 44 px, Échap et fond = annuler.
 * Rien n'est envoyé sans clic explicite sur le bouton de confirmation.
 * Option `input` : un champ texte (remplace prompt()) ; sa valeur est passée à onConfirm.
 */
const C = { navy: '#123644', danger: '#B3402F', teal: '#0B8374', line: '#DCE5E3', slate: '#4E6470' }
const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  flex: 1, minHeight: 44, padding: '0 14px', borderRadius: 999, border: border ? `1.5px solid ${border}` : 'none', background: bg, color: fg,
  fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})

export default function ConfirmSheet({ open, title, text, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false, busy = false, input, onConfirm, onCancel }: {
  open: boolean; title: string; text?: React.ReactNode
  confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean
  input?: { label: string; placeholder?: string; inputMode?: 'text' | 'decimal' }
  onConfirm: (value: string) => void; onCancel: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!open) return
    setValue('')
    const prev = document.activeElement as HTMLElement | null
    boxRef.current?.focus({ preventScroll: true })
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelRef.current() }
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('keydown', k); try { prev?.focus?.({ preventScroll: true }) } catch { /* élément disparu */ } }
  }, [open])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget && !busy) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,54,68,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={boxRef} tabIndex={-1} style={{ outline: 'none', width: '100%', maxWidth: 520, background: '#fff', borderRadius: '18px 18px 0 0', padding: '16px 16px calc(18px + env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{title}</div>
        {text && <p style={{ fontSize: 13, color: C.navy, lineHeight: 1.5, margin: '0 0 12px' }}>{text}</p>}
        {input && (
          <label style={{ display: 'block', fontSize: 12.5, color: C.slate, margin: '0 0 12px' }}>
            {input.label}
            <input value={value} onChange={e => setValue(e.target.value)} placeholder={input.placeholder} inputMode={input.inputMode}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 44, marginTop: 4, padding: '0 12px', border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} style={btn('#fff', C.navy, C.line)} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" disabled={busy} style={btn(danger ? C.danger : C.teal, '#fff')} onClick={() => onConfirm(value)}>{busy ? 'Un instant…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
