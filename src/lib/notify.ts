// Prévient l'autre partie d'une mission par e-mail (route /api/notify, limitée à 1 e-mail par mission
// et par destinataire toutes les 10 minutes). Tire-et-oublie : n'attend rien, n'échoue jamais.
export type NotifyEvent = 'message' | 'offer' | 'booking' | 'dispute'

export function notifyOther(transactionId: string, event: NotifyEvent) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, event }),
      keepalive: true,
    }).catch(() => { })
  } catch { }
}
