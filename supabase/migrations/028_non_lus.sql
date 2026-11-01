-- 028 : messages non lus (pastille) + journal d'envoi des e-mails de notification.
-- Additif seulement. Rien n'est modifié sur `messages` (le garde de la migration 027 interdit l'UPDATE) :
-- la lecture est notée à part, par utilisateur et par mission.

-- 1. Dernière lecture d'une conversation, par utilisateur (lui seul la voit et la pose).
create table if not exists public.message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, transaction_id)
);
alter table public.message_reads enable row level security;

create policy "message_reads select self" on public.message_reads for select to authenticated
  using (user_id = auth.uid());
create policy "message_reads insert self" on public.message_reads for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.transactions t
                where t.id = transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));
create policy "message_reads update self" on public.message_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Nombre de messages non lus par mission : messages de l'AUTRE partie (hors messages système),
--    plus récents que la dernière lecture (tous s'il n'y en a pas). Seulement les missions où l'on est
--    acheteur ou prestataire.
create or replace function public.unread_counts()
returns table (transaction_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select m.transaction_id, count(*)::bigint as n
  from public.messages m
  join public.transactions t on t.id = m.transaction_id
  left join public.message_reads r on r.transaction_id = m.transaction_id and r.user_id = auth.uid()
  where auth.uid() is not null
    and auth.uid() in (t.buyer_id, t.seller_id)
    and m.sender_id is not null
    and m.sender_id <> auth.uid()
    and coalesce(m.kind, 'text') <> 'system'
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by m.transaction_id
$$;
revoke execute on function public.unread_counts() from public, anon;
grant execute on function public.unread_counts() to authenticated;

-- 3. Journal des e-mails de notification (limite : 1 par mission et destinataire toutes les 10 minutes).
--    RLS activée sans aucune policy : réservé au serveur (clé service).
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transaction_id uuid not null,
  event text not null,
  created_at timestamptz not null default now()
);
create index if not exists notification_log_recent on public.notification_log (user_id, transaction_id, created_at desc);
alter table public.notification_log enable row level security;
