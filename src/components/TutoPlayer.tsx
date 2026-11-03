"use client"
import { useCallback, useEffect, useRef, useState } from 'react'

// Lecteur plein écran d'une animation (iframe en mode ?embed=1). « Retour » toujours visible ;
// à la fin (postMessage { ping: 'anim-ended' } envoyé par la page animation) : Revoir / Retour aux rubriques.
export default function TutoPlayer({ title, src, onClose }: { title: string; src: string; onClose: () => void }) {
  const [ended, setEnded] = useState(false)
  const [run, setRun] = useState(0)
  const backRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data && e.data.ping === 'anim-ended') setEnded(true)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('message', onMsg)
    window.addEventListener('keydown', onKey)
    backRef.current?.focus()
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('keydown', onKey) }
  }, [])

  const replay = useCallback(() => { setEnded(false); setRun(r => r + 1) }, [])

  const btn: React.CSSProperties = { border: 'none', borderRadius: 999, padding: '11px 20px', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }

  return (
    <div role="dialog" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0b1f27', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#123644', flex: '0 0 auto' }}>
        <button ref={backRef} onClick={onClose} aria-label="Retour aux rubriques"
          style={{ ...btn, background: 'rgba(255,255,255,.14)', color: '#fff', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Retour
        </button>
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <iframe key={run} src={src} title={title} allow="autoplay; fullscreen" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#0b1f27' }} />
        {ended && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,39,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 340, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644' }}>Fin de la rubrique</div>
              <div style={{ fontSize: 12.5, color: '#4E6470', margin: '6px 0 16px' }}>{title}</div>
              <button onClick={replay} style={{ ...btn, width: '100%', background: '#12B39C', color: '#fff' }}>Revoir</button>
              <button onClick={onClose} style={{ ...btn, width: '100%', background: '#F3F6F5', color: '#123644', marginTop: 8 }}>Retour aux rubriques</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
