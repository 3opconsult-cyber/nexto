-- 056 — Annulations, frais, prestataire absent, report de rendez-vous, client sans réponse (décisions Romain du
-- 20/11/2026). NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/056_annulations_frais_absences_report.sql.
-- À coller APRÈS 052 (booking_status), 054 et 055 ; lit aussi 038/048 (presence_requests, _presence_amounts) quand elles
-- sont collées. Additive et idempotente (collable deux fois) : aucun DROP ni DELETE, aucune ligne existante modifiée.
--
-- Règles tenues CÔTÉ BASE (l'interface ne fait que les afficher) :
--  1. Annulation par le CLIENT, trois paliers (RPC cancel_booking) :
--       gratuite     : avant « Je pars » (en_route_at nul) ; motif facultatif ;
--       motif_grave  : prestataire en route, pas arrivé, et il reste au moins `cancel_free_minutes` (15) avant l'heure du
--                      rendez-vous : motif RÉEL et sérieux dans une liste (maladie, urgence_familiale, accident,
--                      autre_grave + texte obligatoire) ; sans frais ; motif enregistré, transmis (message système) et
--                      visible de PING (table mission_cancellations) ;
--       frais_totaux : à l'heure du rendez-vous, à moins de 15 min, ou prestataire « arrivé » (position envoyée à
--                      l'adresse, arrivée pas encore validée) : 100 % de la prestation + frais de service du client,
--                      traités comme abus ; refusés tant que p_confirm_fees n'est pas vrai (l'application demande deux
--                      confirmations) ; documents de facturation émis (FACT/RECAP + PING-C + PING-V, virement à régler) ;
--                      litige possible 24 h (055 étendu : fenêtre comptée depuis l'annulation).
--     Plus d'annulation une fois l'intervention commencée (arrived_at posé) : garde 014/027 conservée, ici aussi.
--  2. Annulation par le PRESTATAIRE : toujours possible (avant l'arrivée), motif de la liste obligatoire (+ texte pour
--     « autre »), jamais de frais, remboursement 100 % (le serveur le fait si paiement en ligne). Compteur sur 30 jours,
--     alerte payment_alerts `provider_cancellations` au-delà de `provider_cancel_alert_threshold` (3).
--  3. PRESTATAIRE ABSENT (declare_provider_no_show) : `no_show_minutes` (30) après l'heure du rendez-vous, sans arrivée :
--     le client annule sans frais, remboursement 100 %, alerte `provider_no_show` + signalement (reports, si la table
--     existe), message aux deux, avis possible. Contestation par le prestataire : litige dans les 24 h.
--  4. REPORT (propose_reschedule / accept_reschedule / decline_reschedule) : l'autre partie accepte ou refuse ; plus de 24 h
--     avant : gratuit ; moins de 24 h : accord obligatoire, sinon le rendez-vous reste et seule l'annulation (règles
--     ci-dessus) est possible. Prix inchangé. La date d'un rendez-vous confirmé ne se change plus que par ces RPC.
--  5. CLIENT SANS RÉPONSE (close_on_proof) : après `client_silence_hours` (2) sans réponse à la photo d'arrivée ou au code de
--     fin demandés, le prestataire clôture sur preuve (photo horodatée et position déjà prises) : facturée normalement,
--     client prévenu, litige possible 24 h.
-- Lecture : cancellation_state(tx) donne à l'application tout ce qu'elle affiche (palier, frais, absence, report, silence).
-- Vérification : select proname from pg_proc where proname in ('cancel_booking', 'declare_provider_no_show',
--   'propose_reschedule', 'accept_reschedule', 'decline_reschedule', 'close_on_proof', 'cancellation_state');

-- 1. Réglages (modifiables sur /admin/commission, sans déploiement) ----------------------------------------------
insert into public.app_settings (key, value) values
  ('cancel_free_minutes', '15'::jsonb),
  ('no_show_minutes', '30'::jsonb),
  ('client_silence_hours', '2'::jsonb),
  ('provider_cancel_alert_threshold', '3'::jsonb),
  ('reschedule_free_hours', '24'::jsonb)
on conflict (key) do nothing;

create or replace function public._cx_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select case
            when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric
            when jsonb_typeof(s.value) = 'string' and (s.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (s.value #>> '{}')::numeric
          end from public.app_settings s where s.key = p_key), p_default)
$$;
revoke all on function public._cx_num(text, numeric) from public, anon, authenticated;

-- 2. Colonnes de la mission -----------------------------------------------------------------------------------------
alter table public.transactions add column if not exists cancelled_at timestamptz;
alter table public.transactions add column if not exists cancelled_by uuid;
alter table public.transactions add column if not exists cancel_tier text;
alter table public.transactions add column if not exists cancel_reason_kind text;
alter table public.transactions add column if not exists cancel_reason_text text;
alter table public.transactions add column if not exists cancel_fee_cents integer;
alter table public.transactions add column if not exists provider_no_show_at timestamptz;
alter table public.transactions add column if not exists closure_mode text;
alter table public.transactions add column if not exists closed_on_proof_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_cancel_tier_check') then
    alter table public.transactions add constraint transactions_cancel_tier_check
      check (cancel_tier is null or cancel_tier in ('gratuite', 'motif_grave', 'frais_totaux', 'prestataire', 'absence_prestataire'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_cancel_reason_len') then
    alter table public.transactions add constraint transactions_cancel_reason_len
      check (cancel_reason_text is null or char_length(cancel_reason_text) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_closure_mode_check') then
    alter table public.transactions add constraint transactions_closure_mode_check
      check (closure_mode is null or closure_mode in ('preuve_prestataire'));
  end if;
end $$;

-- 3. Journal des annulations (lu par PING seul) ---------------------------------------------------------------------
create table if not exists public.mission_cancellations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  party text not null check (party in ('client', 'prestataire')),
  actor_id uuid not null,
  provider_id uuid,
  client_id uuid,
  tier text not null check (tier in ('gratuite', 'motif_grave', 'frais_totaux', 'prestataire', 'absence_prestataire')),
  reason_kind text,
  reason_text text,
  fee_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mission_cancellations_provider on public.mission_cancellations (provider_id, created_at desc);
create index if not exists mission_cancellations_tx on public.mission_cancellations (transaction_id);
alter table public.mission_cancellations enable row level security;
revoke all on table public.mission_cancellations from anon, authenticated;
grant select on table public.mission_cancellations to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_cancellations' and policyname = 'mission_cancellations admin read') then
    create policy "mission_cancellations admin read" on public.mission_cancellations for select to authenticated using (public.is_admin());
  end if;
end $$;

-- 4. Demandes de report ------------------------------------------------------------------------------------------------
create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  proposed_by uuid not null,
  old_at timestamptz,
  new_at timestamptz not null,
  late boolean not null default false,
  note text,
  status text not null default 'en_attente' check (status in ('en_attente', 'acceptee', 'refusee', 'retiree', 'expiree')),
  expires_at timestamptz not null,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reschedule_note_len check (note is null or char_length(note) <= 300)
);
create unique index if not exists reschedule_one_pending on public.reschedule_requests (transaction_id) where status = 'en_attente';
create index if not exists reschedule_tx on public.reschedule_requests (transaction_id, created_at desc);
alter table public.reschedule_requests enable row level security;
revoke all on table public.reschedule_requests from anon, authenticated;
grant select on table public.reschedule_requests to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reschedule_requests' and policyname = 'reschedule parties read') then
    create policy "reschedule parties read" on public.reschedule_requests for select to authenticated
      using (public.is_admin() or exists (select 1 from public.transactions t where t.id = transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));
  end if;
end $$;

-- 5. Verrou : plus d'annulation ni de changement de date « à la main » depuis l'API --------------------------------------
-- SECURITY INVOKER (comme booking_rules, 052) : current_user vaut 'authenticated' pour un appel direct de l'API, le
-- propriétaire des fonctions quand l'écriture vient d'une RPC definer (cancel_booking, accept_booking…).
create or replace function public.cancellation_rules() returns trigger
language plpgsql security invoker set search_path = public as $$
declare api boolean := current_user in ('authenticated', 'anon') and not public.is_admin();
begin
  if not api then return new; end if;
  if tg_op = 'INSERT' then
    if new.cancelled_at is not null or new.cancelled_by is not null or new.cancel_tier is not null
       or new.cancel_reason_kind is not null or new.cancel_reason_text is not null or new.cancel_fee_cents is not null
       or new.provider_no_show_at is not null or new.closure_mode is not null or new.closed_on_proof_at is not null then
      raise exception 'Annulation et clôture sont posées par les règles de PING.';
    end if;
    return new;
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    raise exception 'Une annulation passe par le bouton « Annuler » de la mission (règles de frais et de motif).';
  end if;
  if new.cancelled_at is distinct from old.cancelled_at or new.cancelled_by is distinct from old.cancelled_by
     or new.cancel_tier is distinct from old.cancel_tier or new.cancel_reason_kind is distinct from old.cancel_reason_kind
     or new.cancel_reason_text is distinct from old.cancel_reason_text or new.cancel_fee_cents is distinct from old.cancel_fee_cents
     or new.provider_no_show_at is distinct from old.provider_no_show_at or new.closure_mode is distinct from old.closure_mode
     or new.closed_on_proof_at is distinct from old.closed_on_proof_at then
    raise exception 'Annulation et clôture sont posées par les règles de PING.';
  end if;
  if old.scheduled_at is not null and new.scheduled_at is distinct from old.scheduled_at and coalesce(old.price_confirmed, false) then
    raise exception 'Le rendez-vous se déplace avec « Reporter » : l''autre partie doit accepter.';
  end if;
  return new;
end $$;
revoke execute on function public.cancellation_rules() from public, anon, authenticated;
create or replace trigger trg_cancellation_rules
  before insert or update on public.transactions
  for each row execute function public.cancellation_rules();

-- 6. Outils internes -------------------------------------------------------------------------------------------------------
create or replace function public._cx_eur(p_cents numeric) returns text language sql immutable as $$
  select replace(to_char(coalesce(p_cents, 0) / 100.0, 'FM999999990.00'), '.', ',') || ' €'
$$;

-- Prestataire « arrivé » avant la validation : sa position a été envoyée à l'adresse (client absent) et attend le client.
create or replace function public._cx_arrival_pending(p_tx uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v boolean := false;
begin
  if to_regclass('public.presence_requests') is null then return false; end if;
  execute 'select exists (select 1 from public.presence_requests r where r.transaction_id = $1 and r.phase = ''arrivee''
             and r.used_at is null and r.declined_at is null and r.confirmed_at is null and r.confirm_until > now())'
    into v using p_tx;
  return coalesce(v, false);
end $$;
revoke all on function public._cx_arrival_pending(uuid) from public, anon, authenticated;

-- Palier d'annulation du CLIENT : impossible | commencee | gratuite | motif_grave | frais_totaux.
create or replace function public._cx_tier(p_tx uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare t record; free_min numeric := public._cx_num('cancel_free_minutes', 15);
begin
  select status, arrived_at, en_route_at, scheduled_at, price_confirmed into t from public.transactions where id = p_tx;
  if not found or t.status in ('cancelled', 'completed', 'released') then return 'impossible'; end if;
  if t.arrived_at is not null or t.status = 'arrived' then return 'commencee'; end if;
  if not coalesce(t.price_confirmed, false) then return 'gratuite'; end if;
  if public._cx_arrival_pending(p_tx) then return 'frais_totaux'; end if;
  if t.en_route_at is null then return 'gratuite'; end if;
  if t.scheduled_at is not null and now() >= t.scheduled_at - make_interval(mins => free_min::int) then return 'frais_totaux'; end if;
  return 'motif_grave';
end $$;
revoke all on function public._cx_tier(uuid) from public, anon, authenticated;

create or replace function public._cx_fee(p_tx uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(t.total_charged_cents, coalesce(t.subtotal_cents, 0) + coalesce(t.buyer_fee_cents, 0))::integer
    from public.transactions t where t.id = p_tx
$$;
revoke all on function public._cx_fee(uuid) from public, anon, authenticated;

-- Message système (la RLS de messages refuse sender_id nul : posé au nom de l'auteur, kind = 'system').
create or replace function public._cx_say(p_tx uuid, p_sender uuid, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_tx, p_sender, 'system', p_body)
$$;
revoke all on function public._cx_say(uuid, uuid, text) from public, anon, authenticated;

-- Alerte PING ; ne bloque jamais l'opération principale.
create or replace function public._cx_alert(p_provider uuid, p_kind text, p_detail jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_alerts (provider_id, kind, detail) values (p_provider, p_kind, coalesce(p_detail, '{}'::jsonb));
exception when others then null;
end $$;
revoke all on function public._cx_alert(uuid, text, jsonb) from public, anon, authenticated;

-- Compte les annulations du prestataire sur 30 jours (annulations de sa part et absences) et alerte au-delà du seuil.
create or replace function public._cx_provider_count(p_provider uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.mission_cancellations
   where provider_id = p_provider and tier in ('prestataire', 'absence_prestataire') and created_at > now() - interval '30 days'
$$;
revoke all on function public._cx_provider_count(uuid) from public, anon, authenticated;

create or replace function public._cx_check_threshold(p_provider uuid, p_tx uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n integer := public._cx_provider_count(p_provider); seuil integer := public._cx_num('provider_cancel_alert_threshold', 3)::integer;
begin
  if n < seuil then return; end if;
  if exists (select 1 from public.payment_alerts a where a.provider_id = p_provider and a.kind = 'provider_cancellations'
               and a.created_at > now() - interval '24 hours') then return; end if;
  perform public._cx_alert(p_provider, 'provider_cancellations',
    jsonb_build_object('count', n, 'windowDays', 30, 'threshold', seuil, 'transactionId', p_tx));
end $$;
revoke all on function public._cx_check_threshold(uuid, uuid) from public, anon, authenticated;

-- 7. Documents de facturation d'une annulation à frais totaux ----------------------------------------------------------
-- Même trois documents qu'une mission terminée (generate_invoices, 006), mêmes montants figés à la réservation : la
-- prestation (FACT/RECAP) du prestataire au client, PING-C (frais de service du client) et PING-V (commission du
-- prestataire). La base crée les lignes de virement (trigger 025). Jamais deux fois.
create or replace function public._cx_cancellation_invoices(p_tx uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t record; seller record; buyer record; sp record; plat jsonb; yr text; n bigint; d date; est_pro boolean; enseigne text;
  detail jsonb; taux_c text; taux_v text;
begin
  select * into t from public.transactions where id = p_tx;
  if not found then return; end if;
  if exists (select 1 from public.invoices where transaction_id = p_tx) then return; end if;
  select * into seller from public.profiles where id = t.seller_id;
  select * into buyer from public.profiles where id = t.buyer_id;
  select * into sp from public.provider_profiles where id = t.seller_id;
  plat := public.platform_identity();
  d := coalesce(t.cancelled_at, now())::date; yr := to_char(d, 'YYYY'); n := nextval('invoice_seq');
  est_pro := coalesce(sp.legal_status::text, 'particulier') <> 'particulier';
  enseigne := coalesce(nullif(sp.company_name, ''), seller.full_name);
  taux_c := case when coalesce(t.subtotal_cents, 0) > 0
                 then replace(to_char(100.0 * coalesce(t.buyer_fee_cents, 0) / t.subtotal_cents, 'FM990.0'), '.', ',') || ' % du montant de la prestation' end;
  taux_v := case when coalesce(t.subtotal_cents, 0) > 0
                 then replace(to_char(100.0 * coalesce(t.seller_fee_cents, 0) / t.subtotal_cents, 'FM990.0'), '.', ',') || ' % du montant de la prestation' end;
  detail := jsonb_build_object(
    'prestation', 'Frais d''annulation tardive (100 % de la prestation) — ' || public.trade_label(sp.trade),
    'date', to_char(d, 'DD/MM/YYYY'),
    'annulation', true,
    'montant_cents', t.subtotal_cents);

  insert into public.invoices (transaction_id, number, kind, template, issuer_id, client_id,
                               net_cents, issued_at, issuer_snapshot, client_snapshot, lines, legal)
  values (
    p_tx,
    case when est_pro then 'FACT-' || yr || '-' || lpad(n::text, 5, '0') else 'RECAP-' || yr || '-' || lpad(n::text, 5, '0') end,
    'prestation', case when est_pro then 'facture' else 'recapitulatif' end,
    t.seller_id, t.buyer_id, t.subtotal_cents, d,
    jsonb_build_object('enseigne', enseigne, 'nom', seller.full_name, 'adresse', seller.address, 'ville', seller.city,
                       'siret', sp.siret, 'statut', sp.legal_status::text, 'sap', sp.sap_number, 'immatricule', est_pro),
    jsonb_build_object('nom', buyer.full_name, 'adresse', buyer.address, 'ville', buyer.city),
    jsonb_build_array(detail),
    case when est_pro then public.invoice_legal(sp.legal_status, d)
         else jsonb_build_object(
           'avertissement', 'Ce document n''est pas une facture. Il est émis par PING pour le compte d''un intervenant particulier non immatriculé, qui n''est pas autorisé à facturer.',
           'declaration', 'Les sommes perçues sont déclarables par l''intervenant au titre de ses revenus.',
           'categorie_operation', 'Prestation de services entre particuliers') end);

  insert into public.invoices (transaction_id, number, kind, template, issuer_id, client_id,
                               net_cents, issued_at, issuer_snapshot, client_snapshot, lines, legal)
  values
    (p_tx, 'PING-C-' || yr || '-' || lpad(n::text, 5, '0'), 'commission_client', 'commission',
     t.seller_id, t.buyer_id, t.buyer_fee_cents, d, plat,
     jsonb_build_object('nom', buyer.full_name, 'adresse', buyer.address, 'ville', buyer.city),
     jsonb_build_array(jsonb_build_object('libelle', 'Frais de mise en relation',
       'detail', 'Annulation tardive du rendez-vous du ' || to_char(d, 'DD/MM/YYYY'), 'montant_cents', t.buyer_fee_cents)),
     jsonb_build_object('taux', taux_c)),
    (p_tx, 'PING-V-' || yr || '-' || lpad(n::text, 5, '0'), 'commission_pro', 'commission',
     t.buyer_id, t.seller_id, t.seller_fee_cents, d, plat,
     jsonb_build_object('nom', enseigne, 'adresse', seller.address, 'ville', seller.city, 'siret', sp.siret),
     jsonb_build_array(jsonb_build_object('libelle', 'Frais de mise en relation',
       'detail', 'Annulation tardive du rendez-vous du ' || to_char(d, 'DD/MM/YYYY'), 'montant_cents', t.seller_fee_cents)),
     jsonb_build_object('taux', taux_v));
end $$;
revoke all on function public._cx_cancellation_invoices(uuid) from public, anon, authenticated;

-- IBAN du prestataire : donné aussi au client d'une annulation à frais totaux (il doit virer la prestation).
create or replace function public.payee_bank_details(p_transaction uuid)
returns table (holder text, iban text, bic text, enseigne text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.transactions t where t.id = p_transaction and t.buyer_id = auth.uid()
                  and (t.status in ('completed', 'released') or t.cancel_tier = 'frais_totaux'))
     or not exists (select 1 from public.invoices i where i.transaction_id = p_transaction and i.kind = 'prestation') then
    return;
  end if;
  return query
    select coalesce(nullif(pp.iban_holder, ''), pr.full_name), pp.iban, pp.bic,
           coalesce(nullif(sp.company_name, ''), pr.full_name)
      from public.transactions t
      join public.profiles pr on pr.id = t.seller_id
      left join public.provider_profiles sp on sp.id = t.seller_id
      left join public.provider_private pp on pp.id = t.seller_id
     where t.id = p_transaction;
end $$;
revoke all on function public.payee_bank_details(uuid) from public, anon;
grant execute on function public.payee_bank_details(uuid) to authenticated;

-- 8. Annuler (client ou prestataire) ---------------------------------------------------------------------------------------
create or replace function public.cancel_booking(
  p_transaction uuid, p_reason_kind text default null, p_reason_text text default null, p_confirm_fees boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); t record; is_buyer boolean; tier text; fee integer := 0; kind text := nullif(trim(coalesce(p_reason_kind, '')), '');
  why text := nullif(trim(coalesce(p_reason_text, '')), ''); confirmed boolean; body text; label text; motif text;
  grave text[] := array['maladie', 'urgence_familiale', 'accident', 'autre_grave'];
  libre_client text[] := array['maladie', 'urgence_familiale', 'accident', 'autre_grave', 'changement_de_plan', 'autre'];
  libre_pro text[] := array['maladie', 'urgence_familiale', 'accident', 'panne_vehicule', 'indisponibilite', 'autre'];
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if why is not null and char_length(why) > 500 then raise exception 'Motif trop long (500 caractères au plus).'; end if;
  select * into t from public.transactions where id = p_transaction for update;
  if not found or uid not in (t.buyer_id, t.seller_id) then raise exception 'Réservé aux parties de cette mission.'; end if;
  is_buyer := uid = t.buyer_id;
  confirmed := coalesce(t.price_confirmed, false);
  if t.status = 'cancelled' then return jsonb_build_object('ok', true, 'already', true, 'tier', t.cancel_tier); end if;
  if t.status in ('completed', 'released') then
    return jsonb_build_object('ok', false, 'reason', 'terminee', 'message', 'Cette mission est terminée.');
  end if;
  if t.arrived_at is not null or t.status = 'arrived' then
    return jsonb_build_object('ok', false, 'reason', 'commencee',
      'message', 'Mission commencée : ouvrez un litige plutôt qu''une annulation.');
  end if;
  if kind is not null and not (kind = any (case when is_buyer then libre_client else libre_pro end)) then
    return jsonb_build_object('ok', false, 'reason', 'motif_invalide', 'message', 'Motif inconnu : choisissez-en un dans la liste.');
  end if;
  motif := case kind when 'maladie' then 'maladie' when 'urgence_familiale' then 'urgence familiale' when 'accident' then 'accident'
    when 'autre_grave' then 'autre motif grave' when 'panne_vehicule' then 'panne ou problème de véhicule'
    when 'indisponibilite' then 'indisponibilité' when 'changement_de_plan' then 'changement de plan' when 'autre' then 'autre motif' end;

  if is_buyer then
    tier := public._cx_tier(p_transaction);
    if tier = 'motif_grave' then
      if kind is null or not (kind = any (grave)) then
        return jsonb_build_object('ok', false, 'reason', 'motif_requis', 'tier', tier,
          'message', 'Le prestataire est en route : l''annulation n''est possible que pour un motif sérieux (maladie, urgence familiale, accident, autre motif grave).');
      end if;
      if kind = 'autre_grave' and (why is null or char_length(why) < 5) then
        return jsonb_build_object('ok', false, 'reason', 'texte_requis', 'tier', tier, 'message', 'Décrivez ce motif grave en quelques mots.');
      end if;
    elsif tier = 'frais_totaux' then
      fee := coalesce(public._cx_fee(p_transaction), 0);
      if not coalesce(p_confirm_fees, false) then
        return jsonb_build_object('ok', false, 'reason', 'confirmation_frais', 'tier', tier, 'fee_cents', fee,
          'message', format('Le prestataire est sur place ou le rendez-vous est imminent : vous serez facturé la totalité (%s).', public._cx_eur(fee)));
      end if;
    end if;
    label := tier;
  else
    tier := 'prestataire';
    if confirmed then
      if kind is null then
        return jsonb_build_object('ok', false, 'reason', 'motif_requis', 'tier', tier, 'message', 'Choisissez le motif de l''annulation.');
      end if;
      if kind = 'autre' and (why is null or char_length(why) < 5) then
        return jsonb_build_object('ok', false, 'reason', 'texte_requis', 'tier', tier, 'message', 'Décrivez le motif en quelques mots.');
      end if;
    end if;
    label := tier;
  end if;

  update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = uid,
      cancel_tier = label,
      cancel_reason_kind = kind, cancel_reason_text = why, cancel_fee_cents = case when tier = 'frais_totaux' then fee else 0 end
    where id = p_transaction;

  if confirmed then
    insert into public.mission_cancellations (transaction_id, party, actor_id, provider_id, client_id, tier, reason_kind, reason_text, fee_cents)
      values (p_transaction, case when is_buyer then 'client' else 'prestataire' end, uid, t.seller_id, t.buyer_id, label, kind, why,
              case when tier = 'frais_totaux' then fee else 0 end);
  end if;

  body := case
    when not is_buyer then
      '✕ Réservation annulée par le prestataire' || coalesce(' — motif : ' || motif, '') || coalesce(' (« ' || why || ' »)', '')
        || '. Aucun frais pour le client ; remboursement à 100 % si le paiement a été fait en ligne.'
    when tier = 'motif_grave' then
      '✕ Réservation annulée par le client alors que le prestataire était en route, pour motif grave (' || coalesce(motif, '') || ')'
        || coalesce(' : « ' || why || ' »', '') || '. Aucun frais ; le motif est enregistré et visible de PING.'
    when tier = 'frais_totaux' then
      '✕ Annulation tardive par le client : frais d''annulation de ' || public._cx_eur(fee)
        || ' (100 % de la prestation et frais de service). Les documents de facturation sont émis ; le client peut ouvrir un litige dans les 24 h.'
    else
      '✕ ' || case when confirmed then 'Réservation' else 'Demande' end || ' annulée par le client'
        || coalesce(' — motif : ' || motif, '') || case when confirmed then '. Aucun frais.' else '.' end
  end;
  perform public._cx_say(p_transaction, uid, body);

  if not is_buyer and confirmed then
    perform public._cx_check_threshold(t.seller_id, p_transaction);
  end if;
  if tier = 'frais_totaux' then
    perform public._cx_cancellation_invoices(p_transaction);
    perform public._cx_alert(t.seller_id, 'late_cancellation_fees',
      jsonb_build_object('transactionId', p_transaction, 'feeCents', fee, 'clientId', t.buyer_id));
  end if;

  return jsonb_build_object('ok', true, 'tier', label, 'fee_cents', case when tier = 'frais_totaux' then fee else 0 end,
    'refund_online', label <> 'frais_totaux');
end $$;
revoke all on function public.cancel_booking(uuid, text, text, boolean) from public, anon;
grant execute on function public.cancel_booking(uuid, text, text, boolean) to authenticated;

-- 9. Prestataire absent ------------------------------------------------------------------------------------------------------
create or replace function public.declare_provider_no_show(p_transaction uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; wait_min integer := public._cx_num('no_show_minutes', 30)::integer; rep boolean;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from public.transactions where id = p_transaction for update;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de cette mission.'; end if;
  if t.status = 'cancelled' then return jsonb_build_object('ok', true, 'already', true, 'tier', t.cancel_tier); end if;
  if t.status in ('completed', 'released') or t.arrived_at is not null or t.status = 'arrived' then
    return jsonb_build_object('ok', false, 'reason', 'arrive', 'message', 'Le prestataire est déjà arrivé : si le service pose problème, ouvrez un litige.');
  end if;
  if not coalesce(t.price_confirmed, false) or coalesce(t.booking_status, 'acceptee') <> 'acceptee' or t.scheduled_at is null then
    return jsonb_build_object('ok', false, 'reason', 'non_confirmee', 'message', 'Cette réservation n''a pas de rendez-vous confirmé.');
  end if;
  if public._cx_arrival_pending(p_transaction) then
    return jsonb_build_object('ok', false, 'reason', 'sur_place', 'message', 'Le prestataire a envoyé sa position sur place : confirmez son arrivée ou contestez-la.');
  end if;
  if now() < t.scheduled_at + make_interval(mins => wait_min) then
    return jsonb_build_object('ok', false, 'reason', 'trop_tot', 'at', t.scheduled_at + make_interval(mins => wait_min),
      'message', format('Vous pourrez déclarer son absence %s minutes après l''heure du rendez-vous.', wait_min));
  end if;

  update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = uid, cancel_tier = 'absence_prestataire',
      cancel_reason_kind = 'absence_prestataire', cancel_reason_text = null, cancel_fee_cents = 0, provider_no_show_at = now()
    where id = p_transaction;
  insert into public.mission_cancellations (transaction_id, party, actor_id, provider_id, client_id, tier, reason_kind, reason_text, fee_cents)
    values (p_transaction, 'client', uid, t.seller_id, t.buyer_id, 'absence_prestataire', 'absence_prestataire', null, 0);
  perform public._cx_say(p_transaction, uid,
    '✕ Le prestataire n''est pas arrivé (' || wait_min || ' minutes après l''heure du rendez-vous) : le client déclare son absence. '
    || 'Réservation annulée sans aucun frais, remboursement à 100 % si le paiement a été fait en ligne. PING est prévenu. '
    || 'Le prestataire peut contester dans les 24 h en ouvrant un litige ; le client peut laisser un avis.');
  perform public._cx_alert(t.seller_id, 'provider_no_show',
    jsonb_build_object('transactionId', p_transaction, 'scheduledAt', t.scheduled_at, 'clientId', t.buyer_id));
  perform public._cx_check_threshold(t.seller_id, p_transaction);
  -- Signalement dans la file de modération existante (043), si elle est là.
  if to_regclass('public.reports') is not null then
    begin
      execute 'insert into public.reports (reporter_id, transaction_id, reported_user_id, category, body) values ($1, $2, $3, $4, $5)'
        using uid, p_transaction, t.seller_id, 'comportement',
          'Absence du prestataire déclarée par le client (' || wait_min || ' min après l''heure du rendez-vous). Mission annulée sans frais.';
      rep := true;
    exception when others then rep := false;
    end;
  end if;
  return jsonb_build_object('ok', true, 'tier', 'absence_prestataire', 'fee_cents', 0, 'refund_online', true, 'reported', coalesce(rep, false));
end $$;
revoke all on function public.declare_provider_no_show(uuid) from public, anon;
grant execute on function public.declare_provider_no_show(uuid) to authenticated;

-- 10. Report de rendez-vous --------------------------------------------------------------------------------------------------
create or replace function public._cx_when(p_at timestamptz) returns text language sql immutable as $$
  select to_char(p_at at time zone 'Europe/Paris', 'DD/MM "à" HH24:MI')
$$;

create or replace function public._cx_expire_reschedules(p_tx uuid) returns void
language sql security definer set search_path = public as $$
  update public.reschedule_requests set status = 'expiree', decided_at = now()
   where transaction_id = p_tx and status = 'en_attente' and expires_at < now()
$$;
revoke all on function public._cx_expire_reschedules(uuid) from public, anon, authenticated;

create or replace function public.propose_reschedule(p_transaction uuid, p_new_at timestamptz, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; cur record; late boolean; exp timestamptz; new_id uuid; note text := nullif(trim(coalesce(p_note, '')), '');
        free_h numeric := public._cx_num('reschedule_free_hours', 24); who text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if note is not null and char_length(note) > 300 then raise exception 'Message trop long (300 caractères au plus).'; end if;
  select * into t from public.transactions where id = p_transaction for update;
  if not found or uid not in (t.buyer_id, t.seller_id) then raise exception 'Réservé aux parties de cette mission.'; end if;
  if t.status <> 'pending' or t.arrived_at is not null or not coalesce(t.price_confirmed, false)
     or coalesce(t.booking_status, 'acceptee') <> 'acceptee' or t.scheduled_at is null then
    return jsonb_build_object('ok', false, 'reason', 'non_reportable', 'message', 'Ce rendez-vous ne peut pas être reporté.');
  end if;
  if t.en_route_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'en_route', 'message', 'Le prestataire est déjà en route : un report n''est plus possible, seule l''annulation l''est.');
  end if;
  if p_new_at is null or p_new_at < now() + interval '1 hour' or p_new_at > now() + interval '90 days' then
    return jsonb_build_object('ok', false, 'reason', 'date_invalide', 'message', 'Choisissez un nouveau créneau entre dans 1 h et 90 jours.');
  end if;
  if abs(extract(epoch from (p_new_at - t.scheduled_at))) < 900 then
    return jsonb_build_object('ok', false, 'reason', 'meme_date', 'message', 'Ce créneau est le même que le rendez-vous actuel.');
  end if;
  perform public._cx_expire_reschedules(p_transaction);
  select * into cur from public.reschedule_requests where transaction_id = p_transaction and status = 'en_attente';
  if found then
    if cur.proposed_by <> uid then
      return jsonb_build_object('ok', false, 'reason', 'reponse_attendue',
        'message', 'L''autre partie vous a proposé un nouveau créneau : acceptez-le ou refusez-le d''abord.');
    end if;
    update public.reschedule_requests set status = 'retiree', decided_by = uid, decided_at = now() where id = cur.id;
  end if;
  late := t.scheduled_at - now() < make_interval(hours => free_h::int);
  exp := greatest(least(now() + interval '24 hours', t.scheduled_at), now() + interval '30 minutes');
  insert into public.reschedule_requests (transaction_id, proposed_by, old_at, new_at, late, note, expires_at)
    values (p_transaction, uid, t.scheduled_at, p_new_at, late, note, exp) returning reschedule_requests.id into new_id;
  who := case when uid = t.buyer_id then 'le client' else 'le prestataire' end;
  perform public._cx_say(p_transaction, uid,
    'Report proposé par ' || who || ' : ' || public._cx_when(p_new_at) || ' au lieu de ' || public._cx_when(t.scheduled_at)
    || case when late then ' (moins de 24 h avant le rendez-vous : l''accord de l''autre partie est nécessaire, sinon le rendez-vous reste et seule l''annulation, avec ses règles, est possible)'
            else ' (sans frais : l''autre partie accepte ou refuse)' end
    || coalesce(' — « ' || note || ' »', '') || '. Le prix ne change pas.');
  return jsonb_build_object('ok', true, 'id', new_id, 'late', late, 'expires_at', exp);
end $$;
revoke all on function public.propose_reschedule(uuid, timestamptz, text) from public, anon;
grant execute on function public.propose_reschedule(uuid, timestamptz, text) to authenticated;

create or replace function public.accept_reschedule(p_request uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r record; t record;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into r from public.reschedule_requests where id = p_request for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  select * into t from public.transactions where id = r.transaction_id for update;
  if uid not in (t.buyer_id, t.seller_id) then raise exception 'Réservé aux parties de cette mission.'; end if;
  if r.proposed_by = uid then raise exception 'C''est l''autre partie qui répond à votre proposition.'; end if;
  if r.status <> 'en_attente' then
    return jsonb_build_object('ok', false, 'reason', r.status, 'message', 'Cette proposition de report n''est plus d''actualité.');
  end if;
  if r.expires_at < now() then
    update public.reschedule_requests set status = 'expiree', decided_at = now() where id = r.id;
    return jsonb_build_object('ok', false, 'reason', 'expiree', 'message', 'Le délai de réponse est dépassé : le rendez-vous reste inchangé.');
  end if;
  if t.status <> 'pending' or t.arrived_at is not null or t.en_route_at is not null then
    update public.reschedule_requests set status = 'expiree', decided_at = now() where id = r.id;
    return jsonb_build_object('ok', false, 'reason', 'non_reportable', 'message', 'La mission a avancé : le rendez-vous reste inchangé.');
  end if;
  update public.transactions set scheduled_at = r.new_at where id = t.id;
  update public.reschedule_requests set status = 'acceptee', decided_by = uid, decided_at = now() where id = r.id;
  -- Créneau publié : l'ancien est libéré, le nouveau pris s'il est libre (au mieux).
  update public.provider_slots set transaction_id = null where transaction_id = t.id;
  update public.provider_slots set transaction_id = t.id where provider_id = t.seller_id and starts_at = r.new_at and transaction_id is null;
  perform public._cx_say(t.id, uid, '✓ Report accepté : le rendez-vous est déplacé au ' || public._cx_when(r.new_at)
    || ' (au lieu du ' || public._cx_when(r.old_at) || '). Le prix reste celui validé.');
  return jsonb_build_object('ok', true, 'scheduled_at', r.new_at);
end $$;
revoke all on function public.accept_reschedule(uuid) from public, anon;
grant execute on function public.accept_reschedule(uuid) to authenticated;

create or replace function public.decline_reschedule(p_request uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r record; t record; mine boolean;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into r from public.reschedule_requests where id = p_request for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  select buyer_id, seller_id, scheduled_at into t from public.transactions where id = r.transaction_id;
  if uid not in (t.buyer_id, t.seller_id) then raise exception 'Réservé aux parties de cette mission.'; end if;
  if r.status <> 'en_attente' then return jsonb_build_object('ok', true, 'already', true, 'status', r.status); end if;
  mine := r.proposed_by = uid;
  update public.reschedule_requests set status = case when mine then 'retiree' else 'refusee' end, decided_by = uid, decided_at = now() where id = r.id;
  perform public._cx_say(r.transaction_id, uid,
    case when mine then '✕ Report retiré : le rendez-vous reste fixé au ' || public._cx_when(t.scheduled_at) || '.'
         else '✕ Report refusé : le rendez-vous reste fixé au ' || public._cx_when(t.scheduled_at)
              || '. Sans accord, seule l''annulation est possible, avec ses règles habituelles (frais selon le moment).' end);
  return jsonb_build_object('ok', true, 'status', case when mine then 'retiree' else 'refusee' end);
end $$;
revoke all on function public.decline_reschedule(uuid) from public, anon;
grant execute on function public.decline_reschedule(uuid) to authenticated;

-- 11. Client sans réponse : clôture sur preuve ------------------------------------------------------------------------------
-- Phase 'fin' (code de fin demandé et resté sans réponse) : la mission est clôturée à l'heure annoncée par le prestataire,
-- facturée normalement. Phase 'arrivee' (photo + position envoyées, client resté silencieux) : l'arrivée est enregistrée sur
-- preuve et la mission continue. Jamais si le client a contesté (declined_at) ou répondu (code envoyé, confirmation).
create or replace function public.close_on_proof(p_transaction uuid, p_phase text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); t record; r record; ph text := nullif(trim(coalesce(p_phase, '')), ''); hrs numeric := public._cx_num('client_silence_hours', 2);
  a jsonb; prev_claims text; prev_sub text; at_ timestamptz; mins int; dur text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if to_regclass('public.presence_requests') is null then
    return jsonb_build_object('ok', false, 'reason', 'indisponible', 'message', 'Fonction indisponible : réessayez dans un instant.');
  end if;
  select * into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de la mission.'; end if;
  if t.status = 'cancelled' or not coalesce(t.price_confirmed, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'Cette mission n''est pas confirmée ou a été annulée.');
  end if;
  if t.completed_at is not null then return jsonb_build_object('ok', true, 'already', true, 'phase', 'fin'); end if;
  if ph is null then ph := case when t.arrived_at is not null then 'fin' else 'arrivee' end; end if;
  if ph not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  if ph = 'arrivee' and t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true, 'phase', 'arrivee'); end if;
  if ph = 'fin' and t.arrived_at is null then
    return jsonb_build_object('ok', false, 'reason', 'pas_arrive', 'message', 'L''arrivée n''a pas encore été validée.');
  end if;
  execute 'select * from public.presence_requests where transaction_id = $1 and phase = $2 for update' into r using p_transaction, ph;
  if r.transaction_id is null or r.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'aucune_demande', 'message', 'Aucune demande restée sans réponse sur cette mission.');
  end if;
  if r.declined_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'contestee', 'message', 'Le client a contesté : la mission ne peut pas être clôturée sur preuve, PING décide.');
  end if;
  if r.confirmed_at is not null or r.code_sent_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'reponse', 'message', 'Le client a répondu : saisissez son code dans « Mission du jour ».');
  end if;
  if ph = 'arrivee' and r.photo_path is null then
    return jsonb_build_object('ok', false, 'reason', 'sans_preuve', 'message', 'Il faut une photo d''arrivée horodatée avec la position.');
  end if;
  if now() < r.created_at + make_interval(secs => (hrs * 3600)::int) then
    return jsonb_build_object('ok', false, 'reason', 'trop_tot', 'at', r.created_at + make_interval(secs => (hrs * 3600)::int),
      'message', format('Le client a %s h pour répondre : vous pourrez clôturer sur preuve ensuite.', replace(hrs::text, '.', ',')));
  end if;
  at_ := r.requested_at;

  prev_claims := current_setting('request.jwt.claims', true);
  prev_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims',
    (coalesce(nullif(prev_claims, '')::jsonb, '{}'::jsonb) || jsonb_build_object('sub', t.seller_id::text))::text, true);
  perform set_config('request.jwt.claim.sub', t.seller_id::text, true);
  if ph = 'arrivee' then
    update public.transactions set arrived_at = at_, status = 'arrived', arrival_method = 'photo_gps',
        arrival_lat = r.lat, arrival_lng = r.lng, arrival_photo_path = coalesce(r.photo_path, arrival_photo_path),
        closure_mode = 'preuve_prestataire', closed_on_proof_at = now(),
        presence_notes = coalesce(presence_notes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'phase', 'arrivee', 'preuve', 'preuve_prestataire', 'heure', at_, 'par', uid, 'le', now(), 'photo', r.photo_path is not null))
      where id = p_transaction;
  else
    a := public._presence_amounts(p_transaction, at_);
    update public.transactions set completed_at = at_, status = 'completed', closure_mode = 'preuve_prestataire', closed_on_proof_at = now(),
        duration_minutes = (a->>'duration_minutes')::int,
        subtotal_cents = case when (a->>'recalcule')::boolean then (a->>'subtotal_cents')::bigint else subtotal_cents end,
        buyer_fee_cents = case when (a->>'recalcule')::boolean then (a->>'buyer_fee_cents')::bigint else buyer_fee_cents end,
        seller_fee_cents = case when (a->>'recalcule')::boolean then (a->>'seller_fee_cents')::bigint else seller_fee_cents end,
        total_charged_cents = case when (a->>'recalcule')::boolean then (a->>'total_charged_cents')::bigint else total_charged_cents end,
        payout_cents = case when (a->>'recalcule')::boolean then (a->>'payout_cents')::bigint else payout_cents end,
        presence_notes = coalesce(presence_notes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'phase', 'fin', 'preuve', 'preuve_prestataire', 'heure', at_, 'par', uid, 'le', now()))
      where id = p_transaction;
  end if;
  perform set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(prev_sub, ''), true);
  execute 'update public.presence_requests set used_at = now(), code_clair = null where transaction_id = $1 and phase = $2' using p_transaction, ph;

  if ph = 'arrivee' then
    perform public._cx_say(p_transaction, uid, format('✓ Arrivée enregistrée sur preuve à %s : le client n''a pas répondu en %s h à la photo et à la position envoyées. La mission continue ; le client peut ouvrir un litige dans les 24 h.',
      to_char(at_ at time zone 'Europe/Paris', 'HH24:MI'), replace(hrs::text, '.', ',')));
    return jsonb_build_object('ok', true, 'phase', 'arrivee', 'at', at_);
  end if;
  mins := coalesce((a->>'duration_minutes')::int, 0);
  dur := case when mins >= 60 then (mins / 60)::text || ' h ' || lpad((mins % 60)::text, 2, '0') else mins::text || ' min' end;
  perform public._cx_say(p_transaction, uid, format('✓ Mission clôturée sur preuve à %s : le client n''a pas répondu en %s h au code de fin demandé. %s sur place, prestation %s, facturée normalement. Le client peut ouvrir un litige dans les 24 h.',
    to_char(at_ at time zone 'Europe/Paris', 'HH24:MI'), replace(hrs::text, '.', ','), dur, public._cx_eur((a->>'subtotal_cents')::numeric)));
  return jsonb_build_object('ok', true, 'phase', 'fin', 'at', at_, 'subtotal_cents', a->'subtotal_cents');
end $$;
revoke all on function public.close_on_proof(uuid, text) from public, anon;
grant execute on function public.close_on_proof(uuid, text) to authenticated;

-- 12. État lu par l'application ----------------------------------------------------------------------------------------------
create or replace function public.cancellation_state(p_transaction uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); t record; role text; tier text; fee integer := 0; free_min integer := public._cx_num('cancel_free_minutes', 15)::integer;
  wait_min integer := public._cx_num('no_show_minutes', 30)::integer; hrs numeric := public._cx_num('client_silence_hours', 2);
  free_h numeric := public._cx_num('reschedule_free_hours', 24); mins_left integer; ns jsonb; sil jsonb := jsonb_build_object('eligible', false);
  resch jsonb; r record; can_cancel boolean; pend boolean; req record; ph text;
begin
  if uid is null then return null; end if;
  select * into t from public.transactions where id = p_transaction;
  if not found then return null; end if;
  if uid = t.buyer_id then role := 'client'; elsif uid = t.seller_id then role := 'prestataire';
  elsif public.is_admin() then role := 'admin'; else return null; end if;

  tier := public._cx_tier(p_transaction);
  if role = 'prestataire' and tier not in ('impossible', 'commencee') then tier := 'prestataire'; end if;
  can_cancel := tier not in ('impossible', 'commencee') and role <> 'admin';
  if role = 'client' and tier = 'frais_totaux' then fee := coalesce(public._cx_fee(p_transaction), 0); end if;
  mins_left := case when t.scheduled_at is null then null else floor(extract(epoch from (t.scheduled_at - now())) / 60)::integer end;
  pend := public._cx_arrival_pending(p_transaction);

  ns := jsonb_build_object('eligible', role = 'client' and t.status = 'pending' and t.arrived_at is null and coalesce(t.price_confirmed, false)
        and coalesce(t.booking_status, 'acceptee') = 'acceptee' and t.scheduled_at is not null and not pend
        and now() >= t.scheduled_at + make_interval(mins => wait_min),
      'minutes', wait_min, 'at', case when t.scheduled_at is not null then t.scheduled_at + make_interval(mins => wait_min) end);

  if role = 'prestataire' and to_regclass('public.presence_requests') is not null and t.status in ('pending', 'arrived') and t.completed_at is null then
    ph := case when t.arrived_at is not null then 'fin' else 'arrivee' end;
    execute 'select * from public.presence_requests where transaction_id = $1 and phase = $2' into req using p_transaction, ph;
    if req.transaction_id is not null and req.used_at is null and req.declined_at is null and req.confirmed_at is null and req.code_sent_at is null
       and (ph = 'fin' or req.photo_path is not null) then
      sil := jsonb_build_object('eligible', now() >= req.created_at + make_interval(secs => (hrs * 3600)::int), 'phase', ph, 'hours', hrs,
        'at', req.created_at + make_interval(secs => (hrs * 3600)::int), 'waiting', true);
    end if;
  end if;

  select * into r from public.reschedule_requests where transaction_id = p_transaction and status = 'en_attente' and expires_at >= now();
  resch := jsonb_build_object(
    'can_propose', role <> 'admin' and t.status = 'pending' and t.arrived_at is null and t.en_route_at is null and coalesce(t.price_confirmed, false)
                   and coalesce(t.booking_status, 'acceptee') = 'acceptee' and t.scheduled_at is not null and r.id is null,
    'free', t.scheduled_at is not null and t.scheduled_at - now() >= make_interval(hours => free_h::int),
    'pending', case when r.id is null then null else jsonb_build_object('id', r.id, 'proposed_by', r.proposed_by, 'mine', r.proposed_by = uid,
                    'new_at', r.new_at, 'old_at', r.old_at, 'late', r.late, 'expires_at', r.expires_at, 'note', r.note) end);

  return jsonb_build_object('ok', true, 'role', role, 'status', t.status, 'tier', tier, 'can_cancel', can_cancel, 'fee_cents', fee,
    'free_minutes', free_min, 'minutes_to_rdv', mins_left, 'scheduled_at', t.scheduled_at, 'arrival_pending', pend,
    'no_show', ns, 'silence', sil, 'reschedule', resch,
    'cancelled', case when t.status = 'cancelled' then jsonb_build_object('tier', t.cancel_tier, 'reason_kind', t.cancel_reason_kind,
        'reason_text', t.cancel_reason_text, 'fee_cents', t.cancel_fee_cents, 'by', t.cancelled_by, 'at', t.cancelled_at) end);
end $$;
revoke all on function public.cancellation_state(uuid) from public, anon;
grant execute on function public.cancellation_state(uuid) to authenticated;

-- 13. Litige : 24 h aussi après une annulation à frais ou une clôture sur preuve (étend 055) -------------------------------------
create or replace function public.enforce_incident_window()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_end timestamptz; v_pay text; v_hours numeric; v_cancel timestamptz; v_proof timestamptz; v_tier text;
begin
  select completed_at, payment_status::text, cancelled_at, closed_on_proof_at, cancel_tier
    into v_end, v_pay, v_cancel, v_proof, v_tier from public.transactions where id = new.transaction_id;
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'incident_window_hours'), 24) into v_hours;
  if v_pay = 'released' then
    raise exception 'Le paiement a déjà été versé au prestataire : un litige n''est plus possible.' using errcode = 'P0001';
  end if;
  -- Fin de mission (la plus tardive : la clôture sur preuve compte depuis le jour où elle est posée) ; à défaut, une
  -- annulation (frais totaux, absence du prestataire) : 24 h pour la contester.
  v_end := greatest(v_end, v_proof);
  if v_end is null and v_tier in ('frais_totaux', 'absence_prestataire') then v_end := v_cancel; end if;
  if v_end is not null and now() > v_end + make_interval(secs => v_hours * 3600) then
    raise exception 'Le délai de % h pour signaler un incident est dépassé : le paiement est libéré.', v_hours using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 14. Avis possible après l'absence du prestataire ---------------------------------------------------------------------------------
do $$ begin
  alter policy "reviews participant write" on public.reviews with check (
    rater_id = auth.uid() and exists (
      select 1 from public.transactions t
      where t.id = reviews.transaction_id and t.buyer_id = auth.uid() and t.seller_id = reviews.ratee_id
        and t.buyer_id <> t.seller_id and (t.status in ('completed', 'released') or t.cancel_tier = 'absence_prestataire')));
exception when others then null;
end $$;

-- 15. Admin : compteur d'annulations par prestataire (30 jours) ---------------------------------------------------------------------
create or replace function public.admin_provider_cancellations(p_days integer default 30)
returns table (provider_id uuid, provider_name text, cancels integer, no_shows integer, last_at timestamptz, over_threshold boolean)
language plpgsql stable security definer set search_path = public as $$
declare seuil integer := public._cx_num('provider_cancel_alert_threshold', 3)::integer;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs PING.'; end if;
  return query
    select c.provider_id, coalesce(max(p.full_name), ''), (count(*) filter (where c.tier = 'prestataire'))::integer,
           (count(*) filter (where c.tier = 'absence_prestataire'))::integer, max(c.created_at), count(*) >= seuil
      from public.mission_cancellations c left join public.profiles p on p.id = c.provider_id
     where c.tier in ('prestataire', 'absence_prestataire') and c.created_at > now() - make_interval(days => greatest(1, p_days))
     group by c.provider_id
     order by count(*) desc, max(c.created_at) desc;
end $$;
revoke all on function public.admin_provider_cancellations(integer) from public, anon;
grant execute on function public.admin_provider_cancellations(integer) to authenticated;

-- Vérification : select proname from pg_proc where proname in ('cancel_booking', 'declare_provider_no_show',
--   'propose_reschedule', 'accept_reschedule', 'decline_reschedule', 'close_on_proof', 'cancellation_state');
--   select key, value from app_settings where key in ('cancel_free_minutes', 'no_show_minutes', 'client_silence_hours', 'provider_cancel_alert_threshold');
