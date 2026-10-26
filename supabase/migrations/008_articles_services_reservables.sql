-- 008 — Catalogue d'articles réellement réservables (26/10/2026)
--
-- PAS ENCORE APPLIQUÉE — accès Supabase bloqué dans cette session (toute
-- requête, même en lecture, renvoie une erreur de permission). À appliquer
-- dès que l'accès est rétabli.
--
-- Demande de Romain : chaque article/service d'un prestataire doit porter
-- sa propre fiche de prix complète (forfait + heures incluses + taux
-- horaire au-delà, OU taux horaire pur) et une description — pas juste un
-- nom et un prix plat. `services` ne portait que (provider_id, name,
-- price_cents) : on lui ajoute les mêmes colonnes que provider_profiles
-- pour la tarification, afin que la réservation (mission/new) puisse
-- calculer le prix d'un article exactement comme pour le métier principal.
--
-- Idempotent.

alter table public.services
  add column if not exists description text,
  add column if not exists pricing_type pricing_type not null default 'forfait',
  add column if not exists base_price_cents integer not null default 0,
  add column if not exists included_hours numeric,
  add column if not exists hourly_rate_cents integer;

-- Les articles déjà créés via l'ancien formulaire (nom + prix plat) avaient
-- leur prix dans price_cents : on le reprend en forfait pour ne rien perdre.
update public.services
  set base_price_cents = price_cents, pricing_type = 'forfait'
  where base_price_cents = 0 and price_cents > 0;

comment on column public.services.price_cents is
  'Conservé pour compat (affichage simple côté admin) — le prix réel vient de base_price_cents/hourly_rate_cents/pricing_type depuis la migration 008.';
