-- 062 — Alertes d'argent et de litige dans l'admin (pastille + e-mail des cas graves) et chat en direct
-- (demande Romain 22/11/2026). NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/062_alertes_admin_et_chat_direct.sql.
-- À coller APRÈS 061 (et donc après 057 : la table admin_notifications doit exister ; 054 et 059 de préférence).
-- Uniquement des ajouts : CREATE OR REPLACE, CREATE ... IF NOT EXISTS, ALTER PUBLICATION ... ADD TABLE. Aucune instruction
-- qui retire un objet ou une ligne. Rejouable sans risque.
--
-- Contenu
--   1. Chat en direct : public.messages (et public.dispute_messages si elle existe) ajoutées à la publication
--      supabase_realtime si elles n'y sont pas déjà. Sans publication (base hors Supabase) : simple avis, aucune erreur.
--   2. Toute nouvelle ligne de payment_alerts (annulation après l'arrivée, annulation tardive, prestataire absent, prestataire
--      qui annule trop, virement non reçu, désaccord, commission en retard, compte suspendu, incidents du séquestre) crée une
--      alerte admin_notifications (kind 'payment_alert', même table que les pièces de 057), titre en français, ids seulement.
--      Traitée automatiquement quand payment_alerts.handled_at est posé (bouton « Traitée » de /admin/paiements).
--   3. Litige ouvert (kind 'dispute_open') et intervention de PING demandée (kind 'dispute_mediation') : même table ;
--      traitées automatiquement quand le litige est clos (résolu, non retenu, ou closed_at posé).
--   4. admin_alert_counts() : compteurs par catégorie pour les pastilles (admin seulement).
--   5. Rattrapage : les alertes et litiges déjà ouverts apparaissent dans la file, marqués « e-mail envoyé » (pas de rafale).
--
-- Tolérance : les triggers ont leur propre bloc d'exception. Une alerte ratée ne fait JAMAIS échouer l'opération principale
-- (annulation, virement, litige). Aucune donnée personnelle copiée : ni nom, ni note libre, ni adresse ; seulement des ids,
-- le code de l'alerte et sa gravité.
-- L'e-mail à PING des cas graves part du cron quotidien /api/bookings/expire (sendPaymentAlerts, src/lib/notifyServer.ts),
-- une seule fois par alerte (emailed_at), jamais pour les comptes de démonstration (.invalid).

-- 0. Prérequis -----------------------------------------------------------------------------------------------------------
do $$ begin
  if to_regclass('public.admin_notifications') is null then
    raise exception 'Migration 057 absente : collez d''abord 057_alertes_admin_pieces.sql, puis 062.';
  end if;
end $$;

-- 1. Chat en direct ------------------------------------------------------------------------------------------------------
do $$
declare
  v_t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime absente : rien à ajouter (base hors Supabase).';
    return;
  end if;
  foreach v_t in array array['messages', 'dispute_messages'] loop
    if to_regclass('public.' || v_t) is not null
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_t) then
      begin
        execute format('alter publication supabase_realtime add table public.%I', v_t);
        raise notice 'Table public.% ajoutée à supabase_realtime.', v_t;
      exception when others then
        raise notice 'Table public.% non ajoutée à supabase_realtime : %', v_t, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- 2. Une seule alerte ouverte par source -----------------------------------------------------------------------------------
-- Les index uniques de 057 et 061 sont partiels (kind = 'document_pending', 'document_expiring', 'controle_nuit') :
-- ils ne bloquent pas les nouveaux kinds. Ceux-ci ont les leurs.
create unique index if not exists admin_notifications_one_open_payment
  on public.admin_notifications (ref_id) where kind = 'payment_alert' and handled_at is null;
create unique index if not exists admin_notifications_one_open_dispute
  on public.admin_notifications (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null;
create index if not exists admin_notifications_kind_open_idx
  on public.admin_notifications (kind) where handled_at is null;

-- 3. Libellés et gravité (même vocabulaire que src/lib/adminAlerts.ts) -----------------------------------------------------
create or replace function public._payment_alert_label(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind
    when 'cancel_after_arrival' then 'Annulation après l''arrivée du prestataire'
    when 'late_cancellation_fees' then 'Annulation tardive aux frais du client'
    when 'provider_no_show' then 'Prestataire absent déclaré'
    when 'provider_cancellations' then 'Prestataire : annulations répétées'
    when 'transfer_not_received' then 'Virement signalé non reçu'
    when 'transfer_disagreement' then 'Virement : désaccord, le payeur maintient'
    when 'transfer_overdue' then 'Commission par virement en retard'
    when 'suspended' then 'Compte prestataire suspendu'
    when 'unsuspended' then 'Suspension levée'
    when 'mandate_revoked' then 'Mandat de prélèvement révoqué'
    when 'mandate_failed' then 'Mandat de prélèvement refusé'
    when 'debit_rejected' then 'Prélèvement de commission rejeté'
    when 'chargeback' then 'Opposition d''un client'
    when 'refund_failed' then 'Remboursement en ligne échoué'
    else 'Alerte de paiement : ' || coalesce(p_kind, 'inconnue') end
$$;
revoke execute on function public._payment_alert_label(text) from public, anon, authenticated;

-- Cas graves : e-mail à PING (en plus de la pastille).
create or replace function public._payment_alert_grave(p_kind text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_kind in ('cancel_after_arrival', 'provider_no_show', 'transfer_disagreement', 'suspended',
                             'mandate_revoked', 'mandate_failed', 'debit_rejected', 'chargeback', 'refund_failed'), false)
$$;
revoke execute on function public._payment_alert_grave(text) from public, anon, authenticated;

-- 4. Trigger sur payment_alerts ------------------------------------------------------------------------------------------
create or replace function public.payment_alerts_admin_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_grave boolean;
begin
  if tg_op = 'INSERT' then
    v_grave := public._payment_alert_grave(new.kind);
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, handled_at)
    values ('payment_alert', new.provider_id, new.id, public._payment_alert_label(new.kind),
            jsonb_build_object('categorie', 'paiement', 'payment_kind', new.kind,
                               'gravite', case when v_grave then 'grave' else 'normal' end,
                               'transaction_id', new.detail ->> 'transactionId',
                               'transfer_id', new.detail ->> 'transferId'),
            new.handled_at)
    on conflict (ref_id) where kind = 'payment_alert' and handled_at is null do nothing;
  elsif tg_op = 'UPDATE' and new.handled_at is not null and old.handled_at is null then
    update public.admin_notifications set handled_at = new.handled_at
     where kind = 'payment_alert' and ref_id = new.id and handled_at is null;
  end if;
  return null;
exception when others then
  return null;  -- une alerte ratée ne doit jamais empêcher une annulation, un virement ou une suspension
end $$;
revoke execute on function public.payment_alerts_admin_notify() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.payment_alerts') is not null
     and not exists (select 1 from pg_trigger where tgname = 'trg_payment_alerts_admin_notify'
                      and tgrelid = 'public.payment_alerts'::regclass) then
    create trigger trg_payment_alerts_admin_notify after insert or update of handled_at on public.payment_alerts
      for each row execute function public.payment_alerts_admin_notify();
  end if;
end $$;

-- 5. Trigger sur disputes ------------------------------------------------------------------------------------------------
-- Colonnes lues par to_jsonb : le trigger reste valable si 040 (closed_at) ou 054 (mediation_requested_at) manquent.
create or replace function public.disputes_admin_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_open boolean;
  v_was_open boolean;
  v_opener uuid;
  v_detail jsonb;
begin
  v_open := coalesce(v_new ->> 'status', '') = 'open' and (v_new ->> 'closed_at') is null;
  begin v_opener := nullif(v_new ->> 'opener_id', '')::uuid; exception when others then v_opener := null; end;
  v_detail := jsonb_build_object('categorie', 'litige', 'transaction_id', v_new ->> 'transaction_id');

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_was_open := coalesce(v_old ->> 'status', '') = 'open' and (v_old ->> 'closed_at') is null;
  else
    v_was_open := false;
  end if;

  if v_open then
    if not v_was_open then
      insert into public.admin_notifications (kind, user_id, ref_id, title, detail)
      values ('dispute_open', v_opener, new.id, 'Litige ouvert', v_detail || jsonb_build_object('gravite', 'normal'))
      on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    end if;
    if (v_new ->> 'mediation_requested_at') is not null
       and (not v_was_open or (v_old ->> 'mediation_requested_at') is null) then
      insert into public.admin_notifications (kind, user_id, ref_id, title, detail)
      values ('dispute_mediation', v_opener, new.id, 'Intervention de PING demandée', v_detail || jsonb_build_object('gravite', 'grave'))
      on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    end if;
  elsif v_was_open then
    -- Litige clos (arrangement à l'amiable, Décision PING, non retenu) : ses alertes sont traitées.
    update public.admin_notifications set handled_at = now()
     where kind in ('dispute_open', 'dispute_mediation') and ref_id = new.id and handled_at is null;
  end if;
  return null;
exception when others then
  return null;  -- une alerte ratée ne doit jamais empêcher l'ouverture, la médiation ou la clôture d'un litige
end $$;
revoke execute on function public.disputes_admin_notify() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.disputes') is not null
     and not exists (select 1 from pg_trigger where tgname = 'trg_disputes_admin_notify'
                      and tgrelid = 'public.disputes'::regclass) then
    create trigger trg_disputes_admin_notify after insert or update on public.disputes
      for each row execute function public.disputes_admin_notify();
  end if;
end $$;

-- 6. Compteurs pour les pastilles (admin seulement) -----------------------------------------------------------------------
create or replace function public.admin_alert_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'version', 62,
      'documents', count(*) filter (where kind = 'document_pending'),
      'paiements', count(*) filter (where kind = 'payment_alert'),
      'paiements_graves', count(*) filter (where kind = 'payment_alert' and detail ->> 'gravite' = 'grave'),
      'litiges', count(*) filter (where kind in ('dispute_open', 'dispute_mediation')),
      'mediation', count(*) filter (where kind = 'dispute_mediation'))
    from public.admin_notifications where handled_at is null);
end $$;
revoke execute on function public.admin_alert_counts() from public, anon;
grant execute on function public.admin_alert_counts() to authenticated;

-- 7. Rattrapage (sans rafale d'e-mails : emailed_at = maintenant) -------------------------------------------------------------
do $$ begin
  if to_regclass('public.payment_alerts') is not null then
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'payment_alert', a.provider_id, a.id, public._payment_alert_label(a.kind),
           jsonb_build_object('categorie', 'paiement', 'payment_kind', a.kind,
                              'gravite', case when public._payment_alert_grave(a.kind) then 'grave' else 'normal' end,
                              'transaction_id', a.detail ->> 'transactionId', 'transfer_id', a.detail ->> 'transferId'),
           a.created_at, now()
      from public.payment_alerts a
     where a.handled_at is null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'payment_alert' and n.ref_id = a.id)
    on conflict (ref_id) where kind = 'payment_alert' and handled_at is null do nothing;
  end if;
  if to_regclass('public.disputes') is not null then
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'dispute_open', nullif(to_jsonb(d) ->> 'opener_id', '')::uuid, d.id, 'Litige ouvert',
           jsonb_build_object('categorie', 'litige', 'transaction_id', to_jsonb(d) ->> 'transaction_id', 'gravite', 'normal'),
           coalesce((to_jsonb(d) ->> 'created_at')::timestamptz, now()), now()
      from public.disputes d
     where to_jsonb(d) ->> 'status' = 'open' and (to_jsonb(d) ->> 'closed_at') is null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'dispute_open' and n.ref_id = d.id)
    on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
    select 'dispute_mediation', nullif(to_jsonb(d) ->> 'opener_id', '')::uuid, d.id, 'Intervention de PING demandée',
           jsonb_build_object('categorie', 'litige', 'transaction_id', to_jsonb(d) ->> 'transaction_id', 'gravite', 'grave'),
           coalesce((to_jsonb(d) ->> 'mediation_requested_at')::timestamptz, now()), now()
      from public.disputes d
     where to_jsonb(d) ->> 'status' = 'open' and (to_jsonb(d) ->> 'closed_at') is null
       and (to_jsonb(d) ->> 'mediation_requested_at') is not null
       and not exists (select 1 from public.admin_notifications n where n.kind = 'dispute_mediation' and n.ref_id = d.id)
    on conflict (kind, ref_id) where kind in ('dispute_open', 'dispute_mediation') and handled_at is null do nothing;
  end if;
end $$;

-- Vérification :
--   select pubname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('messages', 'dispute_messages');
--   select tgname from pg_trigger where tgname in ('trg_payment_alerts_admin_notify', 'trg_disputes_admin_notify');
--   select kind, title, detail ->> 'gravite' as gravite, created_at from public.admin_notifications
--    where kind in ('payment_alert', 'dispute_open', 'dispute_mediation') and handled_at is null order by created_at desc limit 20;
--   select public.admin_alert_counts();   -- connecté en admin (dans le SQL Editor : erreur « Réservé à l'administration », normal)
