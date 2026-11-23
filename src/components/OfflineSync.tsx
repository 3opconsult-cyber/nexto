"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NET_EVENT } from '@/lib/netError'
import { PROOF_EVENT, listProofs, purgeExpiredProofs } from '@/lib/proofStore'
import { KEPT_TEXT, PROOF_FAILED_EVENT, PROOF_SENT_EVENT, flushQueuedProofs } from '@/lib/proofSend'
import { ZONE_STOP_EVENT, flushZoneStop, pendingZoneStop } from '@/lib/liveZone'

/**
 * Bannière « Pas de connexion, nouvelle tentative » (toutes les pages) et reprise des envois gardés sur le téléphone :
 * preuve d'arrivée (photo + position, src/lib/proofSend.ts) et arrêt de la zone « en intervention ici ».
 * La bannière s'affiche quand le navigateur se dit hors ligne OU qu'une requête vers PING vient d'échouer, puis se
 * ferme dès qu'une requête réussit (sonde toutes les 5 s en attendant). Le renvoi se fait au retour du réseau, à
 * l'ouverture de l'application et toutes les 15 s tant qu'un envoi attend. Aucune position n'est lue ici.
 */
export default function OfflineSync() {
  const [down, setDown] = useState(false)
  const [proofs, setProofs] = useState(0)
  const [zone, setZone] = useState(false)
  const [toast, setToast] = useState<{ err: boolean; text: string } | null>(null)
  const running = useRef(false)
  const downRef = useRef(false)
  downRef.current = down

  const refreshQueue = useCallback(async () => {
    const list = await purgeExpiredProofs().catch(() => [])
    setProofs(list.filter(p => p.queued).length)
    setZone(pendingZoneStop())
  }, [])

  const flush = useCallback(async () => {
    if (running.current) return
    const list = await listProofs().catch(() => [])
    if (!list.some(p => p.queued) && !pendingZoneStop()) return
    running.current = true
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const sent = await flushQueuedProofs(supabase, user.id)
      if (sent > 0) setToast({ err: false, text: 'Connexion rétablie : votre preuve a été envoyée.' })
      if (await flushZoneStop(supabase, user.id)) setToast({ err: false, text: 'Connexion rétablie : votre zone « en intervention ici » est arrêtée.' })
    } catch { /* la prochaine tentative reprendra */ } finally {
      running.current = false
      refreshQueue()
    }
  }, [refreshQueue])

  // Sonde : une requête simple vers PING. Réponse quelconque = réseau revenu.
  const probe = useCallback(async () => {
    try {
      await fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
      setDown(false)
      flush()
    } catch { setDown(true) }
  }, [flush])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setDown(true)
    refreshQueue(); flush()
    const onOffline = () => setDown(true)
    const onOnline = () => { probe() }
    const onNet = (e: Event) => {
      const k = (e as CustomEvent).detail
      if (k === 'fail') setDown(true)
      else if (downRef.current) { setDown(false); flush() }
    }
    const onVisible = () => { if (!document.hidden) { refreshQueue(); flush() } }
    const onSent = () => refreshQueue()
    const onFailed = (e: Event) => { setToast({ err: true, text: (e as CustomEvent).detail?.message || 'Preuve non envoyée.' }); refreshQueue() }
    window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline)
    window.addEventListener(NET_EVENT, onNet)
    window.addEventListener(PROOF_EVENT, refreshQueue); window.addEventListener(ZONE_STOP_EVENT, refreshQueue)
    window.addEventListener(PROOF_SENT_EVENT, onSent); window.addEventListener(PROOF_FAILED_EVENT, onFailed)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline)
      window.removeEventListener(NET_EVENT, onNet)
      window.removeEventListener(PROOF_EVENT, refreshQueue); window.removeEventListener(ZONE_STOP_EVENT, refreshQueue)
      window.removeEventListener(PROOF_SENT_EVENT, onSent); window.removeEventListener(PROOF_FAILED_EVENT, onFailed)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush, probe, refreshQueue])

  // Nouvelle tentative : toutes les 5 s tant que la bannière est là ; toutes les 15 s tant qu'un envoi gardé attend.
  useEffect(() => {
    if (!down) return
    const t = setInterval(probe, 5000)
    return () => clearInterval(t)
  }, [down, probe])
  useEffect(() => {
    if (!proofs && !zone) return
    const t = setInterval(flush, 15000)
    return () => clearInterval(t)
  }, [proofs, zone, flush])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.err ? 12000 : 8000)
    return () => clearTimeout(t)
  }, [toast])

  const box: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3500, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10,
    padding: 'calc(8px + env(safe-area-inset-top, 0px)) 14px 8px', fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.4, fontWeight: 600,
  }
  if (down) {
    return (
      <div role="status" aria-live="polite" data-ping-offline style={{ ...box, background: '#123644', color: '#fff', minHeight: 44 }}>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2A93B" strokeWidth="2.2" strokeLinecap="round" style={{ flex: '0 0 auto' }}>
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" fill="#F2A93B" /><path d="M3 3l18 18" />
        </svg>
        <span style={{ flex: 1, minWidth: 0 }}>
          Pas de connexion, nouvelle tentative…
          {proofs > 0 && <span style={{ display: 'block', fontWeight: 500 }}>{KEPT_TEXT}</span>}
          {zone && <span style={{ display: 'block', fontWeight: 500 }}>L’arrêt de votre zone « en intervention ici » sera appliqué dès le retour du réseau.</span>}
        </span>
        <button type="button" onClick={probe} style={{ flex: '0 0 auto', minHeight: 44, padding: '0 14px', borderRadius: 999, border: '1.5px solid #fff', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    )
  }
  if (toast) {
    return (
      <div role={toast.err ? 'alert' : 'status'} aria-live="polite" data-ping-offline-toast style={{ ...box, background: toast.err ? '#B3402F' : '#0B8374', color: '#fff', minHeight: 44 }}>
        <span style={{ flex: 1, minWidth: 0 }}>{toast.text}</span>
        <button type="button" onClick={() => setToast(null)} aria-label="Fermer le message" style={{ flex: '0 0 auto', minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>
    )
  }
  return null
}
