// Crédit d'impôt services à la personne : 50 % des dépenses (plafond annuel 12 000 €, hors cas
// particuliers). Avec l'avance immédiate, le client ne paie que sa part, l'Urssaf verse le reste.
export const CREDIT_RATE = 0.5

// Ménage, repassage, nettoyage et vitres relèvent tous de « l'entretien de la maison ».
const ELIGIBLE = ['menage', 'repassage', 'nettoyage', 'vitres']

export function isEligible(category?: string | null) {
  return !!category && ELIGIBLE.includes(category)
}

export function partClientCents(totalCents: number) {
  return totalCents - Math.round(totalCents * CREDIT_RATE)
}

// Affiché côté client uniquement quand le branchement Urssaf est actif.
export const AVANCE_IMMEDIATE_ACTIVE = process.env.NEXT_PUBLIC_AVANCE_IMMEDIATE === '1'
