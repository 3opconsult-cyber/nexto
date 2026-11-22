// Alertes d'argent et de litige pour l'admin (migration 062). Même vocabulaire que les fonctions SQL
// _payment_alert_label() et _payment_alert_grave() : le test scripts/tests/alertes-admin/run.cjs compare les deux.
// Aucun nom ni texte libre dans ces libellés : ils partent tels quels dans l'e-mail à PING.

export const PAYMENT_ALERT_LABEL: Record<string, string> = {
  cancel_after_arrival: 'Annulation après l’arrivée du prestataire',
  late_cancellation_fees: 'Annulation tardive aux frais du client',
  provider_no_show: 'Prestataire absent déclaré',
  provider_cancellations: 'Prestataire : annulations répétées',
  transfer_not_received: 'Virement signalé non reçu',
  transfer_disagreement: 'Virement : désaccord, le payeur maintient',
  transfer_overdue: 'Commission par virement en retard',
  suspended: 'Compte prestataire suspendu',
  unsuspended: 'Suspension levée',
  mandate_revoked: 'Mandat de prélèvement révoqué',
  mandate_failed: 'Mandat de prélèvement refusé',
  debit_rejected: 'Prélèvement de commission rejeté',
  chargeback: 'Opposition d’un client',
  refund_failed: 'Remboursement en ligne échoué',
}

// Cas graves : pastille + e-mail à PING (cron quotidien). Les autres : pastille seulement.
export const PAYMENT_ALERT_GRAVE: readonly string[] = [
  'cancel_after_arrival', 'provider_no_show', 'transfer_disagreement', 'suspended',
  'mandate_revoked', 'mandate_failed', 'debit_rejected', 'chargeback', 'refund_failed',
]

export function paymentAlertLabel(kind: string): string {
  return PAYMENT_ALERT_LABEL[kind] || `Alerte de paiement : ${kind || 'inconnue'}`
}

export function paymentAlertGrave(kind: string): boolean {
  return PAYMENT_ALERT_GRAVE.includes(kind)
}

// Tri de la liste « Alertes à traiter » : cas graves d'abord, puis les plus récentes.
export function sortPaymentAlerts<T extends { kind: string; created_at: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const g = Number(paymentAlertGrave(b.kind)) - Number(paymentAlertGrave(a.kind))
    return g !== 0 ? g : (b.created_at || '').localeCompare(a.created_at || '')
  })
}

// Kinds de admin_notifications posés par 062.
export const ADMIN_NOTIF_PAYMENT = 'payment_alert'
export const ADMIN_NOTIF_DISPUTE = ['dispute_open', 'dispute_mediation'] as const
