"use client"
import { useRef, useState } from 'react'

/**
 * Accueil du particulier juste après l'inscription : 3 écrans à glisser (ou à suivre au bouton),
 * montrés une seule fois (localStorage `ping_welcome_seen`), puis `onDone` envoie vers la carte.
 * Aucune mention de séquestre ni de paiement en ligne : seulement ce que l'application fait déjà.
 */
const SEEN_KEY = 'ping_welcome_seen'

export function welcomeSeen(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}
function markSeen() {
  try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* stockage indisponible : l'écran pourra revenir */ }
}

const ICON = { width: 44, height: 44, viewBox: '0 0 24 24', fill: 'none', stroke: '#12B39C', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const SLIDES = [
  {
    title: 'Dites ce dont vous avez besoin',
    text: 'Ménage, repassage, nettoyage : décrivez votre besoin en quelques lignes, ou choisissez directement un prestataire sur la carte.',
    icon: (
      <svg {...ICON} aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></svg>
    ),
  },
  {
    title: 'Comparez les propositions et fixez le prix',
    text: 'Les prestataires proches de vous répondent. Comparez, discutez dans la messagerie, puis validez le tarif : il ne change plus ensuite.',
    icon: (
      <svg {...ICON} aria-hidden="true"><path d="M12 3v18M5 7h14" /><path d="M5 7l-3 7a3.2 3.2 0 0 0 6 0L5 7zM19 7l-3 7a3.2 3.2 0 0 0 6 0l-3-7z" /></svg>
    ),
  },
  {
    title: 'Réglez après l’intervention, facture automatique',
    text: 'Vous pointez l’arrivée et la fin avec un QR code. La facture est générée toute seule, et vous pouvez laisser un avis.',
    icon: (
      <svg {...ICON} aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
    ),
  },
]

export default function WelcomeCarousel({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const touchX = useRef<number | null>(null)
  const last = i === SLIDES.length - 1

  function finish() { markSeen(); onDone() }
  function go(n: number) {
    if (n < 0 || n >= SLIDES.length || n === i) return
    setDir(n > i ? 'r' : 'l')
    setI(n)
  }
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0) { if (last) finish(); else go(i + 1) }
    else go(i - 1)
  }

  const s = SLIDES[i]
  return (
    <div role="dialog" aria-label="Bienvenue sur PING" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Inter, sans-serif', padding: '18px 24px 28px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={finish}
          style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,.8)', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, padding: '8px 4px', cursor: 'pointer' }}>
          Passer
        </button>
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: 380, display: 'flex', alignItems: 'center' }}>
        <div key={i} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'}
          style={{ width: '100%', background: '#fff', borderRadius: 24, padding: '34px 26px 30px', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: 'rgba(18,179,156,.12)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            {s.icon}
          </div>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, lineHeight: 1.25, color: '#123644', margin: '0 0 10px' }}>{s.title}</h1>
          <p style={{ fontSize: 14, color: '#4E6470', lineHeight: 1.6, margin: 0 }}>{s.text}</p>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 18 }} role="tablist" aria-label="Étapes">
          {SLIDES.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Écran ${n + 1} sur ${SLIDES.length}`} onClick={() => go(n)}
              style={{ width: n === i ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: n === i ? '#12B39C' : 'rgba(255,255,255,.3)', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
        <button type="button" onClick={() => (last ? finish() : go(i + 1))}
          style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
          {last ? 'Découvrir la carte' : 'Suivant'}
        </button>
      </div>
    </div>
  )
}
