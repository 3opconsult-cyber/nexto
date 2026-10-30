-- 017 — APPLIQUÉE le 30/10/2026 (MCP). Archive du SQL passé en prod.
-- 1. requests_nearby tournait avec les droits de l'appelant : la RLS de `requests` masquait toute
--    demande ouverte à un pro qui n'y avait pas encore répondu (« 0 demande autour de vous »).
--    SECURITY DEFINER, colonnes limitées (jamais l'adresse), position floutée (~500 m), sans ses
--    propres demandes, drapeau `urgent`, urgentes en tête.
-- 2. handle_new_user : is_pro NOT NULL, un compte créé sans `role` échouait (« Database error
--    saving new user »). Défaut particulier.
-- (016 client_reviews appliquée le même jour.)
drop function if exists public.requests_nearby(double precision, double precision, integer);
create function public.requests_nearby(p_lat double precision, p_lng double precision, radius_m integer default 15000)
returns table(id uuid, category text, title text, description text, budget_cents integer, budget_min_cents integer,
  budget_max_cents integer, desired_date date, desired_slot text, frequency text, urgent boolean,
  lat double precision, lng double precision, distance_m double precision, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.category, r.title, r.description, r.budget_cents, r.budget_min_cents, r.budget_max_cents,
    r.desired_date, r.desired_slot, r.frequency, coalesce(r.urgent, false),
    round(r.lat::numeric / 0.005) * 0.005 + ((('x' || substr(md5(r.id::text), 1, 4))::bit(16)::int % 100) - 50) * 0.00003,
    round(r.lng::numeric / 0.005) * 0.005 + ((('x' || substr(md5(r.id::text), 5, 4))::bit(16)::int % 100) - 50) * 0.00003,
    ST_Distance(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) as distance_m,
    r.created_at
  from public.requests r
  where r.status = 'open'
    and r.lat is not null and r.lng is not null
    and r.requester_id is distinct from auth.uid()
    and ST_DWithin(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
                   ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, radius_m)
  order by coalesce(r.urgent, false) desc, distance_m;
$$;
revoke all on function public.requests_nearby(double precision, double precision, integer) from public, anon;
grant execute on function public.requests_nearby(double precision, double precision, integer) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $function$
begin
  insert into public.profiles (id, full_name, first_name, last_name, phone_enc, birthdate, address, is_pro)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data->>'first_name','') || ' ' || coalesce(new.raw_user_meta_data->>'last_name','')),
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'birthdate','')::date,
    new.raw_user_meta_data->>'address',
    coalesce((new.raw_user_meta_data->>'role') = 'pro', false)
  )
  on conflict (id) do nothing;
  return new;
end $function$;
