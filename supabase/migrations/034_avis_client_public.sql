-- 034 — Le prestataire note et commente son client (02/11/2026, demande Romain)
--
-- 1) Le commentaire du prestataire sur son client est PUBLIABLE : quand `is_public` est vrai, la ligne
--    (note, remarques, commentaire) est lisible par tout utilisateur connecté. Policy additive : les
--    policies RLS se cumulent (OU), « client_reviews read » (016) reste en place. Une ligne
--    `is_public = false` reste lisible de son seul auteur.
-- 2) Note personnelle (jamais publiée) : table SÉPARÉE `client_private_notes`, car la RLS ne filtre
--    pas par colonne — une colonne `private_note` sur client_reviews aurait été lisible du client
--    concerné dès que l'avis est publié. Ici : lisible, modifiable et supprimable par le prestataire
--    auteur seulement. Ni le client, ni les autres prestataires, ni l'admin via l'API publique.
-- Additive et idempotente : aucun DROP de table ni de colonne.

-- 1. Lecture publique des commentaires publiés (utilisateurs connectés).
alter table public.client_reviews add column if not exists is_public boolean not null default false;
drop policy if exists "client_reviews public read" on public.client_reviews;
create policy "client_reviews public read" on public.client_reviews for select to authenticated
  using (is_public = true);

-- 2. Notes personnelles du prestataire sur un client.
create table if not exists public.client_private_notes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, transaction_id)
);
create index if not exists client_private_notes_seller_client on public.client_private_notes (seller_id, client_id);
alter table public.client_private_notes enable row level security;

drop policy if exists "client_private_notes seller read" on public.client_private_notes;
create policy "client_private_notes seller read" on public.client_private_notes for select
  using (seller_id = auth.uid());

-- Seul le prestataire de la mission écrit une note, sur le client de cette mission.
drop policy if exists "client_private_notes seller insert" on public.client_private_notes;
create policy "client_private_notes seller insert" on public.client_private_notes for insert
  with check (
    seller_id = auth.uid() and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.seller_id = auth.uid() and t.buyer_id = client_id
        and t.buyer_id <> t.seller_id)
  );

drop policy if exists "client_private_notes seller update" on public.client_private_notes;
create policy "client_private_notes seller update" on public.client_private_notes for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

drop policy if exists "client_private_notes seller delete" on public.client_private_notes;
create policy "client_private_notes seller delete" on public.client_private_notes for delete
  using (seller_id = auth.uid());

revoke all on public.client_private_notes from anon;
grant select, insert, update, delete on public.client_private_notes to authenticated;
