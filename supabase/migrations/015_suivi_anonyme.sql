-- 015 — Suivi des visiteurs non connectés (30/10/2026)
--
-- Constaté en test réel : un visiteur non connecté (scan d'un sticker / QR, plaquette, page d'accueil)
-- ne peut pas écrire dans `events` (« permission denied for table events ») : toute l'attribution
-- marketing avant inscription était perdue. On autorise l'insertion anonyme, sans identifiant
-- utilisateur, et rien d'autre (pas de lecture). Idempotent.
grant insert on public.events to anon;
drop policy if exists "events anon insert" on public.events;
create policy "events anon insert" on public.events for insert to anon with check (user_id is null);
