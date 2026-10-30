-- 018 — APPLIQUÉE le 30/10/2026 (MCP). Site internet du prestataire (Mon entreprise › Coordonnées).
-- Pas affiché aux clients pour l'instant (risque de contournement), à décider avec Romain.
alter table public.provider_profiles add column if not exists website text;
