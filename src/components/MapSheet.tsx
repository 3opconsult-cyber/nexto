"use client"
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

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
// Le volet se pose aussi au-dessus du bandeau d'action de la barre du bas (--banner-h : mission, réservation,
// avis) : il ne le recouvre jamais, et le bandeau ne cache jamais la liste.
const INSTALL = 'var(--ping-install-lift, 0px)'
const BANNER = 'var(--banner-h, 0px)'
const LIFT = `calc(${INSTALL} + ${BANNER})`
export const SHEET_H: Record<SheetSnap, string> = {
  peek: `${PEEK_PX}px`,
  half: `${HALF * 100}%`,
  full: `calc(100% - 64px - ${LIFT})`,
}
/** Décalage du bas (bandeau d'installation + bandeau d'action de la barre du bas) à ajouter aux `bottom` des boutons de la carte. */
export const SHEET_LIFT = LIFT
/** Hauteur CSS d'une position ; `peek` = hauteur du volet replié (64 px par défaut). */
export function sheetH(snap: SheetSnap, peek = PEEK_PX) {
  return snap === 'peek' ? `${peek}px` : SHEET_H[snap]
}
/** Ligne de fin de liste : ouvre le volet « Cette page, ça va ? » (la bulle flottante est masquée sur la carte mobile). */
export function SheetFeedbackRow() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('ping-feedback'))}
      style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 8, border: 0, background: 'none', color: '#4E6470', fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center' }}>
      Laisser un commentaire sur cette page
    </button>
  )
}
const ORDER: SheetSnap[] = ['peek', 'half', 'full']
const NEXT: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'peek' }

function liftPx() {
  try {
    const cs = getComputedStyle(document.documentElement)
    return (parseFloat(cs.getPropertyValue('--ping-install-lift')) || 0) + (parseFloat(cs.getPropertyValue('--banner-h')) || 0)
  } catch { return 0 }
}

/**
 * État de la feuille mémorisé par écran (`key`, ex. « map », « pro-carte »), dans le navigateur.
 * Lu après le montage (le rendu serveur reste identique). « Plein » n'est jamais rouvert tel quel :
 * la carte ne doit pas disparaître à l'ouverture, on revient à mi-hauteur.
 */
export function useSheetSnap(key: string, initial: SheetSnap = 'peek'): [SheetSnap, (s: SheetSnap) => void] {
  const [snap, setSnapState] = useState<SheetSnap>(initial)
  const k = `ping_sheet_${key}`
  useEffect(() => {
    try {
      const v = localStorage.getItem(k)
      if (v === 'peek' || v === 'half') setSnapState(v)
      else if (v === 'full') setSnapState('half')
    } catch { /* stockage indisponible : état par défaut */ }
  }, [k])
  const setSnap = useCallback((s: SheetSnap) => {
    setSnapState(s)
    try { localStorage.setItem(k, s) } catch { /* rien */ }
  }, [k])
  return [snap, setSnap]
}
/** Hauteur en pixels d'une position du volet, pour un conteneur de hauteur `h`. */
export function sheetPx(snap: SheetSnap, h: number, peek = PEEK_PX) {
  if (snap === 'peek') return peek
  if (snap === 'half') return Math.round(h * HALF)
  return Math.max(peek, h - 64 - liftPx())
}

export default function MapSheet({ snap, onSnap, title, accent = 'var(--slate)', children, footer, peek = PEEK_PX }: {
  snap: SheetSnap
  /** Hauteur du volet replié, en px (défaut 64 : poignée + titre). /map la monte pour laisser voir la 1re ligne. */
  peek?: number
  onSnap: (s: SheetSnap) => void
  title: ReactNode
  accent?: string
  children: ReactNode
  /** Boutons d'action toujours visibles en bas du volet (hors défilement), dès la mi-hauteur. */
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; h0: number; moved: number } | null>(null)
  const dragged = useRef(false)
  const hint = snap === 'peek' ? 'Afficher' : snap === 'half' ? 'Agrandir' : 'Réduire'

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
    el.style.height = `${Math.max(peek, Math.min(sheetPx('full', parentH, peek), d.h0 + (d.y0 - e.clientY)))}px`
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
      const dd = Math.abs(sheetPx(s, parentH, peek) - h)
      if (dd < bestD) { bestD = dd; best = s }
    }
    el.style.height = sheetH(best, peek)
    onSnap(best)
  }

  return (
    <div ref={ref} className="map-sheet" data-snap={snap}
      style={{ position: 'absolute', left: 0, right: 0, bottom: LIFT, height: sheetH(snap, peek), zIndex: 40, background: '#fff', borderRadius: '22px 22px 0 0', boxShadow: '0 -14px 36px rgba(20,50,60,.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'height .25s ease' }}>
      <button type="button" aria-expanded={snap !== 'peek'} aria-label={snap === 'peek' ? 'Afficher la liste' : 'Réduire ou agrandir la liste'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={() => { if (dragged.current) { dragged.current = false; return } onSnap(NEXT[snap]) }}
        style={{ flex: '0 0 auto', width: '100%', border: 0, background: 'transparent', padding: '8px 16px 6px', minHeight: 44, cursor: 'grab', touchAction: 'none', textAlign: 'left', fontFamily: 'inherit' }}>
        <i style={{ display: 'block', width: 40, height: 5, borderRadius: 3, background: '#CBD7D4', margin: '0 auto 8px' }} />
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>
          <b style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>
          <small style={{ color: accent, fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{hint}</small>
        </span>
      </button>
      {/* Réduite : poignée + une ligne de résumé seulement, le contenu n'apparaît pas sous la ligne. */}
      <div aria-hidden={snap === 'peek'} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px', visibility: snap === 'peek' ? 'hidden' : 'visible' }}>
        {children}
      </div>
      {footer && snap !== 'peek' && (
        <div style={{ flex: '0 0 auto', padding: '10px 16px 12px', borderTop: '1px solid var(--line, #E7EDEB)', background: '#fff' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
