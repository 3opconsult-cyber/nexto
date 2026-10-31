"use client"

/**
 * Détails d'une annonce de particulier (migration 024) : heures souhaitées, linge, fréquence, foyer,
 * surface, paiement. Affiché sur la carte du prestataire, dans « Mes demandes » et dans la conversation.
 * Ne montre que ce qui est renseigné ; rien du tout si l'annonce n'a aucun détail.
 */
export const FREQUENCIES = [
  { key: 'ponctuel', label: 'Une fois' },
  { key: 'hebdomadaire', label: '1× par semaine' },
  { key: '2_semaine', label: '2× par semaine' },
  { key: '3_semaine', label: '3× par semaine' },
  { key: 'bimensuel', label: 'Toutes les 2 semaines' },
  { key: 'mensuel', label: '1× par mois' },
]
export const FREQ_LABEL: Record<string, string> = Object.fromEntries(FREQUENCIES.map(f => [f.key, f.label]))
export const HOUSEHOLD = [
  { key: '1', label: '1 personne' }, { key: '2', label: '2 personnes' },
  { key: '3-4', label: '3 à 4 personnes' }, { key: '5+', label: '5 personnes et plus' },
]
export const HOUSEHOLD_LABEL: Record<string, string> = Object.fromEntries(HOUSEHOLD.map(h => [h.key, h.label]))
export const LINEN_TYPES = [
  { key: 'chemises', label: 'Chemises' }, { key: 'draps', label: 'Draps' },
  { key: 'linge_maison', label: 'Linge de maison' }, { key: 'vetements', label: 'Vêtements du quotidien' },
  { key: 'delicat', label: 'Délicat' },
]
export const LINEN_LABEL: Record<string, string> = Object.fromEntries(LINEN_TYPES.map(l => [l.key, l.label]))
export const PAYMENTS = [
  { key: 'cesu', label: 'CESU' }, { key: 'direct', label: 'Paiement direct' }, { key: 'indifferent', label: 'Indifférent' },
]
export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(PAYMENTS.map(p => [p.key, p.label]))

const num = (n: number) => String(n).replace('.', ',')

export type RequestDetailFields = {
  hours_wanted?: number | null; linen_kg?: number | null; linen_types?: string[] | null
  frequency?: string | null; household_size?: string | null; surface_m2?: number | null; payment_pref?: string | null
}

export function requestDetailRows(r: RequestDetailFields) {
  const rows: Array<[string, string]> = []
  if (r.surface_m2) rows.push(['Surface', `${r.surface_m2} m²`])
  if (r.hours_wanted) rows.push(['Heures souhaitées', `${num(r.hours_wanted)} h`])
  if (r.linen_kg) rows.push(['Linge', `${num(r.linen_kg)} kg`])
  if (r.linen_types?.length) rows.push(['Types de linge', r.linen_types.map(t => LINEN_LABEL[t] || t).join(', ')])
  if (r.frequency) rows.push(['Fréquence', FREQ_LABEL[r.frequency] || r.frequency])
  if (r.household_size) rows.push(['Foyer', HOUSEHOLD_LABEL[r.household_size] || r.household_size])
  if (r.payment_pref) rows.push(['Paiement souhaité', PAYMENT_LABEL[r.payment_pref] || r.payment_pref])
  return rows
}

export default function RequestDetails({ request, compact = false }: { request: RequestDetailFields; compact?: boolean }) {
  const rows = requestDetailRows(request)
  if (!rows.length) return null
  if (compact) return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {rows.map(([k, v]) => (
        <span key={k} style={{ fontSize: 11.5, fontWeight: 600, color: '#123644', background: '#F3F6F5', border: '1px solid #E7EDEB', borderRadius: 999, padding: '3px 9px' }}>{v}</span>
      ))}
    </div>
  )
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0' }}>
          <span style={{ color: '#4E6470' }}>{k}</span><b style={{ color: '#123644', textAlign: 'right' }}>{v}</b>
        </div>
      ))}
    </div>
  )
}
