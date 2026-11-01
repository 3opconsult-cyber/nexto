-- 031 : corrections de l'audit (additif, sans DROP ni DELETE)
-- (a) admin_leads() : provider_profiles est cle par id (pas de user_id).
create or replace function public.admin_leads()
returns table (
  id uuid, prenom text, nom text, type text, email text, telephone text,
  zone text, canal text, campagne text, contenu text,
  inscrit_le timestamptz, statut text
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'access denied'; end if;
  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    case when p.is_pro then 'pro' else 'particulier' end,
    u.email::text,
    p.phone_enc,
    p.city,
    coalesce(a.utm_source, 'direct'),
    a.utm_campaign,
    a.utm_content,
    p.created_at,
    case
      when exists (select 1 from transactions t
                   where t.buyer_id = p.id or t.seller_id = p.id) then 'actif'
      when p.is_pro and exists (select 1 from provider_profiles pp
                   where pp.id = p.id and pp.is_active) then 'inscrit'
      when p.is_pro then 'kyc_en_cours'
      else 'nouveau'
    end
  from profiles p
  join auth.users u on u.id = p.id
  left join signup_attributions a on a.user_id = p.id
  where coalesce(p.is_admin, false) = false
  order by p.created_at desc;
end;
$$;

-- (b) l'admin peut geocoder les demandes (ecriture lat/lng depuis /admin).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'requests' and policyname = 'requests admin update') then
    create policy "requests admin update" on public.requests
      for update using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
