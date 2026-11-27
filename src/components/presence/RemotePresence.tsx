"use client"
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyOther } from '@/lib/notify'
import { systemSender } from '@/lib/systemMessage'
import { requestRemotePresence, validatePresence, type Phase, type RemoteRequest } from '@/lib/presence'
import { geoMessage, isGeoFail, readPositionOnce } from '@/lib/position'
import { friendlyError } from '@/lib/netError'

const hhmm = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/**
 * Prestataire, client absent (arrivée ou fin) : une seule position, après consentement explicite, comparée à
 * l'adresse ; le client est prévenu (fil, pastille, e-mail sans code) et confirme en un appui, ou dicte le code.
 * Aucune validation sans le client (l'ancienne voie « photo + GPS » est supprimée).
 * `v2` false (migration 038 absente) : arrivée seulement, code de la migration 033.
 */
export default function RemotePresence({ txId, phase, v2, remote, onDone, initialOpen = false }: {
  txId: string; phase: Phase; v2: boolean; remote?: RemoteRequest; onDone: () => void; initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [posFail, setPosFail] = useState(false)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')

  const pending = remote?.etat === 'en_attente'
  const waiting = pending || sent

  async function send() {
    setConsent(false); setInfo(''); setPosFail(false); setBusy(true)
    const pos = await readPositionOnce()
    if (isGeoFail(pos)) { setBusy(false); setPosFail(true); setInfo(geoMessage(pos.reason)); return }
    const r = await requestRemotePresence(txId, phase, pos)
    setBusy(false)
    if (r.ok !== true) {
      const f = r as Extract<typeof r, { ok: false }>
      setInfo(friendlyError(f.message))
      if (f.error === 'throttled') setSent(true)
      return
    }
    setSent(true)
    notifyOther(txId, v2 ? (phase === 'arrivee' ? 'presence_arrivee' : 'presence_fin') : 'message')
    setInfo(r.geo === 'conforme'
      ? `Le client est prévenu. Votre position correspond à l’adresse (précision ± ${Math.round(pos.accuracyM)} m).`
      : 'Le client est prévenu. Votre position n’a pas pu être comparée à l’adresse : seule la confirmation du client fait foi.')
    onDone()
  }

  async function submitCode() {
    if (!/^\d{6}$/.test(code)) { setInfo('Le code comporte 6 chiffres.'); return }
    setBusy(true); setInfo('')
    const supabase = createClient()
    if (v2) {
      const r = await validatePresence(supabase, txId, phase, code)
      setBusy(false)
      if (!r.ok) { setInfo(friendlyError(r.message, 'Code refusé.')); return }
      onDone()
      return
    }
    // Repli 033 (arrivée seulement).
    const { data: r, error } = await supabase.rpc('arrive_with_code', { p_transaction: txId, p_code: code })
    if (error) { setBusy(false); setInfo(friendlyError(error)); return }
    if (!r?.ok) {
      setBusy(false)
      setInfo(r?.reason === 'bad_code' ? `Code incorrect. Il vous reste ${r.remaining} essai${r.remaining > 1 ? 's' : ''}.`
        : r?.reason === 'locked' ? 'Trop d’essais : demandez un nouveau code.' : 'Code expiré ou absent : demandez un nouveau code.')
      return
    }
    await supabase.from('messages').insert({
      transaction_id: txId, ...(await systemSender(supabase)),
      body: `✓ Arrivée validée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — client absent, code de confirmation saisi par le prestataire`,
    })
    setBusy(false)
    onDone()
  }

  if (!v2 && phase === 'fin') return null

  const ghost: React.CSSProperties = {
    width: '100%', border: '1.5px solid #E7EDEB', background: '#fff', color: '#123644', borderRadius: 999,
    padding: '11px 0', minHeight: 44, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  }

  if (!open && !waiting) {
    return (
      <button onClick={() => setOpen(true)} style={ghost}>
        {phase === 'arrivee' ? 'Le client n’est pas là' : 'Le client n’est pas là (fin à distance)'}
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>
        {phase === 'arrivee' ? 'Client absent : faire confirmer votre arrivée' : 'Client absent : faire confirmer la fin'}
      </div>

      {!waiting && !consent && (
        <>
          <p style={{ fontSize: 12.5, color: '#4E6470', margin: '5px 0 10px', lineHeight: 1.5 }}>
            Votre position est envoyée une seule fois et comparée à l&apos;adresse. Le client est prévenu et confirme en un appui,
            ou vous dicte un code. Rien n&apos;est validé sans lui.
          </p>
          <button onClick={() => setConsent(true)} disabled={busy} style={{ ...ghost, background: '#123644', color: '#fff', border: 'none' }}>
            {busy ? 'Localisation…' : 'Prévenir le client'}
          </button>
          <button onClick={() => setOpen(false)} style={{ marginTop: 6, width: '100%', border: 'none', background: 'none', color: '#4E6470', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>Annuler</button>
        </>
      )}

      {consent && (
        <div style={{ marginTop: 8, padding: 11, borderRadius: 12, background: '#F3F6F5', fontSize: 12, lineHeight: 1.5, color: '#123644' }}>
          <b>Utilisation de votre position</b><br />
          Votre position sera relevée une seule fois, uniquement pour {phase === 'arrivee' ? 'votre arrivée' : 'la fin de mission'} en l&apos;absence du client
          (pas de suivi). Elle est enregistrée avec la mission et consultable en cas de litige.
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <button onClick={send} style={{ ...ghost, background: '#0B8374', color: '#fff', border: 'none' }}>J&apos;accepte</button>
            <button onClick={() => setConsent(false)} style={ghost}>Annuler</button>
          </div>
        </div>
      )}

      {waiting && (
        <>
          <p role="status" style={{ fontSize: 12.5, color: '#3d5560', margin: '6px 0 0', lineHeight: 1.5 }}>
            {pending && remote ? `Demande envoyée à ${hhmm(remote.requested_at)}. ` : ''}
            {v2 ? 'Dès que le client confirme, cette page se met à jour. Il peut aussi vous dicter son code :' : 'Demandez au client le code affiché dans son application :'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Code du client"
              style={{ flex: 1, minWidth: 0, borderRadius: 10, border: '1.5px solid #E7EDEB', padding: '9px 10px', fontSize: 17, letterSpacing: 4, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
            <button onClick={submitCode} disabled={busy || code.length !== 6} style={{
              border: 'none', borderRadius: 999, padding: '9px 16px', background: '#0B8374', color: '#fff', fontWeight: 700,
              opacity: code.length === 6 && !busy ? 1 : .6, cursor: 'pointer',
            }}>Valider</button>
          </div>
          {remote?.etat === 'refusee' && <p style={{ fontSize: 12, color: '#B3402F', margin: '8px 0 0' }}>Le client a indiqué que ce n&apos;était pas normal. Échangez avec lui dans la conversation.</p>}
          <button onClick={() => setConsent(true)} disabled={busy} style={{ marginTop: 8, width: '100%', border: 'none', background: 'none', color: '#0B8374', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
            Prévenir à nouveau le client
          </button>
        </>
      )}
      {info && <div role="status" style={{ marginTop: 7, fontSize: 12, color: '#123644', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{info}</div>}
      {posFail && !busy && (
        <button type="button" onClick={send} style={{ ...ghost, marginTop: 8, background: '#0B8374', color: '#fff', border: 'none' }}>Réessayer</button>
      )}
    </div>
  )
}
