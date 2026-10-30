import type { SupabaseClient } from '@supabase/supabase-js'

// Créneaux réservables (migration 012). Tant que la migration n'est pas appliquée, la table
// n'existe pas : on renvoie `null` et les écrans masquent la réservation par créneau.
export type Slot = { id: string; provider_id: string; starts_at: string; duration_minutes: number; transaction_id: string | null }

export async function fetchSlots(supabase: SupabaseClient, providerId: string, days = 30): Promise<Slot[] | null> {
  const from = new Date()
  const to = new Date(from.getTime() + days * 86400000)
  const { data, error } = await supabase.from('provider_slots')
    .select('id, provider_id, starts_at, duration_minutes, transaction_id')
    .eq('provider_id', providerId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
  if (error) return null
  return data as Slot[]
}

// Créneaux d'une période précise (navigation dans le calendrier).
export async function fetchSlotsBetween(supabase: SupabaseClient, providerId: string, from: Date, to: Date): Promise<Slot[] | null> {
  const { data, error } = await supabase.from('provider_slots')
    .select('id, provider_id, starts_at, duration_minutes, transaction_id')
    .eq('provider_id', providerId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
  if (error) return null
  return data as Slot[]
}

export function slotEnd(s: Pick<Slot, 'starts_at' | 'duration_minutes'>) {
  return new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000)
}

export function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Date(iso).toLocaleDateString('fr-FR', opts)
}

export function durationLabel(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`
}
