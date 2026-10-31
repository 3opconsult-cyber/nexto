-- Supprime TOUTES les données fictives de démonstration, le jour du lancement réel.
-- À coller dans l'éditeur SQL Supabase : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new
--
-- Repère : colonne `fictif` (migration 020) sur `transactions` et `requests`, posée sur tout ce qui
-- concerne les comptes de démonstration (@ping-demo.invalid) ou porte un titre « Exemple — … ».
-- Factures, messages, avis, notes sur les clients et litiges des missions fictives partent avec elles.
-- Les comptes de démonstration eux-mêmes (fictif1..10, audit.*, client.demo*) sont conservés :
-- les supprimer depuis Authentication > Users si on n'en veut plus.
--
-- Vérifier d'abord ce qui partira :
--   select count(*) from transactions where fictif;   select count(*) from requests where fictif;
begin;
create temp table _fictives as select id from public.transactions where fictif;
delete from public.client_reviews   where transaction_id in (select id from _fictives);
delete from public.reviews          where transaction_id in (select id from _fictives);
delete from public.disputes         where transaction_id in (select id from _fictives);
delete from public.invoices         where transaction_id in (select id from _fictives);
delete from public.messages         where transaction_id in (select id from _fictives);
delete from public.commission_debts where transaction_id in (select id from _fictives);
update public.provider_slots set transaction_id = null where transaction_id in (select id from _fictives);
delete from public.transactions     where id in (select id from _fictives);
delete from public.requests         where fictif;
-- Notes des prestataires recalculées sans les avis fictifs.
update public.provider_profiles p set
  rating = coalesce((select round(avg(stars)::numeric, 1) from public.reviews where ratee_id = p.id), 0),
  reviews_count = (select count(*) from public.reviews where ratee_id = p.id);
commit;
