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
