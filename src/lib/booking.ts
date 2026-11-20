"use client"
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { notifyOther } from '@/lib/notify'
import { sessionUserId } from '@/lib/screenCache'

// Réservation directe à accepter par le prestataire (décision Romain 19/11, migration 052).
// Une réservation (mission/new -> book_service) naît « en_attente » ; le prestataire l'accepte (1 appui) ou la
// refuse (2 appuis, motif facultatif) ; sans réponse avant `accept_deadline` (24 h, ou 2 h avant le rendez-vous),
// elle expire (annulée, créneau libéré). Le prix est figé dès la réservation ; l'adresse exacte, la Mission du
// jour, les QR et « Je pars » attendent l'acceptation.
// Avant la migration, la colonne n'existe pas : `booking_status` est absent des lignes et tout est « acceptée »
// (fonctionnement d'avant : réservation confirmée d'office).
export type BookingStatus = 'en_attente' | 'acceptee' | 'refusee' | 'expiree'

type Row = { booking_status?: string | null; status?: string | null } | null | undefined

/** Acceptée (ou migration absente, ou mission issue d'un devis accepté dans le chat). */
export const bookingAccepted = (t: Row) => !t?.booking_status || t.booking_status === 'acceptee'
/** En attente de la réponse du prestataire (et pas annulée entre-temps par le client). */
export const bookingPending = (t: Row) => t?.booking_status === 'en_attente' && t?.status !== 'cancelled'
/** Refusée par le prestataire ou expirée sans réponse. */
export const bookingEnded = (t: Row) => t?.booking_status === 'refusee' || t?.booking_status === 'expiree'

/** « 3 h », « 45 min », « 1 j » : temps restant avant la fin du délai de réponse. */
export function deadlineLeft(iso?: string | null, now = Date.now()): string {
  if (!iso) return '24 h'
  const ms = new Date(iso).getTime() - now
  if (ms <= 60_000) return 'quelques instants'
  const min = Math.ceil(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.ceil(min / 60)
  return `${h} h`
}

/** « avant 14:30 » (même jour) ou « avant demain 09:00 » / « avant le 21/11 à 09:00 ». */
export function deadlineAt(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso), n = new Date()
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const day = (x: Date) => x.toLocaleDateString('fr-FR')
  if (day(d) === day(n)) return `avant ${hm}`
  const tomorrow = new Date(n.getTime() + 86400_000)
  if (day(d) === day(tomorrow)) return `avant demain ${hm}`
  return `avant le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${hm}`
}

export const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || ''

let available: Promise<boolean> | null = null
/** Migration 052 collée ? (colonne posée par la même migration que les fonctions). */
export function bookingAvailable(supabase: SupabaseClient): Promise<boolean> {
  if (available) return available
  available = (async () => {
    const { error } = await supabase.from('transactions').select('booking_status').limit(1)
    if (!error) return true
    if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(error.message || '')) return false
    available = null
    return false
  })()
  return available
}

const missingRpc = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function|function .* does not exist/i.test(e.message || ''))

export type BookingResult = { ok: boolean; already?: boolean; reason?: string; message?: string }

async function decide(supabase: SupabaseClient, txId: string, fn: 'accept_booking' | 'refuse_booking', reason?: string): Promise<BookingResult> {
  const args: Record<string, unknown> = { p_transaction: txId }
  if (fn === 'refuse_booking') args.p_reason = reason?.trim() || null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return { ok: false, message: missingRpc(error) ? 'Fonction indisponible : réessayez dans un instant.' : (error.message || 'Action impossible.') }
  const r = (data || {}) as BookingResult
  if (r.ok && !r.already) notifyOther(txId, fn === 'accept_booking' ? 'booking_accepted' : 'booking_refused')
  if (r.reason === 'expiree') notifyOther(txId, 'booking_expired')
  return r
}

/** Le prestataire accepte : 1 appui. Message système posé par la base, e-mail au client. */
export const acceptBooking = (supabase: SupabaseClient, txId: string) => decide(supabase, txId, 'accept_booking')
/** Le prestataire refuse (motif facultatif) : annulation sans frais, créneau libéré, e-mail au client. */
export const refuseBooking = (supabase: SupabaseClient, txId: string, reason?: string) => decide(supabase, txId, 'refuse_booking', reason)

/**
 * Expiration « à la lecture » (en plus du cron de 052) : passe en « expirée » les réservations dont le délai est
 * dépassé. Quand c'est le prestataire qui ouvre l'application, le client est prévenu par e-mail.
 */
export async function expireBookings(supabase: SupabaseClient, uid?: string | null) {
  try {
    const { data, error } = await supabase.rpc('expire_pending_bookings')
    if (error || !Array.isArray(data)) return
    for (const r of data as { transaction_id: string; seller_id: string }[]) {
      if (uid && r.seller_id === uid) notifyOther(r.transaction_id, 'booking_expired')
    }
  } catch { }
}

export type PendingBooking = { id: string; scheduled_at: string | null; accept_deadline: string | null }

/** Réservations en attente de MA réponse (prestataire), la plus urgente en tête. */
export async function fetchPendingBookings(supabase: SupabaseClient): Promise<PendingBooking[]> {
  if (!(await bookingAvailable(supabase))) return []
  const uid = await sessionUserId(supabase)
  if (!uid) return []
  await expireBookings(supabase, uid)
  const { data } = await supabase.from('transactions').select('id, scheduled_at, accept_deadline, buyer_id')
    .eq('seller_id', uid).eq('booking_status', 'en_attente').eq('status', 'pending')
    .order('accept_deadline', { ascending: true }).limit(20)
  return ((data ?? []) as any[]).filter(t => t.buyer_id !== uid).map(t => ({ id: t.id, scheduled_at: t.scheduled_at, accept_deadline: t.accept_deadline }))
}

/** Bandeau « Nouvelle réservation : accepter » (prestataire) : relu à chaque page et toutes les 60 s. */
export function usePendingBookings(enabled: boolean, refreshKey?: string): PendingBooking[] {
  const [list, setList] = useState<PendingBooking[]>([])
  useEffect(() => {
    if (!enabled) { setList([]); return }
    let alive = true
    const supabase = createClient()
    const run = () => { fetchPendingBookings(supabase).then(v => { if (alive) setList(v) }).catch(() => { }) }
    run()
    const iv = setInterval(run, 60000)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    window.addEventListener(BOOKING_EVENT, run)
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(iv); window.removeEventListener(BOOKING_EVENT, run); document.removeEventListener('visibilitychange', vis) }
  }, [enabled, refreshKey])
  return list
}

/** Émis après une acceptation / un refus : la barre du bas et Mon entreprise se mettent à jour. */
export const BOOKING_EVENT = 'ping-booking'
export const signalBookingChange = () => { try { window.dispatchEvent(new Event(BOOKING_EVENT)) } catch { } }

/** Motifs de refus proposés en un appui (le champ libre reste possible). */
export const REFUSAL_REASONS = ['Indisponible à cette date', 'Hors de ma zone', 'Prestation non adaptée']
