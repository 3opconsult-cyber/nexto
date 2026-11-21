"use client"
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { notifyOther, settleEndedBooking } from '@/lib/notify'
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
  // Acceptée : e-mail au client. Refusée ou expirée : le serveur prévient le client (une seule fois) et, si la
  // réservation était payée en ligne, la rembourse à 100 % (/api/bookings/ended, 053).
  if (r.ok && !r.already) { if (fn === 'accept_booking') notifyOther(txId, 'booking_accepted'); else settleEndedBooking(txId) }
  if (r.reason === 'expiree') settleEndedBooking(txId)
  return r
}

/** Le prestataire accepte : 1 appui. Message système posé par la base, e-mail au client. */
export const acceptBooking = (supabase: SupabaseClient, txId: string) => decide(supabase, txId, 'accept_booking')
/** Le prestataire refuse (motif facultatif) : annulation sans frais, créneau libéré, e-mail au client. */
export const refuseBooking = (supabase: SupabaseClient, txId: string, reason?: string) => decide(supabase, txId, 'refuse_booking', reason)

/**
 * Expiration « à la lecture » (en plus de pg_cron et du cron serveur /api/bookings/expire) : passe en « expirée » les
 * réservations dont le délai est dépassé. Le serveur prévient alors le client par e-mail (une seule fois) et rembourse
 * à 100 % si elle avait été payée en ligne. `uid` est gardé pour compatibilité des appels.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Une seule expiration à la fois et pas plus d'une toutes les 20 s par onglet (audit 21/11 : l'agenda, le chat et la barre
// du bas l'appelaient en rafale). Le cron et pg_cron restent la vraie garde.
let expireLast = 0
let expireRunning: Promise<void> | null = null
export function expireBookings(supabase: SupabaseClient, uid?: string | null): Promise<void> {
  if (expireRunning) return expireRunning
  if (Date.now() - expireLast < 20_000) return Promise.resolve()
  expireLast = Date.now()
  expireRunning = (async () => {
    try {
      const { data, error } = await supabase.rpc('expire_pending_bookings')
      if (error || !Array.isArray(data)) return
      for (const r of data as { transaction_id: string }[]) settleEndedBooking(r.transaction_id)
    } catch { }
  })().finally(() => { expireRunning = null })
  return expireRunning
}

/**
 * Réservation dont le délai de réponse est dépassé mais pas encore passée « expirée » (le cron n'est pas encore
 * passé) : traitée comme expirée à l'affichage, pour qu'elle ne reste jamais sur un écran actif.
 */
export const bookingLapsed = (t: { booking_status?: string | null; accept_deadline?: string | null } | null | undefined, now = Date.now()) =>
  t?.booking_status === 'en_attente' && !!t.accept_deadline && new Date(t.accept_deadline).getTime() < now

/** Réservation encore « active » (à venir, en cours) : ni refusée, ni expirée, ni au délai dépassé. */
export const bookingLive = (t: Row & { accept_deadline?: string | null }) => !bookingEnded(t) && !bookingLapsed(t)

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
  return ((data ?? []) as any[]).filter(t => t.buyer_id !== uid && !bookingLapsed(t)).map(t => ({ id: t.id, scheduled_at: t.scheduled_at, accept_deadline: t.accept_deadline }))
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
