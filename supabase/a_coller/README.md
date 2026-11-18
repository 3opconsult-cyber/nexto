# SQL Supabase

Lien direct : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new

## Ordre de collage (mis à jour le 18/11/2026)

**Règle commune.** Déployer l'application AVANT de coller. Chaque fichier ci-dessous :
- est une copie exacte de `supabase/migrations/…` (sauf `provider_services_public.sql` et `comptes_qa.sql`, qui n'existent qu'ici) ;
- est idempotent : on peut le recoller sans risque ;
- ne contient aucune instruction DROP ni DELETE. Les mots `on delete cascade`, `revoke delete` et `for delete` apparaissent dans 043, 044 et 046 : ce sont des clauses, pas des suppressions. Par le connecteur MCP, ils déclenchent quand même la confirmation humaine.

L'application détecte chaque migration et garde l'ancien fonctionnement tant qu'elle est absente. Coller dans l'ordre. Un fichier collé seul ne casse rien, mais l'ordre évite de réécrire deux fois la même fonction (`provider_docs_checked` : 039 puis 042).

| # | Fichier | Ce que ça apporte | Vérification après coup |
|---|---|---|---|
| 1 | `038_arrivee_depart_securise.sql` | Arrivée et départ validés uniquement avec une preuve du client. | `select proname from pg_proc where proname in ('validate_presence', 'client_confirm_presence', 'presence_state');` |
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
| 12 | `comptes_qa.sql` | Comptes de test `qa.…@qa.ping-test.invalid` (mot de passe `QaPing2026!`). | `select email from auth.users where email like 'qa.%';` |

Après 042 à 046 : rejouer `scripts/e2e/separation-espaces.mjs` (26 OK) et `scripts/e2e/factures.mjs` (20 OK), puis `scripts/e2e/parcours.mjs` (réservation, chat, QR, 3 factures).

## Déjà en production

014, 015, 016 et 017 sont en prod (vérifié ou appliqué le 30/10/2026). 032 à 035 aussi (03/11/2026).

## Autres fichiers

- `nettoyage_donnees_fictives.sql` : à coller le jour où les données fictives ne servent plus. Il supprime tout ce dont le titre commence par « Exemple — ».
- `prestataires_fictifs_scenarios.sql`, `compte_lea_demo.sql` : données de démonstration (voir CLAUDE.md).
- `appliquer_032_033_034.sql`, `corrige_get_arrival_code.sql` : déjà appliqués le 03/11.

Les 7 anciennes missions de test « avec soi-même » ont été supprimées le 30/10. Une copie est dans la table `_sauvegarde_missions_test_30_10`, lisible seulement depuis le tableau de bord Supabase.
