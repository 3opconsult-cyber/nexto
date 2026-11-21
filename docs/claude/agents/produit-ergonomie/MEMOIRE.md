# Mémoire produit-ergonomie (vérifié le 21/11/2026)
## Méthode éprouvée (audits 18, 19 bis, 19 ter, 21/11)
- Playwright, mobile 390x844 tactile (et 1280x900 pour les listes), comptes audit `.invalid`, missions « QA ergo ... » ; avant = prod, après = build local.
- Mesurer : nombre d'appuis par tâche, nombre de requêtes au chargement, cibles < 44 px, erreurs console. Note sur 10 par tâche.
- Les délais d'agenda / Messages / fiche sont inexploitables (texte déjà dans la coquille) : seuls les nombres de requêtes sont fiables.
## Conventions de l'interface
- Design : `src/app/ping-ui.css` (teal #12B39C, navy #123644, Quicksand + Inter). Gris secondaire #4E6470 minimum (contraste AA).
- Cibles >= 44 px (interrupteur : zone de toucher 60x44) ; jamais `confirm()` ; volets (`Sheet`, `Modal`) en z-index 3000, au-dessus de la barre du bas (1500).
- Menu : 4 entrées identiques (pro : Demandes autour de moi, Messages, Agenda, Mon entreprise ; particulier : Carte, Messages, Agenda, Mon profil) + Support PING. Le reste = lignes Hub (`src/components/Hub.tsx`).
- Bascule particulier / prestataire uniquement depuis le menu (ModeHint = simple cloche). Barre du bas aussi sur les pages mission (`--tabbar-h`).
- Pictogrammes SVG inline, pas d'emoji. Prix et distances au format français (7,3 km, 108,00 EUR).
- Bulle verte de feedback masquée sur /auth, /mission/*, /essai, /litiges/*.
## Résultats du 21/11 (docs/audit-ergonomie-2026-11-21.md)
- Corrigés : fenêtres d'annulation sous la barre (bloquant mobile), « Annuler » visible (2 appuis), bandeau de réservation sur la saisie du chat, libellé du formulaire de litige, cibles < 44 px, litiges au clavier.
- Fluidité du chat : 63-103 requêtes -> 39-43 ; bouton clé 1,0-2,1 s -> 0,85 s (mesure locale à refaire en production).
## Points ouverts (voir AMELIORATIONS.md)
- `presence_state` encore ~7 fois par chargement (RPC groupée à écrire, changement de base).
- Bandeau « Report proposé » en haut alors que le fil est calé en bas ; « Demander l'intervention de PING » sans confirmation (décision 20/11 : 1 appui) ; /pro/documents 1,3-2,0 s.
- Non vérifiés en réel : repère « Ici aujourd'hui », pièce refusée avec motif, TransferCard « Non reçu », absence du prestataire, clôture sur preuve.
## Pièges
- Un écran « correct » en build n'est pas validé : la validation du rendu se fait sur nexto-eta.vercel.app.
- Double confirmation des frais totaux d'annulation : voulue, ne pas la supprimer.
- Adresse du RDV : jamais montrée avant confirmation et paiement (voir REGLES-METIER).

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
