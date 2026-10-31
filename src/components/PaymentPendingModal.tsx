"use client"
import Modal, { Cta } from './Modal'

/**
 * Pop-up avant de confirmer une réservation, tant que le paiement en ligne est éteint.
 *
 * Décision Romain du 31/10/2026 : on règle par virement SEPA dans un premier temps, le compte
 * séquestre est en suspens. Rien n'est débité à la réservation : après l'intervention, la facture
 * arrive dans « Mes opérations » avec les coordonnées bancaires, et le client vire la prestation
 * directement au prestataire, ses frais de service à PING (migration 025, TransferCard).
 */
export default function PaymentPendingModal({
  open, onClose, onConfirm, totalCents, proName, busy,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void
  totalCents: number; proName: string; busy?: boolean
}) {
  const eur = (c: number) =>
    (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  return (
    <Modal open={open} onClose={onClose} title="Paiement par virement">
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.07em', color: '#0C8F7E',
        background: 'rgba(18,179,156,.1)', padding: '5px 10px', borderRadius: 999,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12B39C' }} />
        Rien n&apos;est débité à la réservation
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#123644', marginTop: 14 }}>
        Votre réservation va être enregistrée et <b>{proName}</b> sera prévenu. Vous réglez
        <b> après l&apos;intervention, sur facture, par virement</b> : le prix de la prestation
        directement au prestataire, et vos frais de service à PING.
      </p>

      <div style={{ background: '#F3F6F5', borderRadius: 13, padding: 13, marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12.5, color: '#4E6470' }}>Montant prévu, frais compris</span>
          <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17 }}>{eur(totalCents)}</b>
        </div>
        <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 6, lineHeight: 1.5 }}>
          Recalculé sur la durée réellement passée, relevée par les codes d&apos;arrivée et de départ.
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12.5, color: '#4E6470', lineHeight: 1.6 }}>
        Après le scan de fin, les factures et les coordonnées bancaires (IBAN, référence à indiquer)
        apparaissent dans <b style={{ color: '#123644' }}>Mes opérations</b>. Un problème ? Signalez-le
        avant de régler : la réclamation passe par PING.
      </div>

      <div style={{ height: 6 }} />

      <div slot="footer" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
        <Cta onClick={onConfirm} disabled={busy}>
          {busy ? 'Enregistrement…' : 'J\'ai compris, réserver'}
        </Cta>
        <Cta variant="ghost" onClick={onClose}>Annuler</Cta>
      </div>
    </Modal>
  )
}
