# Refonte aérée, deuxième lot du particulier : mesures avant / après (24/11/2026)

Mesure : `node scripts/e2e/mesure-aere.mjs` (Playwright mobile 390x844, compte audit client, lecture seule), PREMIER ÉCRAN. Avant = code de `main` fusionné au départ ; après = build de production local de cette branche (serveur local, base de production). Mêmes colonnes que docs/refonte-aeree-2026-11-24/TABLEAU.md.

| Écran | blocs av → ap | cadres av → ap | texte min av → ap | < 15 px av → ap | air blocs av → ap | cibles < 44 av → ap |
|---|---|---|---|---|---|---|
| Agenda (/agenda) | 2 → 2 | 6 → 0 | 10,5 → 15 | 30 → 0 | 12 → 20 | 0 → 0 |
| Conversation (/mission/[id]/chat) | 8 → 8 | 8 → 4 | 9,5 → 15 | 27 → 0 | 0 → -29 (voir limites) | 0 → 0 |
| Fiche prestataire (/pro/[id]) | 2 → 2 | 5 → 1 | 9,5 → 13 (pastille) | 20 → 0 | 28 → 28 | 0 → 0 |
| Déposer une demande | 3 → 3 | 8 → 0 | 12 → 15 | 12 → 0 | 16 → 16 | 0 → 0 |
| Mes demandes | 2 → 2 | 4 → 0 | 10,5 → 15 | 19 → 0 | 16 → 24 | 0 → 0 |
| Mon profil | 3 → 4 | 0 → 0 | 15 → 15 | 0 → 0 | 28 → 28 | 0 → 0 |
| /bienvenue | 2 → 2 | 1 → 1 | 13 → 15 | 3 → 0 | - | 0 → 0 |
| Inscription étape 1 | 3 → 3 | 4 → 0 | 15 → 16 | 0 → 0 | -40 → 24 | 0 → 0 |

Captures : `avant/<écran>.jpg`, `apres/<écran>.jpg`, plus `apres-inscription-1/2/3.jpg`, `apres-reservation-horaires.jpg`, `apres-deposer.jpg`. Mesures brutes : `mesures-avant2.json`, `mesures-apres3.json`.

Limites : la mesure porte sur le premier écran, pas sur le bas des pages. Conversation : le script donne -29 px entre « Demande » et « Rendez-vous » alors que la capture montre un espace d'environ 20 px (écart non expliqué). Les écrans du prestataire (agenda, conversation, fiche vue par le pro) gardent leurs tailles : les styles aérés ne s'appliquent qu'à l'espace particulier (variable `A` / classes `aere`).
