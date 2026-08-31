"use client"
import { useEffect, useRef } from 'react'

/**
 * Coque de fenêtre modale, à la charte PING.
 *
 * Elle sert les trois pop-up du parcours : paiement en attente, avis de fin de
 * mission, départ du prestataire. Une seule implémentation, pour que le fond,
 * les arrondis et le comportement clavier soient identiques partout.
 *
 * Échap ferme, le focus reste dans la boîte, le fond ne défile pas derrière.
 */
export default function Modal({
  open, onClose, title, children, footer, dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** false = la décision est obligatoire : ni Échap, ni clic sur le fond. */
  dismissable?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    box.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissable) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, dismissable, onClose])

  if (!open) return null

  return (
    <div
      onClick={() => dismissable && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(11,31,39,.62)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', padding: 0,
      }}
    >
      <div
        ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', width: '100%', maxWidth: 480, outline: 'none',
          borderRadius: '22px 22px 0 0', maxHeight: '92vh', display: 'flex',
          flexDirection: 'column', fontFamily: 'Inter, sans-serif', color: '#123644',
          animation: 'pingSheetUp .26s cubic-bezier(.2,.8,.3,1)',
        }}
      >
        <style>{`
          @keyframes pingSheetUp{from{transform:translateY(18px);opacity:.4}to{transform:none;opacity:1}}
          @media (prefers-reduced-motion:reduce){[role=dialog]{animation:none!important}}
        `}</style>

        <div style={{ padding: '9px 0 0', flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: '#DCE5E3', margin: '0 auto' }} />
        </div>

        {title && (
          <h2 style={{
            fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18.5,
            letterSpacing: '-.01em', margin: '16px 20px 0', lineHeight: 1.25,
          }}>{title}</h2>
        )}

        <div style={{ padding: '12px 20px 4px', overflowY: 'auto', flex: 1 }}>{children}</div>

        {footer && (
          <div style={{
            padding: '12px 20px calc(16px + env(safe-area-inset-bottom,0px))',
            borderTop: '1px solid #F0F4F3', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>{footer}</div>
        )}
      </div>
    </div>
  )
}

/** Bouton principal, à la charte. */
export function Cta({
  children, onClick, variant = 'teal', disabled,
}: {
  children: React.ReactNode; onClick?: () => void
  variant?: 'teal' | 'dark' | 'ghost'; disabled?: boolean
}) {
  const styles = {
    teal:  { background: '#12B39C', color: '#fff', boxShadow: '0 8px 18px rgba(18,179,156,.28)' },
    dark:  { background: '#123644', color: '#fff', boxShadow: '0 8px 18px rgba(18,54,68,.22)' },
    ghost: { background: '#fff', color: '#123644', boxShadow: '0 0 0 1px #DCE5E3' },
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', border: 'none', padding: 14, borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5,
      opacity: disabled ? .45 : 1, ...styles, ...(disabled ? { boxShadow: 'none' } : {}),
    }}>{children}</button>
  )
}
