# Refonte aérée du prestataire : mesures avant / après (24/11/2026)

Mesure : `WHO=pro LABEL=avant|apres BASE=... node scripts/e2e/mesure-aere.mjs` (Playwright mobile 390x844, compte audit prestataire, lecture seule). Avant = code au départ, après = build de production local. Blocs, cadres, texte min, air, interligne : premier écran. « Sous 15 px » et « cibles < 44 » : page entière (13 px autorisé pour pastilles et mentions `.a-mini` / `.a-pill`, non comptés).

| Écran | blocs | cadres | texte min | éléments < 15 px (page) | air entre blocs | interligne min | cibles < 44 (page) |
|---|---|---|---|---|---|---|---|
| Paiements /pro/paiements | 4 → 3 | 4 → 1 | 11 → 15 | 292 → 0 | 8 → 28 | 1.5 → 1.55 | 0 → 0 |
| Mes pièces /pro/documents | 2 → 2 | 5 → 1 | 10.5 → 13 | 44 → 0 | 16 → 42 | 1.45 → 1.55 | 0 → 0 |
| Mon annonce /pro/annonce | 3 → 3 | 2 → 0 | 12 → 15 | 52 → 0 | 14 → 30 | 1.45 → 1.55 | 21 → 0 |
| Agenda pro, vue Jour | 2 → 2 | 4 → 0 | 10 → 13 | 82 → 0 | 12 → 30 | 1.45 → 1.55 | 1 → 0 |
| Agenda pro, vue Mois | 2 → 2 | 7 → 1 | 10.5 → 15 | 67 → 0 | 12 → 30 | 1.45 → 1.55 | 1 → 0 |
| Mon entreprise /pro/dashboard | 2 → 2 | 1 → 1 | 14 → 15 | 19 → 0 | 12 → 28 | 1.5 → 1.55 | 0 → 0 |
| Revenus | 3 → 3 | 6 → 0 | 11 → 15 | 17 → 0 | 16 → 32 | 1.5 → 1.55 | 0 → 0 |
| Mes tarifs | 2 → 2 | 3 → 0 | 10 → 13 | 8 → 0 | 20 → 28 | 1.5 → 1.55 | 0 → 0 |
| Disponibilités | 2 → 2 | 4 → 1 | 10.5 → 15 | 54 → 0 | 16 → 40 | 1.5 → 1.55 | 0 → 0 |
| Documents (étape de l'inscription) | 2 → 2 | 6 → 1 | 11 → 13 | 11 → 0 | 19 → 42 | 1.3 → 1.5 | 2 → 0 |

Captures : `avant/`, `apres/` (premier écran `<écran>.jpg`, page entière tronquée à 3000 px `<écran>-page.jpg`), plus `apres/agenda-jour-deplie.jpg` (« 9 rendez-vous à 07:00 » déplié) et `apres/pieces-prise-de-vue.jpg` (« Cadrez le document en entier »). Mesures brutes : `mesures-avant.json`, `mesures-apres.json`.

Limites : le texte sous 15 px des fenêtres non ouvertes (éditeur de prestation, fiche du jour des disponibilités, éditeur de prix) n'est pas dans la mesure ; la barre du bas et la bulle sont exclues (étiquettes passées de 12 à 13 px). Le bandeau « nouvelles réservations » flotte au-dessus de la barre sur les écrans sauf Mon entreprise.
