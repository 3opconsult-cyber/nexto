"use client"
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { amountToCents } from '@/components/DisputeFields'

/**
 * Arrangement à l'amiable (décision Romain du 18/11/2026, migration 040).
 * Une partie propose UN montant (au plus le prix de la prestation), l'autre accepte ou refuse.
 * Accepté : litige clos « Arrangement à l'amiable : X € », avoir sur la facture de la prestation,
 * virement ajusté. Tout passe par les RPC propose_settlement / accept_settlement / decline_settlement.
 * Trois appuis au plus de chaque côté : « Arrangement à l'amiable » → montant → « Envoyer » ;
 * « Accepter » → « Confirmer » (ou « Refuser »).
 *
 * Tant que la migration 040 n'est pas appliquée, la ligne du litige n'a pas de colonne
 * `settlement_status` (lue avec select('*')) : le composant ne rend rien, aucun appel n'est fait.
 */
export type SettlementDispute = {
  id?: string; status: string
  settlement_cents?: number | null; settlement_by?: string | null
  settlement_status?: 'proposee' | 'acceptee' | 'refusee' | null; agreed_cents?: number | null
}

const C = { teal: '#12B39C', tealD: '#0C8F7E', navy: '#123644', slate: '#4E6470', line: '#E7EDEB' }

export const settlementAvailable = (d: unknown) => !!d && typeof d === 'object' && 'settlement_status' in (d as object)

export default function AmicableSettlement({ dispute, buyerId, sellerId, userId, ceilingCents, onChange }: {
  dispute: SettlementDispute; buyerId: string; sellerId: string; userId: string
  /** Prix de la prestation (borne indicative ; la base vérifie la vraie borne). */
  ceilingCents?: number | null
  onChange: () => void
}) {
  const [step, setStep] = useState<'idle' | 'form' | 'confirm'>('idle')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!settlementAvailable(dispute) || !dispute.id) return null
  const party = userId === buyerId || userId === sellerId
  const st = dispute.settlement_status ?? null
  const cents = dispute.settlement_cents ?? 0

  if (dispute.status !== 'open') {
    if (st !== 'acceptee') return null
    const agreed = dispute.agreed_cents ?? cents
    return (
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(18,179,156,.1)', border: '1px solid rgba(18,179,156,.35)' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: C.tealD }}>Arrangement à l’amiable : {EUR(agreed)}</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 3, lineHeight: 1.5 }}>
          {agreed > 0 ? `Accepté par les deux parties. Un avoir de ${EUR(agreed)} est déduit de la facture de la prestation.` : 'Accepté par les deux parties, sans montant à déduire.'}
        </div>
      </div>
    )
  }
  if (!party) {
    return st === 'proposee' ? (
      <div style={{ marginTop: 10, fontSize: 12.5, color: C.navy }}>
        Arrangement à l’amiable proposé par {dispute.settlement_by === buyerId ? 'le client' : 'le prestataire'} : <b>{EUR(cents)}</b>, en attente de réponse.
      </div>
    ) : null
  }

  async function call(fn: 'propose_settlement' | 'accept_settlement' | 'decline_settlement', args: Record<string, unknown>) {
    setBusy(true); setErr('')
    const { error } = await createClient().rpc(fn, args)
    setBusy(false)
    if (error) { setErr(error.message || 'Action impossible. Réessayez.'); return false }
    // Accord conclu : le serveur répartit l'argent (séquestre : X € rendus au client, le reste versé au
    // prestataire) et prévient les deux parties. Virement : l'avoir est déjà posé par la base (040).
    if (fn === 'accept_settlement' && dispute.id) {
      fetch('/api/disputes/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeId: dispute.id }), keepalive: true }).catch(() => { })
    }
    setStep('idle'); setAmount(''); onChange()
    return true
  }

  function send() {
    const c = amountToCents(amount)
    if (c == null) { setErr('Indiquez un montant en euros.'); return }
    if (ceilingCents != null && c > ceilingCents) { setErr(`Au plus ${EUR(ceilingCents)}, le prix de la prestation.`); return }
    call('propose_settlement', { p_dispute: dispute.id, p_amount_cents: c })
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 44, padding: '10px 12px', borderRadius: 999, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1,
    border: primary ? 'none' : `1.5px solid ${C.line}`, background: primary ? C.teal : '#fff', color: primary ? '#fff' : C.navy,
    fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5,
  })
  const link: React.CSSProperties = { border: 'none', background: 'none', padding: '0 4px', minHeight: 44, color: C.tealD, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
  const pendingFromOther = st === 'proposee' && dispute.settlement_by !== userId
  const pendingFromMe = st === 'proposee' && dispute.settlement_by === userId
  const otherLabel = dispute.settlement_by === buyerId ? 'Le client' : 'Le prestataire'

  const form = (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={`amiable-${dispute.id}`} style={{ display: 'block', fontSize: 12, color: C.slate, marginBottom: 6, lineHeight: 1.5 }}>
        Un seul montant, déduit de la prestation{ceilingCents != null ? ` (au plus ${EUR(ceilingCents)})` : ''}. S’il est accepté, le litige est clos et un avoir est émis.
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 130, flexShrink: 0 }}>
          <input id={`amiable-${dispute.id}`} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 28px 10px 12px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'inherit' }} />
          <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: C.slate, fontSize: 14 }}>€</span>
        </div>
        <button type="button" onClick={send} disabled={busy || !amount.trim()} style={{ ...btn(true), opacity: busy || !amount.trim() ? .5 : 1 }}>Envoyer</button>
        <button type="button" onClick={() => { setStep('idle'); setErr('') }} style={{ ...link, color: C.slate, flexShrink: 0 }}>Annuler</button>
      </div>
    </div>
  )

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#fff', border: `1.5px solid ${pendingFromOther ? '#F2A93B' : C.line}` }}>
      {pendingFromOther && step !== 'form' && (
        <>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: C.navy }}>
            {otherLabel} propose un arrangement à l’amiable : {EUR(cents)}
          </div>
          <div style={{ fontSize: 12, color: C.slate, marginTop: 3, lineHeight: 1.5 }}>
            Montant déduit de la prestation{ceilingCents != null ? ` (${EUR(ceilingCents)})` : ''}. Si vous acceptez, le litige est clos.
          </div>
          {step === 'confirm' ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={() => call('accept_settlement', { p_dispute: dispute.id })} style={btn(true)}>Confirmer l’accord à {EUR(cents)}</button>
              <button type="button" disabled={busy} onClick={() => setStep('idle')} style={{ ...btn(false), flex: '0 0 auto' }}>Retour</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={() => setStep('confirm')} style={btn(true)}>Accepter</button>
              <button type="button" disabled={busy} onClick={() => call('decline_settlement', { p_dispute: dispute.id })} style={btn(false)}>Refuser</button>
            </div>
          )}
          <button type="button" onClick={() => { setStep('form'); setErr('') }} style={{ ...link, marginTop: 8 }}>Proposer un autre montant</button>
        </>
      )}

      {pendingFromMe && step !== 'form' && (
        <>
          <div style={{ fontSize: 13, color: C.navy }}>Vous proposez un arrangement à l’amiable : <b>{EUR(cents)}</b></div>
          <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>En attente de la réponse de l’autre partie.</div>
          <button type="button" onClick={() => { setAmount((cents / 100).toString().replace('.', ',')); setStep('form'); setErr('') }} style={{ ...link, marginTop: 6 }}>Modifier le montant</button>
        </>
      )}

      {!pendingFromOther && !pendingFromMe && step !== 'form' && (
        <>
          {st === 'refusee' && (
            <div style={{ fontSize: 12, color: C.slate, marginBottom: 8 }}>
              {dispute.settlement_by === userId ? 'Votre' : 'La'} proposition de {EUR(cents)} a été refusée.
            </div>
          )}
          <button type="button" onClick={() => { setStep('form'); setErr('') }} style={{ ...btn(true), width: '100%' }}>Arrangement à l’amiable</button>
        </>
      )}

      {step === 'form' && form}
      {err && <div role="alert" style={{ color: '#c0503a', fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ fontSize: 11.5, color: C.slate, marginTop: 8, lineHeight: 1.5 }}>Pas d’accord ? Demandez l’intervention de PING depuis le dossier du litige : PING décide du montant rendu au client.</div>
    </div>
  )
}
