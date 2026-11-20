"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { notifyOther } from '@/lib/notify'
import { TRANSFER_STATUS, formatIban, hasNotReceived, pingBank, transferDue, transferState, transfersFor, type PingBank, type Transfer } from '@/lib/transfers'

/**
 * Règlement par virement (migration 025), sous les factures d'une mission terminée.
 *   Client     : « Régler par virement » — la prestation au prestataire (son IBAN, transmis seulement
 *                à l'acheteur de cette mission, RPC payee_bank_details), les frais de service à PING.
 *   Prestataire: « Commission PING à régler » (IBAN de PING) + suivi « Paiement du client », qu'il note reçu.
 * Le payeur annonce son virement ; seul le destinataire le note reçu (PING = l'admin).
 */
const C = { teal: '#12B39C', tealD: '#0C8F7E', navy: '#123644', slate: '#4E6470', line: '#E7EDEB' }
type PayeeBank = { holder: string | null; iban: string | null; bic: string | null; enseigne: string | null }

function Copy({ value }: { value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500) } catch { } }}
      style={{ border: `1px solid ${C.line}`, background: '#fff', color: C.tealD, borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
      {ok ? 'Copié' : 'Copier'}
    </button>
  )
}

function Line({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5 }}>
      <span style={{ color: C.slate, minWidth: 92 }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: 600, flex: 1, wordBreak: 'break-all', fontFamily: label === 'IBAN' ? 'ui-monospace, monospace' : undefined }}>{value}</span>
      {copy && value && <Copy value={value.replace(/\s/g, label === 'IBAN' ? '' : ' ')} />}
    </div>
  )
}

function Badge({ t }: { t: Transfer }) {
  const s = TRANSFER_STATUS[transferState(t)]
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>{s.t}</span>
}

/** Avoir d'un arrangement à l'amiable (migration 040) sur le virement de la prestation. */
function CreditNote({ t, viewerIsPayer }: { t: Transfer; viewerIsPayer: boolean }) {
  const c = t.credit_cents ?? 0
  if (!t.credit_mode || c <= 0) return null
  const text = t.credit_mode === 'deduit'
    ? `Avoir de ${EUR(c)} (arrangement à l’amiable) déduit de la facture de ${EUR(t.amount_cents)}.${transferDue(t) === 0 ? ' Plus rien à virer.' : ''}`
    : t.credit_refunded_at
      ? `Avoir de ${EUR(c)} (arrangement à l’amiable) remboursé au client le ${dateFr(t.credit_refunded_at)}.`
      : viewerIsPayer
        ? `Avoir de ${EUR(c)} (arrangement à l’amiable) : la prestation étant déjà réglée, le prestataire vous rembourse ${EUR(c)}.`
        : `Avoir de ${EUR(c)} (arrangement à l’amiable) : la prestation étant déjà réglée, remboursez ${EUR(c)} au client, puis notez-le ici.`
  return (
    <p style={{ fontSize: 12, color: C.tealD, background: 'rgba(18,179,156,.1)', borderRadius: 9, padding: '8px 10px', margin: '6px 0', lineHeight: 1.5, fontWeight: 600 }}>{text}</p>
  )
}

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export default function TransferCard({ transactionId, userId }: { transactionId: string; userId: string }) {
  const [rows, setRows] = useState<Transfer[] | null>(null)
  const [ping, setPing] = useState<PingBank | null>(null)
  const [payee, setPayee] = useState<PayeeBank | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState<string | null>(null)

  async function load() {
    const db = createClient()
    const list = await transfersFor(db, transactionId)
    setRows(list)
    setPing(await pingBank(db))
    if (list.some(t => t.payee === 'pro' && t.payer_id === userId)) {
      const { data } = await db.rpc('payee_bank_details', { p_transaction: transactionId })
      setPayee(((data ?? []) as PayeeBank[])[0] ?? null)
    }
  }
  useEffect(() => { load() }, [transactionId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(t: Transfer, status: Transfer['status']) {
    setBusy(t.id); setErr('')
    const { error } = await createClient().from('transfer_payments').update({ status }).eq('id', t.id)
    if (error) setErr('Enregistrement impossible : ' + error.message)
    await load(); setBusy(null)
  }

  // Migration 059 : « Non reçu » (destinataire) et « Mon virement est bien parti » (payeur), par RPC.
  async function contest(t: Transfer, fn: 'transfer_report_not_received' | 'transfer_reaffirm') {
    setBusy(t.id); setErr('')
    const { error } = await createClient().rpc(fn, { p_transfer: t.id, p_note: note.trim() || null })
    if (error) setErr(/function|schema cache/i.test(error.message) ? 'Cette fonction n’est pas encore disponible. Réessayez bientôt.' : error.message)
    else {
      setNote(''); setAsking(null)
      if (fn === 'transfer_report_not_received') notifyOther(t.transaction_id, 'transfer_not_received')
      else notifyOther(t.transaction_id, 'transfer_reaffirmed')
    }
    await load(); setBusy(null)
  }

  async function markRefunded(t: Transfer) {
    setBusy(t.id); setErr('')
    const { error } = await createClient().rpc('mark_settlement_refunded', { p_transfer: t.id })
    if (error) setErr('Enregistrement impossible : ' + error.message)
    await load(); setBusy(null)
  }

  if (!rows || !rows.length) return null
  const toPay = rows.filter(t => t.payer_id === userId)
  const toReceive = rows.filter(t => t.payee_id === userId)
  const isClient = toPay.some(t => t.payer_role === 'client')

  const btn = (primary: boolean): React.CSSProperties => ({
    border: primary ? 'none' : `1.5px solid ${C.line}`, background: primary ? C.teal : '#fff', color: primary ? '#fff' : C.navy,
    fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
  })

  const payBlock = (t: Transfer) => {
    const toPro = t.payee === 'pro'
    const iban = toPro ? payee?.iban : ping?.iban
    const holder = toPro ? (payee?.holder || payee?.enseigne || 'Le prestataire') : (ping?.beneficiary || 'PING')
    const bic = toPro ? payee?.bic : ping?.bic
    return (
      <div key={t.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>
            {toPro ? 'La prestation, au prestataire' : t.payer_role === 'client' ? 'Vos frais de service, à PING' : 'Votre commission, à PING'}
          </div>
          <Badge t={t} />
        </div>
        <Line label="Montant" value={EUR(transferDue(t))} />
        <CreditNote t={t} viewerIsPayer />
        <Line label="Bénéficiaire" value={holder} />
        {iban ? <Line label="IBAN" value={formatIban(iban)} copy /> : (
          <p style={{ fontSize: 12, color: '#8A6520', background: 'rgba(242,169,59,.12)', borderRadius: 9, padding: '8px 10px', margin: '4px 0', lineHeight: 1.5 }}>
            {toPro
              ? 'Le prestataire n’a pas encore renseigné son IBAN. Demandez-le-lui dans la conversation, ou réglez-le directement (chèque, CESU préfinancé s’il l’accepte) : il le notera reçu. Un paiement en espèces n’ouvre pas droit au crédit d’impôt.'
              : 'Les coordonnées bancaires de PING vous seront communiquées très prochainement.'}
          </p>
        )}
        {iban && bic && <Line label="BIC" value={bic} copy />}
        <Line label="Référence" value={t.reference} copy />
        <div style={{ fontSize: 11.5, color: C.slate, margin: '2px 0 6px' }}>
          {t.suspended_at && t.status !== 'recu' ? 'Suspendu : un litige est ouvert sur cette mission. Le paiement est bloqué jusqu’à sa résolution, sans relance de retard ; le montant final suivra la décision.'
            : t.status === 'recu' && transferDue(t) === 0 && t.credit_mode === 'deduit' ? 'Soldé par l’avoir.'
            : t.status === 'recu' ? `Reçu le ${dateFr(t.received_at || t.created_at)}.`
            : t.status === 'declare_paye' ? `Virement annoncé le ${dateFr(t.declared_at || t.created_at)}, en attente de réception.`
            : `À régler avant le ${dateFr(t.due_at)}, avec la référence en libellé du virement.`}
        </div>
        {transferState(t) === 'non_recu' && (
          <div style={{ background: 'rgba(192,80,58,.08)', borderRadius: 9, padding: '9px 11px', margin: '4px 0 8px', fontSize: 12.5, lineHeight: 1.55, color: '#7A2E1E' }}>
            <b>{toPro ? 'Le prestataire' : 'PING'} indique ne pas avoir reçu ce virement</b>{t.not_received_at ? ` (le ${dateFr(t.not_received_at)})` : ''}.
            {t.not_received_note ? ` « ${t.not_received_note} »` : ''} Vérifiez le montant, la référence et l’IBAN sur votre relevé.
            {asking === t.id ? (
              <div style={{ marginTop: 8 }}>
                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Facultatif : date du virement, banque…"
                  style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 12.5, fontFamily: 'Inter, sans-serif' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy === t.id} onClick={() => contest(t, 'transfer_reaffirm')} style={btn(true)}>Confirmer : mon virement est bien parti</button>
                  <button type="button" onClick={() => setAsking(null)} style={btn(false)}>Annuler</button>
                </div>
              </div>
            ) : hasNotReceived(t) && (
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => setAsking(t.id)} style={btn(true)}>Mon virement est bien parti</button>
              </div>
            )}
          </div>
        )}
        {transferState(t) === 'desaccord' && (
          <p style={{ fontSize: 12.5, color: '#7A2E1E', background: 'rgba(192,80,58,.08)', borderRadius: 9, padding: '9px 11px', margin: '4px 0 8px', lineHeight: 1.55 }}>
            Vous maintenez avoir fait ce virement, le destinataire ne le voit pas : PING est informé et peut intervenir dans la conversation de la mission. Une preuve de virement (capture, avis d’exécution) aide à trancher.
          </p>
        )}
        {(t.status === 'a_payer' || t.status === 'en_retard') && transferDue(t) > 0 && (
          <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, 'declare_paye')} style={{ ...btn(true), opacity: busy === t.id ? .6 : 1 }}>
            J’ai fait le virement
          </button>
        )}
        {t.status === 'declare_paye' && (
          <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, 'a_payer')} style={btn(false)}>Pas encore fait</button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
      {toPay.length > 0 && (
        <>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: C.navy }}>
            {isClient ? 'Régler par virement' : 'Commission PING à régler'}
          </div>
          <p style={{ fontSize: 12.5, color: C.slate, lineHeight: 1.55, margin: '4px 0 0' }}>
            {isClient
              ? 'Deux virements : le prix de la prestation directement au prestataire, et vos frais de service à PING. Indiquez la référence en libellé.'
              : 'Par virement, avec la référence en libellé. Sans réception 15 jours après la facture, la commission est retenue sur vos prochains paiements et, au-delà du plafond, le compte est suspendu (CGV prestataires).'}
          </p>
          {toPay.map(payBlock)}
        </>
      )}

      {toReceive.length > 0 && (
        <div style={{ borderTop: toPay.length ? `1px solid ${C.line}` : 'none', paddingTop: toPay.length ? 12 : 0, marginTop: toPay.length ? 12 : 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: C.navy }}>Paiement du client</div>
          {toReceive.map(t => (
            <div key={t.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{EUR(transferDue(t))} · {t.reference}</span>
                <Badge t={t} />
              </div>
              <CreditNote t={t} viewerIsPayer={false} />
              {t.credit_mode === 'a_rembourser' && !t.credit_refunded_at && (
                <button type="button" disabled={busy === t.id} onClick={() => markRefunded(t)} style={{ ...btn(false), marginBottom: 8, opacity: busy === t.id ? .6 : 1 }}>J’ai remboursé le client</button>
              )}
              <div style={{ fontSize: 11.5, color: C.slate, margin: '4px 0 8px', lineHeight: 1.5 }}>
                {t.status === 'recu' ? `Noté reçu le ${dateFr(t.received_at || t.created_at)}.`
                  : t.status === 'declare_paye' ? `Le client a annoncé son virement le ${dateFr(t.declared_at || t.created_at)}. Notez-le reçu dès qu’il apparaît sur votre compte.`
                  : 'Le client règle par virement sur votre IBAN (Mon entreprise, Paiements), ou directement (chèque, CESU préfinancé si vous l’acceptez).'}
              </div>
              {transferState(t) === 'non_recu' && <p style={{ fontSize: 12, color: '#7A2E1E', margin: '0 0 8px', lineHeight: 1.5 }}>Vous avez indiqué ne rien avoir reçu{t.not_received_at ? ` le ${dateFr(t.not_received_at)}` : ''} : le client et PING en sont informés. Dès que le virement apparaît, notez-le reçu.</p>}
              {transferState(t) === 'desaccord' && <p style={{ fontSize: 12, color: '#7A2E1E', margin: '0 0 8px', lineHeight: 1.5 }}>Le client maintient avoir fait le virement{t.reaffirmed_note ? ` : « ${t.reaffirmed_note} »` : ''}. PING est informé et peut intervenir dans la conversation. Si rien n’arrive, vous pouvez aussi ouvrir un litige.</p>}
              {asking === t.id && (
                <div style={{ marginBottom: 8 }}>
                  <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Facultatif : ce que vous constatez (rien sur le relevé depuis le…)"
                    style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 12.5, fontFamily: 'Inter, sans-serif' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy === t.id} onClick={() => contest(t, 'transfer_report_not_received')} style={btn(true)}>Confirmer : non reçu</button>
                    <button type="button" onClick={() => setAsking(null)} style={btn(false)}>Annuler</button>
                  </div>
                </div>
              )}
              {t.status !== 'recu' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, 'recu')} style={{ ...btn(true), opacity: busy === t.id ? .6 : 1 }}>Je l’ai reçu</button>
                  {hasNotReceived(t) && t.declared_at && transferState(t) !== 'non_recu' && asking !== t.id && (
                    <button type="button" disabled={busy === t.id} onClick={() => setAsking(t.id)} style={btn(false)}>Non reçu</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {err && <p style={{ color: '#c0503a', fontSize: 12, marginTop: 8 }}>{err}</p>}
    </div>
  )
}
