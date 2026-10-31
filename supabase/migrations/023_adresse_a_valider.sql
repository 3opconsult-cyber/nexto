-- 023 — APPLIQUÉE le 31/10/2026 (MCP). Adresse d'intervention : celle du profil par défaut ; une autre
-- adresse est soumise au prestataire (qui la voit sans numéro) : a_valider -> acceptee | refusee.
alter table public.transactions add column if not exists address_status text not null default 'profil'
  check (address_status in ('profil', 'a_valider', 'acceptee', 'refusee'));
-- + trigger trg_guard_address_status : seul le prestataire accepte/refuse, seul le client propose.
