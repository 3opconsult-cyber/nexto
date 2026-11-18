// Catalogue des services PING.
//
// Mono-produit verrouille au lancement : ménage, repassage, nettoyage — rien d'autre.
// La base ne restreint rien (trade/category/name sont de simples colonnes texte,
// aucun enum Postgres) : ouvrir un nouveau service en v3 se fait ICI, en une ligne,
// sans migration. Ne jamais redéfinir cette liste localement dans un écran.
export const TRADES: Record<string, string> = {
  menage: 'Ménage',
  repassage: 'Repassage',
  nettoyage: 'Nettoyage',
  // Présent en base chez certains prestataires (cf. CLAUDE.md « + vitres en base ») : libellé
  // nécessaire à l'affichage, mais pas proposé au choix tant que l'offre reste aux 3 services.
  vitres: 'Vitres',
}

// Services proposés au choix (inscription pro, demande client) : les 3 du lancement.
const SELECTABLE = ['menage', 'repassage', 'nettoyage']
export const TRADE_LIST = SELECTABLE.map(key => ({ key, label: TRADES[key] }))

// Tous les métiers connus (puces de la carte client) : les 3 du lancement + ceux présents en base.
export const ALL_TRADE_KEYS = Object.keys(TRADES)

// Métier d'une prestation du catalogue `services` (/pro/tarifs). Le métier n'a pas de colonne dédiée :
// il est porté par `services.name` (clé « menage » ou libellé « Ménage », cf. /pro/onboarding et
// /pro/tarifs), parfois suivi d'une précision (« Repassage (en complément du ménage) »). Un nom libre
// qui ne commence par aucun métier connu (« Mise en blanc ») ne compte pour aucun métier.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export function tradeOfServiceName(name: string | null | undefined): string | null {
  if (!name) return null
  const n = norm(name)
  for (const k of ALL_TRADE_KEYS) {
    const l = norm(TRADES[k])
    if (n === k || n === l) return k
    if (n.startsWith(l + ' ') || n.startsWith(l + '(') || n.startsWith(k + ' ')) return k
  }
  return null
}
