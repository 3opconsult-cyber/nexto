-- ============================================================================
-- PING — Migration 003 (13/08/2026, suite de session)
-- Corrige trois problemes trouves en auditant le parcours carte + onboarding pro.
-- ============================================================================

-- 1) providers_nearby() ne renvoyait pas lat/lng : impossible de placer un pin
--    sur une vraie carte. La page /map n'affichait d'ailleurs aucune carte
--    visuelle (juste une liste) — corrige cote front (Leaflet + OpenStreetMap,
--    gratuit, sans cle) en meme temps que ce correctif.
DROP FUNCTION IF EXISTS public.providers_nearby(double precision, double precision, integer, text);

CREATE FUNCTION public.providers_nearby(
  lat double precision, lng double precision, radius_m integer DEFAULT 15000, p_trade text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, trade text, legal_status legal_status, base_price_cents integer,
  rating numeric, reviews_count integer, is_active boolean, distance_m double precision,
  bio text, lat double precision, lng double precision,
  pricing_type pricing_type, hourly_rate_cents integer
)
LANGUAGE sql
STABLE
AS $function$
  select p.id, p.trade, p.legal_status, p.base_price_cents, p.rating, p.reviews_count, p.is_active,
    ST_Distance(p.location, ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography) as distance_m,
    p.bio,
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng,
    p.pricing_type, p.hourly_rate_cents
  from provider_profiles p
  where p.is_active = true
    and p.location is not null
    and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography, radius_m)
    and (p_trade is null or p.trade = p_trade)
  order by distance_m
  limit 50;
$function$;

-- 2) L'onboarding pro ne capturait jamais la position (lat/lng/location) du
--    prestataire : meme corrigee, la carte n'aurait jamais montre aucun
--    prestataire reel, faute de coordonnees enregistrees. L'onboarding
--    redesigne capture desormais la position (bouton "Utiliser ma position
--    actuelle") et une raison sociale (nouvelle colonne).
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS company_name text;

-- 3) Le bucket Storage "documents" (pieces d'identite, assurances...) etait
--    marque PUBLIC : accessible par URL directe sans authentification,
--    malgre des policies RLS correctes sur storage.objects (qui ne
--    protegent que l'acces via l'API/SDK, pas la diffusion "publique"
--    directe qu'active ce flag). Or la page /pro/onboarding/documents
--    affirme explicitement "stockage prive, visible uniquement par vous et
--    l'equipe PING" — c'etait faux jusqu'a ce correctif.
UPDATE storage.buckets SET public = false WHERE id = 'documents';

DROP POLICY IF EXISTS "documents admin storage read" ON storage.objects;
CREATE POLICY "documents admin storage read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND public.is_admin());
