// Prévient l'autre partie d'une mission par e-mail (route /api/notify, limitée à 1 e-mail par mission
// et par destinataire toutes les 10 minutes). Tire-et-oublie : n'attend rien, n'échoue jamais.
// 'booking_request' : réservation à accepter (052) ; 'booking_accepted' / 'booking_refused' / 'booking_expired' : réponse au client.
// 'presence_arrivee' / 'presence_fin' : le prestataire demande au client absent de confirmer (jamais le code).
// 'dispute_mediation' : intervention de PING demandée sur un litige (054), lien vers le dossier (`disputeId`).
export type NotifyEvent = 'message' | 'offer' | 'booking' | 'dispute' | 'presence_arrivee' | 'presence_fin' | 'presence_client' | 'code_client'
  | 'booking_request' | 'booking_accepted' | 'booking_refused' | 'booking_expired' | 'dispute_mediation'

export function notifyOther(transactionId: string, event: NotifyEvent, disputeId?: string) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, event, ...(disputeId ? { disputeId } : {}) }),
      keepalive: true,
    }).catch(() => { })
  } catch { }
}

/**
 * Réservation refusée ou expirée : le serveur rembourse à 100 % si elle avait été payée en ligne (séquestre) et
 * prévient le client par e-mail. Tire-et-oublie ; le cron /api/bookings/expire rattrape tout appel perdu.
 */
export function settleEndedBooking(transactionId: string) {
  try {
    fetch('/api/bookings/ended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId }),
      keepalive: true,
    }).catch(() => { })
  } catch { }
}
