// Statut juridique et fiscal du prestataire (décision Romain du 18/11/2026).
//
// Colonnes de provider_profiles ajoutées par supabase/migrations/039_statut_pro_cesu.sql :
//   legal_form               micro | ei | eurl | sasu | sas | sarl | autre (null pour un particulier)
//   vat_status               franchise (« TVA non applicable, art. 293 B du CGI ») | assujetti
//   vat_number               n° de TVA intracommunautaire (seulement si assujetti)
//   accepts_cesu_prefinance  le prestataire accepte le CESU préfinancé
// L'app doit marcher AVANT la migration : écrire ces champs seulement s'ils existent (voir
// `isMissingColumnError` : on réessaie sans eux) et ne rien afficher quand ils sont absents.

export const LEGAL_FORMS = [
  { key: 'micro', label: 'Micro-entrepreneur', invoice: 'Entrepreneur individuel (micro-entrepreneur)' },
  { key: 'ei', label: 'Entreprise individuelle (EI)', invoice: 'Entrepreneur individuel (EI)' },
  { key: 'eurl', label: 'EURL', invoice: 'EURL' },
  { key: 'sasu', label: 'SASU', invoice: 'SASU' },
  { key: 'sas', label: 'SAS', invoice: 'SAS' },
  { key: 'sarl', label: 'SARL', invoice: 'SARL' },
  { key: 'autre', label: 'Autre forme', invoice: null },
] as const
export type LegalForm = typeof LEGAL_FORMS[number]['key']
export type VatStatus = 'franchise' | 'assujetti'

export const VAT_FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI'

export const legalFormLabel = (k: string | null | undefined) => LEGAL_FORMS.find(f => f.key === k)?.label ?? null
export const legalFormInvoiceLabel = (k: string | null | undefined) => LEGAL_FORMS.find(f => f.key === k)?.invoice ?? null

/** Forme juridique déduite du code INSEE de la recherche d'entreprise (pré-remplissage seulement). */
export function guessLegalForm(natureJuridique: string | null | undefined): LegalForm | null {
  if (!natureJuridique) return null
  if (natureJuridique === '1000') return 'micro'
  if (natureJuridique === '5720') return 'sasu'
  if (natureJuridique === '5710') return 'sas'
  if (natureJuridique === '5498' || natureJuridique === '5499') return 'eurl'
  if (natureJuridique.startsWith('54')) return 'sarl'
  return 'autre'
}

/** Valeur historique de provider_profiles.legal_status (enum en base) correspondant à une forme juridique. */
export function legalStatusFor(form: LegalForm | null, fallback: string): string {
  if (form === 'micro') return 'auto_entrepreneur'
  if (form === 'eurl' || form === 'sasu' || form === 'sarl') return form
  return fallback
}

export const cleanVat = (v: string) => v.replace(/[\s.\-]/g, '').toUpperCase()
/** Format d'un n° de TVA intracommunautaire : 2 lettres de pays puis 2 à 13 caractères (FR : 2 + 9 chiffres). */
export function vatNumberValid(v: string) {
  const c = cleanVat(v)
  if (c.startsWith('FR')) return /^FR[0-9A-Z]{2}\d{9}$/.test(c)
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(c)
}

/** Erreur PostgREST/Postgres « colonne inconnue » : la migration 039 n'est pas encore appliquée. */
export function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST204' || err.code === '42703') return true
  return /column .* does not exist|could not find the .* column/i.test(err.message || '')
}

export const PRO_STATUS_COLUMNS = ['legal_form', 'vat_status', 'vat_number', 'accepts_cesu_prefinance'] as const
