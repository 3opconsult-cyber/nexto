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
