"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import {
  acceptBooking, refuseBooking, bookingPending, bookingEnded, deadlineAt, deadlineLeft, firstName,
  signalBookingChange, REFUSAL_REASONS,
} from '@/lib/booking'

/**
 * Réservation directe à accepter (migration 052) : la même carte dans le chat, l'agenda, la commande et la
 * mission du jour.
 *  - Prestataire, en attente : « Accepter » (1 appui) / « Refuser » puis « Confirmer le refus » (2 appuis, motif facultatif).
 *  - Client, en attente : « Réservation envoyée, en attente de [prénom] (réponse sous X h) ».
 *  - Client, refusée ou expirée : « Choisir un autre prestataire » (carte filtrée sur le même service).
 * Rien n'est rendu pour une réservation acceptée (ou avant la migration).
 */
export default function BookingCard({ tx, userId, counterpart, onChange, compact = false, style }: {
  tx: any; userId: string; counterpart?: string | null
  onChange?: (patch: Record<string, unknown>) => void
  compact?: boolean; style?: React.CSSProperties
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'refuse' | null>(null)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [, setTick] = useState(0)
  // Le temps restant se met à jour toutes les minutes.
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(iv) }, [])

  if (!tx || !userId) return null
  const isSeller = userId === tx.seller_id
  const isBuyer = userId === tx.buyer_id
  const pending = bookingPending(tx)
  const ended = bookingEnded(tx)
  if (!pending && !ended) return null
  const pn = firstName(counterpart) || (isSeller ? 'Le client' : 'le prestataire')
  const when = tx.scheduled_at
    ? new Date(tx.scheduled_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  async function accept(e: React.MouseEvent) {
    stop(e)
    setErr(''); setBusy('accept')
    const r = await acceptBooking(createClient(), tx.id)
    setBusy(null)
    if (r.ok) { onChange?.({ booking_status: 'acceptee', accepted_at: new Date().toISOString() }); signalBookingChange(); return }
    if (r.reason === 'expiree') onChange?.({ booking_status: 'expiree', status: 'cancelled' })
    else if (r.reason === 'annulee') onChange?.({ status: 'cancelled' })
    setErr(r.message || 'Action impossible.')
  }
  async function refuse(e: React.MouseEvent) {
    stop(e)
    setErr(''); setBusy('refuse')
    const r = await refuseBooking(createClient(), tx.id, reason)
    setBusy(null)
    if (r.ok) {
      setAsking(false)
      onChange?.({ booking_status: 'refusee', status: 'cancelled', refusal_reason: reason.trim() || null, refused_at: new Date().toISOString() })
      signalBookingChange(); return
    }
    setErr(r.message || 'Action impossible.')
  }

  const box: React.CSSProperties = {
    background: pending && isSeller ? '#FFF7ED' : '#fff', border: `1.5px solid ${pending ? (isSeller ? '#F2A93B' : '#12B39C') : '#DCE5E3'}`,
    borderRadius: 14, padding: compact ? 12 : 14, ...style,
  }
  const h: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: compact ? 13.5 : 14.5, color: '#123644' }
  const p: React.CSSProperties = { fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, margin: '3px 0 0' }
  const btn = (primary: boolean, danger = false): React.CSSProperties => ({
    flex: primary ? 1.4 : 1, minHeight: 48, borderRadius: 999, cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14,
    border: primary ? 'none' : '1.5px solid #DCE5E3', background: primary ? (danger ? '#C0503A' : '#0C8F7E') : '#fff', color: primary ? '#fff' : '#123644',
  })

  // ---- Prestataire : à accepter ----
  if (isSeller && pending) return (
    <div role="region" aria-label="Nouvelle réservation à accepter" style={box} onClick={stop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: '#E8743B', flexShrink: 0 }} />
        <div style={h}>Nouvelle réservation : à accepter</div>
      </div>
      <p style={p}>
        {pn} a réservé{when ? ` pour ${when}` : ''}{tx.payout_cents > 0 ? ` · vous percevez ${EUR(tx.payout_cents)}` : ''}.
      </p>
      <p style={{ ...p, color: '#8a6520', fontWeight: 700 }}>
        Répondez {deadlineAt(tx.accept_deadline) || 'sous 24 h'} (encore {deadlineLeft(tx.accept_deadline)}) : sans réponse, elle est annulée.
      </p>
      {!compact && <p style={{ ...p, fontSize: 11.5, color: '#4E6470' }}>Prix de votre fiche, figé. L&apos;adresse exacte vous est transmise dès que vous acceptez.</p>}
      {!asking ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={accept} disabled={!!busy} style={{ ...btn(true), opacity: busy ? .7 : 1 }}>
            {busy === 'accept' ? 'Acceptation…' : 'Accepter'}
          </button>
          <button type="button" onClick={e => { stop(e); setAsking(true); setErr('') }} disabled={!!busy} style={btn(false)}>Refuser</button>
        </div>
      ) : (
        <div role="group" aria-label="Refuser la réservation" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#123644', marginBottom: 6 }}>Motif (facultatif, transmis au client)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {REFUSAL_REASONS.map(r => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={e => { stop(e); setReason(x => x === r ? '' : r) }}
                style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${reason === r ? '#0C8F7E' : '#DCE5E3'}`, background: reason === r ? 'rgba(18,179,156,.1)' : '#fff', color: '#123644', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {r}
              </button>
            ))}
          </div>
          <input value={reason} onChange={e => setReason(e.target.value.slice(0, 300))} onClick={stop} placeholder="Ou écrivez un motif"
            aria-label="Motif du refus" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 12, border: '1.5px solid #DCE5E3', padding: '0 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={e => { stop(e); setAsking(false) }} disabled={!!busy} style={btn(false)}>Garder</button>
            <button type="button" onClick={refuse} disabled={!!busy} autoFocus style={{ ...btn(true, true), opacity: busy ? .7 : 1 }}>
              {busy === 'refuse' ? 'Refus…' : 'Confirmer le refus'}
            </button>
          </div>
          <p style={{ ...p, fontSize: 11.5, color: '#4E6470' }}>Annulation sans frais, le créneau est libéré.</p>
        </div>
      )}
      {err && <p role="alert" style={{ ...p, color: '#B3402F', fontWeight: 600 }}>{err}</p>}
    </div>
  )

  // ---- Client : en attente ----
  if (isBuyer && pending) return (
    <div role="status" style={box}>
      <div style={h}>Réservation envoyée</div>
      <p style={p}>En attente de {pn} (réponse sous {deadlineLeft(tx.accept_deadline)}).</p>
      {!compact && <p style={{ ...p, fontSize: 11.5, color: '#4E6470' }}>Le prix est figé. Vous êtes prévenu dès sa réponse ; sans réponse {deadlineAt(tx.accept_deadline)}, la réservation est annulée sans frais.</p>}
    </div>
  )

  // ---- Refusée ou expirée ----
  const expired = tx.booking_status === 'expiree'
  if (isBuyer) {
    const service = tx.requests?.category
    return (
      <div role="status" style={box}>
        <div style={h}>{expired ? `Réservation expirée : ${pn} n’a pas répondu à temps` : `${pn} ne peut pas assurer cette réservation`}</div>
        {!expired && tx.refusal_reason && <p style={p}>Motif : {tx.refusal_reason}</p>}
        <p style={{ ...p, fontSize: 11.5, color: '#4E6470' }}>Annulée sans frais : rien ne vous est facturé.</p>
        <button type="button" onClick={e => { stop(e); router.push(service ? `/map?service=${encodeURIComponent(service)}` : '/map') }}
          style={{ ...btn(true), width: '100%', marginTop: 10 }}>Choisir un autre prestataire</button>
      </div>
    )
  }
  return (
    <div role="status" style={{ ...box, padding: '10px 14px' }}>
      <p style={{ ...p, margin: 0, fontWeight: 600 }}>{expired ? 'Réservation expirée sans réponse : annulée, le créneau est libéré.' : 'Vous avez refusé cette réservation : annulée sans frais, le créneau est libéré.'}</p>
    </div>
  )
}
