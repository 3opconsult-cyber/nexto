-- 009 — Fiche établissement : photo de couverture + logo (26/10/2026)
--
-- Appliquée directement (voir message). Idempotent.
--
-- Demande de Romain : une fiche prestataire façon Google Établissement —
-- photo + logo, simple à ajouter. Le bucket storage `avatars` existait déjà
-- (public en lecture, upload restreint au dossier de son propre uid) mais
-- n'était branché nulle part dans le code. On ajoute juste les deux colonnes
-- qui stockent les URLs publiques une fois l'image envoyée.

alter table public.provider_profiles
  add column if not exists photo_url text,
  add column if not exists logo_url text;
