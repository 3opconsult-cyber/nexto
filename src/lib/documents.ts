// Catalogue des documents prestataire — même logique que src/lib/trades.ts :
// une seule source, jamais redéfinie localement dans un écran.
export interface DocType {
  key: 'identite' | 'rcpro' | 'kbis' | 'diplome'
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
