"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { roleColumn, type Mode } from '@/lib/mode'
import { getPresenceState, presenceAvailable } from '@/lib/presence'
import { sessionUserId } from '@/lib/screenCache'
import { bookingAccepted, bookingAvailable } from '@/lib/booking'

// « Mission du jour » : la mission confirmée du mode courant qui est en cours, ou prévue
// dans les 2 h qui précèdent l'heure (ou annoncée « en route »), ou dont l'heure est passée de moins de 12 h sans arrivée.
// Sert au bouton d'accès rapide (barre du bas, menu, barre latérale) et à l'agenda.
export type TodayMission = {
  id: string; status: string; scheduled_at: string | null; en_route_at: string | null; arrived_at: string | null; urgent: boolean
  /** Étape qui attend une action (client : photo d'arrivée à confirmer ou code de fin demandé ; prestataire : code reçu). */
  action?: 'arrivee' | 'fin' | null
}

export function isTodayMission(t: { status?: string; booking_status?: string | null; price_confirmed?: boolean; scheduled_at?: string | null; en_route_at?: string | null; arrived_at?: string | null; completed_at?: string | null }, now = new Date()): boolean {
  if (!t.price_confirmed || t.completed_at || !['pending', 'arrived'].includes(t.status || '')) return false
  // Réservation pas encore acceptée par le prestataire (migration 052) : pas de Mission du jour.
  if (!bookingAccepted(t)) return false
  // Une arrivée (ou un départ annoncé) ancienne n'est plus « du jour » : au-delà de 24 h après l'arrivée, la fin
  // est fixée par PING (fenêtre de 038) ; un « en route » de plus de 12 h sans arrivée est abandonné. Sans ces
  // bornes, une mission restée « arrivée » des semaines plus tôt occupait le bouton Mission à la place de celle du jour.
  if (t.arrived_at) return now.getTime() - new Date(t.arrived_at).getTime() < 24 * 3600_000
  if (t.en_route_at && now.getTime() - new Date(t.en_route_at).getTime() < 12 * 3600_000) return true
  if (!t.scheduled_at) return false
  // Fenêtre glissante (audit ergonomie 19/11 bis, correction 7) : de 2 h avant l'heure à 12 h après, sans
  // condition « même jour » (un RDV à 00 h 05 vu à 23 h 59 est bien la mission du jour).
  const diff = new Date(t.scheduled_at).getTime() - now.getTime()
  return diff <= 2 * 3600_000 && diff > -12 * 3600_000
}

export async function fetchTodayMission(mode: Mode): Promise<TodayMission | null> {
  const supabase = createClient()
  // Session locale (aucun aller-retour, relu toutes les 15 s) ; la RLS reste la garde.
  const uid = await sessionUserId(supabase)
  if (!uid) return null
  const user = { id: uid }
  const withBooking = await bookingAvailable(supabase)
  const { data } = await supabase.from('transactions')
    .select(`id, status, price_confirmed, scheduled_at, en_route_at, arrived_at, completed_at, buyer_id, seller_id${withBooking ? ', booking_status' : ''}`)
    .eq(roleColumn(mode), user.id).eq('price_confirmed', true).in('status', ['pending', 'arrived'])
    .order('scheduled_at', { ascending: true, nullsFirst: false }).limit(30)
  const now = new Date()
  const list = (data ?? []).filter((t: any) => t.buyer_id !== t.seller_id && isTodayMission(t, now))
  if (!list.length) return null
  // Ordre : en cours, puis en route, puis la plus proche. Une mission qui attend une action (photo à
  // confirmer, code demandé, code reçu par le prestataire) passe devant : sans ça, une autre mission
  // « arrivée » du même compte occupait le bouton et le bandeau « code reçu » ne s'affichait jamais.
  const ordered: any[] = [...list.filter((t: any) => t.arrived_at), ...list.filter((t: any) => !t.arrived_at && t.en_route_at), ...list.filter((t: any) => !t.arrived_at && !t.en_route_at)]
  let pick: any = ordered[0]
  let urgent = false
  let action: 'arrivee' | 'fin' | null = null
  if (await presenceAvailable(supabase)) {
    // Client : une confirmation ou un code à envoyer. Prestataire (048) : le code du client est arrivé.
    const waits = (r: any) => r?.etat === 'en_attente' && (mode === 'particulier' ? !r?.code_sent_at : !!r?.code_sent_at)
    const cand = ordered.slice(0, 3)
    const states = await Promise.all(cand.map((t: any) => getPresenceState(supabase, t.id).catch(() => null)))
    const actionOf = (st: any): 'arrivee' | 'fin' | null => waits(st?.remote?.fin) ? 'fin' : waits(st?.remote?.arrivee) ? 'arrivee' : null
    const i = states.findIndex(st => !!actionOf(st))
    if (i >= 0) { pick = cand[i]; action = actionOf(states[i]) }
    urgent = !!action
  }
  return { id: pick.id, status: pick.status, scheduled_at: pick.scheduled_at, en_route_at: pick.en_route_at, arrived_at: pick.arrived_at, urgent, action }
}

/**
 * Mission du jour du mode courant ; rafraîchie à chaque changement de page, toutes les 15 s tant qu'une mission
 * du jour est en route ou en cours (la photo d'arrivée ou la demande de code doit se voir vite, audit 19/11),
 * sinon toutes les 60 s.
 */
export function useTodayMission(mode: Mode | null, refreshKey?: string): TodayMission | null {
  const [m, setM] = useState<TodayMission | null>(null)
  const live = !!m && !!(m.en_route_at || m.arrived_at)
  useEffect(() => {
    if (!mode) { setM(null); return }
    let alive = true
    const run = () => { fetchTodayMission(mode).then(v => { if (alive) setM(v) }).catch(() => { }) }
    run()
    const iv = setInterval(run, live ? 15000 : 60000)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [mode, refreshKey, live])
  return m
}
