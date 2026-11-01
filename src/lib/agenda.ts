// Regles communes de l'agenda (page /agenda et /pro/disponibilites).
// Statuts reellement poses en base : pending, arrived, completed (+ cancelled).
// 'matched', 'en_route' (jamais poses : le depart est transactions.en_route_at) et 'released'
// (pose seulement une fois le paiement en ligne actif) restent toleres par precaution.
export const UPCOMING = ['pending', 'matched', 'en_route', 'arrived']
export const DONE = ['completed', 'released']
export const DEFAULT_DURATION_MIN = 120

export const isDone = (t: { status?: string }) => DONE.includes(t.status ?? '')
export const isUpcoming = (t: { status?: string }) => UPCOMING.includes(t.status ?? '')

// Date du rendez-vous quand elle existe (creneau reserve, migration 012), sinon repli sur la creation.
export function txDate(t: any): Date {
  if (isDone(t)) return new Date(t.completed_at || t.scheduled_at || t.created_at)
  return new Date(t.scheduled_at || t.created_at)
}

export function durationMinutes(t: { duration_minutes?: number | null }): number {
  return t.duration_minutes || DEFAULT_DURATION_MIN
}

export function txEnd(t: any): Date {
  return new Date(new Date(t.scheduled_at).getTime() + durationMinutes(t) * 60000)
}

// Mission confirmee et non annulee : c'est ce qui occupe le calendrier.
export const isConfirmed = (t: any) => !!t.price_confirmed && t.status !== 'cancelled'
