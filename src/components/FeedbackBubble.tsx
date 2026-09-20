"use client"
import { useState } from 'react'
import { trackEvent } from '@/lib/tracking'

/**
 * Bulle de feedback permanente, demandée par Romain : pouvoir noter "ce qui
 * marche, ce qui ne marche pas" à tout moment pendant le test, sans quitter
 * l'écran. Enregistrée dans `events` (pas une nouvelle table) : la note
 * apparaît directement à sa place dans la frise du parcours d'un testeur
 * sur /admin/parcours — on voit sur QUEL écran elle a été laissée.
 * "Possibilité de dicter" : déjà couvert nativement — tout clavier mobile
 * (iOS/Android) a un micro de dictée intégré à n'importe quel champ de
 * texte, pas besoin de le reconstruire.
 */
export default function FeedbackBubble() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSending(true)
    trackEvent('feedback_note', { text: text.trim() })
    setTimeout(() => {
      setSending(false)
      setSent(true)
      setText('')
      setTimeout(() => { setSent(false); setOpen(false) }, 1400)
    }, 300)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Laisser un avis"
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 3000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: '#123644', color: '#fff', boxShadow: '0 8px 20px rgba(18,54,68,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>
    )
  }

  return (
    <div onClick={() => !sending && setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.35)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom,0px))', fontFamily: 'Inter, sans-serif' }}>
        {sent ? (
          <p style={{ textAlign: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#0C8F7E', padding: '10px 0' }}>
            Merci, c'est noté !
          </p>
        ) : (
          <>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Ce qui marche, ce qui ne marche pas</div>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Écrivez ou dictez (micro du clavier) — c'est envoyé avec l'écran où vous êtes.</p>
            <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="Ex. je ne trouve pas le bouton pour…"
              style={{ width: '100%', marginTop: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#6E8592', fontWeight: 700, fontSize: 14 }}>Annuler</button>
              <button onClick={submit} disabled={!text.trim() || sending}
                style={{ flex: 2, padding: 13, borderRadius: 999, border: 'none', background: (!text.trim() || sending) ? '#DCE5E3' : '#12B39C', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
