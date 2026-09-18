"use client"
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sign } from '@/components/Brand'
import QrCode from '@/components/QrCode'

/**
 * Page unique, partageable par lien (WhatsApp, SMS...) — pas une capture
 * d'écran, une vraie page qui se balaye au doigt. Demande de Romain : un
 * support simple à envoyer, qui montre les 3 écrans puis invite à tester
 * l'app et à faire suivre à 3-4 proches (parrainage) et à donner un avis.
 */
const SHARE_URL = 'https://nexto-eta.vercel.app/l/beta'
const SHARE_TEXT = `Salut ! Je teste PING, une appli de mise en relation pour des services de ménage/nettoyage près de chez soi — 2 minutes, en tant que particulier ou pro : ${SHARE_URL}`

const SLIDES = [
  {
    kicker: 'Vous êtes un particulier ?',
    q: 'Et si ce que vous cherchez se trouvait juste à côté ?',
    dark: true,
  },
  {
    kicker: 'Vous êtes un pro ?',
    q: 'Et si votre client était à quelques mètres ?',
    dark: false,
  },
]

export default function Essai() {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const total = SLIDES.length + 1
  const isReveal = i === SLIDES.length

  function go(next: number) {
    if (next < 0 || next >= total) return
    setDir(next > i ? 'r' : 'l')
    setI(next)
  }

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) go(i + 1); else go(i - 1)
  }

  function shareWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`, '_blank')
  }

  const dark = !isReveal && SLIDES[i].dark
  const bg = dark ? '#123644' : isReveal ? '#123644' : '#F3F6F5'

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: total }).map((_, s) => (
            <div key={s} style={{ width: s === i ? 22 : 8, height: 8, borderRadius: 999, background: s === i ? '#12B39C' : (dark || isReveal) ? 'rgba(255,255,255,.25)' : '#DCE5E3', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
        {!isReveal && (
          <button onClick={() => router.push('/map')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: dark ? 'rgba(255,255,255,.5)' : '#6E8592', cursor: 'pointer' }}>
            Passer
          </button>
        )}
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 32px', textAlign: 'center', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={i} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {isReveal ? (
            <>
              <Sign size={84} pulse />
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 44, color: '#fff', marginTop: 22 }}>ping</div>

              <button onClick={() => router.push('/map')}
                style={{ width: '100%', maxWidth: 320, marginTop: 34, padding: 16, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
                Tester l'application →
              </button>

              <div style={{ marginTop: 26, padding: 16, background: '#fff', borderRadius: 20 }}>
                <QrCode data={SHARE_URL} size={120} />
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.45)', marginTop: 10 }}>Ou montrez ce code à quelqu'un à côté de vous</p>

              <div style={{ width: '100%', maxWidth: 320, height: 1, background: 'rgba(255,255,255,.14)', margin: '30px 0 24px' }} />

              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.5, maxWidth: 300 }}>
                Invitez 3 ou 4 proches à tester avec vous — même lien, même message.
              </p>
              <button onClick={shareWhatsapp}
                style={{ width: '100%', maxWidth: 320, marginTop: 14, padding: 15, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.06)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 3 4.7 4.1.7.3 1.2.4 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>
                Partager sur WhatsApp
              </button>

              <a href="/essai/avis" style={{ marginTop: 22, fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 600, textDecoration: 'underline' }}>
                Donner mon avis après le test →
              </a>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '.08em', textTransform: 'uppercase', color: '#4FD3BE' }}>
                {SLIDES[i].kicker}
              </div>
              <div style={{ marginTop: 30 }}><Sign size={72} ring={SLIDES[i].dark ? '#4FD3BE' : '#12B39C'} pulse /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 27, lineHeight: 1.25, marginTop: 26, maxWidth: 320, color: SLIDES[i].dark ? '#fff' : '#123644' }}>
                {SLIDES[i].q}
              </h1>
            </>
          )}
        </div>
      </div>

      {!isReveal && (
        <div style={{ padding: '0 28px 40px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => go(i + 1)}
            style={{ width: '100%', maxWidth: 340, padding: 16, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
            Suivant
          </button>
        </div>
      )}
      {isReveal && <div style={{ height: 40 }} />}
    </div>
  )
}
