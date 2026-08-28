"use client"
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sign } from '@/components/Brand'

type Mode = 'particulier' | 'pro'
type Slide = { kicker: string; title: string; body: string; icon?: string; cards?: { icon: string; title: string; body: string }[] }

const ICONS: Record<string, JSX.Element> = {
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  click: <><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2" /></>,
  shield: <><path d="M12 2l8 3v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5c0-1.5 1.5-2 3-2s3 .8 3 2-1.5 2-3 2-3 .5-3 2 1.5 2 3 2 3-.5 3-2" /></>,
  radar: <><circle cx="12" cy="12" r="2.3" fill="#2FD06E" stroke="none" /><path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.4 7.4l1.4 1.4M15.2 15.2l1.4 1.4M7.4 16.6l1.4-1.4M15.2 8.8l1.4-1.4" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2FD06E" strokeWidth="2">{ICONS[name]}</svg>
}

const SLIDES: Record<Mode, Slide[]> = {
  particulier: [
    { kicker: 'Services de proximité', title: 'Et si ce que vous cherchiez\nétait juste à côté ?', body: 'Ménage, repassage, nettoyage — des prestataires de confiance, disponibles en temps réel, autour de vous.' },
    { kicker: 'Comment ça marche · 1', icon: 'map', title: 'Une carte, en temps réel', body: 'Les prestataires disponibles près de chez vous s\u2019affichent directement sur la carte, avec leur tarif.' },
    { kicker: 'Comment ça marche · 2', icon: 'click', title: 'Vous choisissez, vous réservez', body: 'Le tarif est net, affiché à l\u2019avance. Aucune surprise, aucun devis à négocier.' },
    { kicker: 'Comment ça marche · 3', icon: 'qr', title: 'Arrivée et départ validés', body: 'Un code scanné à l\u2019arrivée, un autre au départ — la durée réelle est enregistrée automatiquement.' },
    {
      kicker: 'Pourquoi PING', title: 'Une tranquillité que\nle bouche-à-oreille ne garantit pas', body: '',
      cards: [
        { icon: 'shield', title: 'Traçabilité complète', body: 'Chaque étape est horodatée.' },
        { icon: 'coin', title: 'Paiement sécurisé', body: 'Le montant est clair avant de réserver.' },
        { icon: 'doc', title: 'Un support en cas de litige', body: 'Une équipe qui vous épaule.' },
      ],
    },
  ],
  pro: [
    { kicker: 'Prestataires de services', title: 'Et si vos prochains clients\nétaient juste à côté ?', body: 'Pro ou particulier, tout le monde peut commencer.' },
    { kicker: 'Comment ça marche · 1', icon: 'map', title: 'Devenez visible\nà chaque déplacement', body: 'Réduisez les trajets, intervenez à côté. Développez votre clientèle là où vous travaillez déjà !' },
    { kicker: 'Comment ça marche · 2', icon: 'radar', title: 'Paiement en ligne', body: 'Facture générée automatiquement. Paiement sécurisé.' },
    { kicker: 'Comment ça marche · 3', icon: 'qr', title: 'Le client paie, vous intervenez', body: 'C\u2019est noté, et payé d\u2019avance. Pas de litige : c\u2019est déjà réglé avant même que vous arriviez.' },
    {
      kicker: 'Pourquoi PING', title: 'Moins de temps sur l\u2019administratif,\nplus de temps sur le terrain', body: '',
      cards: [
        { icon: 'doc', title: 'Moins de devis, moins de factures', body: 'Plus de temps pour l\u2019opérationnel.' },
        { icon: 'coin', title: 'Paiement garanti d\u2019avance', body: 'La mission est déjà financée.' },
        { icon: 'shield', title: 'Un appui en cas de désaccord', body: 'Une équipe qui vous épaule.' },
      ],
    },
  ],
}

export default function CommentCaMarche() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('particulier')
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const slides = SLIDES[mode]

  function switchMode(m: Mode) { setMode(m); setIndex(0); setAnimKey(k => k + 1) }
  function go(delta: number) {
    setDir(delta)
    setIndex(i => Math.max(0, Math.min(slides.length - 1, i + delta)))
    setAnimKey(k => k + 1)
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 50) go(-1)
    else if (dx < -50) go(1)
    touchStartX.current = null
  }

  const slide = slides[index]
  const isLast = index === slides.length - 1
  const ctaHref = mode === 'pro'
    ? '/auth/signup?role=pro&utm_source=carousel&utm_medium=onboarding&utm_campaign=comment_ca_marche'
    : '/map?utm_source=carousel&utm_medium=onboarding&utm_campaign=comment_ca_marche'

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes slideInR { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes slideInL { from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: translateX(0) } }
        .slide-anim-1 { animation: slideInR .32s cubic-bezier(.2,.7,.3,1) both }
        .slide-anim--1 { animation: slideInL .32s cubic-bezier(.2,.7,.3,1) both }
      `}</style>
      <div style={{ padding: '20px 20px 0' }}>
        <button onClick={() => router.back()} style={{ color: 'rgba(255,255,255,.7)', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4 }}>
          {(['particulier', 'pro'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 999, border: 'none', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13,
                background: mode === m ? '#12B39C' : 'rgba(255,255,255,.08)', color: '#fff', transition: 'background .2s',
              }}>
              {m === 'particulier' ? 'Côté particulier' : 'Côté professionnel'}
            </button>
          ))}
        </div>
      </div>

      <div
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 28px', textAlign: 'center', minHeight: 0 }}>
        <div key={animKey} className={dir >= 0 ? 'slide-anim-1' : 'slide-anim--1'}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#12B39C', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            {slide.kicker}
          </div>

          {index === 0 && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Sign size={60} pulse /></div>}

          {slide.icon && (
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(47,208,110,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name={slide.icon} size={26} />
            </div>
          )}

          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#fff', lineHeight: 1.28, whiteSpace: 'pre-line' }}>
            {slide.title}
          </h1>
          {slide.body && (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginTop: 14, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              {slide.body}
            </p>
          )}

          {slide.cards && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, textAlign: 'left' }}>
              {slide.cards.map(c => (
                <div key={c.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(47,208,110,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={c.icon} size={18} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#fff' }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 28px 12px', display: 'flex', justifyContent: 'center', gap: 7 }}>
        {slides.map((_, i) => (
          <div key={i} onClick={() => { setDir(i > index ? 1 : -1); setIndex(i); setAnimKey(k => k + 1) }}
            style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 999, background: i === index ? '#12B39C' : 'rgba(255,255,255,.25)', transition: 'width .25s', cursor: 'pointer' }} />
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 24px 28px' }}>
        {isLast ? (
          <button onClick={() => router.push(ctaHref)}
            style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 999, boxShadow: '0 8px 20px rgba(18,179,156,.35)' }}>
            {mode === 'pro' ? 'Proposer mes services' : 'Voir la carte'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => go(-1)} disabled={index === 0}
              style={{ flex: 1, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, padding: 15, borderRadius: 999, opacity: index === 0 ? 0.4 : 1 }}>
              Précédent
            </button>
            <button onClick={() => go(1)}
              style={{ flex: 1, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, padding: 15, borderRadius: 999 }}>
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
