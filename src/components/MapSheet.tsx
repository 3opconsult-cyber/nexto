"use client"
import { useRef, type ReactNode } from 'react'

// Volet du bas des cartes (/map, /pro/carte), comme la maquette : 3 positions.
// - replié (peek) : seule la poignée et le titre dépassent ;
// - mi-hauteur (half) : la liste et la carte se partagent l'écran ;
// - plein (full) : la liste, jusque sous la barre du haut.
// Toucher la poignée fait passer à la position suivante ; la glisser la suit puis se cale
// sur la position la plus proche (un glisser n'est jamais compté comme un toucher).
// Le volet se pose au-dessus du bandeau d'installation (--ping-install-lift, InstallPrompt).
// Masqué sur ordinateur (>= 1000 px) : la carte y a son panneau latéral.
export type SheetSnap = 'peek' | 'half' | 'full'
const PEEK_PX = 64
const HALF = 0.45
const LIFT = 'var(--ping-install-lift, 0px)'
export const SHEET_H: Record<SheetSnap, string> = {
  peek: `${PEEK_PX}px`,
  half: `${HALF * 100}%`,
  full: `calc(100% - 64px - ${LIFT})`,
}
export const SHEET_LIFT = LIFT
const ORDER: SheetSnap[] = ['peek', 'half', 'full']
const NEXT: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'peek' }

function liftPx() {
  try { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ping-install-lift')) || 0 } catch { return 0 }
}
/** Hauteur en pixels d'une position du volet, pour un conteneur de hauteur `h`. */
export function sheetPx(snap: SheetSnap, h: number) {
  if (snap === 'peek') return PEEK_PX
  if (snap === 'half') return Math.round(h * HALF)
  return Math.max(PEEK_PX, h - 64 - liftPx())
}

export default function MapSheet({ snap, onSnap, title, accent = 'var(--slate)', children }: {
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  title: ReactNode
  accent?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; h0: number; moved: number } | null>(null)
  const dragged = useRef(false)
  const hint = snap === 'peek' ? 'Afficher la liste' : snap === 'half' ? 'Agrandir' : 'Réduire'

  function down(e: React.PointerEvent) {
    const el = ref.current
    if (!el) return
    drag.current = { y0: e.clientY, h0: el.offsetHeight, moved: 0 }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { }
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, el = ref.current
    if (!d || !el) return
    d.moved = Math.abs(d.y0 - e.clientY)
    if (d.moved < 6) return
    const parentH = el.parentElement?.clientHeight || window.innerHeight
    el.style.transition = 'none'
    el.style.height = `${Math.max(PEEK_PX, Math.min(sheetPx('full', parentH), d.h0 + (d.y0 - e.clientY)))}px`
  }
  function up() {
    const d = drag.current, el = ref.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ''
    if (d.moved < 6) return
    dragged.current = true
    setTimeout(() => { dragged.current = false }, 350)
    const parentH = el.parentElement?.clientHeight || window.innerHeight
    const h = el.offsetHeight
    let best: SheetSnap = snap
    let bestD = Infinity
    for (const s of ORDER) {
      const dd = Math.abs(sheetPx(s, parentH) - h)
      if (dd < bestD) { bestD = dd; best = s }
    }
    el.style.height = SHEET_H[best]
    onSnap(best)
  }

  return (
    <div ref={ref} className="map-sheet" data-snap={snap}
      style={{ position: 'absolute', left: 0, right: 0, bottom: LIFT, height: SHEET_H[snap], zIndex: 40, background: '#fff', borderRadius: '22px 22px 0 0', boxShadow: '0 -14px 36px rgba(20,50,60,.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'height .25s ease' }}>
      <button type="button" aria-expanded={snap !== 'peek'} aria-label={snap === 'peek' ? 'Afficher la liste' : 'Réduire ou agrandir la liste'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={() => { if (dragged.current) { dragged.current = false; return } onSnap(NEXT[snap]) }}
        style={{ flex: '0 0 auto', width: '100%', border: 0, background: 'transparent', padding: '8px 16px 6px', cursor: 'grab', touchAction: 'none', textAlign: 'left', fontFamily: 'inherit' }}>
        <i style={{ display: 'block', width: 40, height: 5, borderRadius: 3, background: '#CBD7D4', margin: '0 auto 8px' }} />
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>
          <b style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>
          <small style={{ color: accent, fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{hint}</small>
        </span>
      </button>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {children}
      </div>
    </div>
  )
}
