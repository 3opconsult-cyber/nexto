-- 052 — Réservation directe à accepter par le prestataire (décision Romain du 19/11/2026). NON APPLIQUÉE par Claude.
-- Copie identique dans supabase/a_coller/052_reservation_a_accepter.sql. À coller APRÈS 051 (et après 045, 048 si
-- elles sont collées : 052 réécrit book_service de 045 et unread_counts de 048). Additive et idempotente : aucune
-- instruction DROP ni DELETE, aucune ligne existante modifiée (les réservations déjà enregistrées prennent la valeur
-- par défaut « acceptee » de la nouvelle colonne, sans réécriture).
--
-- Avant : une réservation directe (mission/new -> book_service) était confirmée d'office.
-- Après : elle est « en attente » ; le prestataire l'accepte (1 appui) ou la refuse (2 appuis, motif facultatif).
--   * Le prix reste figé dès la réservation (règle suprême du tarif) : rien ne se renégocie.
--   * Tant qu'elle n'est pas acceptée : ni « Je pars », ni arrivée, ni fin (verrou ci-dessous) ; l'application
--     masque aussi l'adresse exacte, la Mission du jour et les QR.
--   * Délai de réponse : 24 h après la réservation ou 2 h avant le rendez-vous, le plus court (au moins 30 min).
--     Sans réponse : « expiree », mission annulée, créneau libéré (trigger 012), client prévenu (message + pastille).
--   * Refus : annulation sans frais, créneau libéré, message système.
--   * Les missions issues d'un devis accepté dans le chat sont « acceptee » (valeur par défaut) : l'accord sur le
--     prix vaut acceptation. Les réservations existantes aussi.
--
-- Colonnes : transactions.booking_status ('en_attente' | 'acceptee' | 'refusee' | 'expiree'), accepted_at,
-- refused_at, expired_at, refusal_reason, accept_deadline.
-- Fonctions : accept_booking(tx), refuse_booking(tx, motif), expire_pending_bookings() (pg_cron toutes les 10 min
-- si l'extension est là ; l'application l'appelle aussi à la lecture), book_service (045, réécrite).
-- Vérification : select proname from pg_proc where proname in ('accept_booking', 'refuse_booking', 'expire_pending_bookings');
--                select booking_status, count(*) from transactions group by 1;

-- 1. Colonnes ------------------------------------------------------------------------------------------------
alter table public.transactions add column if not exists booking_status text not null default 'acceptee';
alter table public.transactions add column if not exists accepted_at timestamptz;
alter table public.transactions add column if not exists refused_at timestamptz;
alter table public.transactions add column if not exists expired_at timestamptz;
alter table public.transactions add column if not exists refusal_reason text;
alter table public.transactions add column if not exists accept_deadline timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_booking_status_check') then
    alter table public.transactions add constraint transactions_booking_status_check
      check (booking_status in ('en_attente', 'acceptee', 'refusee', 'expiree'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_refusal_reason_len') then
    alter table public.transactions add constraint transactions_refusal_reason_len
      check (refusal_reason is null or char_length(refusal_reason) <= 300);
  end if;
end $$;
create index if not exists transactions_booking_pending
  on public.transactions (seller_id, accept_deadline) where booking_status = 'en_attente';

-- 2. Délai de réponse : 24 h après la réservation, ou 2 h avant le rendez-vous, le plus court ; au moins 30 min.
create or replace function public._booking_deadline(p_created timestamptz, p_scheduled timestamptz)
returns timestamptz language sql immutable as $$
  select greatest(
    case when p_scheduled is null then p_created + interval '24 hours'
         else least(p_created + interval '24 hours', p_scheduled - interval '2 hours') end,
    p_created + interval '30 minutes')
$$;

-- 3. Règles de la réservation (un seul trigger, SECURITY INVOKER comme 038/048 : current_user vaut 'authenticated'
--    pour un appel direct de l'API, le propriétaire des fonctions quand l'écriture vient d'une fonction definer).
create or replace function public.booking_rules() returns trigger
language plpgsql security invoker set search_path = public as $$
declare api boolean := current_user in ('authenticated', 'anon') and not public.is_admin();
begin
  if tg_op = 'INSERT' then
    if api then
      -- Une mission insérée directement avec un prix déjà validé est une réservation directe (ancien chemin de
      -- mission/new) : elle attend l'acceptation du prestataire, comme book_service. Une conversation (prix à
      -- valider dans le chat) est « acceptee » : l'accord sur le devis vaudra acceptation.
      new.booking_status := case when coalesce(new.price_confirmed, false) then 'en_attente' else 'acceptee' end;
      new.accepted_at := null; new.refused_at := null; new.expired_at := null;
      new.refusal_reason := null; new.accept_deadline := null;
    end if;
  elsif api and (new.booking_status is distinct from old.booking_status
     or new.accepted_at is distinct from old.accepted_at or new.refused_at is distinct from old.refused_at
     or new.expired_at is distinct from old.expired_at or new.refusal_reason is distinct from old.refusal_reason
     or new.accept_deadline is distinct from old.accept_deadline) then
    raise exception 'La réservation s''accepte ou se refuse depuis le compte du prestataire.';
  end if;

  -- Délai posé à la création, recalculé si l'heure du rendez-vous change (créneau réservé juste après : book_slot).
  if new.booking_status = 'en_attente' and (tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at
     or new.accept_deadline is null) then
    new.accept_deadline := public._booking_deadline(
      case when tg_op = 'INSERT' then coalesce(new.created_at, now()) else coalesce(old.created_at, now()) end,
      new.scheduled_at);
  end if;

  -- Verrou : rien ne démarre tant que la réservation n'est pas acceptée (aucune exception, même côté serveur).
  if tg_op = 'UPDATE' and new.booking_status <> 'acceptee' then
    if (old.en_route_at is null and new.en_route_at is not null)
       or (new.status is distinct from old.status and new.status in ('arrived', 'completed'))
       or (old.arrived_at is null and new.arrived_at is not null) then
      raise exception 'Réservation pas encore acceptée par le prestataire : la mission ne peut pas commencer.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.booking_rules() from public, anon, authenticated;
create or replace trigger trg_booking_rules
  before insert or update on public.transactions
  for each row execute function public.booking_rules();

-- 4. Expiration (cron et lecture) --------------------------------------------------------------------------
-- Renvoie les missions expirées par cet appel où l'appelant est partie (le prestataire qui ouvre l'application
-- prévient alors le client par e-mail via /api/notify ; le cron, lui, n'envoie pas d'e-mail).
create or replace function public.expire_pending_bookings()
returns table (transaction_id uuid, buyer_id uuid, seller_id uuid)
language plpgsql security definer set search_path = public as $$
declare r record; uid uuid := auth.uid();
begin
  for r in
    select t.id, t.buyer_id, t.seller_id, t.request_id from public.transactions t
    where t.booking_status = 'en_attente' and t.status = 'pending' and t.accept_deadline is not null
      and t.accept_deadline < now()
    order by t.accept_deadline
    limit 200
    for update skip locked
  loop
    update public.transactions set booking_status = 'expiree', expired_at = now(), status = 'cancelled'
      where id = r.id;
    if r.request_id is not null then
      update public.requests set status = 'cancelled' where id = r.request_id and status = 'matched';
    end if;
    insert into public.messages (transaction_id, sender_id, kind, body)
      values (r.id, r.buyer_id, 'system',
        '✕ Réservation expirée : le prestataire n''a pas répondu à temps. Elle est annulée sans frais et le créneau est libéré. Vous pouvez choisir un autre prestataire.');
    if uid is null or uid in (r.buyer_id, r.seller_id) then
      transaction_id := r.id; buyer_id := r.buyer_id; seller_id := r.seller_id; return next;
    end if;
  end loop;
end $$;
revoke all on function public.expire_pending_bookings() from public, anon;
grant execute on function public.expire_pending_bookings() to authenticated;

-- 5. Le prestataire accepte (1 appui) ------------------------------------------------------------------------
create or replace function public.accept_booking(p_transaction uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, seller_id, buyer_id, status, booking_status, accept_deadline into t
    from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de cette réservation.'; end if;
  if t.booking_status = 'acceptee' then return jsonb_build_object('ok', true, 'already', true); end if;
  if t.booking_status in ('refusee', 'expiree') or t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', coalesce(nullif(t.booking_status, 'en_attente'), 'annulee'),
      'message', case t.booking_status when 'refusee' then 'Vous avez déjà refusé cette réservation.'
                                       when 'expiree' then 'Le délai de réponse est dépassé : la réservation a expiré.'
                                       else 'Le client a annulé cette réservation.' end);
  end if;
  if t.accept_deadline is not null and t.accept_deadline < now() then
    perform public.expire_pending_bookings();
    return jsonb_build_object('ok', false, 'reason', 'expiree',
      'message', 'Le délai de réponse est dépassé : la réservation a expiré et le client a été prévenu.');
  end if;
  update public.transactions set booking_status = 'acceptee', accepted_at = now() where id = p_transaction;
  insert into public.messages (transaction_id, sender_id, kind, body)
    values (p_transaction, uid, 'system', '✓ Réservation acceptée par le prestataire : le rendez-vous est confirmé.');
  return jsonb_build_object('ok', true, 'accepted_at', now());
end $$;
revoke all on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

-- 6. Le prestataire refuse (2 appuis, motif facultatif) : annulation sans frais, créneau libéré ---------------
create or replace function public.refuse_booking(p_transaction uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if why is not null and char_length(why) > 300 then raise exception 'Motif trop long (300 caractères au plus).'; end if;
  select id, seller_id, buyer_id, status, booking_status, request_id into t
    from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de cette réservation.'; end if;
  if t.booking_status = 'refusee' then return jsonb_build_object('ok', true, 'already', true); end if;
  if t.booking_status <> 'en_attente' or t.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', t.booking_status,
      'message', case when t.booking_status = 'acceptee' then 'Réservation déjà acceptée : pour l''annuler, passez par le menu de la conversation.'
                      when t.booking_status = 'expiree' then 'Le délai de réponse est dépassé : la réservation a expiré.'
                      else 'Cette réservation est déjà annulée.' end);
  end if;
  update public.transactions set booking_status = 'refusee', refused_at = now(), refusal_reason = why, status = 'cancelled'
    where id = p_transaction;
  if t.request_id is not null then
    update public.requests set status = 'cancelled' where id = t.request_id and status = 'matched';
  end if;
  insert into public.messages (transaction_id, sender_id, kind, body)
    values (p_transaction, uid, 'system',
      '✕ Réservation refusée par le prestataire' || coalesce(' — motif : ' || why, '')
      || '. Elle est annulée sans frais et le créneau est libéré.');
  return jsonb_build_object('ok', true, 'refused_at', now());
end $$;
revoke all on function public.refuse_booking(uuid, text) from public, anon;
grant execute on function public.refuse_booking(uuid, text) to authenticated;

-- 7. book_service (045) : la réservation naît « en attente » -------------------------------------------------
create or replace function public._setting_rate(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select case when r is null or r < 0 or r > 0.5 then p_default else r end
  from (select (select case
                  when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric
                  when jsonb_typeof(s.value) = 'string' and (s.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (s.value #>> '{}')::numeric
                end
                from public.app_settings s where s.key = p_key) as r) x
$$;
revoke all on function public._setting_rate(text, numeric) from public, anon, authenticated;

create or replace function public.book_service(
  p_provider uuid,
  p_service uuid default null,
  p_mode text default null,
  p_estimated_hours numeric default null,
  p_address text default null,
  p_address_status text default 'profil',
  p_scheduled_at timestamptz default null,
  p_description text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_payment_pref text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  src jsonb;
  cat text; label text;
  base_c integer; hourly_c integer; incl numeric; ptype text;
  has_flat boolean; has_hourly boolean; has_overtime boolean; mode text;
  sub integer; bfee integer; sfee integer; brate numeric; srate numeric;
  req_id uuid; tx_id uuid; v_deadline timestamptz;
begin
  if uid is null then raise exception 'Connectez-vous pour réserver.'; end if;
  if p_provider is null or p_provider = uid then raise exception 'Vous ne pouvez pas réserver vos propres services.'; end if;
  if p_address is null or char_length(trim(p_address)) < 5 then raise exception 'Indiquez l''adresse de l''intervention.'; end if;
  if char_length(p_address) > 300 then raise exception 'Adresse trop longue.'; end if;
  if coalesce(p_address_status, 'profil') not in ('profil', 'a_valider') then raise exception 'Adresse : statut inconnu.'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '5 minutes' then raise exception 'Choisissez une date à venir.'; end if;
  if p_payment_pref is not null and p_payment_pref not in ('cesu', 'direct', 'indifferent') then raise exception 'Mode de paiement inconnu.'; end if;
  if p_description is not null and char_length(p_description) > 2000 then raise exception 'Description trop longue.'; end if;

  if p_service is not null then
    select to_jsonb(s) into src from public.services s where s.id = p_service and s.provider_id = p_provider;
    if src is null then raise exception 'Cette prestation n''existe plus.'; end if;
    if coalesce((src ->> 'hidden')::boolean, false) then raise exception 'Cette prestation n''est plus proposée.'; end if;
  else
    select to_jsonb(pp) into src from public.provider_profiles pp where pp.id = p_provider;
    if src is null then raise exception 'Prestataire introuvable.'; end if;
  end if;
  select coalesce(nullif(src ->> 'trade', ''), pp.trade), pp.trade into cat, label
    from public.provider_profiles pp where pp.id = p_provider;
  if not found then raise exception 'Prestataire introuvable.'; end if;

  ptype    := coalesce(src ->> 'pricing_type', 'forfait');
  base_c   := coalesce((src ->> 'base_price_cents')::integer, 0);
  hourly_c := nullif((src ->> 'hourly_rate_cents')::integer, 0);
  incl     := (src ->> 'included_hours')::numeric;
  if ptype = 'devis' then raise exception 'Prestation sur devis : demandez un devis dans la conversation.'; end if;

  has_flat     := base_c > 0;
  has_hourly   := hourly_c is not null and hourly_c > 0;
  has_overtime := has_flat and has_hourly and incl is not null;
  mode := case
    when has_overtime then 'forfait'
    when p_mode = 'horaire' and has_hourly then 'horaire'
    when p_mode = 'forfait' and has_flat then 'forfait'
    when has_flat then 'forfait'
    when has_hourly then 'horaire'
  end;
  if mode is null then raise exception 'Ce prestataire n''a pas encore de prix.'; end if;

  if mode = 'horaire' and not has_overtime then
    if p_estimated_hours is null or p_estimated_hours <= 0 or p_estimated_hours > 24 then
      raise exception 'Indiquez une durée estimée (entre 0,5 et 24 h).';
    end if;
    sub := round(hourly_c * p_estimated_hours)::integer;
  else
    sub := base_c;
  end if;
  if sub is null or sub <= 0 then raise exception 'Montant de la prestation invalide.'; end if;

  brate := public._setting_rate('commission_buyer_rate', 0.08);
  srate := public._setting_rate('commission_seller_rate', 0.17);
  bfee := round(sub * brate)::integer;
  sfee := round(sub * srate)::integer;

  insert into public.requests (requester_id, category, description, address, budget_cents, status, payment_pref, lat, lng)
  values (uid, coalesce(cat, label), coalesce(nullif(trim(p_description), ''), coalesce(src ->> 'name', '')),
          trim(p_address), sub + bfee, 'matched', p_payment_pref, p_lat, p_lng)
  returning id into req_id;

  insert into public.transactions (
    kind, buyer_id, seller_id, request_id,
    subtotal_cents, buyer_fee_cents, seller_fee_cents, total_charged_cents, payout_cents,
    hourly_rate_cents, included_hours, base_forfait_cents,
    status, price_confirmed, address_status, scheduled_at, booking_status)
  values (
    'service', uid, p_provider, req_id,
    sub, bfee, sfee, sub + bfee, sub - sfee,
    case when has_overtime or mode = 'horaire' then hourly_c end,
    case when has_overtime then incl end,
    case when has_overtime then base_c end,
    'pending', true, coalesce(p_address_status, 'profil'), p_scheduled_at, 'en_attente')
  returning id, accept_deadline into tx_id, v_deadline;

  return jsonb_build_object(
    'transaction_id', tx_id, 'request_id', req_id, 'mode', mode,
    'subtotal_cents', sub, 'buyer_fee_cents', bfee, 'seller_fee_cents', sfee,
    'total_charged_cents', sub + bfee, 'payout_cents', sub - sfee,
    'base_price_cents', base_c, 'hourly_rate_cents', hourly_c, 'included_hours', incl,
    'buyer_rate', brate, 'seller_rate', srate,
    'booking_status', 'en_attente', 'accept_deadline', v_deadline);
end $$;
revoke all on function public.book_service(uuid, uuid, text, numeric, text, text, timestamptz, text, double precision, double precision, text) from public, anon;
grant execute on function public.book_service(uuid, uuid, text, numeric, text, text, timestamptz, text, double precision, double precision, text) to authenticated;

-- 8. Pastille Messages (non lus) : réécrit unread_counts en gardant ce que 038 / 048 y ont ajouté, s'ils sont là.
--    Prestataire : 1 par réservation en attente de sa réponse (jusqu'à la réponse). Client : 1 quand sa réservation
--    est acceptée, refusée ou expirée, tant qu'il n'a pas rouvert la conversation.
do $$
declare
  has038 boolean := to_regclass('public.presence_requests') is not null;
  has048 boolean := exists (select 1 from information_schema.columns where table_schema = 'public'
                             and table_name = 'presence_requests' and column_name = 'code_sent_at')
                    and exists (select 1 from information_schema.columns where table_schema = 'public'
                             and table_name = 'transactions' and column_name = 'client_presence_at');
  body text;
begin
  body := $q$
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
    union all
    select t.id, 1::bigint
    from public.transactions t
    where auth.uid() is not null and t.seller_id = auth.uid() and t.booking_status = 'en_attente' and t.status = 'pending'
    union all
    select t.id, 1::bigint
    from public.transactions t
    left join public.message_reads r on r.transaction_id = t.id and r.user_id = auth.uid()
    where auth.uid() is not null and t.buyer_id = auth.uid()
      and coalesce(t.accepted_at, t.refused_at, t.expired_at) is not null
      and (r.last_read_at is null or coalesce(t.accepted_at, t.refused_at, t.expired_at) > r.last_read_at)$q$;
  if has038 then
    body := body || $q$
    union all
    select pr.transaction_id, 1::bigint
    from public.presence_requests pr
    join public.transactions t on t.id = pr.transaction_id
    where auth.uid() is not null and t.buyer_id = auth.uid() and t.status <> 'cancelled'
      and pr.used_at is null and pr.declined_at is null and pr.confirm_until > now()$q$
      || case when has048 then ' and pr.code_sent_at is null' else '' end;
  end if;
  if has048 then
    body := body || $q$
    union all
    select t.id, 1::bigint
    from public.transactions t
    left join public.message_reads r on r.transaction_id = t.id and r.user_id = auth.uid()
    where auth.uid() is not null and t.seller_id = auth.uid() and t.status = 'pending' and t.arrived_at is null
      and t.client_presence_at is not null and (r.last_read_at is null or t.client_presence_at > r.last_read_at)$q$;
  end if;
  execute 'create or replace function public.unread_counts()
    returns table (transaction_id uuid, n bigint)
    language sql stable security definer set search_path = public as $f$
      select x.transaction_id, sum(x.n)::bigint as n from (' || body || '
      ) x group by x.transaction_id
    $f$';
  execute 'revoke execute on function public.unread_counts() from public, anon';
  execute 'grant execute on function public.unread_counts() to authenticated';
end $$;

-- 9. Expiration automatique toutes les 10 minutes, si pg_cron est installé (sinon : à la lecture, par l'app).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'ping_reservations_expirees') then
      perform cron.schedule('ping_reservations_expirees', '*/10 * * * *', 'select public.expire_pending_bookings()');
    end if;
  end if;
end $$;
