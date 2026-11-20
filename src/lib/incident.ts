/**
 * Délai pour déclarer un incident (décision Romain 20/11/2026) : après la fin de la mission, client et
 * prestataire ont 24 h pour ouvrir un litige. Passé ce délai, le paiement est libéré et plus aucun litige
 * n'est possible : jamais de remboursement « à la main » après versement. Même règle en base (migration 055).
 */
export const INCIDENT_WINDOW_H = 24

type TxLike = { completed_at?: string | null; payment_status?: string | null }

/** Fin du délai (null tant que la mission n'est pas terminée : un incident reste possible). */
export function incidentDeadline(tx: TxLike): Date | null {
  return tx.completed_at ? new Date(new Date(tx.completed_at).getTime() + INCIDENT_WINDOW_H * 3600_000) : null
}

/** Un litige peut-il encore être ouvert sur cette mission ? */
export function incidentOpen(tx: TxLike, now = Date.now()): boolean {
  if (tx.payment_status === 'released') return false
  const end = incidentDeadline(tx)
  return !end || now < end.getTime()
}

/** « jusqu'au 21 nov. à 14 h 05 » */
export function incidentDeadlineLabel(tx: TxLike): string | null {
  const end = incidentDeadline(tx)
  if (!end) return null
  return `jusqu'au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`
}
