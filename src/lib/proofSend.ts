import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyOther } from '@/lib/notify'
import { requestRemotePresence, uploadPresencePhoto } from '@/lib/presence'
import { deleteProof, listProofs, saveProof, type StoredProof } from '@/lib/proofStore'

// Envoi de la preuve d'arrivée (client absent) : contrôle de distance par le serveur, PUIS téléversement de la photo,
// PUIS envoi réel. Utilisé par l'écran du prestataire et par le renvoi automatique au retour de connexion.
// Le serveur garde sa propre heure comme référence : aucune heure de prise de vue n'est transmise.

export const PROOF_SENT_EVENT = 'ping:proof-sent'
export const PROOF_FAILED_EVENT = 'ping:proof-failed'
export const KEPT_TEXT = 'Pas de connexion, votre preuve est gardée. Elle sera renvoyée dès le retour du réseau.'

export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'network'; message: string }
  | { kind: 'refused'; message: string; code: string }

// Un seul envoi à la fois par mission (écran + renvoi automatique ne se doublent pas).
const inFlight = new Map<string, Promise<SendOutcome>>()

export function sendProof(supabase: SupabaseClient, entry: StoredProof): Promise<SendOutcome> {
  const hit = inFlight.get(entry.txId)
  if (hit) return hit
  const p = doSend(supabase, entry).finally(() => { if (inFlight.get(entry.txId) === p) inFlight.delete(entry.txId) })
  inFlight.set(entry.txId, p)
  return p
}

const retryable = (code: string) => code === 'network' || code === 'server'

async function doSend(supabase: SupabaseClient, entry: StoredProof): Promise<SendOutcome> {
  const pos = { lat: entry.lat, lng: entry.lng, accuracyM: entry.accuracyM }
  let path = entry.uploadedPath
  if (!path) {
    // 1. Contrôle seul : mission, état, distance. Un refus ne laisse aucune photo au stockage.
    const check = await requestRemotePresence(entry.txId, 'arrivee', pos, null, true)
    if (check.ok !== true) {
      const f = check as Extract<typeof check, { ok: false }>
      if (retryable(f.error)) return { kind: 'network', message: f.message }
      return { kind: 'refused', message: f.message, code: f.error }
    }
    // 2. Téléversement (photo déjà compressée), une seule fois : le chemin est gardé pour les essais suivants.
    const up = await uploadPresencePhoto(supabase, entry.uid, entry.txId, entry.photo)
    if (!up.path) {
      if (up.network) return { kind: 'network', message: up.error || 'Pas de connexion.' }
      return { kind: 'refused', message: up.error || 'Photo non envoyée.', code: 'upload' }
    }
    path = up.path
    entry.uploadedPath = path
    await saveProof(entry)
  }
  // 3. Envoi réel : le serveur refait ses contrôles et pose l'arrivée avec SON heure.
  const r = await requestRemotePresence(entry.txId, 'arrivee', pos, path)
  if (r.ok !== true) {
    const f = r as Extract<typeof r, { ok: false }>
    if (retryable(f.error)) return { kind: 'network', message: f.message }
    return { kind: 'refused', message: f.message, code: f.error }
  }
  await deleteProof(entry.txId)
  notifyOther(entry.txId, 'presence_arrivee')
  try { window.dispatchEvent(new CustomEvent(PROOF_SENT_EVENT, { detail: { txId: entry.txId } })) } catch { /* sans objet */ }
  return { kind: 'sent' }
}

/**
 * Renvoie les preuves mises en attente (« Envoyer » pressé sans réseau) du compte connecté. Appelé au retour de la
 * connexion, à l'ouverture de l'application et toutes les 15 s tant qu'une preuve attend. Renvoie le nombre d'envois réussis.
 */
export async function flushQueuedProofs(supabase: SupabaseClient, uid: string): Promise<number> {
  let sent = 0
  for (const e of await listProofs()) {
    if (!e.queued || e.uid !== uid) continue
    const r = await sendProof(supabase, e)
    if (r.kind === 'sent') sent++
    else if (r.kind === 'refused') {
      // Refus définitif (mission déjà commencée, position éloignée…) : la preuve n'a plus d'utilité, elle ne reste pas.
      await deleteProof(e.txId)
      try { window.dispatchEvent(new CustomEvent(PROOF_FAILED_EVENT, { detail: { txId: e.txId, message: r.message } })) } catch { /* sans objet */ }
    }
  }
  return sent
}
