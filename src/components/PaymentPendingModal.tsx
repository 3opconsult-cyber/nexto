"use client"
import Modal, { Cta } from './Modal'

/**
 * Pop-up de paiement — l'encaissement n'est pas branché.
 *
 * Stripe n'est pas en place : la réservation part avec le statut « pending » et
 * rien n'est débité. Plutôt que de laisser le client le découvrir plus tard,
 * on le dit avant qu'il valide. Le jour où l'encaissement existe, cet écran est
 * remplacé par le vrai formulaire de paiement — pas retiré discrètement.
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
    <Modal open={open} onClose={onClose} title="Le paiement en ligne n'est pas encore actif">
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.07em', color: '#9A6712',
        background: 'rgba(242,169,59,.15)', padding: '5px 10px', borderRadius: 999,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F2A93B' }} />
        Encaissement à venir
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#123644', marginTop: 14 }}>
        Votre réservation va être enregistrée et <b>{proName}</b> sera prévenu. En revanche,
        aucune somme ne sera prélevée aujourd'hui : le paiement en ligne n'est pas encore ouvert
        sur PING.
      </p>

      <div style={{ background: '#F3F6F5', borderRadius: 13, padding: 13, marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12.5, color: '#6E8592' }}>Montant de la réservation</span>
          <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17 }}>{eur(totalCents)}</b>
        </div>
        <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 6, lineHeight: 1.5 }}>
          Ce montant est celui prévu. Il sera recalculé sur la durée réellement passée,
          relevée par les codes d'arrivée et de départ.
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12.5, color: '#6E8592', lineHeight: 1.6 }}>
        Concrètement : <b style={{ color: '#123644' }}>vous réglerez directement le prestataire</b> à
        la fin de l'intervention. Le montant, la durée et la facture restent enregistrés dans
        l'application, et une équipe peut reprendre le dossier en cas de désaccord.
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0F4F3',
                    fontSize: 11.5, color: '#6E8592', lineHeight: 1.55 }}>
        Quand l'encaissement sera ouvert, le montant sera bloqué à la réservation et versé au
        prestataire 24 h après la fin de la mission, sauf litige signalé.
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
