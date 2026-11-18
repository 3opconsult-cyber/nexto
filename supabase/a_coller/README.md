# SQL Supabase

Lien direct : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new

**À coller (18/11/2026)** : `038_arrivee_depart_securise.sql` (copie exacte de `supabase/migrations/038_…`) —
arrivée et départ validés uniquement avec une preuve du client. Déployer l'application AVANT de la coller
(l'application détecte la migration et retombe sur l'ancien fonctionnement tant qu'elle est absente).
Idempotente, sans DROP. Vérification après coup : `select proname from pg_proc where proname in ('validate_presence', 'client_confirm_presence', 'presence_state');`

**Plus rien d'autre à coller** : 014, 015, 016 et 017 sont en prod (vérifié / appliqué le 30/10/2026).

Le jour où les données fictives ne servent plus : coller `nettoyage_donnees_fictives.sql`
(supprime tout ce dont le titre commence par « Exemple — »).
Les 7 anciennes missions de test « avec soi-même » ont été supprimées le 30/10 ; copie dans la
table `_sauvegarde_missions_test_30_10` (lisible seulement depuis le tableau de bord Supabase).
