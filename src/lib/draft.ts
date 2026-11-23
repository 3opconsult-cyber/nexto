// Brouillon d'annonce gardé dans le navigateur du téléphone (localStorage), un par compte. Jamais envoyé au serveur ;
// effacé à la publication ou après 7 jours. Stockage bloqué ou plein : l'écran fonctionne comme avant, sans brouillon.

const KEY = (uid: string) => `ping_draft_annonce_${uid}`
export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000

type Wrapped = { at: number; v: Record<string, any> }

export function readDraft(uid: string, now = Date.now()): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(KEY(uid))
    if (!raw) return null
    const w = JSON.parse(raw) as Wrapped
    if (!w || typeof w.at !== 'number' || now - w.at > DRAFT_TTL_MS || typeof w.v !== 'object' || !w.v) { localStorage.removeItem(KEY(uid)); return null }
    return w.v
  } catch { return null }
}

/** Enregistre le brouillon ; un formulaire encore vierge efface le brouillon au lieu d'en créer un. */
export function writeDraft(uid: string, v: Record<string, any>): void {
  try {
    const touched = !!(String(v.title || '').trim() || String(v.description || '').trim() || v.surface || v.budgetMin || v.budgetMax || v.desiredDate || String(v.addr?.other || '').trim())
    if (!touched) { localStorage.removeItem(KEY(uid)); return }
    localStorage.setItem(KEY(uid), JSON.stringify({ at: Date.now(), v } satisfies Wrapped))
  } catch { /* stockage indisponible */ }
}

export function clearDraft(uid: string): void {
  try { localStorage.removeItem(KEY(uid)) } catch { /* stockage indisponible */ }
}
