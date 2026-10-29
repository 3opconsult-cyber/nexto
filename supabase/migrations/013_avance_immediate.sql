-- 013 — Avance immédiate du crédit d'impôt (API Tiers de prestation, Urssaf) — 29/10/2026
--
-- Prépare le branchement : rien ne s'active tant que les identifiants Urssaf (URSSAF_CLIENT_ID /
-- URSSAF_CLIENT_SECRET) ne sont pas renseignés côté Vercel. Idempotent.
--
-- Rappel de l'invariant : les montants restent déclaratifs tant que le paiement en ligne n'est pas
-- branché ; l'avance immédiate ne fait que réduire la part à la charge du client (50 %).

-- Numéro SAP (déclaration NOVA) du prestataire : sans lui, ses prestations ne sont pas éligibles.
alter table public.provider_profiles
  add column if not exists sap_number text;

-- Inscription du particulier auprès de l'Urssaf (l'Urssaf renvoie un idClient ; le particulier active
-- ensuite son compte en ligne depuis le courriel de l'Urssaf).
create table if not exists public.avance_immediate_clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  urssaf_id_client text,
  date_naissance date,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'inscrit', 'actif', 'refuse')),
  message text,
  updated_at timestamptz not null default now()
);
alter table public.avance_immediate_clients enable row level security;
drop policy if exists "aic self" on public.avance_immediate_clients;
create policy "aic self" on public.avance_immediate_clients for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.avance_immediate_clients to authenticated;

-- Une demande de paiement par mission terminée.
create table if not exists public.avance_immediate_demandes (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  id_demande_paiement text,
  statut text not null default 'transmise',
  montant_cents integer not null,
  part_client_cents integer not null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.avance_immediate_demandes enable row level security;
drop policy if exists "aid parties read" on public.avance_immediate_demandes;
create policy "aid parties read" on public.avance_immediate_demandes for select
  using (exists (select 1 from public.transactions t where t.id = transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));
drop policy if exists "aid seller write" on public.avance_immediate_demandes;
create policy "aid seller write" on public.avance_immediate_demandes for all
  using (exists (select 1 from public.transactions t where t.id = transaction_id and t.seller_id = auth.uid()))
  with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.seller_id = auth.uid()));
grant select, insert, update on public.avance_immediate_demandes to authenticated;

-- Ce dont le prestataire a besoin pour transmettre la demande (identifiant Urssaf et date de
-- naissance du client), sans lui ouvrir la table : uniquement pour SA mission terminée.
create or replace function public.avance_immediate_context(p_transaction uuid)
returns table (id_client text, date_naissance date, category text, sap_number text)
language sql
security definer
set search_path = public
as $$
  select c.urssaf_id_client, c.date_naissance, r.category, pp.sap_number
  from public.transactions t
  join public.avance_immediate_clients c on c.user_id = t.buyer_id
  left join public.requests r on r.id = t.request_id
  join public.provider_profiles pp on pp.id = t.seller_id
  where t.id = p_transaction and t.seller_id = auth.uid()
$$;
revoke all on function public.avance_immediate_context(uuid) from public;
grant execute on function public.avance_immediate_context(uuid) to authenticated;
