# SQL Supabase

Lien direct : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new

## Ordre de collage (mis à jour le 19/11/2026)

**À coller (process de commande, 19/11/2026)** : `048_process_commande.sql`, juste après `038_arrivee_depart_securise.sql`
(elle lit ses tables et réécrit `_presence_apply`, `validate_presence`, `request_remote_presence`, `presence_state`,
`unread_counts`). Testée sur PostgreSQL 16 avec 038 sur un schéma minimal (collée deux fois chacune). Sans 048, l'app garde
le fonctionnement de 038 (ou de 033 sans 038).

**À coller (demande fermée à l'accord, 19/11/2026)** : `051_demande_fermee_a_l_accord.sql` (copie exacte de
`supabase/migrations/051_…`) — trigger sur `transactions.price_confirmed` + RPC `match_request_on_accept` : une demande
publiée passe en « matched » dès qu'une proposition est acceptée, quel que soit celui qui accepte, et disparaît des
« Demandes autour de vous » ; rattrape les demandes déjà acceptées restées « open ». Sans elle, l'application ferme
déjà la demande quand c'est le client qui accepte. Vérification :
`select proname from pg_proc where proname in ('match_request_on_accept', '_request_matched_on_price');`

**À coller (réservation à accepter, 19/11/2026)** : `052_reservation_a_accepter.sql` (copie exacte de
`supabase/migrations/052_…`), APRÈS 051 (et après 045 et 048 si elles sont collées : 052 réécrit `book_service` et
`unread_counts`, en gardant les ajouts de 038/048 s'ils sont présents ; si 038 ou 048 est recollée plus tard, recoller 052).
Une réservation directe (`book_service`) naît « en_attente » : le prestataire l'accepte (`accept_booking`) ou la refuse
(`refuse_booking`, motif facultatif : annulation sans frais, créneau libéré) ; sans réponse avant `accept_deadline`
(24 h ou 2 h avant le rendez-vous, le plus court, au moins 30 min), `expire_pending_bookings()` l'annule (pg_cron toutes les
10 min si l'extension est là, et l'application l'appelle aussi à la lecture). Verrou : ni « Je pars », ni arrivée, ni fin tant
qu'elle n'est pas acceptée. Missions issues d'un devis accepté et réservations existantes : « acceptee » (valeur par défaut).
Sans elle, l'application garde le fonctionnement actuel (réservation confirmée d'office). Testée sur PostgreSQL 16 (collée deux
fois, avec et sans 038/048). Vérification :
`select proname from pg_proc where proname in ('accept_booking', 'refuse_booking', 'expire_pending_bookings');` puis
`select booking_status, count(*) from transactions group by 1;` et `select jobname from cron.job where jobname = 'ping_reservations_expirees';`

**À coller (réservations expirées et argent des litiges, 20/11/2026)**, dans cet ordre, APRÈS 052 et 040 :
1. `053_reservations_expirees_serveur.sql` : droit de la clé service sur `expire_pending_bookings()` et lecture
   `booking_ended_unnotified()` (réservations expirées ou refusées dont le client n'a pas encore reçu l'e-mail). Sert à la
   route cron `/api/bookings/expire` (e-mail au client même si personne n'ouvre l'app, remboursement à 100 % quand le
   paiement en ligne sera actif). Vérification : `select * from public.booking_ended_unnotified();`
2. `054_litige_decision_ping.sql` : paiement bloqué dès l'ouverture d'un litige (virement de la prestation « suspendu »,
   sans relance ; message dans le fil), « Demander l'intervention de PING » (`request_ping_mediation`), « Décision PING »
   de l'admin (`ping_decide_dispute` : montant rendu au client, reste au prestataire, motif ; avoir et virement ajustés
   comme 040 ; litige clos), colonnes `money_*` pour la répartition chez le PSP (séquestre). Sans elle : l'app garde
   l'ancienne clôture admin (résolu / non retenu). Testées sur PostgreSQL 16 (collées deux fois, scénarios virement,
   amiable, décision 0 €, décision avant facture). Vérification :
   `select proname from pg_proc where proname in ('request_ping_mediation', 'ping_decide_dispute', 'apply_dispute_credit');`
3. `055_delai_incident_24h.sql` : 24 h après la fin de la mission pour ouvrir un litige (réglage `incident_window_hours`) ;
   au-delà, ou paiement déjà versé, l'ouverture est refusée : jamais de remboursement à la main après versement.
   Vérification : `select tgname from pg_trigger where tgname = 'trg_enforce_incident_window';`

**À coller (alertes admin sur les pièces, pièces expirées, position d'intervention, 20/11/2026)**, dans cet ordre, APRÈS 042 :
1. `057_alertes_admin_pieces.sql` (copie exacte de `supabase/migrations/057_…`) : table `admin_notifications` (lecture et traitement
   réservés à `is_admin()`) alimentée par trigger à chaque dépôt ou remplacement de pièce (prestataire ou client) et marquée traitée à la
   décision ; message « Support PING » au déposant à chaque décision (validée, refusée avec motif, expirée) ; `expire_documents()` (pose
   `expired` quand `valid_until` est dépassé, rappel unique 45 jours avant), planifiée chaque jour à 6 h 41 UTC par pg_cron s'il est installé.
   Pastille « pièces à valider » dans l'admin (Conformité et accueil) ; e-mail à PING par la route serveur `/api/admin/document-alert`
   (variable Vercel `ADMIN_NOTIFY_EMAIL`, repli `info@opconsult.co`, 1 e-mail par déposant toutes les 10 min, jamais le contenu de la pièce ;
   `RESEND_API_KEY` et `SUPABASE_SERVICE_ROLE_KEY` requis, sinon rien ne part). Sans elle : l'admin garde sa file « Pièces à valider »,
   compte les pièces en attente pour la pastille, et envoie lui-même le motif de refus.
   Vérification : `select tgname from pg_trigger where tgname = 'trg_documents_admin_alert';` puis `select public.expire_documents();`
   puis `select jobname, schedule from cron.job where jobname = 'ping_pieces_expirees';`
2. `058_position_intervention.sql` (indépendante de 057) : « Je suis en intervention ici (visible aujourd'hui) » — consentement
   (`provider_private.live_zone_consent_at`), table `provider_live_zone` (position arrondie à ~500 m par la base, jamais la position exacte ;
   12 h ; arrêt à tout moment, à l'expiration et à la fin de la mission liée), RPC `set_live_zone_consent`, `set_live_zone`,
   `clear_live_zone`, `providers_live_zones(p_lat, p_lng, radius_m, p_trade)` (lecture publique, version floutée seulement).
   `providers_nearby` n'est PAS modifiée (voir l'en-tête du fichier). Sans elle : l'interrupteur n'apparaît pas, la carte est inchangée.
   Vérification : `select proname from pg_proc where proname in ('set_live_zone', 'clear_live_zone', 'set_live_zone_consent', 'providers_live_zones');`
   Testées sur PostgreSQL 16 (collées deux fois, accès interdits refusés). Rien à supprimer : une zone terminée est seulement fermée.
   Test de bout en bout après collage : `node scripts/e2e/pieces-position.mjs`.

**Règle commune.** Déployer l'application AVANT de coller. Chaque fichier ci-dessous :
- est une copie exacte de `supabase/migrations/…` (sauf `provider_services_public.sql` et `comptes_qa.sql`, qui n'existent qu'ici) ;
- est idempotent : on peut le recoller sans risque ;
- ne contient aucune instruction DROP ni DELETE. Les mots `on delete cascade`, `revoke delete` et `for delete` apparaissent dans 043, 044 et 046 : ce sont des clauses, pas des suppressions. Par le connecteur MCP, ils déclenchent quand même la confirmation humaine.

L'application détecte chaque migration et garde l'ancien fonctionnement tant qu'elle est absente. Coller dans l'ordre. Un fichier collé seul ne casse rien, mais l'ordre évite de réécrire deux fois la même fonction (`provider_docs_checked` : 039 puis 042).

**À coller (catalogue des services, lots 26-27, 18/11/2026)** : `050_catalogue_services.sql` (copie exacte de
`supabase/migrations/050_…`) — table `service_catalog` (lecture publique, écriture admin), remplie avec ménage, repassage,
nettoyage (proposés) et vitres (affiché, non proposé), à l'identique de `src/lib/trades.ts` : aucun nouveau métier activé.
L'application lit la table et retombe sur `src/lib/trades.ts` tant qu'elle est absente ; écran admin « Catalogue des services ».
Idempotente, sans DROP ni DELETE. Vérification après coup :
`select key, label, active, hidden, cesu_eligible from public.service_catalog order by sort_order;`


| # | Fichier | Ce que ça apporte | Vérification après coup |
|---|---|---|---|
| 1 | `038_arrivee_depart_securise.sql` | Arrivée et départ validés uniquement avec une preuve du client. | `select proname from pg_proc where proname in ('validate_presence', 'client_confirm_presence', 'presence_state');` |
| 1 bis | `048_process_commande.sql` | Process de commande (maquette 18/11) : « Je serai / ne serai pas sur place » posé par le client seul, photo d'arrivée obligatoire quand il est absent (bucket privé `presence-photos`, message avec photo, distance et heure), code de validation et code de fin envoyés par le client puis saisis par le prestataire. Réécrit 5 fonctions de 038 : à coller juste APRÈS 038 (et à recoller si 038 est recollé). | `select proname from pg_proc where proname in ('set_client_presence', 'request_absent_arrival', 'request_end_code', 'client_send_presence_code');` puis `select id, public from storage.buckets where id = 'presence-photos';` |
| 2 | `039_statut_pro_cesu.sql` | Statut juridique et TVA du pro, CESU préfinancé, `provider_docs_checked`. | `select legal_form, accepts_cesu_prefinance from provider_profiles limit 1;` |
| 3 | `040_arrangement_amiable.sql` | « Arrangement à l'amiable » dans un litige, avoir, virement ajusté. Les frais et la commission ne changent pas (voir 047). | `select proname from pg_proc where proname in ('propose_settlement', 'accept_settlement', 'decline_settlement', 'mark_settlement_refunded');` |
| 4 | `041_prestations_photos.sql` | Prestations : métier, photo, « masquée ». | `select trade, photo_path, hidden from services limit 1;` |
| 5 | `provider_services_public.sql` | Activités du prestataire lisibles par tous (carte multi-activités, lot 20). | `select * from provider_services_public(array[]::uuid[]);` |
| 6 | `042_pieces_motif_expiration.sql` | Lots 21 et 22 : motif de refus, date d'expiration (`valid_until`), alerte à 45 jours (Mes pièces, Mon entreprise, Conformité de l'admin). « Profil vérifié par PING » seulement si la pièce d'identité est validée par un admin et non expirée. | `select rejection_reason, valid_until, reviewed_at from documents limit 1;` puis `select * from provider_docs_status(array[]::uuid[]);` |
| 7 | `043_signalements.sql` | Lot 24 : table `reports` (signalement privé d'un échange, distinct du litige), file « Signalements » de l'admin. | `select count(*) from reports;` |
| 8 | `044_droits_litiges_profils.sql` | Lot 25 : plus de lecture publique de `profiles`, droits du fil des litiges resserrés. Lire d'abord `docs/droits-base-2026-11-18.md` et lancer la requête `pg_policies` qu'il donne. | La même requête `pg_policies` : `dm_restrict_*` présentes, plus aucune politique `profiles` en `true`. |
| 9 | `045_reservation_directe.sql` | Réservation directe calculée en base (`book_service`) : prix, frais et commission recalculés depuis la fiche de prix et `app_settings`. | `select proname from pg_proc where proname = 'book_service';` puis une réservation avec audit.client (`scripts/e2e/parcours.mjs`). |
| 10 | `046_avance_immediate_verrou.sql` | Avance immédiate : seul le serveur ou un admin écrit les statuts Urssaf. Prérequis avant d'activer l'avance immédiate : `SUPABASE_SERVICE_ROLE_KEY` sur Vercel. | `select tgname from pg_trigger where tgname like 'trg_guard_avance_immediate%';` |
| 11 | `047_commission_sur_avoir.sql` | Réglage `commission_on_credit = false` (désactivé). Il prépare la décision de Romain sur la commission après un avoir. Aucun effet tant que le code n'existe pas. | `select value from app_settings where key = 'commission_on_credit';` |
| 12 | `050_catalogue_services.sql` | Catalogue des services en données (lots 26-27), écran admin. | `select key, label, active, hidden from public.service_catalog;` |
| 13 | `comptes_qa.sql` | Comptes de test `qa.…@qa.ping-test.invalid` (mot de passe `QaPing2026!`). | `select email from auth.users where email like 'qa.%';` |

Après 042 à 046 : rejouer `scripts/e2e/separation-espaces.mjs` (26 OK) et `scripts/e2e/factures.mjs` (20 OK), puis `scripts/e2e/parcours.mjs` (réservation, chat, QR, 3 factures).

## Déjà en production

014, 015, 016 et 017 sont en prod (vérifié ou appliqué le 30/10/2026). 032 à 035 aussi (03/11/2026).

## Autres fichiers

- `nettoyage_donnees_fictives.sql` : à coller le jour où les données fictives ne servent plus. Il supprime tout ce dont le titre commence par « Exemple — ».
- `prestataires_fictifs_scenarios.sql`, `compte_lea_demo.sql` : données de démonstration (voir CLAUDE.md).
- `appliquer_032_033_034.sql`, `corrige_get_arrival_code.sql` : déjà appliqués le 03/11.

Les 7 anciennes missions de test « avec soi-même » ont été supprimées le 30/10. Une copie est dans la table `_sauvegarde_missions_test_30_10`, lisible seulement depuis le tableau de bord Supabase.
