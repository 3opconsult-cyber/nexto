-- Supprime TOUTES les données fictives de démonstration (à coller dans l'éditeur SQL Supabase
-- le jour où on n'en a plus besoin). Repère : titre de demande « Exemple — … » ou description
-- « (Donnée fictive de démonstration) ». Les factures, messages, avis, litiges et notes client
-- partent en cascade avec les missions ; le compte des prestataires/clients fictifs est conservé.
begin;
create temp table _fictives as
  select t.id from public.transactions t join public.requests r on r.id = t.request_id
  where r.title like 'Exemple —%' or r.description like '%(Donnée fictive de démonstration)%';
delete from public.client_reviews where transaction_id in (select id from _fictives);
delete from public.reviews        where transaction_id in (select id from _fictives);
delete from public.disputes       where transaction_id in (select id from _fictives);
delete from public.invoices       where transaction_id in (select id from _fictives);
delete from public.messages       where transaction_id in (select id from _fictives);
update public.provider_slots set transaction_id = null where transaction_id in (select id from _fictives);
delete from public.transactions   where id in (select id from _fictives);
delete from public.requests where title like 'Exemple —%' or description like '%(Donnée fictive de démonstration)%';
-- Recalcule la note des prestataires concernés.
update public.provider_profiles p set
  rating = coalesce((select round(avg(stars)::numeric, 1) from public.reviews where ratee_id = p.id), 0),
  reviews_count = (select count(*) from public.reviews where ratee_id = p.id);
commit;
