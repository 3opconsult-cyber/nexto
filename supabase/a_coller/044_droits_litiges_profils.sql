-- 044 — Contrôle des droits en base : fil des litiges et lecture des profils (lot 25, 18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/044_droits_litiges_profils.sql.
-- Rapport : docs/droits-base-2026-11-18.md. Sans DROP ni DELETE : on resserre (ALTER POLICY, politiques
-- RESTRICTIVE qui ne peuvent que restreindre, déclencheur de garde). Rejouable sans risque.
--
-- AVANT DE COLLER, lire l'état réel (lecture seule) et le garder dans le rapport :
--   select policyname, permissive, roles, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename in ('profiles', 'dispute_messages', 'disputes') order by 1, 2;
--
-- L'app fonctionne avant et après : aucun écran ne lit le profil d'un autre compte en direct (les noms
-- passent par provider_public_name, transaction_counterparts, review_rater_names), et le fil des litiges
-- n'écrit que ce que la règle ci-dessous autorise (message de la partie, médiation de l'admin, messages
-- « système » des fonctions SECURITY DEFINER de la 040).

-- 1. profiles : plus aucune lecture publique ------------------------------------------------------------------
--    La 001 créait « profile_public_read » (SELECT USING (true)) : téléphone chiffré, adresse, date de
--    naissance… lisibles par tout visiteur via l'API. CLAUDE.md la dit retirée, mais aucune migration du
--    dépôt ne le prouve. Toute politique SELECT/ALL de `profiles` dont la condition est « true » est
--    ramenée à « soi-même ou admin ». Sans effet si elle n'existe plus.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'profiles' and permissive = 'PERMISSIVE'
              and cmd in ('SELECT', 'ALL') and coalesce(trim(qual), '') in ('true', '(true)')
  loop
    execute format('alter policy %I on public.profiles using ((auth.uid() = id) or public.is_admin())', p.policyname);
    raise notice 'profiles : politique « % » ramenée à soi-même ou admin', p.policyname;
  end loop;
end $$;

-- 2. dispute_messages ------------------------------------------------------------------------------------------
--    Les politiques posées par la 021 (appliquée par le connecteur) ne figurent pas dans le dépôt. Les règles
--    voulues sont donc ré-affirmées ici, indépendamment de ce qui existe :
--      lecture   : une partie de la mission du litige, ou un admin ;
--      écriture  : une partie (en son nom, litige ouvert, message ordinaire) ou un admin (médiation) ;
--      un message envoyé ne se modifie ni ne se supprime (sauf admin).
--    Les politiques RESTRICTIVE s'ajoutent en ET aux politiques existantes : elles ne peuvent que retirer
--    des droits, jamais en donner.
alter table public.dispute_messages enable row level security;
revoke all on table public.dispute_messages from anon;

create or replace function public.dispute_party_or_admin(p_dispute uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.disputes d join public.transactions t on t.id = d.transaction_id
    where d.id = p_dispute and auth.uid() in (t.buyer_id, t.seller_id))
$$;
revoke execute on function public.dispute_party_or_admin(uuid) from public, anon;
grant execute on function public.dispute_party_or_admin(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_read') then
    create policy dm_restrict_read on public.dispute_messages as restrictive for select
      using (public.dispute_party_or_admin(dispute_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_insert') then
    create policy dm_restrict_insert on public.dispute_messages as restrictive for insert
      with check (public.is_admin() or (sender_id = auth.uid() and public.dispute_party_or_admin(dispute_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_update') then
    create policy dm_restrict_update on public.dispute_messages as restrictive for update
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_delete') then
    create policy dm_restrict_delete on public.dispute_messages as restrictive for delete
      using (public.is_admin());
  end if;
end $$;

--    Le « kind » ne se contrôle pas bien par politique : une partie qui écrit en direct ne poste que du
--    texte, dans un litige ouvert. Les messages « system » des RPC de la 040 (propose/accept/decline_settlement,
--    SECURITY DEFINER) passent : elles s'exécutent sous leur propriétaire, pas sous le rôle de l'API.
create or replace function public.dispute_status_text(p_dispute uuid) returns text
language sql stable security definer set search_path = public as $$
  select d.status::text from public.disputes d where d.id = p_dispute
$$;
revoke execute on function public.dispute_status_text(uuid) from public, anon;
grant execute on function public.dispute_status_text(uuid) to authenticated;

-- SECURITY INVOKER exprès : current_user doit être celui de la requête (« authenticated » sous l'API,
-- le propriétaire de la fonction quand le message vient d'une RPC SECURITY DEFINER de la 040).
create or replace function public.guard_dispute_message() returns trigger
language plpgsql set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.is_admin() then return new; end if;
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op <> 'INSERT' then
    raise exception 'Un message du litige ne se modifie pas.';
  end if;
  if new.sender_id is distinct from uid then
    raise exception 'Un message est envoyé en son propre nom.';
  end if;
  if new.kind is distinct from 'text' then
    raise exception 'Seul PING écrit en médiation.';
  end if;
  if public.dispute_status_text(new.dispute_id) is distinct from 'open' then
    raise exception 'Ce litige est clos : écrivez au Support PING.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_dispute_message() from public, anon, authenticated;
create or replace trigger trg_guard_dispute_message before insert or update on public.dispute_messages
  for each row execute function public.guard_dispute_message();
