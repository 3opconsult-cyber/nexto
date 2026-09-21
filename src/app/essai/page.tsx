"use client"
import { useRef, useState } from 'react'
import { Wordmark, Sign } from '@/components/Brand'
import QrCode from '@/components/QrCode'

/**
 * Page de recrutement testeurs, partageable par lien (WhatsApp, QR...).
 * v3 — parcours dicté par Romain : explication + renvoi vers la bulle de
 * commentaire → choix du rôle → 3 écrans "Et si...?" adaptés au rôle choisi
 * → inscription réelle (le rôle est transmis à /auth/signup?role=...).
 * "Et si vos paiements étaient sécurisés ?" reformulé en "prix fixé avant de
 * commencer" : le séquestre Stripe n'est pas branché (CLAUDE.md, invariant
 * #4), on ne peut pas promettre une sécurité qui n'existe pas encore — la
 * règle du tarif figé, elle, est réellement implémentée.
 */
const SHARE_URL = 'https://nexto-eta.vercel.app/l/beta'
const SHARE_TEXT = `Salut ! Merci de tester cette nouvelle application, bientôt en ligne — 2 minutes, particulier ou pro : ${SHARE_URL}`

type Role = 'particulier' | 'prestataire'

const ET_SI: Record<Role, { title: string; body: string }[]> = {
  particulier: [
    { title: 'Et si ce que vous cherchiez se trouvait juste à côté ?', body: 'Ménage, nettoyage, mise en blanc, repassage : des prestataires disponibles près de chez vous.' },
    { title: 'Et si le prix ne bougeait plus une fois fixé ?', body: 'Le tarif se valide avant l’intervention — jamais de mauvaise surprise à la fin.' },
    { title: 'Et si les points de contrôle étaient simples ?', body: 'Un code scanné à l’arrivée, un autre au départ : la durée réelle est actée pour tout le monde.' },
  ],
  prestataire: [
    { title: 'Et si vos clients se trouvaient juste à côté ?', body: 'Les demandes autour de vous, visibles en temps réel sur la carte.' },
    { title: 'Et si diffuser votre offre était aussi simple que trois clics ?', body: 'Tarifs, zone d’intervention, disponibilité : tout se configure en quelques écrans.' },
    { title: 'Et si vous n’aviez plus de facture à éditer ?', body: 'Elle est générée automatiquement à chaque intervention. Plus de temps pour votre métier, moins pour l’administratif.' },
  ],
}

export default function Essai() {
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  const TOTAL = 6 // intro, choix, 3x "et si", cta

  function go(next: number) {
    if (next < 0 || next >= TOTAL) return
    if (next === 2 && !role) return // le choix du rôle est obligatoire pour avancer
    setDir(next > step ? 'r' : 'l')
    setStep(next)
  }
  function pick(r: Role) {
    setRole(r)
    setDir('r')
    setStep(2)
  }

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) go(step + 1); else go(step - 1)
  }

  function shareWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`, '_blank')
  }

  const appUrl = `https://nexto-eta.vercel.app/auth/signup?role=${role === 'prestataire' ? 'pro' : 'client'}`
  const etSi = role ? ET_SI[role][step - 2] : null

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
        <Wordmark size={18} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: TOTAL }).map((_, s) => (
            <div key={s} style={{ width: s === step ? 22 : 8, height: 8, borderRadius: 999, background: s === step ? '#12B39C' : '#E7EDEB', transition: 'width .2s, background .2s' }} />
          ))}
        </div>
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 28px', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={step} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'}>
          {step === 0 && (
            <div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 25, color: '#123644' }}>Salut !</h1>
              <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 16 }}>
                PING s’adresse pour l’instant aux personnes qui cherchent un prestataire pour du ménage, du nettoyage, de la mise en blanc ou du repassage.
              </p>
              <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 14 }}>
                En tant que particulier, vous pourrez aussi devenir prestataire quand vous le souhaitez.
              </p>
              <p style={{ fontSize: 15, color: '#123644', lineHeight: 1.65, marginTop: 14 }}>
                Merci de tester cette application avant son lancement — vos avis et critiques sont les bienvenus, à tout moment, via le petit bouton en bas à droite.
              </p>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 23, color: '#123644' }}>Vous êtes…</h1>
              <button onClick={() => pick('particulier')}
                style={{ width: '100%', maxWidth: 320, marginTop: 24, padding: '18px 20px', borderRadius: 18, border: '1.5px solid #E7EDEB', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 26 }}>🔍</span>
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Je cherche un prestataire</span>
              </button>
              <button onClick={() => pick('prestataire')}
                style={{ width: '100%', maxWidth: 320, marginTop: 12, padding: '18px 20px', borderRadius: 18, border: '1.5px solid #E7EDEB', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 26 }}>🧹</span>
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Je propose mes services</span>
              </button>
            </div>
          )}

          {step >= 2 && step <= 4 && etSi && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ marginBottom: 22 }}><Sign size={64} pulse /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644', lineHeight: 1.3, maxWidth: 320 }}>
                {etSi.title}
              </h1>
              <p style={{ fontSize: 14.5, color: '#6E8592', lineHeight: 1.6, marginTop: 14, maxWidth: 300 }}>
                {etSi.body}
              </p>
            </div>
          )}

          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>C’est parti</h1>
              <p style={{ fontSize: 13.5, color: '#6E8592', lineHeight: 1.5, marginTop: 8, maxWidth: 300 }}>
                Test uniquement : aucun paiement n’est jamais réellement débité. Allez jusqu’au bout sans crainte.
              </p>

              <a href={appUrl}
                style={{ display: 'block', width: '100%', maxWidth: 320, marginTop: 22, padding: 16, borderRadius: 999, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
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
          )}
        </div>
      </div>

      {step !== 1 && step !== 5 && (
        <div style={{ padding: '0 28px 40px' }}>
          <button onClick={() => go(step + 1)}
            style={{ width: '100%', padding: 16, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
            Suivant
          </button>
        </div>
      )}
      {(step === 1 || step === 5) && <div style={{ height: 40 }} />}
    </div>
  )
}
