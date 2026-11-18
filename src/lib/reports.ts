import type { SupabaseClient } from '@supabase/supabase-js'

// Signalement d'un échange à PING (lot 24, migration 043, table `reports`) : distinct du litige.
//   litige      → la prestation (montant, qualité, retard) : visible des deux parties, dossier /litiges/[id] ;
//   signalement → le comportement dans l'échange : privé, lu par PING seul, l'autre partie n'est pas prévenue.
// Tant que la table n'existe pas, `reportsAvailable` renvoie false et l'app ne propose que le litige.

export const REPORT_CATEGORIES: { key: string; label: string }[] = [
  { key: 'propos', label: 'Propos déplacés ou insultants' },
  { key: 'coordonnees', label: 'Coordonnées partagées pour payer ou échanger hors de PING' },
  { key: 'sollicitation', label: 'Sollicitation suspecte (arnaque, demande inhabituelle)' },
  { key: 'comportement', label: 'Comportement inapproprié' },
  { key: 'autre', label: 'Autre' },
]

let cached: boolean | null = null
export async function reportsAvailable(supabase: SupabaseClient): Promise<boolean> {
  if (cached !== null) return cached
  const { error } = await supabase.from('reports').select('id', { head: true, count: 'exact' }).limit(1)
  cached = !error
  return cached
}

export async function createReport(supabase: SupabaseClient, r: { transactionId: string | null; category: string; body: string }):
  Promise<{ ok: true } | { error: string }> {
  const body = r.body.trim().slice(0, 2000)
  if (!body) return { error: 'Décrivez ce qui s’est passé.' }
  // L'auteur, le statut et la personne signalée sont posés par la base (déclencheur guard_report).
  const { error } = await supabase.from('reports').insert({ transaction_id: r.transactionId, category: r.category, body })
  if (error) {
    if (/Trop de signalements/.test(error.message)) return { error: error.message }
    return { error: 'Le signalement n’a pas pu être envoyé. Réessayez, ou écrivez au Support PING.' }
  }
  return { ok: true }
}
