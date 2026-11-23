"use client"
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId } from '@/lib/screenCache'
import Modal, { Cta } from '@/components/Modal'
import {
  cancelPendingZoneStop, currentMissionId, devicePosition, fetchLiveZoneState, pendingZoneStop, sectorLabel, setLiveZoneConsent,
  startLiveZone, stopLiveZoneOrQueue, untilText, zoneActive, LIVE_ZONE_HOURS, ZONE_STOP_EVENT, type LiveZoneState,
} from '@/lib/liveZone'
import { friendlyError } from '@/lib/netError'

/**
 * « Je suis en intervention ici (visible aujourd'hui) » — interrupteur du prestataire (carte pro et Mon entreprise).
 * Le domicile reste visible comme avant ; en plus, un second repère « en intervention près de <secteur> » apparaît sur la
 * carte des clients. Position : une seule lecture de l'appareil, arrondie à ~2 km par la base, 12 h au plus. Rien ne
 * s'affiche tant que la migration 058 n'est pas collée.
 */
export default function LiveZoneCard({ compact = false }: { compact?: boolean }) {
  const [uid, setUid] = useState<string | null>(null)
  const [st, setSt] = useState<LiveZoneState | null>(null)
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState(false)
  const [err, setErr] = useState('')
  const [posFail, setPosFail] = useState(false)
  // Arrêt demandé sans réseau : gardé sur le téléphone, rejoué au retour de la connexion (OfflineSync).
  const [stopQueued, setStopQueued] = useState(false)

  const reload = useCallback(async (id: string) => {
    setSt(await fetchLiveZoneState(createClient(), id))
  }, [])
  useEffect(() => {
    let off = false
    sessionUserId(createClient()).then(id => {
      if (off || !id) return
      setUid(id); setStopQueued(pendingZoneStop(id)); reload(id)
    })
    return () => { off = true }
  }, [reload])
  useEffect(() => {
    if (!uid) return
    // L'arrêt en attente a été rejoué (ou annulé) : on relit l'état réel de la zone.
    const onStop = () => { const q = pendingZoneStop(uid); setStopQueued(q); if (!q) reload(uid) }
    window.addEventListener(ZONE_STOP_EVENT, onStop)
    return () => window.removeEventListener(ZONE_STOP_EVENT, onStop)
  }, [uid, reload])

  async function activate() {
    if (!uid) return
    setErr(''); setPosFail(false); setBusy(true)
    const supabase = createClient()
    try {
      cancelPendingZoneStop()
      const pos = await devicePosition()
      const [label, tx] = await Promise.all([sectorLabel(pos.lat, pos.lng), currentMissionId(supabase, uid)])
      const r = await startLiveZone(supabase, { ...pos, label, transactionId: tx })
      if (r.error) setErr(friendlyError(r.error))
    } catch (e) {
      setErr(friendlyError(e, 'Activation impossible.'))
      setPosFail(!!(e as { reason?: string }).reason)
    }
    await reload(uid); setBusy(false)
  }

  async function toggle() {
    if (!uid || !st || busy) return
    setErr(''); setPosFail(false)
    if (zoneActive(st.zone) && !stopQueued) {
      setBusy(true)
      const e = await stopLiveZoneOrQueue(createClient(), uid)
      if (e === 'queued') setStopQueued(true)
      else if (e) setErr(friendlyError(e))
      if (e !== 'queued') await reload(uid)
      setBusy(false)
      return
    }
    if (!st.consent) { setAsk(true); return }
    await activate()
  }

  async function accept() {
    if (!uid) return
    setBusy(true); setErr('')
    const e = await setLiveZoneConsent(createClient(), true)
    if (e) { setErr(friendlyError(e)); setBusy(false); return }
    setAsk(false)
    await reload(uid); setBusy(false)
    await activate()
  }

  async function withdraw() {
    if (!uid) return
    setBusy(true)
    const e = await setLiveZoneConsent(createClient(), false)
    if (e) setErr(friendlyError(e))
    await reload(uid); setBusy(false)
  }

  if (!st?.available) return null
  // Arrêt en attente : l'interrupteur montre le choix du prestataire, la phrase dit que l'arrêt n'est pas encore appliqué.
  const on = zoneActive(st.zone) && !stopQueued
  return (
    <div style={{ padding: compact ? '8px 0 10px' : 14, borderRadius: compact ? 0 : 16, border: compact ? 'none' : '1px solid #E7EDEB', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', lineHeight: 1.3 }}>Je suis en intervention ici (visible aujourd’hui)</b>
          <small style={{ display: 'block', fontSize: 12, color: '#4E6470', marginTop: 3, lineHeight: 1.45 }}>
            {on
              ? `Les clients voient aussi « en intervention près de ${st.zone?.label || 'ce secteur'} », jusqu’à ${untilText(st.zone!.expires_at)}. Votre domicile reste visible.`
              : 'Les clients vous voient aussi là où vous travaillez aujourd’hui, en plus de votre domicile. Vous choisissez, et vous arrêtez quand vous voulez.'}
          </small>
        </div>
        {/* Zone de toucher de 44 px autour de l'interrupteur visible (52 x 30). */}
        <button type="button" role="switch" aria-checked={on} aria-label="Je suis en intervention ici, visible aujourd’hui" disabled={busy} onClick={toggle}
          style={{ minWidth: 60, height: 44, border: 'none', padding: 0, background: 'none', display: 'grid', placeItems: 'center', cursor: busy ? 'wait' : 'pointer', flex: '0 0 auto' }}>
          <span aria-hidden style={{ width: 52, height: 30, borderRadius: 999, background: on ? '#F2A93B' : '#cdd6d3', position: 'relative', display: 'block', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
          </span>
        </button>
      </div>
      {busy && <div role="status" style={{ fontSize: 12, color: '#0B8374', fontWeight: 600, marginTop: 6 }}>Un instant…</div>}
      {stopQueued && <div role="status" style={{ fontSize: 12.5, color: '#8a6520', fontWeight: 600, marginTop: 6, lineHeight: 1.45 }}>
        Arrêt en attente : pas de connexion. Votre secteur reste visible des clients jusqu’au retour du réseau, puis l’arrêt s’applique tout seul.
      </div>}
      {err && <div role="alert" style={{ fontSize: 12.5, color: '#A8432F', fontWeight: 600, marginTop: 6, lineHeight: 1.45, whiteSpace: 'pre-line' }}>{err}</div>}
      {err && posFail && (
        <button type="button" onClick={activate} disabled={busy}
          style={{ marginTop: 6, minHeight: 44, padding: '0 18px', borderRadius: 999, border: '1.5px solid #0B8374', background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          Réessayer
        </button>
      )}
      {st.consent && !on && (
        <button type="button" onClick={withdraw} disabled={busy}
          style={{ marginTop: 6, minHeight: 44, background: 'none', border: 'none', padding: 0, color: '#4E6470', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
          Retirer mon consentement
        </button>
      )}

      <Modal open={ask} onClose={() => setAsk(false)} title="Partager mon secteur d’intervention ?"
        footer={<>
          <Cta onClick={accept} disabled={busy}>J’accepte et j’active</Cta>
          <Cta variant="ghost" onClick={() => setAsk(false)}>Pas maintenant</Cta>
        </>}>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: '0 0 10px', color: '#123644' }}>
          Vous restez visible à votre domicile. Avec cette option, les clients voient aussi que vous intervenez près de chez eux aujourd’hui.
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13.5, lineHeight: 1.6, color: '#123644' }}>
          <li><b>Ce qui est partagé</b> : un secteur à environ 2 km près (ville ou quartier). Jamais votre position exacte, jamais l’adresse de votre client.</li>
          <li><b>Combien de temps</b> : {LIVE_ZONE_HOURS} heures au plus, puis cela s’arrête tout seul. Cela s’arrête aussi à la fin de votre mission en cours.</li>
          <li><b>À tout moment</b> : vous coupez l’interrupteur quand vous voulez, ou vous retirez votre consentement.</li>
          <li><b>Une seule lecture</b> : PING lit la position de votre téléphone au moment où vous activez, sans suivi pendant la journée.</li>
        </ul>
      </Modal>
    </div>
  )
}
