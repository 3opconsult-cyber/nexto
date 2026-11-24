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
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Parcours A et B : à lancer en journée (avant ~17 h Paris) ; le soir le créneau est le lendemain et « Je pars » est refusé (038) : pas une régression.
- Nouveaux scripts : reservation-litige (TA, TB), annulations (37), pieces-position (11), virement-non-recu (13), comptes-ui (43, requêtes d'auth interceptées), CANCEL_AFTER_ARRIVAL=1 sur parcours A.
- Après `npm uninstall`, recréer le lien : ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright.
- Positions simulées : Grasse (43.6588, 6.9226) pour voir les annonces d'un client audit ; Nice les cache (15 km).
- Le chat n'était pas en direct (message visible après rechargement) : correctif 062 (publication Realtime) à coller puis retester avec deux comptes.
- L'audit des écrans de l'admin est impossible sans compte administrateur : NON VÉRIFIÉ, ne pas le masquer.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : un déploiement pendant un test l'invalide ; A et B échouent le soir (créneau du lendemain) ; le test local est instable, la production en journée fait foi ; rejouer un échec seul avant de conclure ; les scripts doivent être mis à jour quand l'interface change (comptes-ui, étape 3 de l'inscription) ; noms des scripts : scripts/e2e/*.mjs et non-regression.sh.
