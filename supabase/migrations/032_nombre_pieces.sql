-- Nombre de pièces du logement dans l'annonce du particulier (additif).
alter table public.requests add column if not exists nombre_pieces integer
  check (nombre_pieces is null or (nombre_pieces >= 0 and nombre_pieces <= 30));
-- requests_nearby (retour typé) n'est volontairement pas modifiée ici : l'étendre exige un DROP.
