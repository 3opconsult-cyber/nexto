"use client"
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'particulier' | 'pro'

const SLIDES: Record<Mode, { title: string; body: string }[]> = {
  particulier: [
    { title: 'Et si ce que vous cherchez\nse trouvait juste à côté de vous ?', body: 'Ménage, repassage, nettoyage — des personnes disponibles en temps réel, autour de vous.' },
    { title: 'Une carte, des annonces actives', body: 'Les prestataires disponibles près de chez vous s\u2019affichent en direct sur la carte.' },
    { title: 'Vous choisissez, vous cliquez,\nvous réservez', body: 'Le tarif est net, affiché à l\u2019avance. Pas de surprise à la fin.' },
    { title: 'Il arrive : vous validez.\nIl repart : vous validez.', body: 'Un code à scanner à l\u2019arrivée, un autre au départ — la durée réelle est enregistrée automatiquement.' },
    { title: 'Traçabilité et sécurité,\npour les deux parties', body: 'Chaque étape est horodatée. Aucune ambiguïté sur ce qui s\u2019est passé, ni sur ce qui a été payé.' },
  ],
  pro: [
    { title: 'Un service à proposer ?', body: 'Pro ou particulier, tout le monde peut commencer — le statut auto-entrepreneur suffit pour démarrer.' },
    { title: 'Vous vous inscrivez,\nvous devenez visible', body: 'Deux repères vous rendent trouvable : votre adresse, et votre position en direct.' },
    { title: 'Chez un client ?\nActivez PING.', body: 'Envie d\u2019être vu à chaque déplacement ? Un geste suffit pour apparaître sur la carte, là où vous êtes.' },
    { title: 'Le client paie,\nvous intervenez', body: 'C\u2019est noté, et payé d\u2019avance. Pas de litige : c\u2019est déjà réglé avant même que vous arriviez.' },
    { title: 'Moins de devis,\nmoins de factures', body: 'Plus de temps pour travailler. Une vraie traçabilité, sans paperasse à gérer vous-même.' },
    { title: 'Un litige malgré tout ?\nOn est là.', body: 'Une fenêtre de 48h pour signaler un souci, une équipe pour vous épauler si besoin.' },
  ],
}

export default function CommentCaMarche() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('particulier')
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const slides = SLIDES[mode]

  function switchMode(m: Mode) { setMode(m); setIndex(0) }
  function go(delta: number) { setIndex(i => Math.max(0, Math.min(slides.length - 1, i + delta))) }

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
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <button onClick={() => router.back()} style={{ color: 'rgba(255,255,255,.7)', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4 }}>
          {(['particulier', 'pro'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 999, border: 'none', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13,
                background: mode === m ? '#12B39C' : 'rgba(255,255,255,.08)', color: '#fff',
              }}>
              {m === 'particulier' ? 'Côté particulier' : 'Côté professionnel'}
            </button>
          ))}
        </div>
      </div>

      <div
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#12B39C', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 18 }}>
          {index + 1} / {slides.length}
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: '#fff', lineHeight: 1.25, whiteSpace: 'pre-line' }}>
          {slide.title}
        </h1>
        <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginTop: 18, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
          {slide.body}
        </p>
      </div>

      <div style={{ padding: '0 28px 12px', display: 'flex', justifyContent: 'center', gap: 7 }}>
        {slides.map((_, i) => (
          <div key={i} onClick={() => setIndex(i)}
            style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 999, background: i === index ? '#12B39C' : 'rgba(255,255,255,.25)', transition: 'width .2s', cursor: 'pointer' }} />
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 24px 28px' }}>
        {isLast ? (
          <button onClick={() => router.push(ctaHref)}
            style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 999 }}>
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
