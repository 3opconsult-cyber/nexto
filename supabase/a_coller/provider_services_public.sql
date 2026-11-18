-- PROPOSÉ, NON APPLIQUÉ (à coller dans l'éditeur SQL Supabase après relecture).
--
-- Carte client multi-activités (/map) : pour savoir qu'un prestataire fait aussi « Vitres » ou
-- « Repassage » en plus de son métier principal (provider_profiles.trade), le client lit les noms
-- de ses prestations du catalogue `services` (/pro/tarifs). La RLS de `services` n'est décrite dans
-- aucune migration du dépôt ; cette fonction rend la lecture indépendante de cette RLS, en ne
-- sortant QUE l'identifiant du prestataire et le nom de la prestation (ni prix, ni description).
-- Le code client (fetchProviderActivities, src/lib/services.ts) l'utilise si elle existe et se
-- replie sinon sur une lecture directe de `services`, puis sur le seul métier principal.

create or replace function public.provider_services_public(p_provider_ids uuid[])
returns table (provider_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.provider_id, s.name
  from public.services s
  where s.provider_id = any (p_provider_ids)
  limit 2000
$$;

revoke all on function public.provider_services_public(uuid[]) from public;
grant execute on function public.provider_services_public(uuid[]) to anon, authenticated;
