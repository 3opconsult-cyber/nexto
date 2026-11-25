-- 066 : nombre de prestations réalisées par prestataire, pour le résumé d'épingle de la carte (demande de Romain, 26/11/2026).
-- NON APPLIQUÉE par Claude : à coller par Romain après 065. Ajout seulement (CREATE OR REPLACE), aucun DROP ni DELETE, rejouable.
-- Ne renvoie qu'un nombre par prestataire actif : ni client, ni adresse, ni montant. L'app fonctionne sans elle (l'aperçu
-- n'affiche alors que les étoiles et les avis).
create or replace function public.provider_done_counts(p_ids uuid[])
returns table(provider_id uuid, done_count integer)
language sql stable security definer set search_path to 'public' as $$
  select t.seller_id, count(*)::integer
  from public.transactions t
  join public.provider_profiles p on p.id = t.seller_id and p.is_active = true
  where t.seller_id = any(p_ids) and t.completed_at is not null and t.status is distinct from 'cancelled'
  group by t.seller_id;
$$;
grant execute on function public.provider_done_counts(uuid[]) to anon, authenticated;
