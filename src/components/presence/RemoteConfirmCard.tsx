"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConfirmSheet from '@/components/ConfirmSheet'
import { EUR } from '@/lib/invoice-pdf'
import { clientConfirmPresence, clientDeclinePresence, durLabel, type Phase, type RemoteRequest } from '@/lib/presence'

const hhmm = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })


/**
 * Client absent : le prestataire a envoyé sa position et attend. Un appui suffit pour confirmer ; le code reste
 * disponible pour le lui dicter (téléphone) ; « Ce n'est pas normal » invalide la demande et ouvre le signalement.
 */
export default function RemoteConfirmCard({ txId, phase, req, onDone }: {
  txId: string; phase: Phase; req: RemoteRequest; onDone: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [askNo, setAskNo] = useState(false)
  const p = req.preview

  async function confirm() {
    setBusy(true); setMsg('')
    const r = await clientConfirmPresence(createClient(), txId, phase)
    setBusy(false)
    if (!r.ok) { setMsg(r.message || 'Confirmation impossible, réessayez.'); return }
    onDone()
  }
  async function decline() {
    setBusy(true)
    const r = await clientDeclinePresence(createClient(), txId, phase)
    setBusy(false); setAskNo(false)
    if (!r.ok) { setMsg(r.message || 'Action impossible.'); return }
    router.push(`/mission/${txId}/chat?signaler`)
  }

  const sheet = (
    <ConfirmSheet open={askNo} danger busy={busy}
      title={phase === 'arrivee' ? 'Indiquer que la présence du prestataire n’est pas normale ?' : 'Contester la fin annoncée ?'}
      text={phase === 'arrivee'
        ? 'La demande du prestataire sera refusée et le signalement s’ouvrira dans la conversation, pour décrire ce qui ne va pas. Rien n’est validé sans vous.'
        : 'La fin annoncée ne sera pas validée et le signalement s’ouvrira dans la conversation, pour expliquer votre désaccord. Le paiement reste en attente.'}
      confirmLabel="Oui, signaler" cancelLabel="Non, revenir" onConfirm={() => decline()} onCancel={() => setAskNo(false)} />
  )

  return (
    <div role="alert" style={{ background: '#FFF1EF', border: '2px solid #B3402F', borderRadius: 16, padding: 16 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644' }}>
        {phase === 'arrivee' ? 'Votre prestataire indique être arrivé' : 'Votre prestataire indique avoir terminé'}
      </div>
      <p style={{ fontSize: 12.5, color: '#3d5560', margin: '5px 0 0', lineHeight: 1.5 }}>
        {phase === 'arrivee' ? `Arrivée annoncée à ${hhmm(req.requested_at)}, en votre absence. ` : `Fin annoncée à ${hhmm(req.requested_at)}. `}
        {req.geo_status === 'conforme' ? 'Sa position correspond à l’adresse du rendez-vous.' : 'Sa position n’a pas pu être comparée à l’adresse.'}
      </p>
      {phase === 'fin' && p && (
        <div style={{ marginTop: 10, background: '#fff', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#123644' }}>
          <b>{durLabel(p.duration_minutes)} sur place</b>
          {p.recalcule && p.billed_hours != null ? ` → ${String(p.billed_hours).replace('.', ',')} h facturée${Number(p.billed_hours) > 1 ? 's' : ''}` : ''}
          {p.subtotal_cents != null ? `, prestation ${EUR(p.subtotal_cents)}` : ''}
          {p.total_charged_cents != null && (
            <div style={{ fontSize: 12, color: '#4E6470', marginTop: 2 }}>Total frais compris : {EUR(p.total_charged_cents)}</div>
          )}
        </div>
      )}
      <button onClick={confirm} disabled={busy} style={{
        width: '100%', marginTop: 12, border: 'none', borderRadius: 999, padding: '13px 0', minHeight: 44, background: '#0B8374', color: '#fff',
        fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy ? .7 : 1,
      }}>
        {busy ? 'Enregistrement…' : phase === 'arrivee' ? 'Oui, je confirme sa présence' : 'Je confirme la fin'}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {req.code && (
          <button onClick={() => setShowCode(s => !s)} style={{ flex: 1, border: '1px solid #E7EDEB', background: '#fff', color: '#123644', borderRadius: 999, padding: '9px 0', minHeight: 44, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {showCode ? 'Masquer le code' : 'Code à lui dicter'}
          </button>
        )}
        <button onClick={() => setAskNo(true)} disabled={busy} style={{ flex: 1, border: '1px solid #B3402F', background: '#fff', color: '#B3402F', borderRadius: 999, padding: '9px 0', minHeight: 44, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
          {phase === 'arrivee' ? 'Ce n’est pas normal' : 'Contester'}
        </button>
      </div>
      {showCode && req.code && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: 6, color: '#123644', fontVariantNumeric: 'tabular-nums' }}>{req.code}</div>
          <div style={{ fontSize: 11, color: '#4E6470' }}>Valable jusqu&apos;à {hhmm(req.code_expires_at)}. Ne le donnez qu&apos;au prestataire de cette mission.</div>
        </div>
      )}
      {msg && <div role="status" style={{ marginTop: 8, fontSize: 12, color: '#B3402F' }}>{msg}</div>}
      {sheet}
    </div>
  )
}
