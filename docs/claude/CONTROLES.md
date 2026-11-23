# Contrôles : ce qui tourne et ce qui est prévu (vérifié le 21/11/2026 dans le code et les migrations)
Statut « tourne » = défini dans le dépôt ; l'activation réelle en production d'un pg_cron est « à confirmer en base » quand la migration le dit « si l'extension est là ».

## Tâches planifiées existantes
| Tâche | Où | Horaire (UTC) | Rôle | Statut |
|---|---|---|---|---|
| `/api/payments/release` | cron Vercel (`vercel.json`) | 07:17 chaque jour | Verse au prestataire 24 h après la fin si aucun litige ; inactif sans PSP | défini ; PSP éteint donc sans effet |
| `/api/bookings/expire` | cron Vercel | 05:43 chaque jour | `expire_pending_bookings()`, e-mails aux clients, rattrapage alertes pièces, `expire_documents` | défini ; e-mails inactifs sans variables |
| `e2e-prod.yml` | GitHub Actions | 05:17 chaque jour | Tests séparation des espaces + factures contre la prod | défini ; dernier résultat [à compléter] |
| `ping_reservations_expirees` | pg_cron (052) | toutes les 10 min | Annule les réservations non acceptées à temps | à confirmer en base |
| `ping_virements_en_retard` | pg_cron (025) | 06:23 chaque jour | `mark_overdue_transfers()` : retards, dette de commission | à confirmer en base |
| `ping_pieces_expirees` | pg_cron (057) | 06:41 chaque jour | `expire_documents()` : pièces expirées, rappel 45 j | à confirmer en base |
| `auto_release_completed_transactions` | pg_cron | -- | Désactivé le 17/09 (faux « Réglée ») | arrêté, ne jamais réactiver |

## Tests rejouables (sur la prod, comptes `.invalid`)
| Test | Commande | Dernier résultat connu (21/11/2026) |
|---|---|---|
| Parcours A et B (sur place, absent) | `node scripts/e2e/parcours.mjs` (`SCEN=A` ou `B`) | 35/35 ; 41/42 |
| Annulations | `node scripts/e2e/annulations.mjs` | 37/37 |
| Litige et réservation | `node scripts/e2e/reservation-litige.mjs` | 24/24 |
| Séparation des espaces | `node scripts/e2e/separation-espaces.mjs` | 26/26 |
| Factures | `node scripts/e2e/factures.mjs` | 20/20 |
| Pièces et position | `node scripts/e2e/pieces-position.mjs` | 11/11 |
| Virement non reçu | `node scripts/e2e/virement-non-recu.mjs` | 13/13 |
| Comptes (UI) | `node scripts/e2e/comptes-ui.mjs` | 43/43 |
| Tous les écrans | `node scripts/e2e/audit-scenarios.mjs` | [à compléter] |
| Calcul de facture | `node scripts/tests/facturation/run.cjs` | 36/36 |
| Pare-feu des commissions (base simulée) | `node scripts/tests/pare-feu/run.cjs` | 17 OK (31/10) |
| Litige dans le chat (SQL local) | `node scripts/tests/litige-chat/run.cjs` | 17 OK (20/11) |
| Virement non reçu (SQL local) | `node scripts/tests/virement-non-recu/run.cjs` | 21 OK (20/11) |
| E-mails immédiats (base et Resend simulés) | `node scripts/tests/emails-immediats/run.cjs` | 27 OK (23/11) |
Mode d'emploi et variables : `scripts/e2e/README.md`. `parcours.mjs` crée une mission en base à chaque passage : à lancer à la main.

## Contrôles quotidiens, alertes immédiates (décision Romain du 23/11/2026)
Les contrôles de vérification (cron `/api/bookings/expire`, contrôle SQL de nuit) restent UNE FOIS PAR JOUR. Les e-mails de report et d'annulation aux parties partent déjà à l'action (`notifyOther`). Les alertes graves pour PING (annulation après l'arrivée ou tardive à frais, prestataire absent, litige ouvert, intervention de PING, virement non reçu ou contesté) partent aussi à l'action : `POST /api/admin/alerte-immediate` (`sendImmediateAdminAlert`), une fois par alerte (`emailed_at`) ; le cron quotidien reste le filet si l'appel est perdu. Éteint sans Resend ; jamais essayé en vrai (non vérifié).

## Contrôles avant livraison (manuels, déjà la règle)
`npx tsc --noEmit` ; `npm run build` ; test e2e concerné ; vérification sur nexto-eta.vercel.app.

## PRÉVU en phase 2 (non construit, ne pas présenter comme actif)
- Contrôle SQL de nuit : prévu. Idée : missions sans facture, virements en retard sans alerte, pièces expirées visibles, paiements `failed`, réservations coincées.
- Contrôles à chaque mise en ligne : prévu. Idée : tests de séparation, factures et annulations après chaque déploiement `main`.
- Alerte automatique en 4 lignes à Romain si un contrôle échoue : prévu.
- Vérification des droits (appel anonyme refusé sur les RPC sensibles) : prévu.
- Lecture des journaux Vercel (`get_runtime_errors`) après chaque déploiement : prévu.

- 21/11/2026 : phase 2 livrée dans le dépôt, NON vérifiée en production : migration 061 (contrôle de nuit, à coller, puis `select public.run_nightly_controls();`), workflow `.github/workflows/controles.yml` (jamais exécuté sur GitHub), `scripts/controles/*`, alerte e-mail `/api/controles/alerte` (attend Resend). Détail : docs/controles-niveau-3.md.
