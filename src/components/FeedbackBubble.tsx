"use client"
import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/tracking'

/**
 * Bulle de feedback permanente, demandée par Romain : un encart en bas à
 * droite, visible avec son texte quelques secondes puis réduit à une icône,
 * qui ouvre un popup à deux issues — valider la page en un clic (bouton
 * vert) ou laisser un commentaire écrit/dicté — ni l'un ni l'autre n'étant
 * obligatoire (Fermer). Enregistrée dans `events` (pas une nouvelle table) :
 * la note apparaît directement à sa place dans la frise du parcours d'un
 * testeur sur /admin/parcours — on voit sur QUEL écran elle a été laissée.
 * "Possibilité de dicter" : déjà couvert nativement — tout clavier mobile
 * (iOS/Android) a un micro de dictée intégré à n'importe quel champ de texte.
 */
export default function FeedbackBubble() {
  const [open, setOpen] = useState(false)
  const [labelVisible, setLabelVisible] = useState(true)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLabelVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])

  function celebrate() {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSent(true)
      setText('')
      setTimeout(() => { setSent(false); setOpen(false) }, 1200)
    }, 250)
  }

  function validatePage() {
    trackEvent('feedback_note', { ok: true, text: 'Page validée' })
    celebrate()
  }

  function sendComment() {
    if (!text.trim()) return
    trackEvent('feedback_note', { text: text.trim() })
    celebrate()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Laisser un avis"
        style={{
          position: 'fixed', right: 16, bottom: 'calc(132px + env(safe-area-inset-bottom, 0px))', zIndex: 3000,
          height: 52, minWidth: 52, borderRadius: 999, border: 'none',
          background: '#12B39C', color: '#fff', boxShadow: '0 8px 20px rgba(18,54,68,.35)',
          display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
          padding: labelVisible ? '0 18px 0 15px' : 0, justifyContent: 'center',
          overflow: 'hidden', whiteSpace: 'nowrap', transition: 'padding .35s ease',
        }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {labelVisible && <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>Laisser un commentaire</span>}
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
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Cette page, ça va ?</div>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Ni l'un ni l'autre n'est obligatoire.</p>

            <button onClick={validatePage} disabled={sending}
              style={{ width: '100%', marginTop: 14, padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Cette page fonctionne bien
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E7EDEB' }} />
              <span style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 700 }}>OU UN COMMENTAIRE</span>
              <div style={{ flex: 1, height: 1, background: '#E7EDEB' }} />
            </div>

            <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="Écrivez ou dictez (micro du clavier) — ce qui marche, ce qui ne marche pas…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#6E8592', fontWeight: 700, fontSize: 14 }}>Fermer</button>
              <button onClick={sendComment} disabled={!text.trim() || sending}
                style={{ flex: 2, padding: 13, borderRadius: 999, border: 'none', background: (!text.trim() || sending) ? '#DCE5E3' : '#123644', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
