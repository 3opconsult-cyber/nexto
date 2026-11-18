-- 047 — Commission après un arrangement à l'amiable : réglage préparé, DÉSACTIVÉ (18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/047_commission_sur_avoir.sql.
-- Une seule ligne de réglage, idempotente (ON CONFLICT DO NOTHING), sans DROP ni DELETE.
--
-- Décision EN ATTENTE de Romain : après un avoir (migration 040, arrangement à l'amiable), les frais de
-- service du client (PING-C) et la commission du prestataire (PING-V) doivent-ils être recalculés sur le
-- montant après avoir, ou rester ceux de la réservation ?
--
-- Aujourd'hui (040) : ils restent inchangés. Cette migration NE CHANGE RIEN à ce comportement : elle pose
-- seulement le réglage `commission_on_credit` à false, pour que la décision, une fois prise, se branche
-- sans nouvelle colonne. Aucun code (ni base, ni app) ne lit encore ce réglage.
--
-- Valeurs prévues :
--   false (défaut) : commissions de la réservation conservées après un avoir (comportement actuel) ;
--   true           : à coder le jour où Romain tranche — avoir proportionnel sur PING-C et PING-V
--                    (taux figés de la mission appliqués au montant de l'avoir), virements PING ajustés.
-- Ne pas passer à true tant que ce code n'existe pas : le réglage seul n'a aucun effet.

insert into public.app_settings (key, value)
values ('commission_on_credit', 'false'::jsonb)
on conflict (key) do nothing;
