"use client"
import { EUR } from '@/lib/invoice-pdf'
import { contractLabel } from '@/components/MissionRecap'

const pct = (fee: number | null | undefined, sub: number | null | undefined) =>
  fee != null && sub ? `${String(Math.round((fee / sub) * 1000) / 10).replace('.', ',')} %` : ''

/**
 * « Commande validée » (client) / « Commande reçue » (prestataire), maquette du 18/11 : ce qui est figé et ce
 * que chacun paie ou perçoit. Chacun ne voit que SA part : frais de service côté client, commission côté pro.
 * Tarif horaire : le montant se calcule à la fin (heure entamée, heure due au-delà du seuil).
 */
export default function OrderSummary({ tx, asSeller, counterpart, payOn, threshold = 15, compact = false }: {
  tx: any; asSeller: boolean; counterpart?: string; payOn?: boolean; threshold?: number; compact?: boolean
}) {
  const hourlyOnly = tx.hourly_rate_cents != null && tx.included_hours == null && tx.base_forfait_cents == null
  const plus = tx.hourly_rate_cents != null && tx.included_hours != null
  const who = counterpart || (asSeller ? 'le client' : 'le prestataire')
  const sub = tx.subtotal_cents

  if (compact) {
    return (
      <div style={{ fontSize: 12.5, color: '#123644', lineHeight: 1.45 }}>
        {asSeller
          ? <>Vous percevez <b>{hourlyOnly ? `${pct(tx.payout_cents, sub) || '—'} du montant` : EUR(tx.payout_cents)}</b>, commission PING déduite. Le client vous vire la prestation sur facture.</>
          : <>Total <b>{hourlyOnly ? 'calculé à la fin' : EUR(tx.total_charged_cents)}</b>, frais compris. {payOn ? 'Paiement en ligne.' : 'Virement sur facture : rien n’est prélevé aujourd’hui.'}</>}
      </div>
    )
  }

  const row = (l: string, v: string, s?: string, strong?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: '8px 0', minHeight: 44, borderTop: '1px solid #EEF2F1' }}>
      <span style={{ fontSize: 13, color: strong ? '#123644' : '#3d5560', fontWeight: strong ? 700 : 500 }}>
        {l}{s && <small style={{ display: 'block', fontSize: 11.5, color: '#6E8592', fontWeight: 400, marginTop: 1 }}>{s}</small>}
      </span>
      <b style={{ fontSize: strong ? 15 : 13.5, color: '#123644', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{v}</b>
    </div>
  )
  const timeNote = `au temps réel : heure entamée due au-delà de ${threshold} min`

  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 2 }}>Récapitulatif du paiement</div>
      <div style={{ fontSize: 12, color: '#4E6470', marginBottom: 4 }}>{contractLabel(tx)} · prix figé</div>
      {asSeller ? (
        <>
          {row('Prestation, facturée à votre en-tête', hourlyOnly ? `${EUR(tx.hourly_rate_cents)} / h` : EUR(sub), hourlyOnly ? timeNote : plus ? 'heures au-delà au temps réel' : undefined)}
          {row(`Commission PING ${pct(tx.seller_fee_cents, sub)}`, hourlyOnly ? pct(tx.seller_fee_cents, sub) : `− ${EUR(tx.seller_fee_cents)}`, 'à virer à PING après la mission')}
          {row('Vous percevez', hourlyOnly ? `${pct(tx.payout_cents, sub)} du montant` : EUR(tx.payout_cents), undefined, true)}
        </>
      ) : (
        <>
          {row(`Prestation, à ${who}`, hourlyOnly ? `${EUR(tx.hourly_rate_cents)} / h` : EUR(sub), hourlyOnly ? timeNote : plus ? 'heures au-delà au temps réel' : undefined)}
          {row(`Frais de service PING ${pct(tx.buyer_fee_cents, sub)}`, hourlyOnly ? pct(tx.buyer_fee_cents, sub) : EUR(tx.buyer_fee_cents), 'facturés à part par PING')}
          {row('Total', hourlyOnly ? 'calculé à la fin' : EUR(tx.total_charged_cents), undefined, true)}
        </>
      )}
      <p style={{ fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, margin: '8px 0 0' }}>
        {payOn
          ? (asSeller ? 'Paiement en ligne : vous êtes payé après la fin de la mission.' : 'Paiement en ligne : réglez depuis l’écran de paiement. Le prestataire est payé après la fin de la mission.')
          : asSeller
            ? <><b>Virement sur facture.</b> Rien n’est encaissé par PING pour vous : {who} vous vire la prestation à réception de votre facture. Vous virez la commission à PING.</>
            : <><b>Virement sur facture.</b> Rien n’est prélevé aujourd’hui. Après la mission : la prestation à {who}, vos frais de service à PING.</>}
      </p>
    </div>
  )
}
