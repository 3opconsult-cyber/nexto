# État de PING (vérifié le 21/11/2026 sauf mention contraire)
Règle : toute ligne non vérifiée depuis 60 jours devient « à revérifier » (limite au 20/01/2027 pour les lignes ci-dessous).

## Déploiement et base
| Élément | État | Date | Preuve |
|---|---|---|---|
| Vercel projet « nexto » (équipe nextoping) | Production = commit 9b4ffc5 = tête de `main` | 21/11/2026 | Lecture Vercel, identique au dépôt |
| Dépôt | 3opconsult-cyber/nexto | 21/11/2026 | Vérifié |
| Supabase | Projet `wmiawwaxwlvascyflpba` (eu-west-3). L'autre projet `ahtdevozpbeargnmvzcn` n'est PAS celui de PING | 21/11/2026 | Vérifié |
| Migrations | Jusqu'à 060 appliquées et vérifiées en production (053-060 les 20-21/11) | 21/11/2026 | Vérification en base |
| Fonctions serveur Supabase | Aucune : API = routes Next.js `src/app/api` + 2 crons Vercel | 21/11/2026 | `vercel.json` |
| Variables Vercel `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFY_FROM`, `ADMIN_NOTIFY_EMAIL` | Pas encore posées : NON VÉRIFIÉ | 21/11/2026 | Valeurs jamais lues |
| Dernière revue des sauvegardes Supabase | NON VÉRIFIÉ : à regarder par Romain dans le tableau de bord | -- | -- |

## Parcours testés en production le 21/11/2026 (comptes audit `.invalid`)
| Parcours | Résultat | Script |
|---|---|---|
| Client sur place (commande, QR, 3 factures) | VÉRIFIÉ 35/35 | `scripts/e2e/parcours.mjs` (scénario A) |
| Client absent (photo, code) | VÉRIFIÉ 41/42 ; contrôle de texte assoupli ensuite, resélection à rejouer : non revérifié | `parcours.mjs` (scénario B) |
| Annulations (paliers, prestataire, report) | VÉRIFIÉ 37/37 | `scripts/e2e/annulations.mjs` |
| Litige et réservation à accepter | VÉRIFIÉ 24/24 | `scripts/e2e/reservation-litige.mjs` |
| Séparation des espaces | VÉRIFIÉ 26/26 | `scripts/e2e/separation-espaces.mjs` |
| Factures (PDF, partage, relevé) | VÉRIFIÉ 20/20 | `scripts/e2e/factures.mjs` |
| Pièces et position d'intervention | VÉRIFIÉ 11/11 | `scripts/e2e/pieces-position.mjs` |
| Virement non reçu | VÉRIFIÉ 13/13 | `scripts/e2e/virement-non-recu.mjs` |
| Comptes (inscription, connexion, reset), requêtes d'auth interceptées | VÉRIFIÉ 43/43 | `scripts/e2e/comptes-ui.mjs` |
| Calcul de facture (TS = SQL) | VÉRIFIÉ 36/36 | `node scripts/tests/facturation/run.cjs` |
| Audit ergonomie mesuré (écrans du 20/11) | Fait | `docs/audit-ergonomie-2026-11-21.md` |

## Non vérifié en réel
- Prestataire absent, clôture sur preuve, expiration de réservation par le cron : relus dans le code, jamais rejoués avec de vraies preuves (clé service requise).
- Séquestre : jamais essayé avec un vrai PSP (Stripe, Mangopay, Lemonway) ; noms de champs et d'événements à recontrôler en bac à sable. Éteint.
- Avance immédiate Urssaf : habilitation absente, éteint.
- E-mails Resend : aucun envoi réel vérifié (comptes `.invalid` ignorés, variables non posées).
- Repère « Ici aujourd'hui » sur la carte client avec une zone active : non vu (aucune zone active sur les comptes audit).
- Pièce refusée avec motif côté utilisateur réel : non reproduit sur les comptes audit.
- `TransferCard` « Non reçu » en conditions réelles côté écran : corrigé dans le code, non mesuré.
- Délais de l'audit ergonomie mesurés en local : à remesurer en production.

## Bloqué
- Écriture Supabase par Claude : connecteur refusé ; Romain colle le SQL (`supabase/a_coller/`).
- Paiement en ligne, e-mails, Urssaf : bloqués par des clés et habilitations que seul Romain obtient.

## Ce que seul Romain peut faire
1. Se connecter à l'admin et prendre la « Décision PING » sur le litige test « QA scénario E ».
2. Regarder la pastille « pièces à valider » (057) dans l'admin et valider ou refuser les pièces en attente.
3. Poser les variables Vercel (Resend, `NOTIFY_FROM` sur domaine vérifié, `ADMIN_NOTIFY_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) et vérifier Resend.
4. Choisir un PSP et tester le séquestre avec de vrais comptes (bac à sable d'abord).
5. Rejouer en réel prestataire absent, clôture sur preuve, expiration de réservation (ou fournir la clé service pour le faire).
6. Faire valider juridiquement CGU / CGV (PROVISOIRES) et la clause « mise en relation ».
7. Vérifier les sauvegardes Supabase et confirmer l'orthographe `info@opconsult.co`.
8. Trancher les points de A-TRANCHER.md.
9. Reprendre le CESU (« à faire vendredi » noté dans CLAUDE.md) : voir `docs/cesu-ce-qui-manque.md`.

## Données de test restantes (à nettoyer avec accord)
- Missions « QA ergo ... » et « QA parcours ... » (annulées, litiges ouverts, une avec frais totaux et 3 documents) ; comptes `audit.*` et `qa.*` ; prestataires Fictif 1 à 19 ; données « Exemple -- » du compte de Romain.
- Scripts de nettoyage : `supabase/a_coller/nettoyage_donnees_fictives.sql` (contient DELETE : confirmation humaine requise, ne jamais lancer sans accord).
- 21/11/2026 : première passe des 5 critiques faite (propositions A-021 à A-040 dans AMELIORATIONS.md) ; correctifs faits : events.path nettoyé (73bf766), Messages vide, cartes de présence 44 px (non vérifiés à l'écran). 2 déploiements de production par push confirmés (A-036).
- 21/11/2026 (soir) : fenêtres PING (ConfirmSheet) à la place des fenêtres natives, chat allégé de 5 ko seulement (221 ko) : en ligne (1059062). Vérifié en production : annulation gratuite côté client par l'écran (feuille affichée, 4 boutons de 44 px, annulation enregistrée, aucune erreur console), annulations 37/37, séparation 26/26. NON vérifié : parcours A et B après ce changement (ils demandent un créneau du jour : à rejouer demain en journée), ConfirmSheet des contestations de présence, suppression d'une pièce, retrait d'une prestation, actions de /admin/paiements.
