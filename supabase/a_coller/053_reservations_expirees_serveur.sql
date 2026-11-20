-- 053 — Réservations expirées ou refusées : traitées par le serveur (demande Romain du 20/11/2026). NON APPLIQUÉE
-- par Claude. Copie identique dans supabase/a_coller/053_reservations_expirees_serveur.sql. À coller APRÈS 052.
-- Additive et idempotente : aucun DROP, aucun DELETE, aucune ligne existante modifiée.
--
-- Avant : expire_pending_bookings() (052) tournait par pg_cron toutes les 10 min sans e-mail ; seul le prestataire
-- qui ouvrait l'application prévenait le client par e-mail. Si personne n'ouvrait l'app, le client n'avait qu'un
-- message dans la conversation.
-- Après : la route serveur /api/bookings/expire (cron Vercel, protégée par CRON_SECRET, clé service) appelle
-- expire_pending_bookings() puis envoie l'e-mail « réservation expirée » à chaque client concerné, y compris pour
-- les réservations déjà expirées par pg_cron (repérées par booking_expired_unnotified(), dédoublonnées par
-- notification_log). Quand le paiement en ligne sera actif, la même route rembourse à 100 % une réservation
-- refusée ou expirée qui avait été payée (adaptateur du PSP, aucune action manuelle).
--
-- expire_pending_bookings() renvoie déjà les ids expirés (appel sans session : toutes les lignes) : elle n'est pas
-- réécrite. On ajoute seulement le droit d'exécution pour la clé service (le rôle service_role n'hérite pas
-- toujours du droit par défaut une fois `public` révoqué) et une fonction de lecture pour les e-mails en retard.

grant execute on function public.expire_pending_bookings() to service_role;

-- Réservations expirées (ou refusées) sans e-mail envoyé au client : celles expirées par pg_cron, ou dont l'envoi
-- a échoué. Fenêtre de 3 jours pour ne jamais réveiller de vieux dossiers. Réservée à la clé service.
create or replace function public.booking_ended_unnotified(p_since interval default interval '3 days')
returns table (transaction_id uuid, buyer_id uuid, seller_id uuid, booking_status text, ended_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.buyer_id, t.seller_id, t.booking_status, coalesce(t.expired_at, t.refused_at)
    from public.transactions t
   where t.booking_status in ('expiree', 'refusee')
     and coalesce(t.expired_at, t.refused_at) > now() - p_since
     and not exists (select 1 from public.notification_log n
                      where n.transaction_id = t.id and n.user_id = t.buyer_id
                        and n.event = case t.booking_status when 'expiree' then 'booking_expired' else 'booking_refused' end)
   order by coalesce(t.expired_at, t.refused_at)
   limit 200
$$;
revoke all on function public.booking_ended_unnotified(interval) from public, anon, authenticated;
grant execute on function public.booking_ended_unnotified(interval) to service_role;

create index if not exists transactions_booking_ended
  on public.transactions (booking_status, expired_at, refused_at) where booking_status in ('expiree', 'refusee');

-- Vérification : select * from public.booking_ended_unnotified();
