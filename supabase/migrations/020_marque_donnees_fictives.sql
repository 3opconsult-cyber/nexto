-- 020 — APPLIQUÉE le 31/10/2026 (MCP). Marque explicite des données fictives.
alter table public.requests     add column if not exists fictif boolean not null default false;
alter table public.transactions add column if not exists fictif boolean not null default false;
update public.requests r set fictif = true where r.title like 'Exemple —%' or r.description like '%(Donnée fictive de démonstration)%' or r.description like 'Demande de démonstration%' or exists (select 1 from auth.users u where u.id = r.requester_id and (u.email like '%@ping-demo.invalid' or u.email like '%@ping-fixtures.internal'));
update public.transactions t set fictif = true where exists (select 1 from public.requests r where r.id = t.request_id and r.fictif) or exists (select 1 from auth.users u where u.id in (t.buyer_id, t.seller_id) and (u.email like '%@ping-demo.invalid' or u.email like '%@ping-fixtures.internal'));
create index if not exists transactions_fictif_idx on public.transactions (fictif) where fictif;
