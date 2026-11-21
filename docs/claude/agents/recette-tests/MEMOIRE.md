# Mémoire recette-tests (vérifié le 21/11/2026)
## Comptes et données
- Comptes : audit.client.claude@ping-demo.invalid et audit.pro.claude@ping-demo.invalid ; mot de passe : voir CLAUDE.md historique, section « Comptes de test » (ne jamais le recopier).
- Les missions de test restent en base (titres « QA parcours ... », « QA ergo ... ») : ne pas les supprimer sans accord.
- Les comptes fictifs 1 à 19 n'ont pas de ligne `auth.identities` : ils ne se connectent pas.
## Scripts et derniers résultats en production (21/11/2026)
- `parcours.mjs` : A (client sur place) 35/35 ; B (client absent) 41/42, contrôle de texte assoupli ensuite (rejouer). `SCEN=A|B`, `TOUR=1`, `CANCEL_AFTER_ARRIVAL`.
- `annulations.mjs` 37/37 ; `reservation-litige.mjs` 24/24 ; `separation-espaces.mjs` 26/26 ; `factures.mjs` 20/20 ; `pieces-position.mjs` 11/11 ; `virement-non-recu.mjs` 13/13 ; `comptes-ui.mjs` 43/43.
- `node scripts/tests/facturation/run.cjs` 36/36 ; pare-feu 17 ; litige-chat 17 + chatping 9 ; virement-non-recu 21 (bases locales PostgreSQL 16).
- GitHub Actions `e2e-prod.yml` : séparation + factures chaque jour 05:17 UTC ; échoue sur « ECHEC » ou code de sortie non nul.
## Installation
- `npm i playwright@1.48.2 @supabase/supabase-js@2.45.4` ; `npx playwright install --with-deps chromium` ; `PW_CHROMIUM_PATH` si le Chromium préinstallé diffère.
- Variables optionnelles : `ADMIN_EMAIL` / `ADMIN_PASSWORD` (pièces, admin), `SB_SERVICE` (absence réelle) : jamais écrites dans un fichier.
## Ce qu'un test attrape que la relecture rate
- Messages `sender_id` NULL, cookies `@supabase/ssr`, `dispute_status`, description NOT NULL, variable ambiguë de `cancel_booking` (ERREURS.md).
## Limites connues
- Absence du prestataire, clôture sur preuve, expiration : exigent une clé service ou un RDV passé ; non rejoués en réel.
- Les comptes `.invalid` ne reçoivent aucun e-mail : l'envoi se vérifie à la main avec un vrai compte.
- `parcours.mjs` crée une mission à chaque passage : à lancer à la main.
## Format de preuve
- Compte rendu = nom du script, nombre OK / total, lignes KO avec le message, date, commit de production (9b4ffc5 le 21/11).

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
