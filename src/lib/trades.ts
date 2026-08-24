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
}

export const TRADE_LIST = Object.entries(TRADES).map(([key, label]) => ({ key, label }))
