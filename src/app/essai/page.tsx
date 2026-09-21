"use client"
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wordmark, Device, PING_INK, PING_TEAL, PING_GREEN } from '@/components/Brand'

/**
 * Page de recrutement testeurs, partageable par lien.
 * v7 — Romain : trop de texte partout, "et si" pas assez percutant côté pro,
 * couleurs pas franches. Intro réduite à l'essentiel ; côté particulier
 * ramené à UN seul "et si" (sa consigne) ; côté pro, 2-3 arguments forts
 * maximum (latence résolue par la géoloc, facturation automatique, plus de
 * litige possible sur la durée grâce au double QR) — le séquestre/paiement
 * sécurisé n'est PAS repris tel quel : Stripe n'est pas branché, aucun
 * séquestre réel n'existe aujourd'hui (invariant produit déjà documenté),
 * l'argument gardé est le seul vrai déjà en place (prix fixé + QR
 * horodaté = zéro contestation sur le temps). Texte secondaire en blanc
 * plein sur fond sombre (plus d'opacité réduite qui "n'a pas l'air blanc").
 */
type Role = 'particulier' | 'prestataire'

const ET_SI: Record<Role, { title: string; body: string }[]> = {
  particulier: [
    { title: 'Et si votre prestataire se trouvait juste à côté ?', body: 'Faites une recherche sur PING et regardez qui est disponible autour de vous.' },
  ],
  prestataire: [
    { title: 'Et si votre prochain client était juste à côté ?', body: 'PING réduit l’attente entre la demande d’un particulier et votre intervention — visible tout de suite sur la carte.' },
    { title: 'Et si vos factures s’éditaient seules ?', body: 'Générée automatiquement dès la fin de l’intervention, au prix que vous avez fixé. Plus de secrétariat.' },
    { title: 'Et si plus aucun litige n’était possible sur le temps passé ?', body: 'QR code à l’arrivée, QR code au départ : la durée est actée pour tout le monde, sans contestation.' },
  ],
}

const KICKER: Record<Role, string> = { particulier: 'VOUS ÊTES UN PARTICULIER', prestataire: 'VOUS ÊTES UN PRO' }

// Thème clair pour "prestataire" (comme les posts pro), sombre partout ailleurs.
function theme(role: Role | null) {
  const light = role === 'prestataire'
  return {
    bg: light ? '#F3F6F5' : '#123644',
    text: light ? PING_INK : '#fff',
    subtle: light ? '#475A64' : '#fff',
    kicker: light ? PING_TEAL : PING_GREEN,
    hairline: light ? '#E7EDEB' : 'rgba(255,255,255,.15)',
    dotOff: light ? '#DCE5E3' : 'rgba(255,255,255,.22)',
    chipBg: light ? 'rgba(18,54,68,.08)' : 'rgba(255,255,255,.1)',
  }
}

export default function Essai() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const [dir, setDir] = useState<'r' | 'l'>('r')

  const etsiList = role ? ET_SI[role] : null
  const etsiCount = etsiList?.length ?? 1
  const ctaStep = 2 + etsiCount
  const TOTAL = ctaStep + 1

  function go(next: number) {
    if (next < 0 || next >= TOTAL) return
    if (next === 2 && !role) return
    setDir(next > step ? 'r' : 'l')
    setStep(next)
  }
  function pick(r: Role) { setRole(r); setDir('r'); setStep(2) }
  function cta() { if (step === ctaStep) router.push(appUrl); else go(step + 1) }

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
  const etSi = role && step >= 2 && step < ctaStep ? ET_SI[role][step - 2] : null
  const T = theme(step >= 2 ? role : null)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', transition: 'background .25s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 0' }}>
        <Wordmark size={19} color={T.text} />
        {step > 0 && (
          <button onClick={() => go(step - 1)} aria-label="Étape précédente"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: T.chipBg, color: T.text, fontSize: 15, fontWeight: 700 }}>
            ←
          </button>
        )}
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 28px 8px', overflowX: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div key={step} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'}>

          {step === 0 && (
            <>
              <div style={{ marginBottom: 20 }}><Device size={92} hook={T.text} ring={PING_TEAL} dot={PING_GREEN} /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 27, color: T.text, lineHeight: 1.2 }}>Salut !</h1>
              <p style={{ fontSize: 15.5, color: T.subtle, lineHeight: 1.6, marginTop: 14, maxWidth: 300 }}>
                Merci de tester PING avant son lancement — quelques minutes, votre avis compte vraiment.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: T.text, marginBottom: 20 }}>Vous êtes…</h1>
              <button onClick={() => pick('particulier')} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '18px 18px', borderRadius: 16, marginBottom: 12,
                border: role === 'particulier' ? `2px solid ${PING_GREEN}` : '1.5px solid rgba(255,255,255,.18)',
                background: role === 'particulier' ? 'rgba(47,208,110,.16)' : 'rgba(255,255,255,.06)',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#fff', cursor: 'pointer',
              }}>
                Je cherche un prestataire
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>Ménage, nettoyage, mise en blanc, repassage</div>
              </button>
              <button onClick={() => pick('prestataire')} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '18px 18px', borderRadius: 16,
                border: role === 'prestataire' ? `2px solid ${PING_TEAL}` : '1.5px solid rgba(255,255,255,.18)',
                background: role === 'prestataire' ? 'rgba(18,179,156,.2)' : 'rgba(255,255,255,.06)',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#fff', cursor: 'pointer',
              }}>
                Je propose mes services
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>Auto-entrepreneur, société, ou simple particulier</div>
              </button>
            </>
          )}

          {etSi && role && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: T.kicker, marginBottom: 14 }}>{KICKER[role]}</div>
              <div style={{ marginBottom: 20 }}><Device size={78} hook={T.text} ring={PING_TEAL} dot={PING_GREEN} /></div>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 25, color: T.text, lineHeight: 1.22, maxWidth: 320 }}>
                {etSi.title}
              </h1>
              <p style={{ fontSize: 14.5, color: T.subtle, lineHeight: 1.6, marginTop: 14, maxWidth: 300 }}>
                {etSi.body}
              </p>
            </>
          )}

          {step === ctaStep && (
            <>
              <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: T.text }}>C’est parti</h1>
              <p style={{ fontSize: 14, color: T.subtle, lineHeight: 1.55, marginTop: 10, maxWidth: 300 }}>
                Test uniquement : aucun paiement n’est jamais réellement débité. Allez jusqu’au bout sans crainte.
              </p>
              <div style={{ width: '100%', maxWidth: 280, height: 1, background: T.hairline, margin: '20px 0 16px' }} />
              <p style={{ fontSize: 13, color: T.subtle, lineHeight: 1.5, maxWidth: 280 }}>
                Vous testez avec un proche ? Faites-lui suivre ce message pour qu’il teste de son côté aussi.
              </p>
              <a href="/essai/avis" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: T.text, fontWeight: 700, textDecoration: 'underline' }}>
                Donner mon avis après le test →
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: TOTAL }).map((_, s) => (
            <div key={s} style={{ width: s === step ? 22 : 8, height: 8, borderRadius: 999, background: s === step ? PING_TEAL : T.dotOff, transition: 'width .2s, background .2s' }} />
          ))}
        </div>
        <button onClick={cta} disabled={step === 1 && !role}
          style={{ width: '100%', maxWidth: 320, padding: 16, borderRadius: 999, border: 'none', background: (step === 1 && !role) ? T.dotOff : PING_TEAL, color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: (step === 1 && !role) ? 'none' : '0 8px 20px rgba(18,179,156,.3)' }}>
          {step === ctaStep ? 'Je m’inscris et je teste →' : 'Continuer'}
        </button>
      </div>
    </div>
  )
}
