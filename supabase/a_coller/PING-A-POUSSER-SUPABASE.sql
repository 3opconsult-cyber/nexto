-- ============================================================================================
-- PING : TOUT CE QU'IL RESTE À COLLER DANS SUPABASE, EN UN SEUL FICHIER (27/11/2026)
-- Lien : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new
-- Comment faire : ouvrir le lien, coller TOUT ce fichier, appuyer sur « Run ». Une seule fois suffit.
-- Ordre : 061, 062, 063, 064, 065, 066 (déjà dans le bon ordre ci-dessous). Rejouable sans risque : rien n'est supprimé.
-- À éviter : ne pas coller un morceau seul, ni dans un autre ordre.
-- Supposé : les migrations jusqu'à 060 sont déjà collées. Si une erreur apparaît, ne rien refaire : me la copier.
-- Claude n'a PAS le droit d'écrire dans Supabase ; seul Romain colle.
-- ============================================================================================

-- ======================== 061 : 061_controles_nocturnes.sql ========================
-- 061 — Contrôles automatiques de nuit (demande Romain 21/11/2026, « prompt maître v3 », niveau 1).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/061_controles_nocturnes.sql.
-- À coller APRÈS 060 (et après 057 : l'alerte passe par la table admin_notifications ; sans elle, les contrôles
-- continuent et notent simplement « alerte impossible »). Rejouable sans risque : uniquement des ajouts
-- (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, ... IF NOT EXISTS). Aucune instruction de suppression, aucune
-- suppression de données : l'historique des contrôles se conserve (environ 25 lignes par nuit).
--
-- Principe : une fonction SQL, sans modèle de langage, lit les catalogues de la base et écrit une ligne par contrôle
-- (vert, orange ou rouge) dans controles_resultats. Rien de personnel n'y figure : des noms de tables, des numéros
-- de mission, des nombres. Jamais le contenu d'une pièce, d'un message ou d'une adresse.
--
-- Les 11 contrôles
--   1  droits_anon          aucune table de données personnelles accessible à un visiteur sans compte (rouge) ;
--                           écriture inattendue pour un visiteur (rouge) ; lecture inattendue (orange)
--   2  droits_dangereux     aucun droit TRUNCATE, TRIGGER ou REFERENCES pour anon ou authenticated (rouge)
--   3  rls_active           row level security activée sur toutes les tables ; aucune règle « true » ouverte à anon
--      rls_regles_ouvertes  ou à tout le monde sur une table de données personnelles (rouge)
--   4  fonctions_anon       fonctions SECURITY DEFINER exécutables par anon, hors liste blanche (orange)
--   5  integrite_*          cohérence des missions, factures, virements, litiges, réservations, pièces, dettes
--   6  cron                 les tâches planifiées existent et ont réussi depuis moins de 36 h
--   7  donnees_test         restes de données de test (orange)
--   8  volume               taille de la base et des journaux (orange au-delà des seuils ci-dessous)
--   9  derive_schema        empreinte du schéma comparée à la référence ; accept_schema_reference() la remplace
--   10 sauvegarde           NON VÉRIFIABLE EN SQL : ligne orange tant que Romain n'a pas acquitté (valable 90 jours)
--   11 étiquette de version NON VÉRIFIABLE EN SQL : contrôlé par le workflow GitHub (niveau 2), pas ici
--
-- Qui peut quoi
--   - controles_resultats, controles_reference : lecture réservée aux admins (is_admin()), aucune écriture directe,
--     tous les droits par défaut retirés à public, anon, authenticated (TRUNCATE compris).
--   - run_nightly_controls() : exécutable par le serveur seulement (service_role, et pg_cron qui tourne en superutilisateur).
--   - accept_schema_reference() et acknowledge_control() : appelables par un admin connecté (vérifié dans la fonction).

-- 1. Tables ------------------------------------------------------------------------------------------------------
create table if not exists public.controles_resultats (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  run_id uuid not null,
  controle text not null,
  gravite text not null check (gravite in ('vert', 'orange', 'rouge')),
  titre text not null default '',
  detail jsonb not null default '{}'::jsonb,
  acquittee_le timestamptz,
  acquittee_par uuid
);
create index if not exists controles_resultats_run_idx on public.controles_resultats (run_at desc, run_id);
create index if not exists controles_resultats_controle_idx on public.controles_resultats (controle, run_at desc);

-- Valeurs de référence : l'empreinte du schéma (cle = 'schema') et les acquittements (cle = 'ack:sauvegarde').
create table if not exists public.controles_reference (
  cle text primary key,
  empreinte text,
  detail jsonb not null default '{}'::jsonb,
  mis_a_jour timestamptz not null default now(),
  mis_par uuid
);

alter table public.controles_resultats enable row level security;
alter table public.controles_reference enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'controles_resultats' and policyname = 'controles_resultats admin lecture') then
    create policy "controles_resultats admin lecture" on public.controles_resultats for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'controles_reference' and policyname = 'controles_reference admin lecture') then
    create policy "controles_reference admin lecture" on public.controles_reference for select using (public.is_admin());
  end if;
end $$;

-- Droits : on retire tout (les droits par défaut de Supabase donnent tout à anon et authenticated), puis on rend la lecture.
revoke all privileges on public.controles_resultats from public, anon, authenticated;
revoke all privileges on public.controles_reference from public, anon, authenticated;
revoke truncate, references, trigger on public.controles_resultats from public, anon, authenticated;
revoke truncate, references, trigger on public.controles_reference from public, anon, authenticated;
grant select on public.controles_resultats to authenticated;   -- filtré par la règle : admin seulement
grant select on public.controles_reference to authenticated;   -- idem
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.controles_resultats to service_role;   -- e-mail d'alerte (route serveur /api/controles/alerte)
    grant select on public.controles_reference to service_role;
  end if;
end $$;

-- Une seule alerte « controle_nuit » ouverte par jour dans la file d'alertes de l'admin (table de la 057).
do $$ begin
  if to_regclass('public.admin_notifications') is not null then
    create unique index if not exists admin_notifications_one_controle
      on public.admin_notifications ((detail ->> 'jour')) where kind = 'controle_nuit' and handled_at is null;
  end if;
end $$;

-- 2. Écriture d'une ligne de résultat (interne) ---------------------------------------------------------------------
create or replace function public._ctl_put(p_run uuid, p_controle text, p_gravite text, p_titre text, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql set search_path = public as $$
begin
  insert into public.controles_resultats (run_id, controle, gravite, titre, detail)
  values (p_run, p_controle, p_gravite, p_titre, coalesce(p_detail, '{}'::jsonb));
end $$;
revoke all on function public._ctl_put(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Une ligne selon un nombre : vert si zéro, sinon la gravité donnée, avec le nombre et quelques numéros.
create or replace function public._ctl_count(p_run uuid, p_controle text, p_gravite text, p_titre_ok text, p_titre_ko text, p_n bigint, p_ids jsonb default null)
returns void language plpgsql set search_path = public as $$
begin
  if coalesce(p_n, 0) = 0 then
    perform public._ctl_put(p_run, p_controle, 'vert', p_titre_ok, '{}'::jsonb);
  else
    perform public._ctl_put(p_run, p_controle, p_gravite, p_titre_ko, jsonb_build_object('nombre', p_n, 'ids', coalesce(p_ids, '[]'::jsonb)));
  end if;
end $$;
revoke all on function public._ctl_count(uuid, text, text, text, text, bigint, jsonb) from public, anon, authenticated;

-- 3. Empreinte du schéma (interne) -----------------------------------------------------------------------------------
-- Cinq empreintes (colonnes, règles, fonctions, droits des tables, droits des fonctions) et leur total.
-- Les fonctions sont repérées par nom, arguments et SECURITY DEFINER : réécrire le corps d'une fonction ne change pas l'empreinte.
create or replace function public._ctl_fingerprint() returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_col text; v_pol text; v_fn text; v_gt text; v_gf text;
begin
  select md5(coalesce(string_agg(c.table_name || '.' || c.column_name || ':' || c.data_type || ':' || c.is_nullable, ',' order by c.table_name, c.column_name), ''))
    into v_col
    from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE';

  select md5(coalesce(string_agg(p.tablename || '.' || p.policyname || ':' || p.cmd || ':' || p.permissive || ':' || p.roles::text || ':' || coalesce(p.qual, '') || ':' || coalesce(p.with_check, ''), '|' order by p.tablename, p.policyname), ''))
    into v_pol from pg_policies p where p.schemaname = 'public';

  select md5(coalesce(string_agg(f.proname || '(' || pg_get_function_identity_arguments(f.oid) || '):' || f.prosecdef::text, '|' order by f.proname, pg_get_function_identity_arguments(f.oid)), ''))
    into v_fn
    from pg_proc f join pg_namespace n on n.oid = f.pronamespace
   where n.nspname = 'public' and f.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = f.oid and d.deptype = 'e');

  select md5(coalesce(string_agg(c.relname || ':' || r.rolname || ':' || pr.p, ',' order by c.relname, r.rolname, pr.p), ''))
    into v_gt
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
    cross join (select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DEL' || 'ETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p) pr
   where n.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege(r.rolname, c.oid, pr.p);

  select md5(coalesce(string_agg(f.proname || '(' || pg_get_function_identity_arguments(f.oid) || '):' || r.rolname, ',' order by f.proname, pg_get_function_identity_arguments(f.oid), r.rolname), ''))
    into v_gf
    from pg_proc f join pg_namespace n on n.oid = f.pronamespace
    cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
   where n.nspname = 'public' and f.prokind = 'f' and has_function_privilege(r.rolname, f.oid, 'EXECUTE')
     and not exists (select 1 from pg_depend d where d.objid = f.oid and d.deptype = 'e');

  return jsonb_build_object('colonnes', v_col, 'regles', v_pol, 'fonctions', v_fn, 'droits_tables', v_gt, 'droits_fonctions', v_gf,
                            'total', md5(v_col || v_pol || v_fn || v_gt || v_gf));
end $$;
revoke all on function public._ctl_fingerprint() from public, anon, authenticated;

-- 4. Les contrôles ----------------------------------------------------------------------------------------------------
create or replace function public.run_nightly_controls() returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  -- ===== Seuils et listes à régler ici =====
  v_seuil_base_mo      constant int    := 400;      -- taille de la base (Mo) au-delà de laquelle on prévient (offre gratuite : 500 Mo)
  v_seuil_events       constant bigint := 500000;   -- lignes de la table events
  v_seuil_notif        constant bigint := 200000;   -- lignes de notification_log
  v_seuil_alertes      constant bigint := 50000;    -- lignes de payment_alerts
  v_cron_heures        constant int    := 36;       -- dernière exécution réussie d'une tâche planifiée : au plus ... heures
  v_litige_jours       constant int    := 7;        -- litige ouvert depuis plus de ... jours
  v_resa_retard_h      constant int    := 1;        -- réservation en attente dont l'échéance est passée depuis plus de ... heures
  v_test_jours         constant int    := 30;       -- comptes de test .invalid plus anciens que ... jours
  v_ack_jours          constant int    := 90;       -- validité d'un acquittement de la sauvegarde
  -- Tables de données personnelles : aucun droit pour anon, jamais (les tables avance_immediate_* sont ajoutées par motif).
  v_perso constant text[] := array['profiles', 'provider_private', 'documents', 'messages', 'requests', 'transactions',
    'invoices', 'transfer_payments', 'disputes', 'dispute_messages', 'mission_proofs', 'presence_requests', 'client_private_notes',
    'payment_accounts', 'payments', 'commission_debts', 'payment_alerts', 'admin_conversations', 'admin_messages',
    'admin_notifications', 'message_reads', 'notification_log', 'reschedule_requests', 'mission_cancellations', 'reports',
    'favorites', 'referrals', 'provider_live_zone', 'dispute_events', 'controles_resultats', 'controles_reference'];
  -- Tables volontairement lisibles par un visiteur (fiches publiques, catalogue, réglages publics) : lecture seule.
  v_lecture_ok constant text[] := array['provider_profiles', 'services', 'service_catalog', 'provider_slots', 'reviews',
    'client_reviews', 'app_settings', 'articles'];
  -- Écritures volontaires pour un visiteur : le suivi anonyme (015) ajoute des lignes à events, rien d'autre.
  v_insert_ok constant text[] := array['events'];
  -- Fonctions SECURITY DEFINER volontairement publiques (carte, fiches, pièces affichées sans compte).
  v_fonctions_ok constant text[] := array['providers_nearby', 'providers_live_zones', 'provider_public_name', 'provider_docs_checked',
    'provider_docs_status', 'provider_services_public', 'provider_trust_stats', 'is_admin'];
  -- Tâches planifiées attendues.
  v_jobs constant text[] := array['ping_reservations_expirees', 'ping_virements_en_retard', 'ping_pieces_expirees', 'ping_controles_nuit'];
  -- ===== Fin des réglages =====
  v_run uuid := gen_random_uuid();
  r record;
  n bigint;
  ids jsonb;
  v_privs text[];
  v_nb int;
  v_list jsonb;
  v_plafond bigint;
  v_fp jsonb;
  v_ref record;
  v_chg text[];
  v_ack timestamptz;
  v_last timestamptz;
  v_jobid bigint;
  v_job text;
  v_rouge int; v_orange int; v_vert int; v_orange_alerte int;
begin
  -- 1. Droits de anon ----------------------------------------------------------------------------------------------
  begin
    v_nb := 0;
    for r in select c.oid, c.relname::text as t from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              where ns.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname
    loop
      select coalesce(array_agg(x.p order by x.p), '{}') into v_privs
        from (select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DEL' || 'ETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p) x
       where has_table_privilege('anon', r.oid, x.p);
      continue when coalesce(array_length(v_privs, 1), 0) = 0;
      if r.t = any(v_perso) or r.t like 'avance\_immediate%' then
        perform public._ctl_put(v_run, 'droits_anon', 'rouge', 'Table de données personnelles accessible sans compte : ' || r.t,
          jsonb_build_object('table', r.t, 'droits', to_jsonb(v_privs))); v_nb := v_nb + 1;
      elsif exists (select 1 from unnest(v_privs) q where q <> 'SELECT') and not (r.t = any(v_insert_ok) and v_privs = array['INSERT']) then
        perform public._ctl_put(v_run, 'droits_anon', 'rouge', 'Un visiteur sans compte peut écrire dans : ' || r.t,
          jsonb_build_object('table', r.t, 'droits', to_jsonb(v_privs))); v_nb := v_nb + 1;
      elsif v_privs = array['SELECT'] and not (r.t = any(v_lecture_ok)) then
        perform public._ctl_put(v_run, 'droits_anon', 'orange', 'Un visiteur sans compte peut lire : ' || r.t || ' (non listée comme publique)',
          jsonb_build_object('table', r.t, 'droits', to_jsonb(v_privs))); v_nb := v_nb + 1;
      end if;
    end loop;
    if v_nb = 0 then perform public._ctl_put(v_run, 'droits_anon', 'vert', 'Aucun droit inattendu pour un visiteur sans compte'); end if;
  exception when others then
    perform public._ctl_put(v_run, 'droits_anon', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 2. Droits dangereux (TRUNCATE, TRIGGER, REFERENCES) -----------------------------------------------------------------
  begin
    select count(*), coalesce(jsonb_agg(x.t || ' (' || x.who || ' : ' || x.p || ')' order by x.t), '[]'::jsonb) into n, v_list
      from (select c.relname::text as t, ro.rolname::text as who, pr.p
              from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) ro
              cross join (select unnest(array['TRUNCATE', 'TRIGGER', 'REFERENCES']) as p) pr
             where ns.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege(ro.rolname, c.oid, pr.p)) x;
    if n = 0 then
      perform public._ctl_put(v_run, 'droits_dangereux', 'vert', 'Aucun droit TRUNCATE, TRIGGER ou REFERENCES pour anon ou authenticated');
    else
      perform public._ctl_put(v_run, 'droits_dangereux', 'rouge', n || ' droit(s) TRUNCATE, TRIGGER ou REFERENCES à retirer',
        jsonb_build_object('nombre', n, 'liste', v_list));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'droits_dangereux', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 3a. Row level security activée partout ------------------------------------------------------------------------------
  begin
    select count(*), coalesce(jsonb_agg(c.relname::text order by c.relname), '[]'::jsonb) into n, v_list
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
    if n = 0 then
      perform public._ctl_put(v_run, 'rls_active', 'vert', 'La sécurité par ligne est activée sur toutes les tables');
    else
      perform public._ctl_put(v_run, 'rls_active', 'rouge', n || ' table(s) sans sécurité par ligne', jsonb_build_object('nombre', n, 'tables', v_list));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'rls_active', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 3b. Règles « true » ouvertes à anon ou à tout le monde sur une table de données personnelles -----------------------------
  begin
    v_nb := 0;
    for r in select p.tablename::text as t, p.policyname::text as pol, p.cmd::text as cmd from pg_policies p
              where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
                and (p.qual = 'true' or p.with_check = 'true')
                and p.roles && array['anon'::name, 'public'::name]
                and (p.tablename = any(v_perso) or p.tablename like 'avance\_immediate%')
              order by p.tablename, p.policyname
    loop
      perform public._ctl_put(v_run, 'rls_regles_ouvertes', 'rouge', 'Règle ouverte à tous sur une table de données personnelles : ' || r.t,
        jsonb_build_object('table', r.t, 'regle', r.pol, 'operation', r.cmd)); v_nb := v_nb + 1;
    end loop;
    if v_nb = 0 then perform public._ctl_put(v_run, 'rls_regles_ouvertes', 'vert', 'Aucune règle ouverte à tous sur les données personnelles'); end if;
  exception when others then
    perform public._ctl_put(v_run, 'rls_regles_ouvertes', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 4. Fonctions SECURITY DEFINER exécutables par anon ---------------------------------------------------------------------
  begin
    select count(*), coalesce(jsonb_agg(x.nom order by x.nom), '[]'::jsonb) into n, v_list
      from (select distinct f.proname::text as nom
              from pg_proc f join pg_namespace ns on ns.oid = f.pronamespace
             where ns.nspname = 'public' and f.prokind = 'f' and f.prosecdef
               and has_function_privilege('anon', f.oid, 'EXECUTE')
               and not (f.proname::text = any(v_fonctions_ok))
               and not exists (select 1 from pg_depend d where d.objid = f.oid and d.deptype = 'e')) x;
    if n = 0 then
      perform public._ctl_put(v_run, 'fonctions_anon', 'vert', 'Seules les fonctions publiques prévues sont exécutables sans compte');
    else
      perform public._ctl_put(v_run, 'fonctions_anon', 'orange', n || ' fonction(s) SECURITY DEFINER exécutable(s) sans compte, hors liste blanche',
        jsonb_build_object('nombre', n, 'fonctions', v_list));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'fonctions_anon', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 5. Intégrité métier (numéros de mission seulement, jamais de contenu) -------------------------------------------------------
  begin   -- 5a. mission terminée sans arrivée enregistrée
    select count(*), to_jsonb((array_agg(t.id))[1:20]) into n, ids from public.transactions t
     where t.status::text = 'completed' and t.arrived_at is null and not coalesce(t.fictif, false);
    perform public._ctl_count(v_run, 'integrite_arrivee', 'orange', 'Toutes les missions terminées ont une arrivée', n || ' mission(s) terminée(s) sans arrivée enregistrée', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_arrivee', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5b. acheteur = vendeur
    select count(*), to_jsonb((array_agg(t.id))[1:20]) into n, ids from public.transactions t where t.buyer_id = t.seller_id;
    perform public._ctl_count(v_run, 'integrite_acheteur_vendeur', 'rouge', 'Aucune mission avec soi-même', n || ' mission(s) où l''acheteur est le vendeur', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_acheteur_vendeur', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5c. total encaissé = prestation + frais du client (formule figée, 038 et 045 : total = sous-total + frais client)
    select count(*), to_jsonb((array_agg(t.id))[1:20]) into n, ids from public.transactions t
     where t.status::text = 'completed' and not coalesce(t.fictif, false)
       and t.subtotal_cents is not null and t.buyer_fee_cents is not null and t.total_charged_cents is not null
       and abs(t.total_charged_cents - (t.subtotal_cents + t.buyer_fee_cents)) > 1;
    perform public._ctl_count(v_run, 'integrite_total', 'orange', 'Total = prestation + frais du client sur toutes les missions terminées', n || ' mission(s) terminée(s) dont le total ne correspond pas à prestation + frais', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_total', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5d. mission terminée : exactement 3 lignes de factures
    select count(*), to_jsonb((array_agg(t.id))[1:20]) into n, ids from public.transactions t
     where t.status::text = 'completed' and not coalesce(t.fictif, false)
       and (select count(*) from public.invoices i where i.transaction_id = t.id) <> 3;
    perform public._ctl_count(v_run, 'integrite_factures', 'rouge', 'Chaque mission terminée a ses 3 factures', n || ' mission(s) terminée(s) sans exactement 3 lignes de factures', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_factures', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5e. virement sans facture
    select count(*), to_jsonb((array_agg(tp.id))[1:20]) into n, ids from public.transfer_payments tp
     where tp.invoice_id is null or not exists (select 1 from public.invoices i where i.id = tp.invoice_id);
    perform public._ctl_count(v_run, 'integrite_virements', 'rouge', 'Chaque virement a sa facture', n || ' virement(s) sans facture', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_virements', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5f. virement suspendu sans litige ouvert
    select count(*), to_jsonb((array_agg(tp.id))[1:20]) into n, ids from public.transfer_payments tp
     where tp.suspended_at is not null
       and not exists (select 1 from public.disputes d where d.transaction_id = tp.transaction_id and d.status::text = 'open');
    perform public._ctl_count(v_run, 'integrite_suspension', 'orange', 'Aucun virement suspendu sans litige ouvert', n || ' virement(s) suspendu(s) sans litige ouvert', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_suspension', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5g. litige ouvert depuis trop longtemps
    select count(*), to_jsonb((array_agg(d.id))[1:20]) into n, ids from public.disputes d
     where d.status::text = 'open' and d.created_at < now() - make_interval(days => v_litige_jours);
    perform public._ctl_count(v_run, 'integrite_litiges', 'orange', 'Aucun litige ouvert depuis plus de ' || v_litige_jours || ' jours', n || ' litige(s) ouvert(s) depuis plus de ' || v_litige_jours || ' jours', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_litiges', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5h. réservation en attente dont l'échéance est dépassée (expiration en retard)
    select count(*), to_jsonb((array_agg(t.id))[1:20]) into n, ids from public.transactions t
     where t.booking_status = 'en_attente' and t.accept_deadline < now() - make_interval(hours => v_resa_retard_h);
    perform public._ctl_count(v_run, 'integrite_reservations', 'orange', 'Aucune réservation en attente après son échéance', n || ' réservation(s) en attente dont l''échéance est dépassée depuis plus de ' || v_resa_retard_h || ' h', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_reservations', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5i. pièces validées mais échues
    select count(*), to_jsonb((array_agg(d.id))[1:20]) into n, ids from public.documents d
     where d.status::text = 'valid' and d.valid_until is not null and d.valid_until < current_date;
    perform public._ctl_count(v_run, 'integrite_pieces', 'orange', 'Aucune pièce validée avec une échéance dépassée', n || ' pièce(s) validée(s) dont l''échéance est dépassée', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_pieces', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  begin   -- 5j. dettes de commission ouvertes au-dessus du plafond
    select coalesce((select (value #>> '{}')::bigint from public.app_settings where key = 'unpaid_ceiling_cents'), 5000) into v_plafond;
    select count(*), to_jsonb((array_agg(x.provider_id))[1:20]) into n, ids
      from (select provider_id from public.commission_debts where status = 'open' group by provider_id having sum(amount_cents) > v_plafond) x;
    perform public._ctl_count(v_run, 'integrite_dettes', 'orange', 'Aucune dette de commission au-dessus du plafond', n || ' prestataire(s) avec des dettes de commission ouvertes au-dessus du plafond', n, ids);
  exception when others then perform public._ctl_put(v_run, 'integrite_dettes', 'orange', 'Contrôle impossible : ' || sqlerrm); end;

  -- 6. Tâches planifiées (pg_cron) -------------------------------------------------------------------------------------------
  begin
    if not exists (select 1 from pg_extension where extname = 'pg_cron') then
      perform public._ctl_put(v_run, 'cron', 'orange', 'pg_cron n''est pas installé : aucune tâche planifiée ne tourne');
    else
      v_nb := 0;
      foreach v_job in array v_jobs loop
        v_jobid := null;
        select jobid into v_jobid from cron.job where jobname = v_job limit 1;
        if v_jobid is null then
          perform public._ctl_put(v_run, 'cron', 'orange', 'Tâche planifiée absente : ' || v_job, jsonb_build_object('tache', v_job)); v_nb := v_nb + 1;
        elsif v_job <> 'ping_controles_nuit' then
          select max(start_time) into v_last from cron.job_run_details where jobid = v_jobid and status = 'succeeded';
          if v_last is null or v_last < now() - make_interval(hours => v_cron_heures) then
            perform public._ctl_put(v_run, 'cron', 'orange', 'Tâche planifiée sans exécution réussie depuis plus de ' || v_cron_heures || ' h : ' || v_job,
              jsonb_build_object('tache', v_job, 'derniere_reussite', v_last)); v_nb := v_nb + 1;
          end if;
        end if;
      end loop;
      if v_nb = 0 then perform public._ctl_put(v_run, 'cron', 'vert', 'Les tâches planifiées existent et ont réussi depuis moins de ' || v_cron_heures || ' h'); end if;
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'cron', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 7. Données de test restantes (nombres seulement) ----------------------------------------------------------------------------
  begin
    select count(*) into n from public.requests q where not coalesce(q.fictif, false) and q.title like 'QA%';
    select count(*) into v_nb from public.transactions t join public.requests q on q.id = t.request_id
     where not coalesce(t.fictif, false) and q.title like 'QA%';
    ids := jsonb_build_object('demandes_qa', n, 'missions_qa', v_nb);
    select count(*) into n from auth.users u
     where u.email like '%.invalid' and u.email not like '%@ping-demo.invalid'
       and u.created_at < now() - make_interval(days => v_test_jours);
    ids := ids || jsonb_build_object('comptes_invalid_anciens', n);
    if (ids ->> 'demandes_qa')::int + (ids ->> 'missions_qa')::int + n = 0 then
      perform public._ctl_put(v_run, 'donnees_test', 'vert', 'Aucune donnée de test restante');
    else
      perform public._ctl_put(v_run, 'donnees_test', 'orange', 'Données de test restantes (voir nombres)', ids);
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'donnees_test', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 8. Volume ---------------------------------------------------------------------------------------------------------------------
  begin
    v_nb := (pg_database_size(current_database()) / 1048576)::int;
    ids := jsonb_build_object('base_mo', v_nb);
    v_list := '[]'::jsonb;
    if v_nb > v_seuil_base_mo then v_list := v_list || to_jsonb('base ' || v_nb || ' Mo (seuil ' || v_seuil_base_mo || ')'); end if;
    n := null;
    begin execute 'select count(*) from public.events' into n; exception when others then n := null; end;
    ids := ids || jsonb_build_object('events', n);
    if coalesce(n, 0) > v_seuil_events then v_list := v_list || to_jsonb('events ' || n || ' lignes (seuil ' || v_seuil_events || ')'); end if;
    n := null;
    begin execute 'select count(*) from public.notification_log' into n; exception when others then n := null; end;
    ids := ids || jsonb_build_object('notification_log', n);
    if coalesce(n, 0) > v_seuil_notif then v_list := v_list || to_jsonb('notification_log ' || n || ' lignes (seuil ' || v_seuil_notif || ')'); end if;
    n := null;
    begin execute 'select count(*) from public.payment_alerts' into n; exception when others then n := null; end;
    ids := ids || jsonb_build_object('payment_alerts', n);
    if coalesce(n, 0) > v_seuil_alertes then v_list := v_list || to_jsonb('payment_alerts ' || n || ' lignes (seuil ' || v_seuil_alertes || ')'); end if;
    if jsonb_array_length(v_list) = 0 then
      perform public._ctl_put(v_run, 'volume', 'vert', 'Taille de la base et des journaux sous les seuils', ids);
    else
      perform public._ctl_put(v_run, 'volume', 'orange', 'Seuil de volume dépassé', ids || jsonb_build_object('depassements', v_list));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'volume', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 9. Dérive du schéma ------------------------------------------------------------------------------------------------------------
  begin
    v_fp := public._ctl_fingerprint();
    select * into v_ref from public.controles_reference where cle = 'schema';
    if not found then
      insert into public.controles_reference (cle, empreinte, detail) values ('schema', v_fp ->> 'total', v_fp);
      perform public._ctl_put(v_run, 'derive_schema', 'vert', 'Référence initiale du schéma enregistrée', jsonb_build_object('empreinte', v_fp ->> 'total'));
    elsif v_ref.empreinte = v_fp ->> 'total' then
      perform public._ctl_put(v_run, 'derive_schema', 'vert', 'Le schéma est identique à la référence', jsonb_build_object('reference_du', v_ref.mis_a_jour));
    else
      select coalesce(array_agg(k.k order by k.k), '{}') into v_chg from jsonb_object_keys(v_fp) as k(k)
       where k.k <> 'total' and (v_ref.detail ->> k.k) is distinct from (v_fp ->> k.k);
      perform public._ctl_put(v_run, 'derive_schema', 'orange', 'Le schéma a changé depuis la référence : ' || array_to_string(v_chg, ', '),
        jsonb_build_object('reference_du', v_ref.mis_a_jour, 'parties_changees', to_jsonb(v_chg)));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'derive_schema', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- 10. Sauvegarde : non vérifiable en SQL ------------------------------------------------------------------------------------------
  begin
    select mis_a_jour into v_ack from public.controles_reference where cle = 'ack:sauvegarde';
    if v_ack is not null and v_ack > now() - make_interval(days => v_ack_jours) then
      insert into public.controles_resultats (run_id, controle, gravite, titre, detail, acquittee_le)
      values (v_run, 'sauvegarde', 'vert', 'Sauvegarde vérifiée par Romain le ' || to_char(v_ack, 'DD/MM/YYYY'), jsonb_build_object('acquittee_le', v_ack), v_ack);
    else
      perform public._ctl_put(v_run, 'sauvegarde', 'orange', 'À vérifier par Romain dans Supabase > Database > Backups (puis acquitter dans l''admin)',
        jsonb_build_object('non_verifiable_en_sql', true, 'dernier_acquittement', v_ack));
    end if;
  exception when others then
    perform public._ctl_put(v_run, 'sauvegarde', 'orange', 'Contrôle impossible : ' || sqlerrm);
  end;

  -- Bilan et alerte -----------------------------------------------------------------------------------------------------------------
  select count(*) filter (where gravite = 'rouge'), count(*) filter (where gravite = 'orange'), count(*) filter (where gravite = 'vert'),
         count(*) filter (where gravite = 'orange' and controle <> 'sauvegarde')
    into v_rouge, v_orange, v_vert, v_orange_alerte
    from public.controles_resultats where run_id = v_run;

  -- L'alerte ne compte pas le rappel permanent de la sauvegarde : seulement le rouge et l'orange « vivant ».
  if v_rouge + v_orange_alerte > 0 then
    begin
      insert into public.admin_notifications (kind, title, detail)
      values ('controle_nuit', 'Contrôles de nuit : ' || v_rouge || ' rouge, ' || v_orange_alerte || ' orange',
              jsonb_build_object('jour', current_date::text, 'run_id', v_run, 'rouge', v_rouge, 'orange', v_orange_alerte))
      on conflict ((detail ->> 'jour')) where kind = 'controle_nuit' and handled_at is null
      do update set title = excluded.title, detail = excluded.detail, created_at = now(), emailed_at = null;
    exception when others then
      perform public._ctl_put(v_run, 'alerte_admin', 'orange', 'Alerte admin impossible (migration 057 à coller ?) : ' || sqlerrm);
    end;
  end if;

  return jsonb_build_object('run_id', v_run, 'vert', v_vert, 'orange', v_orange, 'rouge', v_rouge);
end $$;

revoke all on function public.run_nightly_controls() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.run_nightly_controls() to service_role;
  end if;
end $$;

-- 5. Actions de l'admin ----------------------------------------------------------------------------------------------------------------
-- Remplace la référence du schéma par l'état actuel, après une migration voulue.
create or replace function public.accept_schema_reference() returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_fp jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administration PING'; end if;
  v_fp := public._ctl_fingerprint();
  insert into public.controles_reference (cle, empreinte, detail, mis_a_jour, mis_par)
  values ('schema', v_fp ->> 'total', v_fp, now(), auth.uid())
  on conflict (cle) do update set empreinte = excluded.empreinte, detail = excluded.detail, mis_a_jour = now(), mis_par = auth.uid();
  return jsonb_build_object('empreinte', v_fp ->> 'total');
end $$;
revoke all on function public.accept_schema_reference() from public, anon;
grant execute on function public.accept_schema_reference() to authenticated;

-- Acquitte le rappel de sauvegarde (seul contrôle acquittable). Valable 90 jours.
create or replace function public.acknowledge_control(p_controle text) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administration PING'; end if;
  if p_controle is distinct from 'sauvegarde' then raise exception 'Ce contrôle ne s''acquitte pas'; end if;
  insert into public.controles_reference (cle, empreinte, detail, mis_a_jour, mis_par)
  values ('ack:sauvegarde', null, '{}'::jsonb, now(), auth.uid())
  on conflict (cle) do update set mis_a_jour = now(), mis_par = auth.uid();
  update public.controles_resultats set acquittee_le = now(), acquittee_par = auth.uid()
   where controle = 'sauvegarde' and acquittee_le is null;
end $$;
revoke all on function public.acknowledge_control(text) from public, anon;
grant execute on function public.acknowledge_control(text) to authenticated;

-- 6. Planification : chaque nuit à 3 h 17 UTC, seulement si la tâche n'existe pas encore -------------------------------------------------
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'ping_controles_nuit') then
      perform cron.schedule('ping_controles_nuit', '17 3 * * *', 'select public.run_nightly_controls()');
    end if;
  end if;
end $$;

-- Vérification après collage (Romain) :
--   select jobname, schedule from cron.job where jobname = 'ping_controles_nuit';
--   select proname from pg_proc where proname in ('run_nightly_controls', 'accept_schema_reference', 'acknowledge_control');
-- Premier passage immédiat (éditeur SQL, rôle postgres) puis lecture :
--   select public.run_nightly_controls();
--   select controle, gravite, titre from public.controles_resultats order by run_at desc, gravite desc limit 40;


-- ======================== 062 : 062_alertes_admin_et_chat_direct.sql ========================
-- 062 — Alertes d'argent et de litige dans l'admin (pastille + e-mail des cas graves) et chat en direct
-- (demande Romain 22/11/2026). NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/062_alertes_admin_et_chat_direct.sql.
-- À coller APRÈS 061 (et donc après 057 : la table admin_notifications doit exister ; 054 et 059 de préférence).
-- Uniquement des ajouts : CREATE OR REPLACE, CREATE ... IF NOT EXISTS, ALTER PUBLICATION ... ADD TABLE. Aucune instruction
-- qui retire un objet ou une ligne. Rejouable sans risque.
--
-- Contenu
--   1. Chat en direct : public.messages (et public.dispute_messages si elle existe) ajoutées à la publication
--      supabase_realtime si elles n'y sont pas déjà. Sans publication (base hors Supabase) : simple avis, aucune erreur.
--   2. Toute nouvelle ligne de payment_alerts (annulation après l'arrivée, annulation tardive, prestataire absent, prestataire
--      qui annule trop, virement non reçu, désaccord, commission en retard, compte suspendu, incidents du séquestre) crée une
--      alerte admin_notifications (kind 'payment_alert', même table que les pièces de 057), titre en français, ids seulement.
--      Traitée automatiquement quand payment_alerts.handled_at est posé (bouton « Traitée » de /admin/paiements).
--   3. Litige ouvert (kind 'dispute_open') et intervention de PING demandée (kind 'dispute_mediation') : même table ;
--      traitées automatiquement quand le litige est clos (résolu, non retenu, ou closed_at posé).
--   4. admin_alert_counts() : compteurs par catégorie pour les pastilles (admin seulement).
--   5. Rattrapage : les alertes et litiges déjà ouverts apparaissent dans la file, marqués « e-mail envoyé » (pas de rafale).
--
-- Tolérance : les triggers ont leur propre bloc d'exception. Une alerte ratée ne fait JAMAIS échouer l'opération principale
-- (annulation, virement, litige). Aucune donnée personnelle copiée : ni nom, ni note libre, ni adresse ; seulement des ids,
-- le code de l'alerte et sa gravité.
-- L'e-mail à PING des cas graves part du cron quotidien /api/bookings/expire (sendPaymentAlerts, src/lib/notifyServer.ts),
-- une seule fois par alerte (emailed_at), jamais pour les comptes de démonstration (.invalid).

-- 0. Prérequis -----------------------------------------------------------------------------------------------------------
do $$ begin
  if to_regclass('public.admin_notifications') is null then
    raise exception 'Migration 057 absente : collez d''abord 057_alertes_admin_pieces.sql, puis 062.';
  end if;
end $$;

-- 1. Chat en direct ------------------------------------------------------------------------------------------------------
do $$
declare
  v_t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime absente : rien à ajouter (base hors Supabase).';
    return;
  end if;
  foreach v_t in array array['messages', 'dispute_messages'] loop
    if to_regclass('public.' || v_t) is not null
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_t) then
      begin
        execute format('alter publication supabase_realtime add table public.%I', v_t);
        raise notice 'Table public.% ajoutée à supabase_realtime.', v_t;
      exception when others then
        raise notice 'Table public.% non ajoutée à supabase_realtime : %', v_t, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- 2. Une seule alerte ouverte par source -----------------------------------------------------------------------------------
-- Les index uniques de 057 et 061 sont partiels (kind = 'document_pending', 'document_expiring', 'controle_nuit') :
-- ils ne bloquent pas les nouveaux kinds. Ceux-ci ont les leurs.
create unique index if not exists admin_notifications_one_open_payment
  on public.admin_notifications (ref_id) where kind = 'payment_alert' and handled_at is null;
create unique index if not exists admin_notifications_one_open_dispute
  on public.admin_notifications (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null;
create index if not exists admin_notifications_kind_open_idx
  on public.admin_notifications (kind) where handled_at is null;

-- 3. Libellés et gravité (même vocabulaire que src/lib/adminAlerts.ts) -----------------------------------------------------
create or replace function public._payment_alert_label(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind
    when 'cancel_after_arrival' then 'Annulation après l''arrivée du prestataire'
    when 'late_cancellation_fees' then 'Annulation tardive aux frais du client'
    when 'provider_no_show' then 'Prestataire absent déclaré'
    when 'provider_cancellations' then 'Prestataire : annulations répétées'
    when 'transfer_not_received' then 'Virement signalé non reçu'
    when 'transfer_disagreement' then 'Virement : désaccord, le payeur maintient'
    when 'transfer_overdue' then 'Commission par virement en retard'
    when 'suspended' then 'Compte prestataire suspendu'
    when 'unsuspended' then 'Suspension levée'
    when 'mandate_revoked' then 'Mandat de prélèvement révoqué'
    when 'mandate_failed' then 'Mandat de prélèvement refusé'
    when 'debit_rejected' then 'Prélèvement de commission rejeté'
    when 'chargeback' then 'Opposition d''un client'
    when 'refund_failed' then 'Remboursement en ligne échoué'
    else 'Alerte de paiement : ' || coalesce(p_kind, 'inconnue') end
$$;
revoke execute on function public._payment_alert_label(text) from public, anon, authenticated;

-- Cas graves : e-mail à PING (en plus de la pastille).
create or replace function public._payment_alert_grave(p_kind text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_kind in ('cancel_after_arrival', 'provider_no_show', 'transfer_disagreement', 'suspended',
                             'mandate_revoked', 'mandate_failed', 'debit_rejected', 'chargeback', 'refund_failed'), false)
$$;
revoke execute on function public._payment_alert_grave(text) from public, anon, authenticated;

-- 4. Trigger sur payment_alerts ------------------------------------------------------------------------------------------
create or replace function public.payment_alerts_admin_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_grave boolean;
begin
  if tg_op = 'INSERT' then
    v_grave := public._payment_alert_grave(new.kind);
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, handled_at)
    values ('payment_alert', new.provider_id, new.id, public._payment_alert_label(new.kind),
            jsonb_build_object('categorie', 'paiement', 'payment_kind', new.kind,
                               'gravite', case when v_grave then 'grave' else 'normal' end,
                               'transaction_id', new.detail ->> 'transactionId',
                               'transfer_id', new.detail ->> 'transferId'),
            new.handled_at)
    on conflict (ref_id) where kind = 'payment_alert' and handled_at is null do nothing;
  elsif tg_op = 'UPDATE' and new.handled_at is not null and old.handled_at is null then
    update public.admin_notifications set handled_at = new.handled_at
     where kind = 'payment_alert' and ref_id = new.id and handled_at is null;
  end if;
  return null;
exception when others then
  return null;  -- une alerte ratée ne doit jamais empêcher une annulation, un virement ou une suspension
end $$;
revoke execute on function public.payment_alerts_admin_notify() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.payment_alerts') is not null
     and not exists (select 1 from pg_trigger where tgname = 'trg_payment_alerts_admin_notify'
                      and tgrelid = 'public.payment_alerts'::regclass) then
    create trigger trg_payment_alerts_admin_notify after insert or update of handled_at on public.payment_alerts
      for each row execute function public.payment_alerts_admin_notify();
  end if;
end $$;

-- 5. Trigger sur disputes ------------------------------------------------------------------------------------------------
-- Colonnes lues par to_jsonb : le trigger reste valable si 040 (closed_at) ou 054 (mediation_requested_at) manquent.
create or replace function public.disputes_admin_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_open boolean;
  v_was_open boolean;
  v_opener uuid;
  v_detail jsonb;
begin
  v_open := coalesce(v_new ->> 'status', '') = 'open' and (v_new ->> 'closed_at') is null;
  begin v_opener := nullif(v_new ->> 'opener_id', '')::uuid; exception when others then v_opener := null; end;
  v_detail := jsonb_build_object('categorie', 'litige', 'transaction_id', v_new ->> 'transaction_id');

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_was_open := coalesce(v_old ->> 'status', '') = 'open' and (v_old ->> 'closed_at') is null;
  else
    v_was_open := false;
  end if;

  if v_open then
    if not v_was_open then
      insert into public.admin_notifications (kind, user_id, ref_id, title, detail)
      values ('dispute_open', v_opener, new.id, 'Litige ouvert', v_detail || jsonb_build_object('gravite', 'normal'))
      on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    end if;
    if (v_new ->> 'mediation_requested_at') is not null
       and (not v_was_open or (v_old ->> 'mediation_requested_at') is null) then
      insert into public.admin_notifications (kind, user_id, ref_id, title, detail)
      values ('dispute_mediation', v_opener, new.id, 'Intervention de PING demandée', v_detail || jsonb_build_object('gravite', 'grave'))
      on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    end if;
  elsif v_was_open then
    -- Litige clos (arrangement à l'amiable, Décision PING, non retenu) : ses alertes sont traitées.
    update public.admin_notifications set handled_at = now()
     where kind in ('dispute_open', 'dispute_mediation') and ref_id = new.id and handled_at is null;
  end if;
  return null;
exception when others then
  return null;  -- une alerte ratée ne doit jamais empêcher l'ouverture, la médiation ou la clôture d'un litige
end $$;
revoke execute on function public.disputes_admin_notify() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.disputes') is not null
     and not exists (select 1 from pg_trigger where tgname = 'trg_disputes_admin_notify'
                      and tgrelid = 'public.disputes'::regclass) then
    create trigger trg_disputes_admin_notify after insert or update on public.disputes
      for each row execute function public.disputes_admin_notify();
  end if;
end $$;

-- 6. Compteurs pour les pastilles (admin seulement) -----------------------------------------------------------------------
create or replace function public.admin_alert_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'version', 62,
      'documents', count(*) filter (where kind = 'document_pending'),
      'paiements', count(*) filter (where kind = 'payment_alert'),
      'paiements_graves', count(*) filter (where kind = 'payment_alert' and detail ->> 'gravite' = 'grave'),
      'litiges', count(*) filter (where kind in ('dispute_open', 'dispute_mediation')),
      'mediation', count(*) filter (where kind = 'dispute_mediation'))
    from public.admin_notifications where handled_at is null);
end $$;
revoke execute on function public.admin_alert_counts() from public, anon;
grant execute on function public.admin_alert_counts() to authenticated;

-- 7. Rattrapage (sans rafale d'e-mails : emailed_at = maintenant) -------------------------------------------------------------
do $$ begin
  if to_regclass('public.payment_alerts') is not null then
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'payment_alert', a.provider_id, a.id, public._payment_alert_label(a.kind),
           jsonb_build_object('categorie', 'paiement', 'payment_kind', a.kind,
                              'gravite', case when public._payment_alert_grave(a.kind) then 'grave' else 'normal' end,
                              'transaction_id', a.detail ->> 'transactionId', 'transfer_id', a.detail ->> 'transferId'),
           a.created_at, now()
      from public.payment_alerts a
     where a.handled_at is null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'payment_alert' and n.ref_id = a.id)
    on conflict (ref_id) where kind = 'payment_alert' and handled_at is null do nothing;
  end if;
  if to_regclass('public.disputes') is not null then
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'dispute_open', nullif(to_jsonb(d) ->> 'opener_id', '')::uuid, d.id, 'Litige ouvert',
           jsonb_build_object('categorie', 'litige', 'transaction_id', to_jsonb(d) ->> 'transaction_id', 'gravite', 'normal'),
           coalesce((to_jsonb(d) ->> 'created_at')::timestamptz, now()), now()
      from public.disputes d
     where to_jsonb(d) ->> 'status' = 'open' and (to_jsonb(d) ->> 'closed_at') is null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'dispute_open' and n.ref_id = d.id)
    on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'dispute_mediation', nullif(to_jsonb(d) ->> 'opener_id', '')::uuid, d.id, 'Intervention de PING demandée',
           jsonb_build_object('categorie', 'litige', 'transaction_id', to_jsonb(d) ->> 'transaction_id', 'gravite', 'grave'),
           coalesce((to_jsonb(d) ->> 'mediation_requested_at')::timestamptz, now()), now()
      from public.disputes d
     where to_jsonb(d) ->> 'status' = 'open' and (to_jsonb(d) ->> 'closed_at') is null
       and (to_jsonb(d) ->> 'mediation_requested_at') is not null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'dispute_mediation' and n.ref_id = d.id)
    on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
  end if;
end $$;

-- Vérification :
--   select pubname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('messages', 'dispute_messages');
--   select tgname from pg_trigger where tgname in ('trg_payment_alerts_admin_notify', 'trg_disputes_admin_notify');
--   select kind, title, detail ->> 'gravite' as gravite, created_at from public.admin_notifications
--    where kind in ('payment_alert', 'dispute_open', 'dispute_mediation') and handled_at is null order by created_at desc limit 20;
--   select public.admin_alert_counts();   -- connecté en admin (dans le SQL Editor : erreur « Réservé à l'administration », normal)


-- ======================== 063 : 063_identite_emetteur_ping.sql ========================
-- 063 : identité de l'émetteur des commissions PING (nom commercial PING, société BAITA EURL).
-- Source : informations de Romain (Notion, fiche société). Rejouable, sans DROP ni DELETE.
-- Effet : les NOUVELLES factures de commission portent ces mentions ; les documents déjà émis ne changent pas
-- (ils gardent leur copie figée `issuer_snapshot`). Avec un SIRET renseigné, le « relevé de frais » devient une « facture ».
insert into public.app_settings(key, value)
values ('platform_identity', '{}'::jsonb)
on conflict (key) do nothing;

update public.app_settings
   set value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
         'nom',     'BAITA EURL (marque PING)',
         'forme',   'EURL au capital de 5 000 €, RCS Grasse',
         'adresse', '40 rue des Arcs',
         'ville',   '06140 Vence',
         'siret',   '512 026 907 00018',
         'tva',     'FR82 512 026 907'),
       updated_at = now()
 where key = 'platform_identity';

-- Contrôle : select value from app_settings where key = 'platform_identity';


-- ======================== 064 : 064_position_floutee.sql ========================
-- 064 : position du prestataire floutée à ~50 m sur la carte des clients (décision de Romain, 26/11/2026).
-- Constat : providers_nearby (définition de production absente du dépôt) renvoie la position exacte du domicile ou de
-- l'entreprise. Ici : une NOUVELLE fonction providers_nearby_public, dont la définition est connue et donnée en entier,
-- qui renvoie un point décalé de 25 à 50 m (rayon réglable : app_settings 'map_blur_m', 50 par défaut), le même à
-- chaque appel (décalage calculé depuis un sel secret : sans le sel, le vrai point ne se déduit pas) ; la distance est
-- calculée depuis le point flouté et arrondie à 10 m (sinon elle permettrait de retrouver le vrai point par recoupement).
-- Les anciennes providers_nearby perdent leur droit d'exécution pour anon et authenticated.
-- Ordre : déployer l'application AVANT de coller (elle essaie la nouvelle fonction, retombe sur l'ancienne si elle
-- n'existe pas encore). Rejouable, sans DROP de table ni DELETE.

create table if not exists public.private_secrets (key text primary key, value text not null);
alter table public.private_secrets enable row level security;           -- aucune règle : personne côté client
revoke all on public.private_secrets from anon, authenticated;
insert into public.private_secrets(key, value) values ('map_blur_salt', gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (key) do nothing;

insert into public.app_settings(key, value) values ('map_blur_m', '50'::jsonb) on conflict (key) do nothing;

-- Point flouté : mêmes entrées, même sortie ; seul le serveur connaît le sel.
create or replace function public._blur_point(p_id uuid, p_lat double precision, p_lng double precision)
returns table(lat double precision, lng double precision)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  salt text; m double precision; h text; a double precision; r double precision;
begin
  select value into salt from private_secrets where key = 'map_blur_salt';
  select coalesce((value #>> '{}')::double precision, 50) into m from app_settings where key = 'map_blur_m';
  m := greatest(coalesce(m, 50), 10);
  h := md5(coalesce(salt, '') || p_id::text);
  a := 2 * pi() * (('x' || substr(h, 1, 8))::bit(32)::bigint)::double precision / 4294967295.0;
  r := m * (0.5 + 0.5 * (('x' || substr(h, 9, 8))::bit(32)::bigint)::double precision / 4294967295.0);   -- de m/2 à m
  lat := p_lat + (r * cos(a)) / 111320.0;
  lng := p_lng + (r * sin(a)) / (111320.0 * greatest(cos(radians(p_lat)), 0.01));
  return next;
end $$;
revoke all on function public._blur_point(uuid, double precision, double precision) from public, anon, authenticated;

create or replace function public.providers_nearby_public(
  p_lat double precision, p_lng double precision, radius_m integer default 15000, p_trade text default null)
returns table(
  id uuid, trade text, legal_status legal_status, base_price_cents integer,
  rating numeric, reviews_count integer, is_active boolean, distance_m double precision,
  bio text, lat double precision, lng double precision, pricing_type pricing_type,
  hourly_rate_cents integer, full_name text, avatar_hue integer,
  has_identity boolean, has_rcpro boolean)
language sql stable security definer set search_path to 'public' as $$
  select q.id, q.trade, q.legal_status, q.base_price_cents, q.rating, q.reviews_count, q.is_active,
         round(ST_Distance(ST_SetSRID(ST_MakePoint(q.blng, q.blat), 4326)::geography,
                           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 10.0) * 10.0 as distance_m,
         q.bio, q.blat as lat, q.blng as lng, q.pricing_type, q.hourly_rate_cents, q.full_name, q.avatar_hue,
         q.has_identity, q.has_rcpro
  from (
    select p.id, p.trade, p.legal_status, p.base_price_cents, p.rating, p.reviews_count, p.is_active, p.bio,
           p.pricing_type, p.hourly_rate_cents, pr.full_name, pr.avatar_hue, p.location,
           b.lat as blat, b.lng as blng,
           exists(select 1 from documents d where d.owner_id = p.id and d.kind = 'identite' and d.status in ('pending','valid')) as has_identity,
           exists(select 1 from documents d where d.owner_id = p.id and d.kind = 'rcpro'    and d.status in ('pending','valid')) as has_rcpro
    from provider_profiles p
    join profiles pr on pr.id = p.id
    cross join lateral public._blur_point(p.id, ST_Y(p.location::geometry), ST_X(p.location::geometry)) b
    where p.is_active = true and p.location is not null
      and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, radius_m)
      and (p_trade is null or p.trade = p_trade)
  ) q
  order by distance_m
  limit 50;
$$;
grant execute on function public.providers_nearby_public(double precision, double precision, integer, text) to anon, authenticated;

-- Ferme l'ancienne porte : toutes les surcharges de providers_nearby (la définition de production est inconnue).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'providers_nearby'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;


-- ======================== 065 : 065_numerotation_references.sql ========================
-- 065 : numéros de facture continus par série, références lisibles, vue pour le CRM (demande de Romain, 26/11/2026).
-- Ne réécrit AUCUNE fonction existante (generate_invoices et les avoirs restent tels quels) : un déclencheur remplace le
-- numéro à l'insertion. Les documents déjà émis ne changent pas. Le compteur est mis à jour dans la même transaction que
-- l'insertion : si l'insertion échoue, le numéro est rendu, donc pas de trou (contrairement à nextval).
-- Séries : facture de prestation, une par prestataire et par année (FACT-2026-P000045-0001) ; commission du prestataire
-- PING-CP-2026-000001 ; commission du client PING-CC-2026-000001. Avoirs (AV-) : inchangés, à traiter avec 063.
-- Références : compte PING-C-000123 (tout compte), PING-P-000045 (prestataire), transaction PING-T-2026-000123.
-- Rejouable, sans DROP ni DELETE.

create sequence if not exists public.account_ref_seq;
create sequence if not exists public.pro_ref_seq;
create sequence if not exists public.transaction_ref_seq;

alter table public.profiles          add column if not exists account_ref text;
alter table public.provider_profiles add column if not exists pro_ref text;
alter table public.transactions      add column if not exists reference text;
alter table public.invoices          add column if not exists transaction_ref text;
alter table public.invoices          add column if not exists client_ref text;
alter table public.invoices          add column if not exists issuer_ref text;

-- Rattrapage des lignes existantes (une fois : seulement celles sans numéro)
update public.profiles p set account_ref = 'PING-C-' || lpad(nextval('public.account_ref_seq')::text, 6, '0')
  from (select id from public.profiles where account_ref is null order by id) o where p.id = o.id;
update public.provider_profiles p set pro_ref = 'PING-P-' || lpad(nextval('public.pro_ref_seq')::text, 6, '0')
  from (select id from public.provider_profiles where pro_ref is null order by id) o where p.id = o.id;
update public.transactions t set reference = 'PING-T-' || to_char(coalesce(t.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.transaction_ref_seq')::text, 6, '0')
  from (select id from public.transactions where reference is null order by created_at, id) o where t.id = o.id;

create unique index if not exists profiles_account_ref_key          on public.profiles(account_ref);
create unique index if not exists provider_profiles_pro_ref_key     on public.provider_profiles(pro_ref);
create unique index if not exists transactions_reference_key        on public.transactions(reference);

create or replace function public._set_account_ref() returns trigger language plpgsql as $$
begin if new.account_ref is null then new.account_ref := 'PING-C-' || lpad(nextval('public.account_ref_seq')::text, 6, '0'); end if; return new; end $$;
create or replace function public._set_pro_ref() returns trigger language plpgsql as $$
begin if new.pro_ref is null then new.pro_ref := 'PING-P-' || lpad(nextval('public.pro_ref_seq')::text, 6, '0'); end if; return new; end $$;
create or replace function public._set_tx_ref() returns trigger language plpgsql as $$
begin if new.reference is null then new.reference := 'PING-T-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.transaction_ref_seq')::text, 6, '0'); end if; return new; end $$;
drop trigger if exists trg_set_account_ref on public.profiles;
create trigger trg_set_account_ref before insert on public.profiles for each row execute function public._set_account_ref();
drop trigger if exists trg_set_pro_ref on public.provider_profiles;
create trigger trg_set_pro_ref before insert on public.provider_profiles for each row execute function public._set_pro_ref();
drop trigger if exists trg_set_tx_ref on public.transactions;
create trigger trg_set_tx_ref before insert on public.transactions for each row execute function public._set_tx_ref();

create table if not exists public.invoice_counters (key text primary key, last_n bigint not null default 0);
alter table public.invoice_counters enable row level security;           -- aucune règle : serveur seulement
revoke all on public.invoice_counters from anon, authenticated;

create or replace function public._invoice_number_gapless() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare k text; pref text; n bigint; w int; yr text := to_char(coalesce(new.issued_at, now()), 'YYYY'); pr text;
begin
  if new.kind = 'prestation' then
    select pro_ref into pr from provider_profiles where id = new.issuer_id;
    k := 'F|' || yr || '|' || new.issuer_id::text;
    pref := 'FACT-' || yr || '-' || coalesce(replace(pr, 'PING-', ''), 'P000000') || '-'; w := 4;
  elsif new.kind = 'commission_seller' then k := 'CP|' || yr; pref := 'PING-CP-' || yr || '-'; w := 6;
  elsif new.kind = 'commission_client' then k := 'CC|' || yr; pref := 'PING-CC-' || yr || '-'; w := 6;
  else return new; end if;
  insert into invoice_counters(key, last_n) values (k, 1)
    on conflict (key) do update set last_n = invoice_counters.last_n + 1 returning last_n into n;
  new.number := pref || lpad(n::text, w, '0');
  select reference into new.transaction_ref from transactions where id = new.transaction_id;
  select account_ref into new.client_ref from profiles where id = new.client_id;
  select coalesce(pp.pro_ref, pr2.account_ref) into new.issuer_ref
    from profiles pr2 left join provider_profiles pp on pp.id = pr2.id where pr2.id = new.issuer_id;
  return new;
end $$;
revoke all on function public._invoice_number_gapless() from public, anon, authenticated;
drop trigger if exists trg_invoice_number_gapless on public.invoices;
create trigger trg_invoice_number_gapless before insert on public.invoices for each row execute function public._invoice_number_gapless();

-- Vue pour le CRM : lecture par la clé serveur (service_role) seulement, jamais par le navigateur.
create or replace view public.crm_invoices as
  select i.id as invoice_id, i.number, i.kind, i.issued_at, i.net_cents,
         i.transaction_id, coalesce(i.transaction_ref, t.reference) as transaction_ref,
         i.client_id, coalesce(i.client_ref, c.account_ref) as client_ref,
         i.issuer_id, i.issuer_ref, t.seller_id, pp.pro_ref as seller_ref,
         i.credit_number, i.credit_cents
  from public.invoices i
  left join public.transactions t on t.id = i.transaction_id
  left join public.profiles c on c.id = i.client_id
  left join public.provider_profiles pp on pp.id = t.seller_id;
revoke all on public.crm_invoices from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant select on public.crm_invoices to service_role; end if; end $$;


-- ======================== 066 : 066_prestations_realisees.sql ========================
-- 066 : nombre de prestations réalisées par prestataire, pour le résumé d'épingle de la carte (demande de Romain, 26/11/2026).
-- NON APPLIQUÉE par Claude : à coller par Romain après 065. Ajout seulement (CREATE OR REPLACE), aucun DROP ni DELETE, rejouable.
-- Ne renvoie qu'un nombre par prestataire actif : ni client, ni adresse, ni montant. L'app fonctionne sans elle (l'aperçu
-- n'affiche alors que les étoiles et les avis).
create or replace function public.provider_done_counts(p_ids uuid[])
returns table(provider_id uuid, done_count integer)
language sql stable security definer set search_path to 'public' as $$
  select t.seller_id, count(*)::integer
  from public.transactions t
  join public.provider_profiles p on p.id = t.seller_id and p.is_active = true
  where t.seller_id = any(p_ids) and t.completed_at is not null and t.status is distinct from 'cancelled'
  group by t.seller_id;
$$;
grant execute on function public.provider_done_counts(uuid[]) to anon, authenticated;


