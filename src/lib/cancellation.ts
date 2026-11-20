"use client"
import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyOther } from '@/lib/notify'
import { systemSender } from '@/lib/systemMessage'
import { paymentsActive } from '@/lib/paymentsClient'

// Annulations, frais, prestataire absent, report, client sans réponse (décisions Romain du 20/11/2026, migration 056).
// Les règles sont tenues par la base (RPC cancel_booking, declare_provider_no_show, propose/accept/decline_reschedule,
// close_on_proof, cancellation_state) ; ici on les appelle et on affiche. Avant la migration, les RPC n'existent pas :
// `cancellationState` renvoie null et l'annulation retombe sur l'écriture directe d'avant (sans paliers).

export type CancelTier = 'impossible' | 'commencee' | 'gratuite' | 'motif_grave' | 'frais_totaux' | 'prestataire'

export type RescheduleView = {
  id: string; proposed_by: string; mine: boolean; new_at: string; old_at: string | null; late: boolean; expires_at: string; note: string | null
}
export type CancellationState = {
  ok: true
  role: 'client' | 'prestataire' | 'admin'
  status: string
  tier: CancelTier
  can_cancel: boolean
  fee_cents: number
  free_minutes: number
  minutes_to_rdv: number | null
  scheduled_at: string | null
  arrival_pending: boolean
  no_show: { eligible: boolean; minutes: number; at: string | null }
  silence: { eligible: boolean; waiting?: boolean; phase?: 'arrivee' | 'fin'; hours?: number; at?: string }
  reschedule: { can_propose: boolean; free: boolean; pending: RescheduleView | null }
  cancelled: { tier: string | null; reason_kind: string | null; reason_text: string | null; fee_cents: number | null; by: string | null; at: string | null } | null
}

export type CancelResult = {
  ok: boolean; already?: boolean; reason?: string; message?: string; tier?: string; fee_cents?: number; refund_online?: boolean
  /** Migration 056 pas encore collée : l'annulation s'est faite à l'ancienne. */
  legacy?: boolean
}

const missingRpc = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function|function .* does not exist/i.test(e.message || ''))

/** Motifs proposés au client (annulation avec prestataire en route : motif sérieux seulement). */
export const CLIENT_GRAVE_REASONS: { kind: string; label: string; needsText?: boolean }[] = [
  { kind: 'maladie', label: 'Maladie' },
  { kind: 'urgence_familiale', label: 'Urgence familiale' },
  { kind: 'accident', label: 'Accident' },
  { kind: 'autre_grave', label: 'Autre motif grave', needsText: true },
]
/** Motifs facultatifs du client avant le départ du prestataire. */
export const CLIENT_FREE_REASONS: { kind: string; label: string }[] = [
  { kind: 'changement_de_plan', label: 'Changement de plan' },
  { kind: 'autre', label: 'Autre motif' },
]
/** Motifs obligatoires du prestataire. */
export const PRO_REASONS: { kind: string; label: string; needsText?: boolean }[] = [
  { kind: 'maladie', label: 'Maladie' },
  { kind: 'urgence_familiale', label: 'Urgence familiale' },
  { kind: 'accident', label: 'Accident' },
  { kind: 'panne_vehicule', label: 'Panne ou véhicule' },
  { kind: 'indisponibilite', label: 'Indisponibilité' },
  { kind: 'autre', label: 'Autre motif', needsText: true },
]

export const REASON_LABEL: Record<string, string> = {
  maladie: 'maladie', urgence_familiale: 'urgence familiale', accident: 'accident', autre_grave: 'autre motif grave',
  panne_vehicule: 'panne ou véhicule', indisponibilite: 'indisponibilité', changement_de_plan: 'changement de plan', autre: 'autre motif',
  absence_prestataire: 'absence du prestataire',
}

export const TIER_LABEL: Record<string, string> = {
  gratuite: 'Annulation gratuite', motif_grave: 'Motif grave, sans frais', frais_totaux: 'Frais totaux',
  prestataire: 'Annulée par le prestataire', absence_prestataire: 'Prestataire absent',
}

/** Événements e-mail d'annulation, ajoutés à /api/notify. */
export type CancelMail = 'cancelled_by_client' | 'cancelled_by_provider' | 'provider_no_show' | 'reschedule_proposed' | 'reschedule_answer' | 'closed_on_proof'

let available: Promise<boolean> | null = null
/** Migration 056 collée ? (sonde : la fonction existe, même si la mission demandée n'existe pas). */
export function cancellationAvailable(supabase: SupabaseClient): Promise<boolean> {
  if (available) return available
  available = (async () => {
    const { error } = await supabase.rpc('cancellation_state', { p_transaction: '00000000-0000-0000-0000-000000000000' })
    if (!error) return true
    if (missingRpc(error)) return false
    available = null
    return false
  })()
  return available
}

/** État de la mission pour l'écran ; null si la migration 056 n'est pas collée (l'application garde l'ancien comportement). */
export async function fetchCancellationState(supabase: SupabaseClient, txId: string): Promise<CancellationState | null> {
  try {
    const { data, error } = await supabase.rpc('cancellation_state', { p_transaction: txId })
    if (error || !data) return null
    return data as CancellationState
  } catch { return null }
}

// Remboursement du paiement en ligne (séquestre), sans effet tant qu'il n'est pas actif. Annulation gratuite, motif grave,
// annulation du prestataire, absence : 100 % ; frais totaux : rien (le serveur décide).
function refundOnline(txId: string, motif: string) {
  paymentsActive().then(on => {
    if (!on) return
    fetch('/api/payments/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txId, motif }), keepalive: true }).catch(() => { })
  }).catch(() => { })
}

/** Ancienne annulation (avant 056) : écriture directe, message système. */
async function legacyCancel(supabase: SupabaseClient, tx: any, userId: string): Promise<CancelResult> {
  const { data: updated, error } = await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', tx.id).select().maybeSingle()
  if (error || !updated) return { ok: false, message: 'Annulation impossible : réessayez.' }
  const who = userId === updated.buyer_id ? 'le client' : 'le prestataire'
  await supabase.from('messages').insert({ transaction_id: tx.id, ...(await systemSender(supabase)), body: `✕ ${tx.price_confirmed ? 'Réservation' : 'Demande'} annulée par ${who}.` })
  return { ok: true, legacy: true, tier: 'gratuite', refund_online: true }
}

export async function cancelMission(supabase: SupabaseClient, tx: any, userId: string, opts: { kind?: string | null; text?: string | null; confirmFees?: boolean } = {}): Promise<CancelResult> {
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_transaction: tx.id, p_reason_kind: opts.kind || null, p_reason_text: opts.text?.trim() || null, p_confirm_fees: !!opts.confirmFees,
  })
  if (error) {
    if (missingRpc(error)) return legacyCancel(supabase, tx, userId)
    return { ok: false, message: error.message || 'Annulation impossible.' }
  }
  const r = (data || {}) as CancelResult
  if (r.ok && !r.already) {
    notifyOther(tx.id, userId === tx.buyer_id ? 'cancelled_by_client' : 'cancelled_by_provider')
    if (r.refund_online) refundOnline(tx.id, 'Annulation')
  }
  return r
}

export async function declareProviderNoShow(supabase: SupabaseClient, tx: any): Promise<CancelResult> {
  const { data, error } = await supabase.rpc('declare_provider_no_show', { p_transaction: tx.id })
  if (error) return { ok: false, message: missingRpc(error) ? 'Fonction indisponible : réessayez dans un instant.' : (error.message || 'Action impossible.') }
  const r = (data || {}) as CancelResult
  if (r.ok && !r.already) { notifyOther(tx.id, 'provider_no_show'); if (r.refund_online) refundOnline(tx.id, 'Absence du prestataire') }
  return r
}

type Simple = { ok: boolean; message?: string; reason?: string; late?: boolean; scheduled_at?: string; at?: string; phase?: string }
async function rpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Simple> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return { ok: false, message: missingRpc(error) ? 'Fonction indisponible : réessayez dans un instant.' : (error.message || 'Action impossible.') }
  return (data || { ok: true }) as Simple
}

export async function proposeReschedule(supabase: SupabaseClient, txId: string, when: Date, note?: string) {
  const r = await rpc(supabase, 'propose_reschedule', { p_transaction: txId, p_new_at: when.toISOString(), p_note: note?.trim() || null })
  if (r.ok) notifyOther(txId, 'reschedule_proposed')
  return r
}
export async function acceptReschedule(supabase: SupabaseClient, txId: string, requestId: string) {
  const r = await rpc(supabase, 'accept_reschedule', { p_request: requestId })
  if (r.ok) notifyOther(txId, 'reschedule_answer')
  return r
}
export async function declineReschedule(supabase: SupabaseClient, txId: string, requestId: string) {
  const r = await rpc(supabase, 'decline_reschedule', { p_request: requestId })
  if (r.ok) notifyOther(txId, 'reschedule_answer')
  return r
}
export async function closeOnProof(supabase: SupabaseClient, txId: string, phase?: 'arrivee' | 'fin') {
  const r = await rpc(supabase, 'close_on_proof', { p_transaction: txId, p_phase: phase ?? null })
  if (r.ok && !(r as any).already) notifyOther(txId, 'closed_on_proof')
  return r
}

export const eur = (c?: number | null) => ((c || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export const whenLabel = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  : ''
