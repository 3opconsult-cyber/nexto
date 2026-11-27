"use client"
import { ReactNode, useEffect, useRef, useState } from 'react'
import '@/app/aere.css'
import '@/app/aere-pro.css'

export default function OnboardingStep({
  step, total, title, subtitle, children,
  onBack, onSkip, skipLabel = 'Passer cette étape',
  ctaLabel = 'Continuer', onCta, ctaDisabled = false, ctaLoading = false,
  onLater, laterNote, aere = false,
}: {
  step: number
  total: number
  title: string
  subtitle?: string
  children?: ReactNode
  onBack?: () => void
  onSkip?: () => void
  skipLabel?: string
  ctaLabel?: string
  onCta: () => void
  ctaDisabled?: boolean
  ctaLoading?: boolean
  /** « Plus tard » en haut à droite : sortir de l'assistant sans rien perdre (brouillon gardé). */
  onLater?: () => void
  /** Courte mention sous le compteur d'étapes (ex. « Brouillon enregistré »). */
  laterNote?: string
  /** Lecture aérée (24/11, espace prestataire) : texte >= 15 px, cibles >= 44 px, espaces plus grands. */
  aere?: boolean
}) {
  // Sens de la glisse "carrousel" : déduit de la comparaison avec l'étape
  // précédente, pas d'un choix explicite de l'appelant (les pages n'ont pas
  // à le savoir — elles se contentent de faire varier `step`).
  const prevStep = useRef(step)
  const [dir, setDir] = useState<'r' | 'l'>('r')
  useEffect(() => {
    setDir(step >= prevStep.current ? 'r' : 'l')
    prevStep.current = step
  }, [step])

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) { if (!ctaDisabled && !ctaLoading) onCta() }
    else if (onBack) onBack()
  }

  return (
    <div className={aere ? 'aere aere-pro a-lift a-navy' : undefined} style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          disabled={!onBack}
          style={{ width: aere ? 44 : 30, height: aere ? 44 : 30, borderRadius: '50%', border: 'none', background: onBack ? 'rgba(255,255,255,.1)' : 'transparent', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0, visibility: onBack ? 'visible' : 'hidden' }}
        >←</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#12B39C' : 'rgba(255,255,255,.15)', transition: 'background .2s' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>Étape {step + 1} sur {total}{laterNote ? ` · ${laterNote}` : ''}</div>
        </div>
        {onLater && (
          <button type="button" onClick={onLater}
            style={{ flexShrink: 0, minHeight: 44, padding: '0 4px', border: 'none', background: 'none', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Plus tard
          </button>
        )}
      </div>

      <div
        style={{ flex: 1, background: '#fff', borderRadius: '24px 24px 0 0', padding: aere ? '32px 20px 28px' : '30px 22px 22px', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div key={step} className={dir === 'r' ? 'ob-slide-r' : 'ob-slide-l'} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', lineHeight: aere ? 1.5 : 1.3 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: aere ? 16 : 13, color: '#4E6470', marginTop: 8, lineHeight: aere ? 1.55 : 1.5 }}>{subtitle}</p>}
          <div style={{ flex: 1, marginTop: aere ? 28 : 22 }}>{children}</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button
            onClick={onCta}
            disabled={ctaDisabled || ctaLoading}
            style={{
              width: '100%', padding: 15, borderRadius: 999, border: 'none',
              background: (ctaDisabled || ctaLoading) ? '#E7EDEB' : '#12B39C',
              color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15,
            }}
          >{ctaLoading ? '…' : ctaLabel}</button>
          {onSkip && (
            <button onClick={onSkip} style={{ width: '100%', padding: aere ? '12px 0' : '12px 0 0', marginTop: aere ? 8 : 0, background: 'none', border: 'none', color: '#4E6470', fontSize: aere ? 16 : 12.5, fontWeight: 700 }}>
              {skipLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
