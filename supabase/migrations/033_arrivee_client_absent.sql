-- 033 — Arrivée du prestataire quand le client n'est pas sur place.
-- Additive et idempotente (aucun DROP). Le client ne peut JAMAIS poser arrived_at : toutes les écritures
-- passent par des RPC SECURITY DEFINER réservées au prestataire de la mission (auth.uid() = seller_id est
-- conservé dans une fonction definer, donc trg_enforce_arrival_departure et guard_transaction_core
-- continuent de s'appliquer normalement).

-- 1. Méthode et preuve d'arrivée -------------------------------------------------------------------
-- NULL = arrivée antérieure à cette migration. La position n'est enregistrée que pour 'geoloc_code' et
-- 'photo_gps' (cas « client absent », avec consentement), jamais pour un scan de QR.
alter table public.transactions add column if not exists arrival_method text;
alter table public.transactions add column if not exists arrival_lat double precision;
alter table public.transactions add column if not exists arrival_lng double precision;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_arrival_method_check') then
    alter table public.transactions add constraint transactions_arrival_method_check
      check (arrival_method is null or arrival_method in ('qr_client', 'qr_sur_place', 'geoloc_code', 'photo_gps'));
  end if;
end $$;

-- Seul le prestataire (ou le serveur / un admin) écrit la méthode et la position ; un scan classique
-- sans méthode précisée est étiqueté 'qr_client'.
create or replace function public.guard_arrival_evidence() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if uid is not null and not public.is_admin()
       and (new.arrival_method is not null or new.arrival_lat is not null or new.arrival_lng is not null) then
      raise exception 'Preuve d''arrivée réservée au prestataire.';
    end if;
    return new;
  end if;
  if (new.arrival_method is distinct from old.arrival_method
      or new.arrival_lat is distinct from old.arrival_lat
      or new.arrival_lng is distinct from old.arrival_lng)
     and uid is not null and not public.is_admin() and uid <> old.seller_id then
    raise exception 'Preuve d''arrivée réservée au prestataire.';
  end if;
  if old.arrived_at is null and new.arrived_at is not null and new.arrival_method is null then
    new.arrival_method := 'qr_client';
  end if;
  return new;
end $$;
revoke execute on function public.guard_arrival_evidence() from public, anon, authenticated;
drop trigger if exists trg_guard_arrival_evidence on public.transactions;
create trigger trg_guard_arrival_evidence before insert or update on public.transactions
  for each row execute function public.guard_arrival_evidence();

-- 2. Voie A : QR unique laissé sur place -----------------------------------------------------------
-- Aucune policy, aucun grant : la table n'est lisible que via create_onsite_token (client acheteur).
create table if not exists public.mission_onsite_tokens (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.mission_onsite_tokens enable row level security;
revoke all on table public.mission_onsite_tokens from anon, authenticated;

-- Le client (acheteur) obtient (ou renouvelle) le jeton de SA mission avant l'arrivée.
create or replace function public.create_onsite_token(p_transaction uuid, p_renew boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; tok text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, buyer_id, status, arrived_at into t from public.transactions where id = p_transaction;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  if t.status <> 'pending' or t.arrived_at is not null then
    raise exception 'Cette mission est déjà commencée ou annulée.';
  end if;
  select token into tok from public.mission_onsite_tokens where transaction_id = p_transaction and used_at is null;
  if tok is not null and not coalesce(p_renew, false) then return tok; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.mission_onsite_tokens (transaction_id, token) values (p_transaction, tok)
    on conflict (transaction_id) do update set token = excluded.token, created_at = now(), used_at = null;
  return tok;
end $$;
revoke all on function public.create_onsite_token(uuid, boolean) from public, anon;
grant execute on function public.create_onsite_token(uuid, boolean) to authenticated;

-- Le prestataire valide son arrivée en scannant le QR laissé sur place.
create or replace function public.arrive_with_onsite_token(p_transaction uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; ok boolean;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, seller_id, status, arrived_at into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then
    raise exception 'Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.';
  end if;
  if t.status = 'cancelled' then raise exception 'Cette réservation a été annulée.'; end if;
  if t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  select true into ok from public.mission_onsite_tokens
    where transaction_id = p_transaction and used_at is null and token = p_token;
  if ok is not true then raise exception 'Code invalide ou déjà utilisé.'; end if;
  update public.transactions set arrived_at = now(), status = 'arrived', arrival_method = 'qr_sur_place'
    where id = p_transaction;
  update public.mission_onsite_tokens set used_at = now() where transaction_id = p_transaction;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.arrive_with_onsite_token(uuid, text) from public, anon;
grant execute on function public.arrive_with_onsite_token(uuid, text) to authenticated;

-- 3. Voie B : repli position + code à 6 chiffres ---------------------------------------------------
-- Pas de policy, pas de grant. Le hash sert à la vérification ; le code en clair n'existe que pour que le
-- CLIENT le lise (get_arrival_code) pendant 15 min, et est effacé à l'usage, à l'expiration ou au blocage.
create table if not exists public.arrival_codes (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  code_hash text not null,
  code_clair text,
  expires_at timestamptz not null,
  attempts int not null default 0,
  issued_count int not null default 1,
  used_at timestamptz,
  lat double precision,
  lng double precision,
  distance_m int,
  geo_status text check (geo_status in ('conforme', 'non_verifiable')),
  created_at timestamptz not null default now()
);
alter table public.arrival_codes enable row level security;
revoke all on table public.arrival_codes from anon, authenticated;

-- Le prestataire (position relevée avec son consentement, déjà comparée à l'adresse par /api/arrival)
-- demande un code. Le code n'est JAMAIS renvoyé au prestataire.
create or replace function public.request_arrival_code(
  p_transaction uuid, p_lat double precision, p_lng double precision,
  p_distance_m int default null, p_geo_status text default 'non_verifiable')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; c record; code text; exp timestamptz := now() + interval '15 minutes';
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Position invalide.';
  end if;
  if p_geo_status not in ('conforme', 'non_verifiable') then raise exception 'Statut de position invalide.'; end if;
  select id, seller_id, status, arrived_at into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de la mission.'; end if;
  if t.status <> 'pending' or t.arrived_at is not null then
    raise exception 'Cette mission est déjà commencée ou annulée.';
  end if;
  select * into c from public.arrival_codes where transaction_id = p_transaction;
  if found then
    if c.created_at > now() - interval '60 seconds' and c.used_at is null then
      return jsonb_build_object('ok', false, 'reason', 'throttled');
    end if;
    if c.issued_count >= 5 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  end if;
  code := lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.arrival_codes (transaction_id, code_hash, code_clair, expires_at, lat, lng, distance_m, geo_status)
    values (p_transaction, encode(sha256(convert_to(p_transaction::text || ':' || code, 'UTF8')), 'hex'), code, exp,
            p_lat, p_lng, p_distance_m, p_geo_status)
    on conflict (transaction_id) do update set
      code_hash = excluded.code_hash, code_clair = excluded.code_clair, expires_at = excluded.expires_at,
      attempts = 0, issued_count = public.arrival_codes.issued_count + 1, used_at = null,
      lat = excluded.lat, lng = excluded.lng, distance_m = excluded.distance_m,
      geo_status = excluded.geo_status, created_at = now();
  return jsonb_build_object('ok', true, 'expires_at', exp);
end $$;
revoke all on function public.request_arrival_code(uuid, double precision, double precision, int, text) from public, anon;
grant execute on function public.request_arrival_code(uuid, double precision, double precision, int, text) to authenticated;

-- Le CLIENT (acheteur) lit le code en cours de validité de SA mission.
create or replace function public.get_arrival_code(p_transaction uuid)
returns table (code text, expires_at timestamptz, geo_status text, distance_m int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.transactions t where t.id = p_transaction and t.buyer_id = uid) then
    raise exception 'Réservé au client de la mission.';
  end if;
  update public.arrival_codes ac set code_clair = null
    where ac.transaction_id = p_transaction and ac.code_clair is not null and (ac.used_at is not null or ac.expires_at <= now());
  return query select c.code_clair, c.expires_at, c.geo_status, c.distance_m
    from public.arrival_codes c
    where c.transaction_id = p_transaction and c.code_clair is not null and c.used_at is null and c.expires_at > now();
end $$;
revoke all on function public.get_arrival_code(uuid) from public, anon;
grant execute on function public.get_arrival_code(uuid) to authenticated;

-- Le prestataire saisit le code communiqué par le client. 5 essais, usage unique, 15 min.
-- Renvoie un jsonb (jamais d'exception sur un mauvais code, sinon le compteur d'essais serait annulé).
create or replace function public.arrive_with_code(p_transaction uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; c record; h text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, seller_id, status, arrived_at into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de la mission.'; end if;
  if t.status = 'cancelled' then raise exception 'Cette réservation a été annulée.'; end if;
  if t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into c from public.arrival_codes where transaction_id = p_transaction;
  if not found or c.used_at is not null or c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if c.attempts >= 5 then
    update public.arrival_codes set code_clair = null where transaction_id = p_transaction;
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  h := encode(sha256(convert_to(p_transaction::text || ':' || coalesce(trim(p_code), ''), 'UTF8')), 'hex');
  if h <> c.code_hash then
    update public.arrival_codes set attempts = attempts + 1,
      code_clair = case when attempts + 1 >= 5 then null else code_clair end
      where transaction_id = p_transaction;
    return jsonb_build_object('ok', false, 'reason', 'bad_code', 'remaining', greatest(0, 4 - c.attempts));
  end if;
  update public.transactions set arrived_at = now(), status = 'arrived', arrival_method = 'geoloc_code',
    arrival_lat = c.lat, arrival_lng = c.lng where id = p_transaction;
  update public.arrival_codes set used_at = now(), code_clair = null where transaction_id = p_transaction;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.arrive_with_code(uuid, text) from public, anon;
grant execute on function public.arrive_with_code(uuid, text) to authenticated;
