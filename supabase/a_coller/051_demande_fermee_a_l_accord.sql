-- 051 — Demande publiée fermée dès qu'une proposition est acceptée (audit ergonomie 19/11, correction 1).
-- NON APPLIQUÉE par Claude (accès SQL refusé le 19/11) : à coller depuis supabase/a_coller/ (copie exacte).
-- Avant : l'acceptation d'un devis validait le prix sur la transaction mais laissait la demande liée en
-- « open » : elle restait dans « Demandes autour de vous » (requests_nearby filtre status = 'open') après
-- l'accord et même après la fin de la mission. L'application passe déjà la demande en « matched » quand
-- c'est le client qui accepte (RLS : l'auteur modifie sa demande) ; le prestataire qui accepte une
-- contre-offre n'a pas ce droit. Deux filets, idempotents, sans DROP ni DELETE :
--   1. trigger sur transactions.price_confirmed (false -> true) : couvre tous les chemins ;
--   2. RPC match_request_on_accept, appelée par src/lib/offers.ts quand l'écriture directe est refusée.
-- Vérification : select proname from pg_proc where proname in ('match_request_on_accept', '_request_matched_on_price');

create or replace function public._request_matched_on_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.request_id is not null and new.price_confirmed and not coalesce(old.price_confirmed, false) then
    update public.requests set status = 'matched' where id = new.request_id and status = 'open';
  end if;
  return new;
end;
$$;

create or replace trigger trg_request_matched_on_price
  after update of price_confirmed on public.transactions
  for each row execute function public._request_matched_on_price();

create or replace function public.match_request_on_accept(p_transaction uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select id, request_id, buyer_id, seller_id, price_confirmed into t from public.transactions where id = p_transaction;
  if t.id is null or auth.uid() is null or auth.uid() not in (t.buyer_id, t.seller_id) then return false; end if;
  if not t.price_confirmed or t.request_id is null then return false; end if;
  update public.requests set status = 'matched' where id = t.request_id and status = 'open';
  return found;
end;
$$;
revoke all on function public.match_request_on_accept(uuid) from public, anon;
grant execute on function public.match_request_on_accept(uuid) to authenticated;

-- Rattrapage : demandes encore « open » alors qu'une de leurs transactions a un prix validé.
update public.requests r set status = 'matched'
where r.status = 'open'
  and exists (select 1 from public.transactions t where t.request_id = r.id and t.price_confirmed and t.status <> 'cancelled');
