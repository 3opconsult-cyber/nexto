# Refonte aérée du particulier : mesures avant / après (24/11/2026)

Mesure : `node scripts/e2e/mesure-aere.mjs` (Playwright mobile 390x844, compte audit client, lecture seule). Avant = code de `main` au départ (serveur local), après = build de production local de cette branche. Les colonnes portent sur le PREMIER ÉCRAN (barre du bas, bulle et éléments fixes exclus).

Colonnes : blocs = blocs visibles ; cadres = éléments avec bordure sur 2 côtés ou plus (hors pastilles de moins de 26 px) ; texte min = plus petite taille de texte (px) ; <15 px = nombre de textes sous 15 px (13 px autorisé pour les pastilles et mentions) ; air blocs = plus petit espace vertical entre le contenu de deux blocs (px) ; interligne min ; cibles < 44 = boutons, liens, champs sous 44 px.

| Écran | blocs av → ap | cadres av → ap | texte min av → ap | <15 px av → ap | air blocs av → ap | interligne min av → ap | cibles < 44 av → ap |
|---|---|---|---|---|---|---|---|
| Mon profil (/client/profil) | 4 → 2 | 3 → 0 | 11 → 15 | 6 → 0 | 16 → 28 | 1.5 → 1.5 | 0 → 0 |
| Messages (/messages) | 4 → 3 | 6 → 0 | 10.5 → 13 | 28 → 0 | 12 → 24 | 1.5 → 1.55 | 0 → 0 |
| Commande (/mission/[id]/commande) | 5 → 3 | 6 → 0 | 9.5 → 13 | 25 → 0 | 12 → 28 | 1.5 → 1.5 | 0 → 0 |
| Mission du jour (/mission/[id]/jour) | 4 → 4 | 5 → 2 | 9 → 15 | 19 → 0 | 12 → 20 | 1.2 → 1.55 | 0 → 0 |
| Réservation (/mission/new) | 2 → 2 | 50 → 0 | 10 → 15 | 78 → 0 | 0 → 16 | 1.5 → 1.5 | 0 → 0 |
| Paiements (/client/paiements) | 3 → 2 | 2 → 0 | 11 → 13 | 17 → 0 | 8 → 48 | 1.5 → 1.5 | 0 → 0 |
| Mes pièces (/client/documents) | 2 → 2 | 0 → 0 | 11 → 13 | 5 → 0 | 16 → 24 | 1.5 → 1.5 | 0 → 0 |
| Facture (/mission/[id]/facture) | 2 → 2 | 0 → 0 | 9 → 15 | 24 → 0 | 20 → 44 | 1.5 → 1.55 | 0 → 0 |
| Litige (/litiges/[id]) | 4 → 3 | 7 → 3 | 10.5 → 13 | 18 → 0 | 14 → 24 | 1.5 → 1.5 | 0 → 0 |
| Connexion (/auth/login) | 3 → 3 | 1 → 0 | 11 → 16 | 10 → 0 | 0 → 24 | 1.45 → 1.5 | 2 → 0 |
| Inscription / accueil (/auth/signup) | 3 → 3 | 4 → 4 | 10.5 → 15 | 45 → 0 | -821 → -40 | 1.5 → 1.5 | 4 → 0 |
| Trouver : besoin | 3 → 3 | 3 → 3 | 14 → 16 | 1 → 0 | 12 → 20 | 1.5 → 1.55 | 0 → 0 |
| Trouver : moment | 4 → 3 | 3 → 0 | 12.5 → 15 | 4 → 0 | 8 → 16 | 1.5 → 1.55 | 0 → 0 |
| Trouver : meilleur choix | 6 → 3 | 2 → 1 | 12 → 15 | 6 → 0 | 4 → 16 | 1.5 → 1.5 | 0 → 0 |

Captures : `avant/<écran>.jpg` et `apres/<écran>.jpg` (390x844). Mesures brutes : `mesures-avant.json`, `mesures-avant-fs.json` (feuille « Trouver »), `mesures-apres.json`.

Limites de la mesure : « air blocs » compare le contenu visible de blocs voisins ; un écran à un seul bloc affiche `-`. Le « texte min » de la page d'inscription et de la feuille vient aussi du sélecteur de date et de la carte masquée dessous (feuille : mesurée dans la feuille seule). La barre du bas (étiquettes 10,5 px) est partagée avec le prestataire et n'a pas été reprise. Le chiffre d'air entre un bloc et un bouton compte le cadre du bouton.
