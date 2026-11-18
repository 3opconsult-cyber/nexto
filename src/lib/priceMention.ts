// Détecte un montant dans un message texte du chat (« 60 € », « 60€ », « 45 euros », « € 50 »,
// « 25e de l'heure », « 20e/h »). Sert uniquement à afficher un rappel non bloquant : un prix
// écrit dans un message ne compte pas, seul un tarif validé des deux côtés (Proposer un tarif)
// est facturé. « e » seul n'est retenu que suivi d'une unité de prix (« 2e étage » n'est pas un prix).
const EURO_SYMBOL = /€\s*\d|\d\s*€/
const EURO_WORD = /\b\d+(?:[.,]\d{1,2})?\s*(?:euros?|eur)\b/i
const BARE_E = /\b\d+(?:[.,]\d{1,2})?\s?e\b(?=\s*(?:\/\s*h|\/\s*heure|de\s+l['’]\s*heure|l['’]\s*heure|par\s+heure|de\s+l['’]\s*h\b|la\s+séance|le\s+passage|la\s+prestation|par\s+(?:mois|semaine|séance|passage)|ttc|ht\b|net\b))/i

export function mentionsPrice(text: string | null | undefined): boolean {
  if (!text) return false
  return EURO_SYMBOL.test(text) || EURO_WORD.test(text) || BARE_E.test(text)
}
