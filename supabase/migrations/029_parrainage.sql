-- 029 — Parrainage réel (audit du 31/10/2026, point 7).
-- Avant : l'inscription avec un code (?ref=) cherchait le parrain dans profiles, dont la lecture est
-- réservée à chacun (RLS self-read) : le parrain n'était JAMAIS retrouvé, rien n'était enregistré.
-- Et le décompte « parrainages aboutis » lisait les missions du filleul, illisibles pour le parrain.
-- Additif seulement (aucun DROP).

-- 1. Enregistrer un filleul : seul chemin d'écriture (le serveur retrouve le parrain à la place du client).
create or replace function public.register_referral(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_referrer uuid;
  v_name text;
  v_created timestamptz;
begin
  if uid is null or p_code is null or length(btrim(p_code)) < 3 or length(p_code) > 40 then return null; end if;

  -- Un filleul n'est enregistré qu'une fois (referrals.referred_id est unique).
  if exists (select 1 from public.referrals where referred_id = uid) then return null; end if;

  -- Seulement pour un compte tout neuf (14 jours) : on ne parraine pas quelqu'un déjà installé.
  select created_at into v_created from public.profiles where id = uid;
  if v_created is null or v_created < now() - interval '14 days' then return null; end if;

  select id, first_name into v_referrer, v_name
  from public.profiles
  where upper(referral_code) = upper(btrim(p_code))
  order by created_at
  limit 1;

  if v_referrer is null or v_referrer = uid then return null; end if;

  insert into public.referrals (referrer_id, referred_id) values (v_referrer, uid)
  on conflict (referred_id) do nothing;

  return coalesce(nullif(btrim(v_name), ''), 'un membre PING');
end $$;
revoke execute on function public.register_referral(text) from public, anon;
grant execute on function public.register_referral(text) to authenticated;

-- 2. Chiffres réels du parrain : inscrits, filleuls ayant terminé une mission, récompenses utilisées.
create or replace function public.my_referral_stats() returns table (registered int, completed int, rewards_used int)
language sql stable security definer set search_path = public as $$
  select
    count(*)::int,
    count(*) filter (where exists (
      select 1 from public.transactions t
      where (t.buyer_id = r.referred_id or t.seller_id = r.referred_id)
        and t.status in ('completed', 'released')))::int,
    count(*) filter (where r.reward_used_at is not null)::int
  from public.referrals r
  where r.referrer_id = auth.uid();
$$;
revoke execute on function public.my_referral_stats() from public, anon;
grant execute on function public.my_referral_stats() to authenticated;

-- 3. Plus d'insertion directe dans referrals : on passait n'importe quel parrain en appel API direct.
--    (la fonction ci-dessus est SECURITY DEFINER et n'a pas besoin de cette règle)
alter policy "referrals insert as referred" on public.referrals with check (false);
