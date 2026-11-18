# SQL Supabase

Lien direct : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new

**À coller (18/11/2026)** : `038_arrivee_depart_securise.sql` (copie exacte de `supabase/migrations/038_…`) —
arrivée et départ validés uniquement avec une preuve du client. Déployer l'application AVANT de la coller
(l'application détecte la migration et retombe sur l'ancien fonctionnement tant qu'elle est absente).
Idempotente, sans DROP. Vérification après coup : `select proname from pg_proc where proname in ('validate_presence', 'client_confirm_presence', 'presence_state');`

**À coller (arrangement à l'amiable, 18/11/2026)** : `040_arrangement_amiable.sql` (copie exacte de `supabase/migrations/040_…`) —
bouton « Arrangement à l'amiable » dans un litige (proposition d'un montant, acceptation par l'autre partie, litige clos,
avoir sur la facture de la prestation, virement ajusté). L'application masque le bouton tant que la migration est absente.
Idempotente, sans DROP (remplace `guard_transfer_payment` de 025 à l'identique + une ligne). Vérification après coup :
`select proname from pg_proc where proname in ('propose_settlement', 'accept_settlement', 'decline_settlement', 'mark_settlement_refunded');`

**À coller (catalogue des services, lots 26-27, 18/11/2026)** : `050_catalogue_services.sql` (copie exacte de
`supabase/migrations/050_…`) — table `service_catalog` (lecture publique, écriture admin), remplie avec ménage, repassage,
nettoyage (proposés) et vitres (affiché, non proposé), à l'identique de `src/lib/trades.ts` : aucun nouveau métier activé.
L'application lit la table et retombe sur `src/lib/trades.ts` tant qu'elle est absente ; écran admin « Catalogue des services ».
Idempotente, sans DROP ni DELETE. Vérification après coup :
`select key, label, active, hidden, cesu_eligible from public.service_catalog order by sort_order;`

**Plus rien d'autre à coller** : 014, 015, 016 et 017 sont en prod (vérifié / appliqué le 30/10/2026).

Le jour où les données fictives ne servent plus : coller `nettoyage_donnees_fictives.sql`
(supprime tout ce dont le titre commence par « Exemple — »).
Les 7 anciennes missions de test « avec soi-même » ont été supprimées le 30/10 ; copie dans la
table `_sauvegarde_missions_test_30_10` (lisible seulement depuis le tableau de bord Supabase).
