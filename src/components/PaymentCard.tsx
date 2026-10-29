"use client"
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startCheckout, usePaymentsActive } from '@/lib/paymentsClient'

// État du paiement d'une mission (séquestre), côté client et côté prestataire.
// N'apparaît que si le paiement en ligne est actif : sinon rien ne change dans l'écran.
const eur = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function PaymentCard({ transactionId }: { transactionId: string }) {
  const actif = usePaymentsActive()
  const [state, setState] = useState<{ status: string; total: number; paid: number; payout: number; confirmed: boolean; isBuyer: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: { user } }, { data: tx }, { data: pays }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('transactions').select('buyer_id, payment_status, total_charged_cents, subtotal_cents, payout_cents, price_confirmed').eq('id', transactionId).maybeSingle(),
      supabase.from('payments').select('kind, amount_cents, status').eq('transaction_id', transactionId),
    ])
    if (!tx) return
    const sum = (k: string) => (pays ?? []).filter(p => p.kind === k && p.status === 'succeeded').reduce((s, p) => s + p.amount_cents, 0)
    setState({
      status: tx.payment_status, total: tx.total_charged_cents ?? tx.subtotal_cents ?? 0,
      paid: sum('charge') - sum('refund'), payout: tx.payout_cents ?? 0, confirmed: !!tx.price_confirmed, isBuyer: tx.buyer_id === user?.id,
    })
  }, [transactionId])

  useEffect(() => {
    if (!actif) return
    const back = new URLSearchParams(window.location.search).get('paiement')
    if (back === 'retour') {
      // Retour de la page de paiement : on relit l'état réel chez le prestataire de paiement.
      fetch('/api/payments/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }) })
        .finally(load)
    } else load()
  }, [actif, transactionId, load])

  if (!actif || !state) return null

  async function pay() {
    setBusy(true); setError('')
    const r = await startCheckout(transactionId)
    if (r.redirectUrl) { window.location.href = r.redirectUrl; return }
    setError(r.error || 'Paiement indisponible.')
    setBusy(false)
  }

  const isBuyer = state.isBuyer
  const rest = Math.max(0, state.total - state.paid)
  const s = state.status
  const tone = s === 'held' || s === 'released' ? 'ok' : s === 'failed' ? 'ko' : 'wait'
  const title = isBuyer
    ? { none: 'Paiement à effectuer', awaiting: 'Paiement en attente', failed: 'Paiement refusé', held: 'Payé — montant bloqué', complement_due: 'Complément à régler', released: 'Réglé au prestataire', refunded: 'Remboursé' }[s]
    : { none: 'Le client n’a pas encore payé', awaiting: 'Paiement du client en attente', failed: 'Paiement du client refusé', held: 'Le client a payé', complement_due: 'Complément attendu du client', released: 'Versé sur votre compte', refunded: 'Remboursé au client' }[s]
  const detail = isBuyer
    ? s === 'held' ? `${eur(state.paid)} bloqués chez notre partenaire de paiement. Versés au prestataire 24 h après la fin, sauf réclamation de votre part.`
      : s === 'complement_due' ? `La mission a duré plus longtemps que prévu : reste ${eur(rest)} à régler.`
      : s === 'released' ? `${eur(state.paid)} réglés.`
      : s === 'refunded' ? 'Le montant a été rendu sur votre carte.'
      : state.confirmed ? `${eur(rest)} par carte. L’argent reste bloqué jusqu’à la fin de la mission.` : 'Le paiement s’ouvre dès que le tarif est validé.'
    : s === 'held' ? `Vous recevrez ${eur(state.payout)} 24 h après le scan de fin, sauf réclamation du client.`
      : s === 'released' ? `${eur(state.payout)} envoyés vers votre IBAN.`
      : s === 'complement_due' ? `Reste ${eur(rest)} à régler par le client avant le versement.`
      : 'Le versement part une fois que le client a payé et que la mission est terminée.'
  const canPay = isBuyer && state.confirmed && rest > 0 && ['none', 'awaiting', 'failed', 'complement_due'].includes(s)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, border: '1px solid #E7EDEB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: tone === 'ok' ? 'rgba(18,179,156,.12)' : tone === 'ko' ? 'rgba(192,80,58,.12)' : 'rgba(242,169,59,.15)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={tone === 'ok' ? '#0C8F7E' : tone === 'ko' ? '#c0503a' : '#9A6712'} strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6E8592', lineHeight: 1.5, marginTop: 2 }}>{detail}</div>
        </div>
      </div>
      {canPay && (
        <button onClick={pay} disabled={busy} style={{ width: '100%', marginTop: 12, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Ouverture du paiement…' : `Payer ${eur(rest)}`}
        </button>
      )}
      {error && <p style={{ color: '#c0503a', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  )
}
