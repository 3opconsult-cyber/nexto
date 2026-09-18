"use client"
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sign } from '@/components/Brand'

/**
 * Premier écran vu par un particulier juste après son inscription — avant,
 * il atterrissait directement sur /map sans un mot d'explication, alors que
 * le pro a un wizard complet. Carrousel court (3 écrans), balayable au
 * doigt ou au clic, pour donner le mode d'emploi avant la première carte.
 */
const SLIDES = [
  {
    title: 'Ouvrez la carte',
    text: 'Les prestataires disponibles s’affichent autour de vous, avec leur tarif.',
  },
  {
    title: 'Tarif affiché, aucune surprise',
    text: 'Vous savez ce que vous payez avant de réserver. Un devis à négocier ? Vous validez avant que ça démarre.',
  },
  {
    title: 'Arrivée et départ validés',
    text: 'Un code scanné à l’arrivée, un autre au départ — la durée réelle est enregistrée, pour vous comme pour le prestataire.',
  },
]

export default function Welcome() {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const isLast = i === SLIDES.length - 1

  function go(next: number) {
    if (next < 0 || next >= SLIDES.length) return
    setDir(next > i ? 'r' : 'l')
    setI(next)
  }
  function cta() { if (isLast) router.push('/map'); else go(i + 1) }

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) { if (isLast) router.push('/map'); else go(i + 1) }
    else go(i - 1)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 20px 0' }}>
        <button onClick={() => router.push('/map')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Passer
        </button>
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={i} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 34 }}><Sign size={84} pulse /></div>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 25, color: '#fff', lineHeight: 1.25, maxWidth: 300 }}>
            {SLIDES[i].title}
          </h1>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginTop: 14, maxWidth: 300 }}>
            {SLIDES[i].text}
          </p>
        </div>
      </div>

      <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {SLIDES.map((_, s) => (
            <button key={s} onClick={() => go(s)} aria-label={`Aller à l'écran ${s + 1}`}
              style={{ width: s === i ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, background: s === i ? '#12B39C' : 'rgba(255,255,255,.25)', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
        <button onClick={cta}
          style={{ width: '100%', maxWidth: 340, padding: 16, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
          {isLast ? 'Découvrir la carte →' : 'Suivant'}
        </button>
      </div>
    </div>
  )
}
