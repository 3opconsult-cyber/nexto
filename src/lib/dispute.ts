import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Champs structurés d'un litige (motif, montant réclamé, jusqu'à 3 photos) + enregistrement.
 * Utilisé par la fenêtre « Signaler un problème » du chat. Les photos vont dans le bucket privé
 * `dispute-photos`, chemin `<uid>/<id du litige>/<fichier>` (migration 030) : l'autre partie et PING
 * les lisent par URL signée. La date cible de réponse (48 h) est posée par la base, pas par le client.
 */
export const DISPUTE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'non_realisee', label: 'Prestation non réalisée' },
  { key: 'qualite', label: 'Qualité insuffisante' },
  { key: 'casse', label: 'Dégât ou casse' },
  { key: 'retard_absence', label: 'Retard ou absence' },
  { key: 'montant', label: 'Montant contesté' },
  { key: 'autre', label: 'Autre' },
]
export const categoryLabel = (k: string | null | undefined) => DISPUTE_CATEGORIES.find(c => c.key === k)?.label ?? null

export type DisputeExtra = { category: string; amount: string; photos: File[] }
export const EMPTY_DISPUTE: DisputeExtra = { category: '', amount: '', photos: [] }

export const MAX_PHOTOS = 3
export const MAX_BYTES = 10 * 1024 * 1024
export const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Montant saisi en euros (« 25 », « 25,50 ») → centimes, null si vide ou invalide. */
export function amountToCents(v: string): number | null {
  const n = Number(v.replace(',', '.').replace(/\s/g, ''))
  return v.trim() && isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

/**
 * Saisie du « Montant rendu au client » (Décision PING, 24/11) : lecture stricte du champ en euros.
 * null = champ vide ; NaN = refusé (texte, signe moins, plus de 2 décimales) ; sinon centimes entiers.
 * Seule l'interface s'en sert pour valider ; l'envoi garde sa conversion d'origine (même résultat pour tout montant accepté ici).
 */
export function refundFieldCents(v: string): number | null {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.')
  if (!s) return null
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN
  return Math.round(Number(s) * 100)
}

/** Centimes -> texte du champ en euros : « 37,75 », « 75 », « 0 ». */
export function centsToField(c: number): string {
  return c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)
}

/** Ouvre le litige : photos d'abord (l'id du litige est choisi ici pour fixer leur chemin), puis la ligne. */
export async function createDispute(
  supabase: SupabaseClient,
  p: { transactionId: string; userId: string; reason: string; extra: DisputeExtra },
): Promise<{ id: string } | { error: string }> {
  const id = crypto.randomUUID()
  const paths: string[] = []
  for (let i = 0; i < p.extra.photos.length; i++) {
    const f = p.extra.photos[i]
    const path = `${p.userId}/${id}/${Date.now()}-${i}.${EXT[f.type] || 'jpg'}`
    const { error } = await supabase.storage.from('dispute-photos').upload(path, f, { contentType: f.type })
    if (error) return { error: 'Une photo n’a pas pu être envoyée. Réessayez, ou retirez-la.' }
    paths.push(path)
  }
  const { error } = await supabase.from('disputes').insert({
    id, transaction_id: p.transactionId, opener_id: p.userId, reason: p.reason,
    category: p.extra.category || null,
    claimed_cents: amountToCents(p.extra.amount),
    photo_paths: paths,
  })
  if (error) return { error: /délai|déjà été versé/i.test(error.message || '') ? error.message : 'Le litige n’a pas pu être enregistré. Réessayez, ou écrivez à info@opconsult.co.' }
  return { id }
}

