import { EUR } from './invoice-pdf'

// Tarif d'un service (ménage, repassage, nettoyage…) : chaque service a son propre prix, dans l'un
// des trois modes ci-dessous (décision Romain 30/10). « Sur devis » ne reste possible que pour une
// prestation complémentaire du catalogue « Mes tarifs ».
//
// Correspondance avec les colonnes existantes (provider_profiles pour le service principal, table
// `services` pour les autres) — c'est ainsi que mission/new et le scan de fin les interprètent :
//   forfait         → pricing_type 'forfait', base > 0, included_hours null, hourly null
//   horaire         → pricing_type 'horaire', base 0, hourly > 0
//   forfait_heures  → pricing_type 'forfait', base > 0, included_hours > 0, hourly > 0
//   devis           → pricing_type 'devis', rien d'autre
export type PricingMode = 'forfait' | 'horaire' | 'forfait_heures' | 'devis'

export const MAIN_MODES: { key: PricingMode; label: string; hint: string }[] = [
  { key: 'forfait', label: 'Forfait', hint: 'Prix fixe, quelle que soit la durée.' },
  { key: 'horaire', label: "À l'heure", hint: 'Facturé selon le temps réellement passé, mesuré entre les deux scans QR.' },
  { key: 'forfait_heures', label: 'Forfait + heures sup.', hint: 'Un forfait qui inclut un nombre d’heures, puis un tarif horaire au-delà.' },
]

export type PricingColumns = {
  pricing_type: 'forfait' | 'horaire' | 'devis'
  base_price_cents: number
  included_hours: number | null
  hourly_rate_cents: number | null
  price_cents: number
}

// Valeurs saisies à l'écran (en euros / heures, sous forme de texte pour les champs).
export type PricingDraft = { mode: PricingMode; flat: string; hours: string; hourly: string }

type Cols = { pricing_type?: string | null; base_price_cents?: number | null; included_hours?: number | null; hourly_rate_cents?: number | null; price_cents?: number | null }

export function emptyDraft(mode: PricingMode = 'forfait'): PricingDraft {
  return { mode, flat: '', hours: '', hourly: '' }
}

export function modeOf(c: Cols): PricingMode {
  if (c.pricing_type === 'devis') return 'devis'
  const base = c.base_price_cents ?? 0
  const hourly = c.hourly_rate_cents ?? 0
  if (base > 0 && hourly > 0 && (c.included_hours ?? 0) > 0) return 'forfait_heures'
  if (base > 0) return 'forfait'
  if (hourly > 0) return 'horaire'
  // Anciennes lignes : seul price_cents est renseigné → lu comme un forfait.
  return 'forfait'
}

const euros = (cents: number | null | undefined) => (cents && cents > 0 ? String(cents / 100) : '')

export function draftFromColumns(c: Cols): PricingDraft {
  const mode = modeOf(c)
  const base = c.base_price_cents && c.base_price_cents > 0 ? c.base_price_cents : (mode === 'forfait' ? c.price_cents ?? 0 : 0)
  return {
    mode,
    flat: mode === 'forfait' || mode === 'forfait_heures' ? euros(base) : '',
    hours: mode === 'forfait_heures' && c.included_hours != null ? String(c.included_hours) : '',
    hourly: mode === 'horaire' || mode === 'forfait_heures' ? euros(c.hourly_rate_cents) : '',
  }
}

const num = (s: string) => Number(String(s).replace(',', '.'))
const cents = (s: string) => Math.round(num(s) * 100)

// Message d'erreur lisible, ou null si le tarif est complet.
export function validateDraft(d: PricingDraft): string | null {
  if (d.mode === 'devis') return null
  if ((d.mode === 'forfait' || d.mode === 'forfait_heures') && !(num(d.flat) > 0)) return 'Indiquez le prix du forfait.'
  if (d.mode === 'forfait_heures' && !(num(d.hours) > 0)) return 'Indiquez le nombre d’heures incluses dans le forfait.'
  if (d.mode === 'horaire' && !(num(d.hourly) > 0)) return 'Indiquez votre taux horaire.'
  if (d.mode === 'forfait_heures' && !(num(d.hourly) > 0)) return 'Indiquez le tarif des heures supplémentaires.'
  return null
}

export function toColumns(d: PricingDraft): PricingColumns {
  switch (d.mode) {
    case 'devis':
      return { pricing_type: 'devis', base_price_cents: 0, included_hours: null, hourly_rate_cents: null, price_cents: 0 }
    case 'horaire': {
      const h = cents(d.hourly)
      return { pricing_type: 'horaire', base_price_cents: 0, included_hours: null, hourly_rate_cents: h, price_cents: h }
    }
    case 'forfait_heures': {
      const f = cents(d.flat)
      return { pricing_type: 'forfait', base_price_cents: f, included_hours: num(d.hours), hourly_rate_cents: cents(d.hourly), price_cents: f }
    }
    default: {
      const f = cents(d.flat)
      return { pricing_type: 'forfait', base_price_cents: f, included_hours: null, hourly_rate_cents: null, price_cents: f }
    }
  }
}

// Montant court : « 90 € » quand il est rond, « 90,50 € » sinon.
export function eur(cents: number) {
  return cents % 100 === 0 ? `${(cents / 100).toLocaleString('fr-FR')} €` : EUR(cents)
}
const hoursTxt = (h: number) => `${String(h).replace('.', ',')} h`

// Libellé complet : « 90 € forfait », « 25 €/h », « 100 € pour 3 h, puis 25 €/h ».
export function pricingLabel(c: Cols): string | null {
  const mode = modeOf(c)
  if (mode === 'devis') return 'Sur devis'
  const base = (c.base_price_cents ?? 0) > 0 ? c.base_price_cents! : (c.price_cents ?? 0)
  if (mode === 'forfait_heures') return `${eur(base)} pour ${hoursTxt(c.included_hours!)}, puis ${eur(c.hourly_rate_cents!)}/h`
  if (mode === 'horaire') return `${eur(c.hourly_rate_cents!)}/h`
  return base > 0 ? `${eur(base)} forfait` : null
}

// Prix mis en avant (colonne de droite du catalogue, bouton « Réserver ») : « 90 € », « 25 €/h ».
export function pricingShort(c: Cols): string | null {
  const mode = modeOf(c)
  if (mode === 'devis') return 'Sur devis'
  if (mode === 'horaire') return `${eur(c.hourly_rate_cents!)}/h`
  const base = (c.base_price_cents ?? 0) > 0 ? c.base_price_cents! : (c.price_cents ?? 0)
  return base > 0 ? eur(base) : null
}

// Ligne descriptive sous le nom (comme la démo : « Forfait », « Sur devis selon surface »…).
export function pricingSummary(c: Cols): string {
  switch (modeOf(c)) {
    case 'devis': return 'Sur devis, chiffré au cas par cas'
    case 'horaire': return 'À l’heure, selon le temps réellement passé'
    case 'forfait_heures': return `Forfait ${hoursTxt(c.included_hours!)} incluses, puis ${eur(c.hourly_rate_cents!)}/h`
    default: return 'Forfait, durée libre'
  }
}
