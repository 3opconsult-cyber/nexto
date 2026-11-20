-- 059b — Tout reste dans le chat de la mission (20/11/2026). À COLLER à la main (rejouable, aucun DROP, aucun DELETE).
-- Prérequis : 021 (dispute_messages), 022 (lecture admin). Fonctionne avec ou sans 054.
--
-- Demande de Romain : « tout reste dans le chat, le super-admin voit toutes les conversations et peut interagir ».
--  (a) Miroir : chaque message du fil du litige (parties et PING) est recopié dans la conversation de la mission
--      (messages.dispute_id / dispute_message_id) par un trigger SECURITY DEFINER sur dispute_messages. L'application
--      l'affiche en carte « Litige » repliable avec le lien vers le dossier ; les messages système du fil ne sont pas
--      recopiés (la conversation a déjà les siens). Les messages d'avant ce fichier ne sont PAS recopiés (pas de
--      pastille « non lu » en rafale sur d'anciens litiges). Si la copie échoue, le message du litige est quand même
--      enregistré (avertissement, jamais d'erreur côté utilisateur).
--  (b) PING écrit dans la conversation : RPC admin_post_chat_message (admin seulement). Message de kind 'mediation'
--      (repli sur 'text' si la colonne messages.kind refuse cette valeur). L'application reconnaît « PING » à kind
--      'mediation' OU à un expéditeur qui n'est ni l'acheteur ni le vendeur ; Realtime et pastille « non lu » existants
--      (unread_counts compte les messages non système de quelqu'un d'autre) s'appliquent donc sans changement.
--  (c) L'admin voit TOUTES les conversations : RPC admin_conversations_list (recherche par nom, numéro de mission ou
--      métier ; filtre « litige ouvert » / « intervention de PING demandée »).
-- L'application détecte l'absence de ce fichier (colonne dispute_id absente, RPC introuvable) et s'en passe.

alter table public.messages add column if not exists dispute_id uuid;
alter table public.messages add column if not exists dispute_message_id uuid;
create unique index if not exists messages_dispute_message_uniq on public.messages (dispute_message_id) where dispute_message_id is not null;
create index if not exists messages_dispute_idx on public.messages (dispute_id) where dispute_id is not null;

-- Insertion d'un message de conversation avec repli de kind si une contrainte refuse 'mediation'.
create or replace function public._chat_insert(p_tx uuid, p_sender uuid, p_kind text, p_body text,
                                               p_dispute uuid default null, p_dm uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  begin
    insert into public.messages (transaction_id, sender_id, kind, body, dispute_id, dispute_message_id)
    values (p_tx, p_sender, p_kind, p_body, p_dispute, p_dm) returning id into mid;
  exception when check_violation then
    insert into public.messages (transaction_id, sender_id, kind, body, dispute_id, dispute_message_id)
    values (p_tx, p_sender, 'text', p_body, p_dispute, p_dm) returning id into mid;
  end;
  return mid;
end $$;
revoke all on function public._chat_insert(uuid, uuid, text, text, uuid, uuid) from public, anon, authenticated;

-- (a) Miroir du fil du litige dans la conversation.
create or replace function public.mirror_dispute_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare tx uuid;
begin
  if new.kind not in ('text', 'mediation') or new.sender_id is null then return new; end if;
  select transaction_id into tx from public.disputes where id = new.dispute_id;
  if tx is null then return new; end if;
  perform public._chat_insert(tx, new.sender_id, case when new.kind = 'mediation' then 'mediation' else 'text' end,
                              new.body, new.dispute_id, new.id);
  return new;
exception when others then
  raise warning 'mirror_dispute_message : %', sqlerrm;
  return new;
end $$;
revoke execute on function public.mirror_dispute_message() from public, anon, authenticated;
create or replace trigger trg_mirror_dispute_message after insert on public.dispute_messages
  for each row execute function public.mirror_dispute_message();

-- (b) PING écrit dans la conversation d'une mission.
create or replace function public.admin_post_chat_message(p_transaction uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); body text := trim(coalesce(p_body, '')); mid uuid;
begin
  if uid is null or not public.is_admin() then raise exception 'Réservé à PING.'; end if;
  if char_length(body) < 1 or char_length(body) > 2000 then raise exception 'Message vide ou trop long (2000 caractères au plus).'; end if;
  if not exists (select 1 from public.transactions where id = p_transaction) then raise exception 'Mission introuvable.'; end if;
  mid := public._chat_insert(p_transaction, uid, 'mediation', body);
  return jsonb_build_object('ok', true, 'id', mid);
end $$;
revoke all on function public.admin_post_chat_message(uuid, text) from public, anon;
grant execute on function public.admin_post_chat_message(uuid, text) to authenticated;

-- (c) Toutes les conversations, pour l'admin.
create or replace function public.admin_conversations_list(p_query text default null, p_filter text default 'all', p_limit integer default 200)
returns table (transaction_id uuid, buyer_id uuid, seller_id uuid, buyer_name text, seller_name text, category text, status text,
               last_at timestamptz, last_body text, last_kind text, n_messages bigint, dispute_id uuid, dispute_open boolean, mediation boolean)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Réservé à PING.'; end if;
  return query
  select t.id, t.buyer_id, t.seller_id, pb.full_name, ps.full_name, r.category::text, t.status::text,
         lm.created_at, left(lm.body, 160), lm.kind::text, coalesce(cnt.n, 0),
         d.id, coalesce(d.status::text = 'open', false), coalesce((to_jsonb(d) ->> 'mediation_requested_at') is not null, false)
    from public.transactions t
    left join public.profiles pb on pb.id = t.buyer_id
    left join public.profiles ps on ps.id = t.seller_id
    left join public.requests r on r.id = t.request_id
    left join lateral (select m.created_at, m.body, m.kind from public.messages m where m.transaction_id = t.id order by m.created_at desc limit 1) lm on true
    left join lateral (select count(*) as n from public.messages m where m.transaction_id = t.id) cnt on true
    left join lateral (select x.* from public.disputes x where x.transaction_id = t.id
                        order by (x.status::text = 'open') desc, x.created_at desc limit 1) d on true
   where (q is null or pb.full_name ilike '%' || q || '%' or ps.full_name ilike '%' || q || '%'
          or t.id::text ilike q || '%' or r.category::text ilike '%' || q || '%')
     and (coalesce(p_filter, 'all') = 'all'
          or (p_filter = 'litige' and d.id is not null and d.status::text = 'open')
          or (p_filter = 'mediation' and d.id is not null and d.status::text = 'open' and (to_jsonb(d) ->> 'mediation_requested_at') is not null))
   order by (d.id is not null and d.status::text = 'open') desc, coalesce(lm.created_at, t.created_at) desc
   limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;
revoke all on function public.admin_conversations_list(text, text, integer) from public, anon;
grant execute on function public.admin_conversations_list(text, text, integer) to authenticated;

-- Vérification après coup :
--   select column_name from information_schema.columns where table_name = 'messages' and column_name like 'dispute%';
--   select proname from pg_proc where proname in ('admin_post_chat_message', 'admin_conversations_list', 'mirror_dispute_message');
