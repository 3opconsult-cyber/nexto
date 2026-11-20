-- 058 — Position d'intervention « Je suis ici aujourd'hui » (décision Romain 20/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/058_position_intervention.sql.
-- Uniquement des ajouts (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS) : aucune suppression,
-- ni de données ni d'objets. Rejouable sans risque. Peut être collée avant ou après 057 (indépendante).
--
-- Règle : le prestataire est visible à son domicile (provider_profiles.location, inchangé) ET, s'il le choisit,
-- à l'endroit où il intervient aujourd'hui. La règle « pas de GPS » est levée pour cette seule option volontaire :
--   * consentement enregistré (provider_private.live_zone_consent_at) avant toute position ;
--   * la position exacte N'EST JAMAIS enregistrée : set_live_zone() l'arrondit à une grille d'environ 500 m AVANT
--     d'écrire (seule la version floutée existe en base) ;
--   * 12 heures au plus (expires_at = maintenant + 12 h), arrêt à tout moment (clear_live_zone), arrêt automatique à
--     la fin ou à l'annulation de la mission liée ;
--   * jamais l'adresse du client : le libellé est un secteur (ville ou quartier), les chiffres en sont retirés.
--
-- Choix de conception :
--   * La table n'est PAS lisible ni inscriptible directement par le public : le prestataire écrit par RPC
--     (set_live_zone / clear_live_zone), lit la sienne (RLS), le public lit seulement par providers_live_zones().
--   * providers_nearby() n'est PAS modifiée : sa définition en production n'est pas dans le dépôt (paramètres p_lat / p_lng
--     posés hors migration) et ajouter une colonne à son résultat obligerait à la supprimer puis la recréer. Le second
--     repère vient donc d'une RPC séparée, providers_live_zones(p_lat, p_lng, radius_m, p_trade), que la carte appelle
--     en plus. Aucune ligne n'est supprimée : une zone terminée est seulement fermée (ended_at), sa ligne est réutilisée.

-- 1. Consentement ---------------------------------------------------------------------------------------------
alter table public.provider_private add column if not exists live_zone_consent_at timestamptz;
comment on column public.provider_private.live_zone_consent_at is 'Consentement du prestataire à partager un secteur d''intervention flouté (~500 m, 12 h max). Null = pas de consentement (058).';

-- 2. Zone d'intervention du jour ----------------------------------------------------------------------------
create table if not exists public.provider_live_zone (
  provider_id uuid primary key references auth.users(id),
  lat double precision not null,         -- déjà arrondie à ~500 m (jamais la position exacte)
  lng double precision not null,
  label text,                            -- secteur : ville ou quartier, sans chiffre
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,                  -- posé à l'arrêt volontaire ou automatique
  source text not null default 'manual' check (source in ('manual', 'mission')),
  transaction_id uuid                    -- mission liée (source = 'mission') : la zone s'arrête avec elle
);
create index if not exists provider_live_zone_expires_idx on public.provider_live_zone (expires_at);

alter table public.provider_live_zone enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'provider_live_zone' and policyname = 'live_zone self read') then
    create policy "live_zone self read" on public.provider_live_zone for select
      using (provider_id = auth.uid() or public.is_admin());
  end if;
end $$;
revoke all on public.provider_live_zone from anon, authenticated;
grant select on public.provider_live_zone to authenticated;   -- filtré par la policy : la sienne, ou admin

-- 3. Consentement : donner / retirer ---------------------------------------------------------------------------
create or replace function public.set_live_zone_consent(p_accept boolean) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_at timestamptz;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '28000'; end if;
  if not exists (select 1 from public.provider_profiles where id = v_uid) then
    raise exception 'Réservé aux prestataires.' using errcode = '42501';
  end if;
  v_at := case when p_accept then now() else null end;
  insert into public.provider_private (id, live_zone_consent_at) values (v_uid, v_at)
    on conflict (id) do update set live_zone_consent_at = excluded.live_zone_consent_at, updated_at = now();
  if not p_accept then
    update public.provider_live_zone set expires_at = least(expires_at, now()), ended_at = coalesce(ended_at, now())
      where provider_id = v_uid and ended_at is null;
  end if;
  return v_at;
end $$;
revoke execute on function public.set_live_zone_consent(boolean) from public, anon;
grant execute on function public.set_live_zone_consent(boolean) to authenticated;

-- 4. Poser la zone : arrondi côté base, 12 h, consentement obligatoire --------------------------------------------
-- Grille d'environ 550 m : 0,005° de latitude ; en longitude, 0,005° / cos(latitude) pour des cases à peu près carrées.
create or replace function public.set_live_zone(
  p_lat double precision, p_lng double precision, p_label text default null,
  p_source text default 'manual', p_transaction_id uuid default null)
returns table (lat double precision, lng double precision, label text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_step_lat constant double precision := 0.005;
  v_step_lng double precision;
  v_lat double precision;
  v_lng double precision;
  v_label text;
  v_src text := case when p_source = 'mission' then 'mission' else 'manual' end;
  v_tx uuid := null;
  v_exp timestamptz := now() + interval '12 hours';
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '28000'; end if;
  if not exists (select 1 from public.provider_profiles where id = v_uid) then
    raise exception 'Réservé aux prestataires.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.provider_private where id = v_uid and live_zone_consent_at is not null) then
    raise exception 'Consentement requis : acceptez le partage de votre secteur d''intervention avant de l''activer.' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Position invalide.' using errcode = '22023';
  end if;
  if v_src = 'mission' then
    -- La mission liée doit être celle du prestataire, en cours (pas terminée ni annulée).
    select t.id into v_tx from public.transactions t
      where t.id = p_transaction_id and t.seller_id = v_uid and t.status::text not in ('completed', 'cancelled', 'released', 'refunded');
    if v_tx is null then v_src := 'manual'; end if;
  end if;

  v_step_lng := v_step_lat / greatest(cos(radians(p_lat)), 0.2);
  v_lat := round(p_lat / v_step_lat) * v_step_lat;
  v_lng := round(p_lng / v_step_lng) * v_step_lng;
  -- Secteur : ni chiffre (numéro de rue, code postal), ni mot de plus de 60 signes.
  v_label := nullif(btrim(regexp_replace(left(coalesce(p_label, ''), 60), '[0-9]+', '', 'g')), '');
  v_label := nullif(btrim(regexp_replace(coalesce(v_label, ''), '\s{2,}', ' ', 'g'), ' ,-'), '');

  insert into public.provider_live_zone as z (provider_id, lat, lng, label, started_at, expires_at, ended_at, source, transaction_id)
  values (v_uid, round(v_lat::numeric, 6)::double precision, round(v_lng::numeric, 6)::double precision, v_label, now(), v_exp, null, v_src, v_tx)
  on conflict (provider_id) do update set lat = excluded.lat, lng = excluded.lng, label = excluded.label,
    started_at = excluded.started_at, expires_at = excluded.expires_at, ended_at = null,
    source = excluded.source, transaction_id = excluded.transaction_id;

  return query select z.lat, z.lng, z.label, z.expires_at from public.provider_live_zone z where z.provider_id = v_uid;
end $$;
revoke execute on function public.set_live_zone(double precision, double precision, text, text, uuid) from public, anon;
grant execute on function public.set_live_zone(double precision, double precision, text, text, uuid) to authenticated;

-- 5. Arrêter la zone (à tout moment) ----------------------------------------------------------------------------
create or replace function public.clear_live_zone() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '28000'; end if;
  update public.provider_live_zone set expires_at = least(expires_at, now()), ended_at = coalesce(ended_at, now())
    where provider_id = auth.uid() and ended_at is null;
end $$;
revoke execute on function public.clear_live_zone() from public, anon;
grant execute on function public.clear_live_zone() to authenticated;

-- 6. Arrêt automatique à la fin (ou annulation) de la mission liée ---------------------------------------------
create or replace function public.live_zone_end_with_mission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status::text in ('completed', 'cancelled', 'released', 'refunded') and old.status::text is distinct from new.status::text then
    update public.provider_live_zone set expires_at = least(expires_at, now()), ended_at = coalesce(ended_at, now())
      where transaction_id = new.id and ended_at is null;
  end if;
  return new;
exception when others then
  return new;   -- ne jamais bloquer le changement de statut d'une mission
end $$;
revoke execute on function public.live_zone_end_with_mission() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_live_zone_end_with_mission') then
    create trigger trg_live_zone_end_with_mission after update of status on public.transactions
      for each row execute function public.live_zone_end_with_mission();
  end if;
end $$;

-- 7. Lecture publique : seulement la version floutée, seulement ce qui est actif -----------------------------------
-- Même esprit que providers_nearby : paramètres p_lat / p_lng, rayon en mètres, filtre de métier facultatif.
-- Actif = zone non expirée, non arrêtée, prestataire visible (is_active). Distance : haversine, sans PostGIS.
create or replace function public.providers_live_zones(
  p_lat double precision, p_lng double precision, radius_m integer default 15000, p_trade text default null)
returns table (provider_id uuid, lat double precision, lng double precision, label text,
               started_at timestamptz, expires_at timestamptz, distance_m double precision,
               trade text, full_name text, avatar_hue integer)
language sql stable security definer set search_path = public as $$
  select z.provider_id, z.lat, z.lng, z.label, z.started_at, z.expires_at, d.distance_m,
         p.trade, pr.full_name, pr.avatar_hue
  from public.provider_live_zone z
  join public.provider_profiles p on p.id = z.provider_id
  join public.profiles pr on pr.id = z.provider_id
  cross join lateral (
    select 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(z.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(z.lat)) * power(sin(radians(z.lng - p_lng) / 2), 2)))) as distance_m
  ) d
  where z.ended_at is null and z.expires_at > now()
    and p.is_active = true
    and (p_trade is null or p.trade = p_trade)
    and d.distance_m <= radius_m
  order by d.distance_m
  limit 50
$$;
revoke execute on function public.providers_live_zones(double precision, double precision, integer, text) from public;
grant execute on function public.providers_live_zones(double precision, double precision, integer, text) to anon, authenticated;

-- Vérification :
--   select proname from pg_proc where proname in ('set_live_zone', 'clear_live_zone', 'set_live_zone_consent', 'providers_live_zones');
--   select * from public.providers_live_zones(43.66, 6.92, 20000, null);
--   select tgname from pg_trigger where tgname = 'trg_live_zone_end_with_mission';
