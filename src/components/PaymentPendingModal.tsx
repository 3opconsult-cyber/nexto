"use client"
import Modal, { Cta } from './Modal'

/**
 * Pop-up de paiement — l'encaissement n'est pas branché.
 *
 * Stripe n'est pas en place : la réservation part avec le statut « pending » et
 * rien n'est débité. Demande de Romain (26/10) : plutôt que de dire seulement
 * « ce n'est pas encore actif », simuler clairement le mécanisme prévu
 * (prélèvement à la réservation → séquestre → déblocage au prestataire 24 h
 * après la prestation, sauf réclamation justifiée) pour que les testeurs
 * vivent le parcours complet — en disant explicitement que RIEN n'est
 * réellement débité dans cette version. Le jour où l'encaissement existe,
 * cet écran est remplacé par le vrai formulaire de paiement.
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
    <Modal open={open} onClose={onClose} title="Paiement — version de test">
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.07em', color: '#9A6712',
        background: 'rgba(242,169,59,.15)', padding: '5px 10px', borderRadius: 999,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F2A93B' }} />
        Simulation — aucun prélèvement réel
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#123644', marginTop: 14 }}>
        Votre réservation va être enregistrée et <b>{proName}</b> sera prévenu. Dans la version
        finale, le prélèvement a lieu le jour même, à la validation de la commande. Vous êtes ici
        dans une version de test : <b>aucune somme ne sera réellement débitée</b>.
      </p>

      <div style={{ background: '#F3F6F5', borderRadius: 13, padding: 13, marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12.5, color: '#6E8592' }}>Montant simulé de la réservation</span>
          <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17 }}>{eur(totalCents)}</b>
        </div>
        <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 6, lineHeight: 1.5 }}>
          Ce montant est celui prévu. Il sera recalculé sur la durée réellement passée,
          relevée par les codes d'arrivée et de départ.
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12.5, color: '#6E8592', lineHeight: 1.6 }}>
        Concrètement, dans la version finale : la somme est placée sur{' '}
        <b style={{ color: '#123644' }}>un compte séquestre</b>, débloquée au prestataire
        24 h après la fin de la prestation, sauf réclamation de votre part. Toute réclamation
        nécessite un justificatif (photo) et un contact avec le service client — sans
        réclamation, le prestataire est réglé dans son intégralité.
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0F4F3',
                    fontSize: 11.5, color: '#6E8592', lineHeight: 1.55 }}>
        Rappel : dans cette version de test, rien de tout cela n'est réellement débité ni
        versé — seule la simulation est enregistrée, pour tester le parcours.
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
