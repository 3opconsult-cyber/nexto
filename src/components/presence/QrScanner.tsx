"use client"
import { useEffect, useRef, useState } from 'react'

/**
 * Scanner de QR intégré (le prestataire ne quitte plus l'application).
 * Caméra arrière + BarcodeDetector quand le navigateur le propose (Chrome / Android, Safari récent) ;
 * sinon, ou si la caméra est refusée, saisie du code à 6 chiffres affiché sous le QR du client.
 * Aucune image n'est envoyée nulle part : la lecture se fait dans le navigateur.
 */
export default function QrScanner({ onResult, onCancel, title, hint, busy }: {
  onResult: (value: string) => void
  onCancel: () => void
  title: string
  hint?: string
  busy?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const [why, setWhy] = useState('')
  const [code, setCode] = useState('')
  const doneRef = useRef(false)
  const cbRef = useRef(onResult)
  cbRef.current = onResult

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let alive = true
    doneRef.current = false
    async function start() {
      const BD = (typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined)
      if (!BD || !navigator.mediaDevices?.getUserMedia) {
        setCamera('off'); setWhy('Ce navigateur ne lit pas les QR : saisissez le code à 6 chiffres affiché sous le QR du client.')
        return
      }
      let detector: any
      try {
        const formats: string[] = typeof BD.getSupportedFormats === 'function' ? await BD.getSupportedFormats() : ['qr_code']
        if (!formats.includes('qr_code')) throw new Error('qr')
        detector = new BD({ formats: ['qr_code'] })
      } catch {
        setCamera('off'); setWhy('Lecture de QR indisponible : saisissez le code à 6 chiffres affiché sous le QR du client.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch {
        setCamera('off'); setWhy('Caméra refusée ou indisponible : saisissez le code à 6 chiffres affiché sous le QR du client.')
        return
      }
      if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      try { await v.play() } catch { }
      setCamera('on')
      const tick = async () => {
        if (!alive || doneRef.current) return
        try {
          if (v.readyState >= 2) {
            const found = await detector.detect(v)
            const raw = found?.[0]?.rawValue
            if (raw && !doneRef.current) { doneRef.current = true; cbRef.current(String(raw)); return }
          }
        } catch { }
        timer = setTimeout(tick, 250)
      }
      tick()
    }
    start()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(10,28,36,.92)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380, color: '#fff', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17 }}>{title}</div>
        {hint && <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', margin: '6px 0 12px', lineHeight: 1.5 }}>{hint}</p>}

        <div style={{
          position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 18, overflow: 'hidden',
          background: '#0b2029', display: camera === 'off' ? 'none' : 'block',
        }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div aria-hidden style={{ position: 'absolute', inset: '18%', border: '3px solid #12B39C', borderRadius: 16 }} />
          {camera === 'starting' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Ouverture de la caméra…</div>
          )}
        </div>
        {why && <p role="status" style={{ fontSize: 12.5, color: '#fff', margin: '6px 0 0', lineHeight: 1.5 }}>{why}</p>}

        <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginBottom: 8 }}>
            {camera === 'on' ? 'Le scan ne passe pas ? Saisissez le code à 6 chiffres du client' : 'Code à 6 chiffres du client'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Code à 6 chiffres"
              style={{ flex: 1, minWidth: 0, borderRadius: 10, border: 'none', padding: '10px', fontSize: 18, letterSpacing: 5, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
            <button onClick={() => { if (code.length === 6) { doneRef.current = true; onResult(code) } }} disabled={busy || code.length !== 6}
              style={{ border: 'none', borderRadius: 999, padding: '10px 18px', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, opacity: code.length === 6 && !busy ? 1 : .6, cursor: 'pointer' }}>
              {busy ? '…' : 'Valider'}
            </button>
          </div>
        </div>

        <button onClick={onCancel} style={{ marginTop: 14, border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    </div>
  )
}
