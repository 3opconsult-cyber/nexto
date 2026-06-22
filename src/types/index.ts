export type UserRole = 'client' | 'pro' | 'admin'

export type LegalForm =
  | 'auto_entrepreneur'
  | 'sarl'
  | 'eurl'
  | 'sas'
  | 'sasu'
  | 'ei'
  | 'sa'
  | 'artisan'
  | 'cesu'
  | 'particulier_emploi'

export type VatRegime =
  | 'franchise_base'
  | 'reel_simplifie'
  | 'reel_normal'
  | 'non_assujetti'

export type ServiceType =
  | 'plomberie' | 'electricite' | 'serrurerie' | 'menage'
  | 'baby_sitting' | 'jardinage' | 'manutention' | 'bricolage'
  | 'peinture' | 'chauffage' | 'vitrerie' | 'autre'

export type DocumentType =
  | 'id_card' | 'kbis' | 'rc_pro' | 'decennale'
  | 'urssaf' | 'siret_cert' | 'iban_cert' | 'other'

export const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  auto_entrepreneur: 'Auto-entrepreneur / Micro-entrepreneur',
  sarl: 'SARL — Société à responsabilité limitée',
  eurl: 'EURL — Entreprise unipersonnelle à responsabilité limitée',
  sas: 'SAS — Société par actions simplifiée',
  sasu: 'SASU — SAS unipersonnelle',
  ei: 'EI — Entreprise individuelle',
  sa: 'SA — Société anonyme',
  artisan: 'Artisan (Chambre des Métiers)',
  cesu: 'CESU — Chèque emploi service universel',
  particulier_emploi: 'Particulier employeur',
}

export const VAT_REGIME_LABELS: Record<VatRegime, string> = {
  franchise_base: 'Franchise en base (auto-entrepreneur, < seuil)',
  reel_simplifie: 'TVA réelle simplifiée',
  reel_normal: 'TVA réelle normale (régime général)',
  non_assujetti: 'Non assujetti à la TVA (CESU, particulier)',
}

export const SERVICE_LABELS: Record<ServiceType, { label: string; emoji: string }> = {
  plomberie:    { label: 'Plomberie',     emoji: '🔧' },
  electricite:  { label: 'Électricité',   emoji: '⚡' },
  serrurerie:   { label: 'Serrurerie',    emoji: '🔑' },
  menage:       { label: 'Ménage',        emoji: '🧹' },
  baby_sitting: { label: 'Baby-sitting',  emoji: '🍼' },
  jardinage:    { label: 'Jardinage',     emoji: '🌿' },
  manutention:  { label: 'Manutention',   emoji: '📦' },
  bricolage:    { label: 'Bricolage',     emoji: '🔨' },
  peinture:     { label: 'Peinture',      emoji: '🎨' },
  chauffage:    { label: 'Chauffage',     emoji: '🔥' },
  vitrerie:     { label: 'Vitrerie',      emoji: '🪟' },
  autre:        { label: 'Autre',         emoji: '⚙️' },
}

export const DOCUMENT_LABELS: Record<DocumentType, { label: string; required: boolean; description: string }> = {
  id_card:    { label: "Pièce d'identité",        required: true,  description: "CNI ou passeport en cours de validité" },
  kbis:       { label: "Extrait Kbis",             required: false, description: "Moins de 3 mois (SARL, SAS, SA)" },
  rc_pro:     { label: "RC Professionnelle",       required: true,  description: "Assurance responsabilité civile pro" },
  decennale:  { label: "Garantie décennale",       required: false, description: "Obligatoire BTP (plomberie, électricité, maçonnerie)" },
  urssaf:     { label: "Attestation URSSAF",       required: false, description: "Attestation de vigilance à jour" },
  siret_cert: { label: "Certificat SIRET",         required: false, description: "Auto-entrepreneur, EI" },
  iban_cert:  { label: "RIB / IBAN",               required: true,  description: "Pour recevoir les virements" },
  other:      { label: "Autre document",           required: false, description: "" },
}

// Documents requis par forme juridique
export const REQUIRED_DOCS: Record<LegalForm, DocumentType[]> = {
  auto_entrepreneur: ['id_card', 'siret_cert', 'rc_pro', 'iban_cert'],
  sarl:              ['id_card', 'kbis', 'rc_pro', 'iban_cert'],
  eurl:              ['id_card', 'kbis', 'rc_pro', 'iban_cert'],
  sas:               ['id_card', 'kbis', 'rc_pro', 'iban_cert'],
  sasu:              ['id_card', 'kbis', 'rc_pro', 'iban_cert'],
  ei:                ['id_card', 'siret_cert', 'rc_pro', 'iban_cert'],
  sa:                ['id_card', 'kbis', 'rc_pro', 'iban_cert'],
  artisan:           ['id_card', 'siret_cert', 'rc_pro', 'iban_cert'],
  cesu:              ['id_card', 'iban_cert'],
  particulier_emploi:['id_card', 'iban_cert'],
}

// TVA selon forme juridique (défaut)
export const DEFAULT_VAT: Record<LegalForm, VatRegime> = {
  auto_entrepreneur: 'franchise_base',
  sarl:              'reel_simplifie',
  eurl:              'reel_simplifie',
  sas:               'reel_simplifie',
  sasu:              'reel_simplifie',
  ei:                'reel_simplifie',
  sa:                'reel_normal',
  artisan:           'reel_simplifie',
  cesu:              'non_assujetti',
  particulier_emploi:'non_assujetti',
}
