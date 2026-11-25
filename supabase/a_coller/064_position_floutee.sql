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
