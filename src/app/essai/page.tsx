"use client"
import { useRef, useState } from 'react'
import { Wordmark } from '@/components/Brand'
import QrCode from '@/components/QrCode'

/**
 * Page de briefing pour les testeurs, partageable par lien (WhatsApp...).
 * v2 : la v1 réutilisait l'habillage de la campagne publicitaire "Et si...?"
 * (device, échos radar, accroches courtes) — Romain voulait un vrai
 * message d'explication à lui, pas une pub, et un lien vers la vraie
 * application qui tourne, pas une expérience recréée à côté. Le texte des
 * 3 écrans reprend le sien, quasi mot pour mot.
 */
const APP_URL = 'https://nexto-eta.vercel.app/auth/signup'
const SHARE_URL = 'https://nexto-eta.vercel.app/l/beta'
const SHARE_TEXT = `Salut ! Merci de tester cette nouvelle application, bientôt en ligne — 2 minutes, particulier ou pro : ${SHARE_URL}`

const SLIDES = [
  {
    title: 'Salut !',
    body: 'Merci de tester cette appli avant son lancement.\n\nVos retours et critiques à la fin — tout est bon à dire.',
  },
  {
    title: 'Testez les deux côtés',
    body: '🧹 Pro — ménage, nettoyage, propreté. Choisissez le statut qui vous parle.\n\n🔍 Particulier — vous cherchez ce type de service.\n\nDans les deux cas : allez jusqu’à la simulation de validation.',
  },
  {
    title: 'Aucun paiement réel',
    body: 'Aucun paiement, aucune transaction validée — juste un test de fluidité.',
  },
]

export default function Essai() {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const total = SLIDES.length
  const isAction = i === SLIDES.length - 1

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

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
        <Wordmark size={18} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: total }).map((_, s) => (
            <div key={s} style={{ width: s === i ? 22 : 8, height: 8, borderRadius: 999, background: s === i ? '#12B39C' : '#E7EDEB', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 28px', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={i} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'}>
          {isAction ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644' }}>{SLIDES[i].title}</h1>
              <p style={{ fontSize: 14.5, color: '#6E8592', lineHeight: 1.6, marginTop: 12, maxWidth: 340, whiteSpace: 'pre-line' }}>{SLIDES[i].body}</p>

              <a href={APP_URL}
                style={{ display: 'block', width: '100%', maxWidth: 320, marginTop: 28, padding: 16, borderRadius: 999, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
                Je m’inscris et je teste →
              </a>

              <div style={{ marginTop: 24, padding: 14, background: '#fff', borderRadius: 18, boxShadow: '0 2px 10px rgba(18,54,68,.06)' }}>
                <QrCode data={SHARE_URL} size={110} />
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Ou montrez ce code à quelqu’un à côté de vous</p>

              <div style={{ width: '100%', maxWidth: 300, height: 1, background: '#E7EDEB', margin: '26px 0 20px' }} />

              <p style={{ fontSize: 13.5, color: '#6E8592', lineHeight: 1.5, maxWidth: 300 }}>
                Faites suivre à 3-4 proches — même lien, même message.
              </p>
              <button onClick={shareWhatsapp}
                style={{ width: '100%', maxWidth: 300, marginTop: 12, padding: 14, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="#12B39C"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 3 4.7 4.1.7.3 1.2.4 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>
                Partager sur WhatsApp
              </button>

              <a href="/essai/avis" style={{ marginTop: 20, fontSize: 13, color: '#6E8592', fontWeight: 600, textDecoration: 'underline' }}>
                Donner mon avis après le test →
              </a>
            </div>
          ) : (
            <div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 25, color: '#123644' }}>{SLIDES[i].title}</h1>
              <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 16, whiteSpace: 'pre-line' }}>{SLIDES[i].body}</p>
            </div>
          )}
        </div>
      </div>

      {!isAction && (
        <div style={{ padding: '0 28px 40px' }}>
          <button onClick={() => go(i + 1)}
            style={{ width: '100%', padding: 16, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
            Suivant
          </button>
        </div>
      )}
      {isAction && <div style={{ height: 40 }} />}
    </div>
  )
}
