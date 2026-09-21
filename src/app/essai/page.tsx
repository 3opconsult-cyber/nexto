"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sign } from '@/components/Brand'
import QrCode from '@/components/QrCode'
import OnboardingStep from '@/components/OnboardingStep'

/**
 * Page de recrutement testeurs, partageable par lien (WhatsApp, QR...).
 * v4 — reconstruite sur OnboardingStep (le même composant que /pro/onboarding
 * et auth/signup) : bandeau marine + fiche blanche + CTA pilule teal. La v3
 * réinventait une mise en page maison (fond clair, cartes blanches, emoji) —
 * hors charte, corrigé ici en réutilisant le composant existant à l'identique.
 */
const SHARE_URL = 'https://nexto-eta.vercel.app/l/beta'
const SHARE_TEXT = `Salut ! Merci de tester cette nouvelle application, bientôt en ligne — 2 minutes, particulier ou pro : ${SHARE_URL}`

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
  width: '100%', textAlign: 'left', padding: '16px 16px', borderRadius: 14, marginBottom: 10,
  border: active ? '2px solid #12B39C' : '2px solid #E7EDEB',
  background: active ? 'rgba(18,179,156,.06)' : '#fff',
  fontSize: 15, fontWeight: 700, color: '#123644',
})

export default function Essai() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const TOTAL = 6 // intro, choix, 3x "et si", cta

  function next() { setStep(s => Math.min(s + 1, TOTAL - 1)) }
  function back() { setStep(s => Math.max(s - 1, 0)) }

  function shareWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`, '_blank')
  }

  const appUrl = `/auth/signup?role=${role === 'prestataire' ? 'pro' : 'client'}`

  if (step === 0) {
    return (
      <OnboardingStep step={step} total={TOTAL} title="Salut !" onCta={next}>
        <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65 }}>
          PING s’adresse pour l’instant aux personnes qui cherchent un prestataire pour du ménage, du nettoyage, de la mise en blanc ou du repassage.
        </p>
        <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 14 }}>
          En tant que particulier, vous pourrez aussi devenir prestataire quand vous le souhaitez.
        </p>
        <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 14 }}>
          Merci de tester cette application avant son lancement — vos avis et critiques sont les bienvenus, à tout moment, via le petit bouton en bas à droite.
        </p>
      </OnboardingStep>
    )
  }

  if (step === 1) {
    return (
      <OnboardingStep step={step} total={TOTAL} title="Vous êtes…" onBack={back} onCta={next} ctaDisabled={!role}>
        <button onClick={() => setRole('particulier')} style={choiceButtonStyle(role === 'particulier')}>
          Je cherche un prestataire
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6E8592', marginTop: 3 }}>Ménage, nettoyage, mise en blanc, repassage</div>
        </button>
        <button onClick={() => setRole('prestataire')} style={choiceButtonStyle(role === 'prestataire')}>
          Je propose mes services
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6E8592', marginTop: 3 }}>Auto-entrepreneur, société, ou simple particulier</div>
        </button>
      </OnboardingStep>
    )
  }

  if (step >= 2 && step <= 4 && role) {
    const etSi = ET_SI[role][step - 2]
    return (
      <OnboardingStep step={step} total={TOTAL} title={etSi.title} subtitle={etSi.body} onBack={back} onCta={next}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <Sign size={72} pulse />
        </div>
      </OnboardingStep>
    )
  }

  return (
    <OnboardingStep step={step} total={TOTAL} title="C’est parti"
      subtitle="Test uniquement : aucun paiement n’est jamais réellement débité. Allez jusqu’au bout sans crainte."
      onBack={back} onCta={() => router.push(appUrl)} ctaLabel="Je m’inscris et je teste →">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ padding: 14, background: '#F3F6F5', borderRadius: 18 }}>
          <QrCode data={SHARE_URL} size={110} />
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Ou montrez ce code à quelqu’un à côté de vous</p>

        <div style={{ width: '100%', maxWidth: 300, height: 1, background: '#E7EDEB', margin: '22px 0 18px' }} />

        <p style={{ fontSize: 13.5, color: '#6E8592', lineHeight: 1.5, maxWidth: 300 }}>
          Faites suivre à 3-4 proches — même lien, même message.
        </p>
        <button onClick={shareWhatsapp}
          style={{ width: '100%', maxWidth: 300, marginTop: 12, padding: 14, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="#12B39C"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 3 4.7 4.1.7.3 1.2.4 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>
          Partager sur WhatsApp
        </button>

        <a href="/essai/avis" style={{ marginTop: 18, fontSize: 13, color: '#6E8592', fontWeight: 600, textDecoration: 'underline' }}>
          Donner mon avis après le test →
        </a>
      </div>
    </OnboardingStep>
  )
}
