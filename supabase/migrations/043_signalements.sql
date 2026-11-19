-- 043 — Signalement d'un échange, distinct du litige (lot 24, 18/11/2026). NON APPLIQUÉE par Claude.
-- Copie identique dans supabase/a_coller/043_signalements.sql. Additive, idempotente, sans DROP ni DELETE.
--
-- Un litige porte sur la PRESTATION (montant, qualité, retard) : il est vu par les deux parties et a son
-- dossier (/litiges/[id]). Un signalement porte sur le COMPORTEMENT dans l'échange (propos déplacés,
-- coordonnées partagées pour contourner PING, sollicitation suspecte) : il est privé, seul PING le lit,
-- l'autre partie n'en est pas informée. PING le classe (sans suite, avertissement, blocage).
--
-- L'app fonctionne avant et après : la conversation ne propose « Signaler l'échange à PING » que si la
-- table existe (sinon seul « Ouvrir un litige » reste, comme aujourd'hui) ; l'admin affiche
-- « disponible après la migration 043 » tant qu'elle manque.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  category text not null,
  body text not null,
  status text not null default 'nouveau',
  admin_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.reports add constraint reports_category_check
    check (category in ('propos', 'coordonnees', 'sollicitation', 'comportement', 'autre'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_status_check
    check (status in ('nouveau', 'classe', 'averti', 'bloque'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_body_len
    check (char_length(trim(body)) between 1 and 2000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_admin_note_len
    check (admin_note is null or char_length(admin_note) <= 2000);
exception when duplicate_object then null; end $$;

comment on table public.reports is 'Signalements de modération (043) : privés, lus par PING seul. Distincts des litiges (disputes).';
comment on column public.reports.category is 'propos | coordonnees | sollicitation | comportement | autre';
comment on column public.reports.status is 'nouveau | classe (sans suite) | averti | bloque — posé par un admin PING';

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_transaction_idx on public.reports (transaction_id);

-- Droits : l'auteur crée et lit les siens, l'admin lit tout et décide. Personne ne supprime.
alter table public.reports enable row level security;
revoke all on table public.reports from anon;
revoke delete on table public.reports from authenticated;
grant select, insert, update on table public.reports to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_insert_own') then
    create policy reports_insert_own on public.reports for insert to authenticated
      with check (reporter_id = auth.uid() and (transaction_id is null or exists (
        select 1 from public.transactions t where t.id = reports.transaction_id and auth.uid() in (t.buyer_id, t.seller_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_read_own_or_admin') then
    create policy reports_read_own_or_admin on public.reports for select to authenticated
      using (reporter_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_admin_update') then
    create policy reports_admin_update on public.reports for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Garde : à la création, l'auteur, le statut et la personne signalée sont posés par la base (jamais par
-- l'app) ; 10 signalements au plus par compte et par 24 h. Ensuite, seul l'admin change le statut et sa
-- note ; le contenu du signalement ne change plus.
create or replace function public.guard_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record;
begin
  if tg_op = 'INSERT' then
    if uid is null then return new; end if;  -- serveur
    new.reporter_id := uid;
    if not public.is_admin() then
      new.status := 'nouveau';
      new.admin_note := null;
      new.handled_by := null;
      new.handled_at := null;
      if (select count(*) from public.reports r where r.reporter_id = uid and r.created_at > now() - interval '24 hours') >= 10 then
        raise exception 'Trop de signalements en peu de temps : écrivez au Support PING.';
      end if;
    end if;
    new.reported_user_id := null;
    if new.transaction_id is not null then
      select buyer_id, seller_id into t from public.transactions where id = new.transaction_id;
      if found then
        new.reported_user_id := case when uid = t.buyer_id then t.seller_id when uid = t.seller_id then t.buyer_id end;
      end if;
    end if;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE
  if uid is not null and not public.is_admin() then
    raise exception 'Un signalement est traité par PING.';
  end if;
  new.reporter_id := old.reporter_id;
  new.transaction_id := old.transaction_id;
  new.reported_user_id := old.reported_user_id;
  new.category := old.category;
  new.body := old.body;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    new.handled_at := now();
    new.handled_by := uid;
  end if;
  return new;
end $$;
revoke execute on function public.guard_report() from public, anon, authenticated;
create or replace trigger trg_guard_report before insert or update on public.reports
  for each row execute function public.guard_report();
