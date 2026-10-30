// Outils de dates du calendrier partagé. Tout est en heure locale du navigateur (Europe/Paris pour
// les utilisateurs de PING) ; les jours sont décalés avec setDate (et jamais ± 24 h en
// millisecondes) pour garder la même heure affichée à travers les changements d'heure été/hiver.

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()))
  return x
}

// La semaine commence le lundi.
export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

// Date locale du jour `day` à `minutes` après minuit.
export function atMinutes(day: Date, minutes: number) {
  const x = startOfDay(day)
  x.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return x
}

export function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function timeLabel(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function rangeLabel(start: Date, end: Date) {
  const day = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day} · ${timeLabel(start)} – ${timeLabel(end)}`
}
