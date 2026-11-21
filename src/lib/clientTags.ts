/** Remarques rapides sur un client (fenêtre d'avis prestataire). Séparé du composant pour ne pas alourdir les pages qui les affichent. */
export const CLIENT_TAGS: { key: string; label: string }[] = [
  { key: 'acces_difficile', label: 'Accès difficile' },
  { key: 'demande_incomplete', label: 'Demande incomplète' },
  { key: 'plus_sale', label: 'Plus sale que prévu' },
  { key: 'plus_propre', label: 'Plus propre que prévu' },
  { key: 'materiel_fourni', label: 'Matériel fourni' },
  { key: 'tres_accueillant', label: 'Très accueillant' },
  { key: 'client_absent', label: 'Client absent' },
  { key: 'retard', label: 'Attente à l’arrivée' },
]
