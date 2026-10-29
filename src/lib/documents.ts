// Catalogue des documents prestataire — même logique que src/lib/trades.ts :
// une seule source, jamais redéfinie localement dans un écran.
export interface DocType {
  key: 'identite' | 'rcpro' | 'kbis' | 'diplome' | 'sap' | 'rib'
  label: string
  question: string
  subtitle?: string
}

export const DOC_TYPES: DocType[] = [
  { key: 'identite', label: "Pièce d'identité", question: 'Avez-vous une pièce d\u2019identité à télécharger ?' },
  { key: 'rcpro', label: 'Assurance RC Pro', question: 'Avez-vous une assurance en cours de validité ?' },
  { key: 'kbis', label: 'Justificatif de statut', question: 'Avez-vous un justificatif SIRET ou Kbis ?' },
  { key: 'diplome', label: 'Diplôme ou qualification', question: 'Avez-vous un diplôme ou une qualification professionnelle à mettre en avant ?', subtitle: 'Facultatif — un vrai plus pour rassurer les clients, mais ça n\u2019est jamais requis pour être visible sur la carte.' },
]

// Documents administratifs complémentaires, déposés depuis « Mes pièces » (hors tunnel d'inscription
// pour ne pas l'allonger) : nécessaires au crédit d'impôt de vos clients et aux futurs versements.
export const EXTRA_DOC_TYPES: DocType[] = [
  { key: 'sap', label: 'Déclaration services à la personne (SAP)', question: 'Avez-vous votre récépissé de déclaration SAP ?', subtitle: 'Obtenu gratuitement sur le portail NOVA. Permet à vos clients de ne payer que 50 % grâce au crédit d\u2019impôt.' },
  { key: 'rib', label: 'RIB professionnel', question: 'Avez-vous votre RIB ?', subtitle: 'Pour les versements de vos prestations, dès l\u2019ouverture du paiement en ligne.' },
]
