-- 024 — Annonce détaillée du particulier (Romain 31/10, « comme sur Airbnb ») : heures souhaitées,
-- kilos et types de linge, taille du foyer, surface, préférence de paiement (CESU / direct).
-- `frequency` reste un texte libre : ponctuel | hebdomadaire | 2_semaine | 3_semaine | bimensuel | mensuel
-- (les anciennes valeurs « ponctuel », « hebdomadaire », « mensuel » restent valides).
alter table public.requests add column if not exists hours_wanted numeric check (hours_wanted is null or (hours_wanted > 0 and hours_wanted <= 24));
alter table public.requests add column if not exists linen_kg numeric check (linen_kg is null or (linen_kg > 0 and linen_kg <= 100));
alter table public.requests add column if not exists linen_types text[];
alter table public.requests add column if not exists household_size text check (household_size is null or household_size in ('1', '2', '3-4', '5+'));
alter table public.requests add column if not exists surface_m2 integer check (surface_m2 is null or (surface_m2 > 0 and surface_m2 <= 2000));
alter table public.requests add column if not exists payment_pref text check (payment_pref is null or payment_pref in ('cesu', 'direct', 'indifferent'));

-- requests_nearby renvoie ces détails (même définition que 017 : SECURITY DEFINER, position floutée
-- ~500 m, jamais l'adresse, sans ses propres demandes, urgentes en tête).
drop function if exists public.requests_nearby(double precision, double precision, integer);
create function public.requests_nearby(p_lat double precision, p_lng double precision, radius_m integer default 15000)
returns table(id uuid, category text, title text, description text, budget_cents integer, budget_min_cents integer,
  budget_max_cents integer, desired_date date, desired_slot text, frequency text, urgent boolean,
  hours_wanted numeric, linen_kg numeric, linen_types text[], household_size text, surface_m2 integer, payment_pref text,
  lat double precision, lng double precision, distance_m double precision, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.category, r.title, r.description, r.budget_cents, r.budget_min_cents, r.budget_max_cents,
    r.desired_date, r.desired_slot, r.frequency, coalesce(r.urgent, false),
    r.hours_wanted, r.linen_kg, r.linen_types, r.household_size, r.surface_m2, r.payment_pref,
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
