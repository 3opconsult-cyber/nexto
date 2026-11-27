"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConfirmSheet from '@/components/ConfirmSheet'
import { notifyOther } from '@/lib/notify'
import { EUR } from '@/lib/invoice-pdf'
import {
  clientConfirmPresence, clientDeclinePresence, billedLabel, clientSendPresenceCode, durLabel, presencePhotoUrl,
  type Phase, type RemoteRequest,
} from '@/lib/presence'

const hhmm = (d?: string | null) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
const spaced = (c: string) => c.replace(/^(\d{3})(\d{3})$/, '$1 $2')

/**
 * Client absent (migration 048), une seule action principale :
 *  - arrivée : photo du prestataire (heure, distance à l'adresse) → « Je confirme » (un appui) ; ou envoyer un
 *    code de validation (affiché ici et posté dans la messagerie) ; « Ce n'est pas normal » ;
 *  - fin : durée et montant → « Envoyer mon code de fin » (affiché ici et dans la messagerie), que le
 *    prestataire saisit pour clôturer ; « Contester ».
 */
export default function ClientAbsentAction({ txId, phase, req, proName, buyerFeeRate, forfait = false, onDone }: {
  txId: string; phase: Phase; req: RemoteRequest; proName?: string; buyerFeeRate?: number | null
  /** Forfait avec heures incluses : les heures facturées de l'aperçu sont celles au-delà du forfait. */
  forfait?: boolean; onDone: () => void
}) {
  const router = useRouter()
  const pn = proName || 'Votre prestataire'
  const [busy, setBusy] = useState<'' | 'ok' | 'code' | 'no'>('')
  const [err, setErr] = useState('')
  const [askNo, setAskNo] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [sent, setSent] = useState<{ code: string; exp?: string } | null>(null)

  useEffect(() => {
    let alive = true
    if (phase === 'arrivee' && req.photo_path) presencePhotoUrl(createClient(), req.photo_path).then(u => { if (alive) setPhoto(u) })
    return () => { alive = false }
  }, [phase, req.photo_path])

  // Code déjà envoyé (autre appareil, rechargement) : il reste affiché.
  const shown = sent || (req.code_sent_at && req.code ? { code: req.code, exp: req.code_expires_at } : null)

  async function confirm() {
    setBusy('ok'); setErr('')
    const r = await clientConfirmPresence(createClient(), txId, phase)
    setBusy('')
    if (!r.ok) { setErr(r.message || 'Confirmation impossible, réessayez.'); return }
    onDone()
  }
  async function sendCode() {
    setBusy('code'); setErr('')
    const r = await clientSendPresenceCode(createClient(), txId, phase)
    setBusy('')
    if (!r.ok || !r.code) { setErr(r.message || 'Code non envoyé, réessayez.'); return }
    setSent({ code: r.code, exp: r.expires_at })
    if (!r.already) notifyOther(txId, 'code_client')
    onDone()
  }
  async function decline() {
    setBusy('no')
    const r = await clientDeclinePresence(createClient(), txId, phase)
    setBusy(''); setAskNo(false)
    if (!r.ok) { setErr(r.message || 'Action impossible.'); return }
    router.push(`/mission/${txId}/chat?signaler`)
  }

  const sheet = (
    <ConfirmSheet open={askNo} danger busy={busy === 'no'}
      title={phase === 'arrivee' ? 'Indiquer que la présence du prestataire n’est pas normale ?' : 'Contester la fin annoncée ?'}
      text={phase === 'arrivee'
        ? 'La demande du prestataire sera refusée et le signalement s’ouvrira dans la conversation, pour décrire ce qui ne va pas. Rien n’est validé sans vous.'
        : 'La fin annoncée ne sera pas validée et le signalement s’ouvrira dans la conversation, pour expliquer votre désaccord. Le paiement reste en attente.'}
      confirmLabel="Oui, signaler" cancelLabel="Non, revenir" onConfirm={() => decline()} onCancel={() => setAskNo(false)} />
  )
  const primary: React.CSSProperties = {
    width: '100%', minHeight: 50, marginTop: 12, border: 'none', borderRadius: 999, background: '#0B8374', color: '#fff',
    fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', opacity: busy ? .7 : 1,
  }
  const second: React.CSSProperties = {
    display: 'block', width: '100%', minHeight: 44, marginTop: 6, border: 'none', background: 'none', color: '#0B8374',
    fontWeight: 700, fontSize: 13, textDecoration: 'underline', cursor: 'pointer',
  }
  const codeBlock = shown && (
    <div style={{ marginTop: 12, background: '#fff', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 11.5, color: '#4E6470', fontWeight: 600 }}>{phase === 'arrivee' ? 'Code de validation envoyé' : 'Votre code de fin, envoyé'}</div>
      <div aria-label="Code" style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: 4, color: '#123644', fontVariantNumeric: 'tabular-nums', margin: '2px 0' }}>{spaced(shown.code)}</div>
      <div style={{ fontSize: 11.5, color: '#4E6470' }}>Aussi dans la messagerie. {pn} le saisit{shown.exp ? ` (valable jusqu’à ${hhmm(shown.exp)})` : ''}.</div>
    </div>
  )

  if (phase === 'arrivee') {
    return (
      <div role="alert" style={{ background: '#FFF1EF', border: '2px solid #B3402F', borderRadius: 16, padding: 16 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644' }}>{pn} indique être sur place</div>
        <p style={{ fontSize: 12.5, color: '#3d5560', margin: '5px 0 0', lineHeight: 1.5 }}>
          Photo reçue à {hhmm(req.requested_at)}{req.distance_m != null ? `, à ${req.distance_m} m de votre adresse` : req.geo_status === 'conforme' ? ', position conforme à votre adresse' : ', position non comparable à votre adresse'}. Rien n’est validé sans vous.
        </p>
        {req.photo_path && (
          photo
            ? <img src={photo} alt={`Photo d’arrivée envoyée par ${pn}`} style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginTop: 10 }} />
            : <div style={{ height: 120, borderRadius: 12, marginTop: 10, background: '#F3F6F5', display: 'grid', placeItems: 'center', fontSize: 12, color: '#4E6470' }}>Chargement de la photo…</div>
        )}
        <button type="button" style={primary} disabled={!!busy} onClick={confirm}>{busy === 'ok' ? 'Enregistrement…' : 'Je confirme'}</button>
        {codeBlock}
        <button type="button" style={second} disabled={!!busy} onClick={sendCode}>
          {busy === 'code' ? 'Envoi…' : shown ? 'Renvoyer le code' : 'Ou : envoyer un code de validation'}
        </button>
        <button type="button" style={{ ...second, color: '#B3402F', marginTop: 0 }} disabled={!!busy} onClick={() => setAskNo(true)}>Ce n’est pas normal</button>
        {err && <p role="status" style={{ marginTop: 6, fontSize: 12, color: '#B3402F' }}>{err}</p>}
        {sheet}
      </div>
    )
  }

  const pv = req.preview
  const fee = pv && pv.buyer_fee_cents != null ? pv.buyer_fee_cents : pv && buyerFeeRate && pv.subtotal_cents != null ? Math.round(pv.subtotal_cents * buyerFeeRate) : null
  return (
    <div role="alert" style={{ background: shown ? '#fff' : '#FFF1EF', border: `2px solid ${shown ? '#12B39C' : '#B3402F'}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644' }}>{shown ? 'Code de fin envoyé' : `${pn} indique avoir terminé`}</div>
      {pv && (
        <p style={{ fontSize: 13, color: '#123644', margin: '6px 0 0', lineHeight: 1.5 }}>
          Fin annoncée à {hhmm(req.requested_at)} : <b>{durLabel(pv.duration_minutes)} sur place</b>
          {billedLabel(pv, forfait || !pv.recalcule)}
          {pv.subtotal_cents != null ? `, ${EUR(pv.subtotal_cents)}` : ''}{fee != null ? ` + frais de service ${EUR(fee)}` : ''}.
        </p>
      )}
      {!shown && <p style={{ fontSize: 12.5, color: '#3d5560', margin: '4px 0 0', lineHeight: 1.5 }}>Envoyez votre code de fin : {pn} le saisit pour clôturer. La facture suit.</p>}
      {!shown && <button type="button" style={primary} disabled={!!busy} onClick={sendCode}>{busy === 'code' ? 'Envoi…' : 'Envoyer mon code de fin'}</button>}
      {codeBlock}
      <button type="button" style={{ ...second, color: '#B3402F' }} disabled={!!busy} onClick={() => setAskNo(true)}>Contester</button>
      {err && <p role="status" style={{ marginTop: 6, fontSize: 12, color: '#B3402F' }}>{err}</p>}
      {sheet}
    </div>
  )
}
