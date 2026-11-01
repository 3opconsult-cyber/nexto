"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { TRANSFER_STATUS, formatIban, pingBank, transfersFor, type PingBank, type Transfer } from '@/lib/transfers'

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
  const s = TRANSFER_STATUS[t.status]
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>{s.t}</span>
}

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export default function TransferCard({ transactionId, userId }: { transactionId: string; userId: string }) {
  const [rows, setRows] = useState<Transfer[] | null>(null)
  const [ping, setPing] = useState<PingBank | null>(null)
  const [payee, setPayee] = useState<PayeeBank | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

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
        <Line label="Montant" value={EUR(t.amount_cents)} />
        <Line label="Bénéficiaire" value={holder} />
        {iban ? <Line label="IBAN" value={formatIban(iban)} copy /> : (
          <p style={{ fontSize: 12, color: '#8A6520', background: 'rgba(242,169,59,.12)', borderRadius: 9, padding: '8px 10px', margin: '4px 0', lineHeight: 1.5 }}>
            {toPro
              ? 'Le prestataire n’a pas encore renseigné son IBAN. Demandez-le-lui dans la conversation, ou réglez-le directement (CESU, espèces) : il le notera reçu.'
              : 'Les coordonnées bancaires de PING vous seront communiquées très prochainement.'}
          </p>
        )}
        {iban && bic && <Line label="BIC" value={bic} copy />}
        <Line label="Référence" value={t.reference} copy />
        <div style={{ fontSize: 11.5, color: C.slate, margin: '2px 0 6px' }}>
          {t.status === 'recu' ? `Reçu le ${dateFr(t.received_at || t.created_at)}.`
            : t.status === 'declare_paye' ? `Virement annoncé le ${dateFr(t.declared_at || t.created_at)}, en attente de réception.`
            : `À régler avant le ${dateFr(t.due_at)}, avec la référence en libellé du virement.`}
        </div>
        {(t.status === 'a_payer' || t.status === 'en_retard') && (
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
                <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{EUR(t.amount_cents)} · {t.reference}</span>
                <Badge t={t} />
              </div>
              <div style={{ fontSize: 11.5, color: C.slate, margin: '4px 0 8px', lineHeight: 1.5 }}>
                {t.status === 'recu' ? `Noté reçu le ${dateFr(t.received_at || t.created_at)}.`
                  : t.status === 'declare_paye' ? `Le client a annoncé son virement le ${dateFr(t.declared_at || t.created_at)}. Notez-le reçu dès qu’il apparaît sur votre compte.`
                  : 'Le client règle par virement sur votre IBAN (Mon entreprise, Paiements), ou directement (CESU, espèces).'}
              </div>
              {t.status !== 'recu' && (
                <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, 'recu')} style={{ ...btn(true), opacity: busy === t.id ? .6 : 1 }}>Je l’ai reçu</button>
              )}
            </div>
          ))}
        </div>
      )}
      {err && <p style={{ color: '#c0503a', fontSize: 12, marginTop: 8 }}>{err}</p>}
    </div>
  )
}
