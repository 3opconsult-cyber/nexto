-- 035 — corrige l'ambiguïté de colonne (expires_at) dans get_arrival_code (400 à chaque appel).
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
