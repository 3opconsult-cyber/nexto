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

// Alertes envoyées à PING en quasi-immédiat (route POST /api/admin/alerte-immediate, appelée par l'application juste
// après l'action). `kind` = ce que l'écran déclare ; `notif` = kind de la ligne admin_notifications (migration 062) ;
// `payment` = codes `payment_alerts.kind` acceptés. Aucun texte libre : seuls ces titres partent par e-mail.
export type ImmediateKind = 'cancellation' | 'provider_no_show' | 'transfer' | 'dispute_open' | 'dispute_mediation'
export const IMMEDIATE_ALERTS: Record<ImmediateKind, { notif: string; payment?: readonly string[]; title: string }> = {
  cancellation: { notif: 'payment_alert', payment: ['cancel_after_arrival', 'late_cancellation_fees'], title: '' },
  provider_no_show: { notif: 'payment_alert', payment: ['provider_no_show'], title: '' },
  transfer: { notif: 'payment_alert', payment: ['transfer_not_received', 'transfer_disagreement'], title: '' },
  dispute_open: { notif: 'dispute_open', title: 'Litige ouvert' },
  dispute_mediation: { notif: 'dispute_mediation', title: 'Intervention de PING demandée' },
}
export const isImmediateKind = (k: unknown): k is ImmediateKind => typeof k === 'string' && Object.prototype.hasOwnProperty.call(IMMEDIATE_ALERTS, k)
