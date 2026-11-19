-- Nettoyage des données de test QA des 18-19/11/2026 (comptes audit uniquement).
-- Rien n'est supprimé : les missions de test sont marquées fictives (masquées des chiffres réels
-- de l'admin), les litiges de test sont clos.

-- 1. Missions et demandes de test (titres « QA … ») marquées fictives
update public.requests set fictif = true where title like 'QA %';
update public.transactions t set fictif = true
  from public.requests r where t.request_id = r.id and r.title like 'QA %';

-- 2. Litiges de test encore ouverts : clos
update public.disputes set status = 'rejected', closed_at = now()
 where status = 'open' and (id::text like 'ce9d254f%' or id::text like '9ab46fb6%' or id::text like '0b11d8c9%');

-- 3. Réponse « absent » posée par erreur sur la mission fictive 452286d0 : remise à vide
update public.transactions set client_presence = null, client_presence_at = null
 where id::text like '452286d0%';

-- Vérification
select (select count(*) from public.transactions t join public.requests r on r.id = t.request_id
         where r.title like 'QA %' and not t.fictif) as qa_non_fictives,
       (select count(*) from public.disputes where status = 'open'
         and (id::text like 'ce9d254f%' or id::text like '9ab46fb6%')) as litiges_qa_ouverts;
