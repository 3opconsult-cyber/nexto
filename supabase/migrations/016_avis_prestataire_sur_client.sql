-- 016 — Le prestataire note le client (30/10/2026, demande Romain)
--
-- Comme sur Airbnb (l'hôte évalue le voyageur) : après une mission terminée, le prestataire note le
-- client sur deux critères, peut cocher des remarques rapides (accès difficile, demande incomplète,
-- plus sale / plus propre que prévu…) et ajouter un mot. Il choisit :
--   · avis publié : visible des autres prestataires et du client concerné (équilibre les notes) ;
--   · note privée : visible de lui seul (pense-bête pour la prochaine fois).
-- Pas de pourboire ici. Table séparée de `reviews` (qui recalcule la note des prestataires). Idempotent.

create table if not exists public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,   -- le prestataire
  client_id uuid not null references auth.users(id) on delete cascade,  -- le client noté
  accuracy_stars integer check (accuracy_stars between 1 and 5),        -- la demande correspondait à la réalité
  welcome_stars integer check (welcome_stars between 1 and 5),          -- accueil, accès, ponctualité
  stars integer not null check (stars between 1 and 5),                 -- moyenne arrondie
  recommend boolean,                                                     -- retravailler pour ce client ?
  tags text[] not null default '{}',
  comment text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (transaction_id, rater_id)
);
alter table public.client_reviews enable row level security;

-- Seul le prestataire d'une mission terminée note le client de cette mission.
drop policy if exists "client_reviews seller insert" on public.client_reviews;
create policy "client_reviews seller insert" on public.client_reviews for insert with check (
  rater_id = auth.uid() and exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.seller_id = auth.uid() and t.buyer_id = client_id
      and t.buyer_id <> t.seller_id and t.status in ('completed', 'released')
  )
);
drop policy if exists "client_reviews author update" on public.client_reviews;
create policy "client_reviews author update" on public.client_reviews for update
  using (rater_id = auth.uid()) with check (rater_id = auth.uid());

-- Lecture : l'auteur voit tout ce qu'il a écrit ; un avis publié est lisible par le client concerné
-- et par tout prestataire (pour se faire une idée avant d'accepter une mission).
drop policy if exists "client_reviews read" on public.client_reviews;
create policy "client_reviews read" on public.client_reviews for select using (
  rater_id = auth.uid()
  or (is_public and (client_id = auth.uid() or exists (select 1 from public.provider_profiles p where p.id = auth.uid())))
);
grant select, insert, update on public.client_reviews to authenticated;
