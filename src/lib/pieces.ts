import type { SupabaseClient } from '@supabase/supabase-js'

// Pièces du prestataire (table `documents`), avec le motif de refus et l'échéance de la migration 042.
// Avant la 042, les colonnes `rejection_reason` (et parfois `valid_until`) n'existent pas : la lecture
// complète échoue, on relit sans elles (aucun motif, aucune échéance affichés, comme avant).

export const EXPIRY_ALERT_DAYS = 45

export type DocRowFull = {
  kind: string
  status: 'pending' | 'valid' | 'expired' | 'rejected'
  storage_path: string | null
  valid_until?: string | null
  rejection_reason?: string | null
}

export async function fetchMyDocuments(supabase: SupabaseClient, uid: string): Promise<{ rows: DocRowFull[]; extended: boolean }> {
  const full = await supabase.from('documents').select('kind, status, storage_path, valid_until, rejection_reason').eq('owner_id', uid)
  if (!full.error) return { rows: (full.data ?? []) as DocRowFull[], extended: true }
  const basic = await supabase.from('documents').select('kind, status, storage_path').eq('owner_id', uid)
  return { rows: (basic.data ?? []) as DocRowFull[], extended: false }
}

// Échéance d'une pièce validée : expirée, ou à renouveler sous 45 jours. null = rien à signaler.
export function expiryOf(row: Pick<DocRowFull, 'status' | 'valid_until'> | undefined | null, now = new Date()):
  { days: number; expired: boolean; date: string } | null {
  if (!row || !row.valid_until || (row.status !== 'valid' && row.status !== 'expired')) return null
  const end = new Date(`${row.valid_until}T23:59:59`)
  if (Number.isNaN(end.getTime())) return null
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000)
  if (days > EXPIRY_ALERT_DAYS) return null
  return { days, expired: days < 0 || row.status === 'expired', date: end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }
}

export function expiryText(e: { days: number; expired: boolean; date: string }): string {
  if (e.expired) return `Expirée depuis le ${e.date} : déposez la nouvelle version`
  if (e.days <= 0) return 'Expire aujourd’hui : déposez la nouvelle version'
  return `Expire le ${e.date} (dans ${e.days} jour${e.days > 1 ? 's' : ''}) : pensez à la renouveler`
}

export const DOC_TITLES: Record<string, string> = {
  identite: 'Pièce d’identité', rcpro: 'Assurance', kbis: 'Statut de l’entreprise', diplome: 'Diplôme ou qualification',
  sap: 'Récépissé SAP', rib: 'RIB',
}

// Alertes de Mon entreprise : pièces refusées, expirées ou à renouveler sous 45 jours.
export function documentAlerts(rows: DocRowFull[], now = new Date()): { kind: string; text: string; urgent: boolean }[] {
  const out: { kind: string; text: string; urgent: boolean }[] = []
  for (const r of rows) {
    const title = DOC_TITLES[r.kind] || r.kind
    if (r.status === 'rejected') {
      out.push({ kind: r.kind, urgent: true, text: `${title} : pièce refusée${r.rejection_reason ? ` (${r.rejection_reason})` : ''}, à redéposer` })
      continue
    }
    const e = expiryOf(r, now)
    if (e) out.push({ kind: r.kind, urgent: e.expired || e.days <= 14, text: `${title} : ${expiryText(e).charAt(0).toLowerCase()}${expiryText(e).slice(1)}` })
  }
  return out
}
