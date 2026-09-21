"use client"
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sign } from '@/components/Brand'

/**
 * Page de recrutement testeurs, partageable par lien.
 * v5 — Romain a corrigé le tir sur le style : ce n'est pas un formulaire
 * (OnboardingStep, fiche blanche sur bandeau marine) mais un carrousel de
 * présentation, comme /welcome à l'époque et les visuels de la campagne
 * Instagram "Et si...?" — fond marine plein, texte blanc, même famille que
 * la marque. Repris ici pour toutes les étapes, y compris le choix de rôle.
 * QR code + bouton WhatsApp retirés des premières pages (pas encore testé
 * l'appli, trop tôt pour pousser au partage) : remplacés par une simple
 * ligne suggérant de faire suivre le message à un proche qui teste aussi.
 */
type Role = 'particulier' | 'prestataire'

const ET_SI: Record<Role, { title: string; body: string }[]> = {
  particulier: [
    { title: 'Et si ce que vous cherchiez se trouvait juste à côté ?', body: 'Ménage, nettoyage, mise en blanc, repassage : des prestataires disponibles près de chez vous.' },
    { title: 'Et si vous pouviez réserver en quelques clics ?', body: 'Choisissez un prestataire disponible et réservez directement, sans appel ni allers-retours.' },
    { title: 'Et si vous aviez un moyen de contrôle automatique ?', body: 'Un QR code à l’arrivée, un autre au départ : la durée réelle est actée, sans mauvaise surprise.' },
  ],
  prestataire: [
    { title: 'Et si vos clients se trouvaient juste à côté ?', body: 'Les demandes autour de vous, visibles en temps réel sur la carte.' },
    { title: 'Et si vous n’aviez plus de facture à éditer ?', body: 'Elle est générée automatiquement à la fin de chaque intervention.' },
    { title: 'Et si vous aviez plus de temps pour votre métier ?', body: 'Moins de temps sur l’administratif, plus de temps sur vos prestations.' },
  ],
}

const choiceButtonStyle = (active: boolean): React.CSSProperties => ({
  width: '100%', maxWidth: 320, textAlign: 'left', padding: '18px 18px', borderRadius: 16, marginBottom: 12,
  border: active ? '2px solid #12B39C' : '1.5px solid rgba(255,255,255,.18)',
  background: active ? 'rgba(18,179,156,.16)' : 'rgba(255,255,255,.06)',
  fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff', cursor: 'pointer',
})

export default function Essai() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const TOTAL = 6 // intro, choix, 3x "et si", cta

  function go(next: number) {
    if (next < 0 || next >= TOTAL) return
    if (next === 2 && !role) return
    setDir(next > step ? 'r' : 'l')
    setStep(next)
  }
  function pick(r: Role) { setRole(r); setDir('r'); setStep(2) }
  function cta() { if (step === TOTAL - 1) router.push(appUrl); else go(step + 1) }

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) { if (step !== 1 || role) go(step + 1) } else go(step - 1)
  }

  const appUrl = `/auth/signup?role=${role === 'prestataire' ? 'pro' : 'client'}`
  const etSi = role && step >= 2 && step <= 4 ? ET_SI[role][step - 2] : null

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px 0', minHeight: 30 }}>
        {step > 0 && (
          <button onClick={() => go(step - 1)} aria-label="Étape précédente"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 15, fontWeight: 700 }}>
            ←
          </button>
        )}
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={step} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {step === 0 && (
            <>
              <div style={{ marginBottom: 30 }}><Sign size={72} pulse /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#fff' }}>Salut !</h1>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginTop: 16, maxWidth: 310 }}>
                PING s’adresse pour l’instant aux personnes qui cherchent un prestataire pour du ménage, du nettoyage, de la mise en blanc ou du repassage.
              </p>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginTop: 12, maxWidth: 310 }}>
                En tant que particulier, vous pourrez aussi devenir prestataire quand vous le souhaitez.
              </p>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, marginTop: 12, maxWidth: 310 }}>
                Merci de tester cette application avant son lancement — vos avis et critiques sont les bienvenus, à tout moment, via le petit bouton en bas à droite.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 22 }}>Vous êtes…</h1>
              <button onClick={() => pick('particulier')} style={choiceButtonStyle(role === 'particulier')}>
                Je cherche un prestataire
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>Ménage, nettoyage, mise en blanc, repassage</div>
              </button>
              <button onClick={() => pick('prestataire')} style={choiceButtonStyle(role === 'prestataire')}>
                Je propose mes services
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>Auto-entrepreneur, société, ou simple particulier</div>
              </button>
            </>
          )}

          {etSi && (
            <>
              <div style={{ marginBottom: 30 }}><Sign size={72} pulse /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff', lineHeight: 1.3, maxWidth: 310 }}>
                {etSi.title}
              </h1>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginTop: 14, maxWidth: 300 }}>
                {etSi.body}
              </p>
            </>
          )}

          {step === 5 && (
            <>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>C’est parti</h1>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.55, marginTop: 10, maxWidth: 300 }}>
                Test uniquement : aucun paiement n’est jamais réellement débité. Allez jusqu’au bout sans crainte.
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.5, marginTop: 22, maxWidth: 280 }}>
                Vous testez avec un proche ? Faites-lui suivre ce message pour qu’il teste de son côté aussi.
              </p>
              <a href="/essai/avis" style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, textDecoration: 'underline' }}>
                Donner mon avis après le test →
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: TOTAL }).map((_, s) => (
            <div key={s} style={{ width: s === step ? 22 : 8, height: 8, borderRadius: 999, background: s === step ? '#12B39C' : 'rgba(255,255,255,.2)', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
        <button onClick={cta} disabled={step === 1 && !role}
          style={{ width: '100%', maxWidth: 320, padding: 16, borderRadius: 999, border: 'none', background: (step === 1 && !role) ? 'rgba(255,255,255,.15)' : '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: (step === 1 && !role) ? 'none' : '0 8px 20px rgba(18,179,156,.3)' }}>
          {step === TOTAL - 1 ? 'Je m’inscris et je teste →' : 'Continuer'}
        </button>
      </div>
    </div>
  )
}
