-- 021 — APPLIQUÉE le 31/10/2026 (MCP). Fil dédié à chaque litige (table dispute_messages, RLS parties +
-- admin, kind 'mediation' réservé à PING, écriture des parties seulement tant que le litige est ouvert),
-- fonction is_dispute_party(), et fil initial des litiges existants (motif, réponse, décision).
-- Voir la migration appliquée dans l'historique Supabase pour le SQL exact.
create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  kind text not null default 'text' check (kind in ('text', 'system', 'mediation')),
  created_at timestamptz not null default now()
);
