-- 038 — Arrivée et départ sécurisés (audit du 18/11/2026, docs/audit-2026-11-07/arrivee-depart-audit.md).
--
-- Défauts corrigés :
--   P0-1  le prestataire lisait les jetons QR (transactions.qr_*_token) et posait seul arrived_at / completed_at ;
--   P0-2  « photo + GPS » validait l'arrivée sans le client ;
--   P0-3  aucun départ possible quand le client est absent ;
--   P0-4  le client absent n'était pas prévenu (pastille Messages) ;
--   P1-8  aucun contrôle d'heure ; P1-11 la facture ne disait pas comment l'heure avait été relevée.
--
-- Principe : TOUTE validation d'arrivée et de fin passe par une fonction SECURITY DEFINER qui exige une preuve
-- venant du client :
--   - QR affiché chez le client (jeton à usage unique, 10 min, lié à la mission et à la phase) ;
--   - ou le code à 6 chiffres affiché sous ce QR (même durée, 5 essais) ;
--   - client absent : le prestataire envoie sa position (consentement, après « Je pars »), puis le client
--     confirme en un appui (client_confirm_presence) ou lui dicte le code reçu (15 min, 5 essais) ;
--   - même mécanique au DÉPART (phase « fin ») ;
--   - QR laissé sur place (033, arrivée seulement) conservé ;
--   - à défaut, décision de PING (admin_set_presence).
-- Les jetons et codes vivent dans des tables sans aucune policy ni grant : le prestataire ne les lit jamais.
-- Les anciennes colonnes transactions.qr_arrival_token / qr_complete_token restent (lisibles) mais ne valident
-- plus rien : toute écriture directe de arrived_at / completed_at est refusée par trg_enforce_arrival_departure.
--
-- Additive et idempotente : aucun DROP, aucune suppression de données. Les fonctions de 033/035
-- (create_onsite_token, arrive_with_onsite_token, request_arrival_code, get_arrival_code, arrive_with_code)
-- gardent leur signature et sont réécrites (CREATE OR REPLACE) sur le nouveau mécanisme.
-- Missions en cours : celles déjà arrivées gardent leur heure d'arrivée ; leur fin passe par le QR / code de
-- fin du client (ou PING si l'arrivée date de plus de 24 h). Aucune ligne existante n'est modifiée.
-- Requiert PostgreSQL 14+ (CREATE OR REPLACE TRIGGER).
--
-- Écriture « au nom du prestataire » : les verrous existants (guard_transaction_core 027, guard_payment_status
-- 014, guard_arrival_evidence 033) raisonnent sur auth.uid() = prestataire. Quand le CLIENT confirme
-- (client_confirm_presence) ou qu'un admin tranche, _presence_apply, après avoir vérifié la preuve, pose
-- localement (set_config(..., true), le temps de l'UPDATE) l'identité du prestataire de la mission, puis la
-- rétablit. Rien n'est contourné : seule cette fonction interne, non appelable depuis l'API, le fait.

-- 1. Colonnes ------------------------------------------------------------------------------------------------
-- Preuve réelle de l'arrivée / de la fin (affichée sur la facture). arrival_method (033) reste rempli pour
-- compatibilité : qr / code -> qr_client, distance_* -> geoloc_code, qr_sur_place -> qr_sur_place.
alter table public.transactions add column if not exists arrival_proof text;
alter table public.transactions add column if not exists completion_proof text;
alter table public.transactions add column if not exists completion_lat double precision;
alter table public.transactions add column if not exists completion_lng double precision;
-- Journal horodaté des validations (preuve, heure retenue, auteur, avertissement d'horaire).
alter table public.transactions add column if not exists presence_notes jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_arrival_proof_check') then
    alter table public.transactions add constraint transactions_arrival_proof_check check (arrival_proof is null
      or arrival_proof in ('qr', 'code', 'qr_sur_place', 'distance_code', 'distance_confirmation', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_completion_proof_check') then
    alter table public.transactions add constraint transactions_completion_proof_check check (completion_proof is null
      or completion_proof in ('qr', 'code', 'distance_code', 'distance_confirmation', 'admin'));
  end if;
end $$;

-- 2. Preuves du client présent : QR + code à 6 chiffres, par mission et par phase ---------------------------
-- Aucune policy, aucun grant : lisible seulement via get_mission_proof (client acheteur).
create table if not exists public.mission_proofs (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  phase text not null check (phase in ('arrivee', 'fin')),
  token text not null,
  code_hash text not null,
  code_clair text,
  expires_at timestamptz not null,
  attempts int not null default 0,
  -- Le jeton précédent reste valable jusqu'à son expiration (rotation pendant que le prestataire scanne).
  prev_token text,
  prev_expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (transaction_id, phase)
);
alter table public.mission_proofs enable row level security;
revoke all on table public.mission_proofs from anon, authenticated;

-- 3. Demandes à distance (client absent), par mission et par phase ------------------------------------------
-- requested_at = heure déclarée par le prestataire, retenue si le client confirme.
create table if not exists public.presence_requests (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  phase text not null check (phase in ('arrivee', 'fin')),
  requested_at timestamptz not null default now(),
  code_hash text not null,
  code_clair text,
  code_expires_at timestamptz not null,
  confirm_until timestamptz not null,
  attempts int not null default 0,
  issued_count int not null default 1,
  lat double precision,
  lng double precision,
  distance_m int,
  geo_status text check (geo_status in ('conforme', 'non_verifiable')),
  confirmed_at timestamptz,
  declined_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (transaction_id, phase)
);
alter table public.presence_requests enable row level security;
revoke all on table public.presence_requests from anon, authenticated;

-- 4. Fonctions internes (jamais appelables depuis l'API) -----------------------------------------------------
create or replace function public._presence_setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric
      when jsonb_typeof(s.value) = 'string' and (s.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (s.value #>> '{}')::numeric
    end
    from public.app_settings s where s.key = p_key), p_default)
$$;
revoke all on function public._presence_setting_num(text, numeric) from public, anon, authenticated;

create or replace function public._presence_code() returns text language sql volatile as $$
  select lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
$$;
revoke all on function public._presence_code() from public, anon, authenticated;

create or replace function public._presence_hash(p_tx uuid, p_phase text, p_code text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_tx::text || ':' || p_phase || ':' || coalesce(trim(p_code), ''), 'UTF8')), 'hex')
$$;
revoke all on function public._presence_hash(uuid, text, text) from public, anon, authenticated;

-- Durée et montant à la fin (mêmes règles que l'ancien scan de fin, désormais calculées en base) :
-- heure entamée due au-delà de billing_hour_threshold_minutes (15 par défaut) ; horaire pur : 1 h minimum ;
-- forfait + dépassement : le forfait en entier, puis les heures au-delà des heures incluses ; forfait seul :
-- jamais ajusté ; taux de commission figés à la réservation.
create or replace function public._presence_amounts(p_tx uuid, p_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t record; mins int; thr int; rb numeric; rs numeric; m numeric; billed numeric; sub bigint; bf bigint; sf bigint;
begin
  select * into t from public.transactions where id = p_tx;
  if not found or t.arrived_at is null then return null; end if;
  mins := greatest(0, round(extract(epoch from (p_end - t.arrived_at)) / 60.0))::int;
  thr := public._presence_setting_num('billing_hour_threshold_minutes', 15)::int;
  if thr < 0 or thr > 59 then thr := 15; end if;
  if coalesce(t.hourly_rate_cents, 0) = 0 then
    return jsonb_build_object('duration_minutes', mins, 'recalcule', false, 'threshold', thr,
      'subtotal_cents', t.subtotal_cents, 'buyer_fee_cents', t.buyer_fee_cents, 'seller_fee_cents', t.seller_fee_cents,
      'total_charged_cents', t.total_charged_cents, 'payout_cents', t.payout_cents);
  end if;
  if coalesce(t.subtotal_cents, 0) > 0 then
    rb := coalesce(t.buyer_fee_cents, 0)::numeric / t.subtotal_cents;
    rs := coalesce(t.seller_fee_cents, 0)::numeric / t.subtotal_cents;
  else
    rb := public._presence_setting_num('commission_buyer_rate', 0.08);
    rs := public._presence_setting_num('commission_seller_rate', 0.17);
  end if;
  if t.base_forfait_cents is not null and t.included_hours is not null then
    m := greatest(0, mins - t.included_hours * 60);
    billed := floor(m / 60) + case when (m - floor(m / 60) * 60) >= thr then 1 else 0 end;
    sub := round(t.base_forfait_cents + t.hourly_rate_cents * billed)::bigint;
  else
    billed := greatest(1, floor(mins / 60.0) + case when (mins % 60) >= thr then 1 else 0 end);
    sub := round(t.hourly_rate_cents * billed)::bigint;
  end if;
  bf := round(sub * rb)::bigint;
  sf := round(sub * rs)::bigint;
  return jsonb_build_object('duration_minutes', mins, 'recalcule', true, 'threshold', thr, 'billed_hours', billed,
    'subtotal_cents', sub, 'buyer_fee_cents', bf, 'seller_fee_cents', sf,
    'total_charged_cents', sub + bf, 'payout_cents', sub - sf);
end $$;
revoke all on function public._presence_amounts(uuid, timestamptz) from public, anon, authenticated;

-- Contrôle d'heure (heure de Paris). Arrivée : jamais avant le jour du rendez-vous, jamais plus de 12 h après
-- l'heure prévue (au-delà : PING) ; avertissement avant H-30 min et après H+3 h. Fin : après l'arrivée, au plus
-- 24 h après (au-delà : PING) ; avertissement sous 5 min ou au-delà de 12 h. Sans rendez-vous fixé (anciennes
-- missions) : accepté, avec l'avertissement « sans_rdv ».
create or replace function public._presence_window(p_tx uuid, p_phase text, p_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t record; lbl text;
begin
  select scheduled_at, arrived_at into t from public.transactions where id = p_tx;
  if not found then return jsonb_build_object('ok', false, 'reason', 'introuvable', 'message', 'Mission introuvable.'); end if;
  if p_phase = 'arrivee' then
    if t.scheduled_at is null then return jsonb_build_object('ok', true, 'warning', 'sans_rdv'); end if;
    lbl := to_char(t.scheduled_at at time zone 'Europe/Paris', 'DD/MM "à" HH24:MI');
    if (p_at at time zone 'Europe/Paris')::date < (t.scheduled_at at time zone 'Europe/Paris')::date then
      return jsonb_build_object('ok', false, 'reason', 'trop_tot',
        'message', format('Le rendez-vous est prévu le %s : l''arrivée ne peut pas être validée avant ce jour-là.', lbl));
    end if;
    if p_at > t.scheduled_at + interval '12 hours' then
      return jsonb_build_object('ok', false, 'reason', 'trop_tard',
        'message', format('Le rendez-vous était prévu le %s : plus de 12 h après, l''arrivée est fixée par le support PING (ou fixez un nouveau rendez-vous).', lbl));
    end if;
    if p_at < t.scheduled_at - interval '30 minutes' then
      return jsonb_build_object('ok', true, 'warning', 'en_avance');
    elsif p_at > t.scheduled_at + interval '3 hours' then
      return jsonb_build_object('ok', true, 'warning', 'en_retard');
    end if;
    return jsonb_build_object('ok', true);
  end if;
  if t.arrived_at is null then
    return jsonb_build_object('ok', false, 'reason', 'pas_arrive', 'message', 'L''arrivée n''a pas encore été validée.');
  end if;
  if p_at < t.arrived_at then
    return jsonb_build_object('ok', false, 'reason', 'incoherent', 'message', 'L''heure de fin précède l''heure d''arrivée.');
  end if;
  if p_at > t.arrived_at + interval '24 hours' then
    return jsonb_build_object('ok', false, 'reason', 'trop_tard',
      'message', 'Plus de 24 h après l''arrivée : l''heure de fin est fixée par le support PING.');
  end if;
  if p_at < t.arrived_at + interval '5 minutes' then return jsonb_build_object('ok', true, 'warning', 'tres_court'); end if;
  if p_at > t.arrived_at + interval '12 hours' then return jsonb_build_object('ok', true, 'warning', 'tres_long'); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public._presence_window(uuid, text, timestamptz) from public, anon, authenticated;

-- Applique une arrivée ou une fin APRÈS vérification de la preuve par l'appelant. Seul point d'écriture de
-- arrived_at / completed_at. Pose un message système dans le fil (au nom de p_actor, kind = 'system').
create or replace function public._presence_apply(
  p_tx uuid, p_phase text, p_proof text, p_at timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_actor uuid default null, p_check_window boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; w jsonb := jsonb_build_object('ok', true); a jsonb; prev_claims text; prev_sub text;
  hhmm text; how text; body text; mins int; dur text; remote boolean := p_proof in ('distance_code', 'distance_confirmation');
begin
  select * into t from public.transactions where id = p_tx for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'introuvable', 'message', 'Mission introuvable.'); end if;
  if t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'annulee', 'message', 'Cette réservation a été annulée.');
  end if;
  if not coalesce(t.price_confirmed, false) then
    return jsonb_build_object('ok', false, 'reason', 'non_confirmee', 'message', 'Le tarif de cette mission n''est pas encore validé.');
  end if;
  if p_phase = 'arrivee' then
    if t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true, 'at', t.arrived_at); end if;
    if t.status <> 'pending' then
      return jsonb_build_object('ok', false, 'reason', 'statut', 'message', 'Cette mission ne peut plus démarrer.');
    end if;
  elsif p_phase = 'fin' then
    if t.completed_at is not null then return jsonb_build_object('ok', true, 'already', true, 'at', t.completed_at); end if;
    if t.arrived_at is null then
      return jsonb_build_object('ok', false, 'reason', 'pas_arrive', 'message', 'L''arrivée n''a pas encore été validée.');
    end if;
  else
    raise exception 'Phase inconnue.';
  end if;
  if p_check_window then
    w := public._presence_window(p_tx, p_phase, p_at);
    if not coalesce((w->>'ok')::boolean, false) then return w; end if;
  end if;

  -- Identité du prestataire le temps de l'écriture (voir l'en-tête), rétablie juste après.
  prev_claims := current_setting('request.jwt.claims', true);
  prev_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims',
    (coalesce(nullif(prev_claims, '')::jsonb, '{}'::jsonb) || jsonb_build_object('sub', t.seller_id::text))::text, true);
  perform set_config('request.jwt.claim.sub', t.seller_id::text, true);

  if p_phase = 'arrivee' then
    update public.transactions set
      arrived_at = p_at, status = 'arrived',
      arrival_method = case p_proof when 'qr_sur_place' then 'qr_sur_place'
                                    when 'distance_code' then 'geoloc_code'
                                    when 'distance_confirmation' then 'geoloc_code'
                                    else 'qr_client' end,
      arrival_proof = p_proof,
      arrival_lat = case when remote then p_lat end,
      arrival_lng = case when remote then p_lng end,
      presence_notes = coalesce(presence_notes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'phase', p_phase, 'preuve', p_proof, 'heure', p_at, 'par', p_actor, 'le', now(), 'avertissement', w->>'warning'))
    where id = p_tx;
  else
    a := public._presence_amounts(p_tx, p_at);
    update public.transactions set
      completed_at = p_at, status = 'completed',
      duration_minutes = (a->>'duration_minutes')::int,
      completion_proof = p_proof,
      completion_lat = case when remote then p_lat end,
      completion_lng = case when remote then p_lng end,
      subtotal_cents = case when (a->>'recalcule')::boolean then (a->>'subtotal_cents')::bigint else subtotal_cents end,
      buyer_fee_cents = case when (a->>'recalcule')::boolean then (a->>'buyer_fee_cents')::bigint else buyer_fee_cents end,
      seller_fee_cents = case when (a->>'recalcule')::boolean then (a->>'seller_fee_cents')::bigint else seller_fee_cents end,
      total_charged_cents = case when (a->>'recalcule')::boolean then (a->>'total_charged_cents')::bigint else total_charged_cents end,
      payout_cents = case when (a->>'recalcule')::boolean then (a->>'payout_cents')::bigint else payout_cents end,
      presence_notes = coalesce(presence_notes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'phase', p_phase, 'preuve', p_proof, 'heure', p_at, 'par', p_actor, 'le', now(), 'avertissement', w->>'warning'))
    where id = p_tx;
  end if;

  perform set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(prev_sub, ''), true);

  -- Les preuves de cette phase ne servent plus.
  update public.mission_proofs set used_at = now(), code_clair = null
    where transaction_id = p_tx and phase = p_phase and used_at is null;
  update public.presence_requests set used_at = coalesce(used_at, now()), code_clair = null
    where transaction_id = p_tx and phase = p_phase and used_at is null;

  hhmm := to_char(p_at at time zone 'Europe/Paris', 'HH24:MI');
  how := case p_proof
    when 'qr' then 'QR du client scanné par le prestataire'
    when 'code' then 'code du client saisi par le prestataire'
    when 'qr_sur_place' then 'QR laissé sur place par le client'
    when 'distance_code' then 'client absent, code dicté par le client'
    when 'distance_confirmation' then 'client absent, confirmée par le client dans l''application'
    when 'admin' then 'heure fixée par PING'
    else p_proof end;
  if p_phase = 'arrivee' then
    body := format('✓ Arrivée validée à %s — %s%s', hhmm, how,
      case when coalesce(t.hourly_rate_cents, 0) > 0 then ' — le chrono démarre' else '' end);
  else
    mins := (a->>'duration_minutes')::int;
    dur := case when mins >= 60 then (mins / 60)::text || ' h ' || lpad((mins % 60)::text, 2, '0') else mins::text || ' min' end;
    body := format('✓ Fin validée à %s — %s sur place%s, prestation %s — %s', hhmm, dur,
      case when (a->>'recalcule')::boolean and (a->>'billed_hours') is not null
           then format(' (%s h facturée%s)', replace((a->>'billed_hours')::numeric::text, '.', ','),
                       case when (a->>'billed_hours')::numeric > 1 then 's' else '' end)
           else '' end,
      replace(to_char(((a->>'subtotal_cents')::numeric) / 100.0, 'FM999999990.00'), '.', ',') || ' €', how);
  end if;
  if w->>'warning' = 'en_avance' then body := body || ' (avant l''heure du rendez-vous)';
  elsif w->>'warning' = 'en_retard' then body := body || ' (plus de 3 h après l''heure du rendez-vous)';
  elsif w->>'warning' = 'tres_court' then body := body || ' (moins de 5 min sur place)';
  elsif w->>'warning' = 'tres_long' then body := body || ' (plus de 12 h sur place)';
  end if;
  insert into public.messages (transaction_id, sender_id, kind, body)
    values (p_tx, coalesce(p_actor, t.seller_id), 'system', body);

  return jsonb_build_object('ok', true, 'phase', p_phase, 'proof', p_proof, 'at', p_at, 'warning', w->>'warning',
    'duration_minutes', a->'duration_minutes', 'billed_hours', a->'billed_hours', 'subtotal_cents', a->'subtotal_cents');
end $$;
revoke all on function public._presence_apply(uuid, text, text, timestamptz, double precision, double precision, uuid, boolean)
  from public, anon, authenticated;

-- 5. Verrou : plus aucune écriture directe de l'arrivée / de la fin ------------------------------------------
-- Fonction créée en 011, branchée en 013. Désormais SECURITY INVOKER : current_user vaut 'authenticated' pour un
-- appel direct de l'API, et le propriétaire des fonctions quand l'écriture vient d'une fonction definer
-- ci-dessus (ou 'service_role' / 'postgres' côté serveur) — on refuse donc tout ce qui vient directement de
-- l'API, quel que soit l'utilisateur (client OU prestataire), sauf un admin PING.
create or replace function public.enforce_arrival_departure_by_seller() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.arrived_at is not null or new.completed_at is not null or new.arrival_proof is not null
       or new.completion_proof is not null or coalesce(new.presence_notes, '[]'::jsonb) <> '[]'::jsonb then
      raise exception 'L''arrivée et la fin d''une mission se valident avec le QR ou le code du client.';
    end if;
    return new;
  end if;
  if new.arrived_at is distinct from old.arrived_at or new.completed_at is distinct from old.completed_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.arrival_method is distinct from old.arrival_method or new.arrival_proof is distinct from old.arrival_proof
     or new.arrival_lat is distinct from old.arrival_lat or new.arrival_lng is distinct from old.arrival_lng
     or new.completion_proof is distinct from old.completion_proof
     or new.completion_lat is distinct from old.completion_lat or new.completion_lng is distinct from old.completion_lng
     or new.presence_notes is distinct from old.presence_notes
     or (new.status is distinct from old.status and new.status in ('arrived', 'completed')) then
    raise exception 'L''arrivée et la fin d''une mission se valident avec le QR ou le code du client.';
  end if;
  -- « Je pars » : pas avant le jour du rendez-vous.
  if old.en_route_at is null and new.en_route_at is not null and old.scheduled_at is not null
     and (now() at time zone 'Europe/Paris')::date < (old.scheduled_at at time zone 'Europe/Paris')::date then
    raise exception '%', format('Le rendez-vous est prévu le %s : « Je pars » s''active le jour même.',
      to_char(old.scheduled_at at time zone 'Europe/Paris', 'DD/MM "à" HH24:MI'));
  end if;
  return new;
end $$;
revoke execute on function public.enforce_arrival_departure_by_seller() from public, anon, authenticated;
create or replace trigger trg_enforce_arrival_departure
  before insert or update on public.transactions
  for each row execute function public.enforce_arrival_departure_by_seller();

-- 6. API client : afficher sa preuve (QR + code) -------------------------------------------------------------
-- p_phase null = phase courante. Renouvelle le jeton s'il reste moins de 2 min, s'il a servi, ou après 5 essais
-- de code ratés ; l'ancien jeton reste valable jusqu'à son expiration.
create or replace function public.get_mission_proof(p_transaction uuid, p_phase text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; ph text; pr record; tok text; code text; exp timestamptz;
        keep_prev boolean := false;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, buyer_id, status, price_confirmed, arrived_at, completed_at into t
    from public.transactions where id = p_transaction;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  if t.status = 'cancelled' then raise exception 'Cette réservation a été annulée.'; end if;
  if not coalesce(t.price_confirmed, false) then raise exception 'Le tarif de cette mission n''est pas encore validé.'; end if;
  ph := coalesce(p_phase, case when t.arrived_at is null then 'arrivee' else 'fin' end);
  if ph not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  if (ph = 'arrivee' and t.arrived_at is not null) or (ph = 'fin' and t.completed_at is not null) then
    return jsonb_build_object('phase', ph, 'done', true);
  end if;
  if ph = 'fin' and t.arrived_at is null then return jsonb_build_object('phase', ph, 'ready', false); end if;

  select * into pr from public.mission_proofs where transaction_id = p_transaction and phase = ph for update;
  if found and pr.used_at is null and pr.attempts < 5 and pr.expires_at > now() + interval '2 minutes' then
    return jsonb_build_object('phase', ph, 'token', pr.token, 'code', pr.code_clair, 'expires_at', pr.expires_at);
  end if;
  keep_prev := found and pr.used_at is null and pr.attempts < 5 and pr.expires_at > now();
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  code := public._presence_code();
  exp := now() + interval '10 minutes';
  insert into public.mission_proofs (transaction_id, phase, token, code_hash, code_clair, expires_at)
    values (p_transaction, ph, tok, public._presence_hash(p_transaction, ph, code), code, exp)
    on conflict (transaction_id, phase) do update set
      prev_token = case when keep_prev then public.mission_proofs.token end,
      prev_expires_at = case when keep_prev then public.mission_proofs.expires_at end,
      token = excluded.token, code_hash = excluded.code_hash, code_clair = excluded.code_clair,
      expires_at = excluded.expires_at, attempts = 0, used_at = null, created_at = now();
  return jsonb_build_object('phase', ph, 'token', tok, 'code', code, 'expires_at', exp);
end $$;
revoke all on function public.get_mission_proof(uuid, text) from public, anon;
grant execute on function public.get_mission_proof(uuid, text) to authenticated;

-- 7. API prestataire : valider avec le QR ou un code ----------------------------------------------------------
-- p_proof = jeton du QR (client présent), ou code à 6 chiffres (affiché chez le client présent, ou dicté par le
-- client absent après request_remote_presence). Ne lève jamais d'exception sur une mauvaise preuve (sinon le
-- compteur d'essais serait annulé) : renvoie {ok:false, reason, message, remaining}.
create or replace function public.validate_presence(p_transaction uuid, p_phase text, p_proof text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; pr record; rq record; proof text := trim(coalesce(p_proof, ''));
        h text; w jsonb; kind text; pr_live boolean := false; rq_live boolean := false; used int := 0;
        res jsonb; lat double precision; lng double precision;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  select id, seller_id, status, arrived_at, completed_at into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then
    raise exception 'Ce code doit être validé depuis le compte du prestataire de cette mission.';
  end if;
  if t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'annulee', 'message', 'Cette réservation a été annulée.');
  end if;
  if p_phase = 'arrivee' and t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  if p_phase = 'fin' and t.completed_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  w := public._presence_window(p_transaction, p_phase, now());
  if not coalesce((w->>'ok')::boolean, false) then return w; end if;

  select * into pr from public.mission_proofs where transaction_id = p_transaction and phase = p_phase for update;
  if found then pr_live := pr.used_at is null; end if;
  select * into rq from public.presence_requests where transaction_id = p_transaction and phase = p_phase for update;
  if found then rq_live := rq.used_at is null and rq.declined_at is null and rq.code_expires_at > now(); end if;

  if proof ~ '^[0-9]{6}$' then
    h := public._presence_hash(p_transaction, p_phase, proof);
    if pr_live and pr.attempts < 5 and pr.expires_at > now() and pr.code_hash = h then
      kind := 'code';
    elsif rq_live and rq.attempts < 5 and rq.code_hash = h then
      kind := 'distance_code'; lat := rq.lat; lng := rq.lng;
    else
      if pr_live and pr.expires_at > now() then
        update public.mission_proofs set attempts = attempts + 1 where transaction_id = p_transaction and phase = p_phase;
        used := greatest(used, pr.attempts + 1);
      end if;
      if rq_live then
        update public.presence_requests set attempts = attempts + 1,
          code_clair = case when attempts + 1 >= 5 then null else code_clair end
          where transaction_id = p_transaction and phase = p_phase;
        used := greatest(used, rq.attempts + 1);
      end if;
      if used = 0 then
        return jsonb_build_object('ok', false, 'reason', 'expired',
          'message', 'Code expiré ou absent : demandez au client d''afficher son code, ou un nouveau code.');
      elsif used >= 5 then
        return jsonb_build_object('ok', false, 'reason', 'locked', 'remaining', 0,
          'message', 'Trop d''essais : le client doit afficher un nouveau code.');
      end if;
      return jsonb_build_object('ok', false, 'reason', 'bad_code', 'remaining', 5 - used,
        'message', format('Code incorrect. Il reste %s essai%s.', 5 - used, case when 5 - used > 1 then 's' else '' end));
    end if;
  else
    if pr_live and ((pr.token = proof and pr.expires_at > now())
                    or (pr.prev_token is not null and pr.prev_token = proof and pr.prev_expires_at > now())) then
      kind := 'qr';
    else
      return jsonb_build_object('ok', false, 'reason', 'bad_token',
        'message', 'QR invalide ou expiré : demandez au client d''afficher à nouveau son QR dans l''application.');
    end if;
  end if;

  res := public._presence_apply(p_transaction, p_phase, kind, now(), lat, lng, uid, true);
  return res;
end $$;
revoke all on function public.validate_presence(uuid, text, text) from public, anon;
grant execute on function public.validate_presence(uuid, text, text) to authenticated;

-- Raccourcis aux noms du cahier des charges.
create or replace function public.arrive_with_token(p_transaction uuid, p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select public.validate_presence(p_transaction, 'arrivee', p_token)
$$;
revoke all on function public.arrive_with_token(uuid, text) from public, anon;
grant execute on function public.arrive_with_token(uuid, text) to authenticated;

create or replace function public.complete_with_token(p_transaction uuid, p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select public.validate_presence(p_transaction, 'fin', p_token)
$$;
revoke all on function public.complete_with_token(uuid, text) from public, anon;
grant execute on function public.complete_with_token(uuid, text) to authenticated;

create or replace function public.complete_with_code(p_transaction uuid, p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select public.validate_presence(p_transaction, 'fin', p_code)
$$;
revoke all on function public.complete_with_code(uuid, text) from public, anon;
grant execute on function public.complete_with_code(uuid, text) to authenticated;

-- 8. Client absent : demande à distance du prestataire --------------------------------------------------------
-- Position relevée une fois, avec consentement, déjà comparée à l'adresse par /api/arrival. Arrivée : seulement
-- après « Je pars ». Code (15 min) jamais renvoyé au prestataire ; le client peut aussi confirmer en un appui
-- (arrivée : 3 h, fin : 48 h ; au-delà, décision de PING). 1 demande par minute, 5 par phase.
create or replace function public.request_remote_presence(
  p_transaction uuid, p_phase text, p_lat double precision, p_lng double precision,
  p_distance_m int default null, p_geo_status text default 'non_verifiable')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; c record; w jsonb; code text;
        exp timestamptz := now() + interval '15 minutes'; v_until timestamptz;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Position invalide.';
  end if;
  if coalesce(p_geo_status, '') not in ('conforme', 'non_verifiable') then raise exception 'Statut de position invalide.'; end if;
  select id, seller_id, status, price_confirmed, en_route_at, arrived_at, completed_at into t
    from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de la mission.'; end if;
  if t.status = 'cancelled' or not coalesce(t.price_confirmed, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'Cette mission n''est pas confirmée ou a été annulée.');
  end if;
  if p_phase = 'arrivee' then
    if t.arrived_at is not null or t.status <> 'pending' then
      return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'L''arrivée est déjà validée.');
    end if;
    if t.en_route_at is null then
      return jsonb_build_object('ok', false, 'reason', 'pas_en_route', 'message', 'Annoncez d''abord votre départ (« Je pars »).');
    end if;
  else
    if t.arrived_at is null or t.completed_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'La mission n''est pas en cours.');
    end if;
  end if;
  w := public._presence_window(p_transaction, p_phase, now());
  if not coalesce((w->>'ok')::boolean, false) then return w; end if;

  select * into c from public.presence_requests where transaction_id = p_transaction and phase = p_phase for update;
  if found then
    if c.created_at > now() - interval '60 seconds' and c.used_at is null and c.declined_at is null then
      return jsonb_build_object('ok', false, 'reason', 'throttled',
        'message', 'Le client vient d''être prévenu : patientez une minute avant une nouvelle demande.');
    end if;
    if c.issued_count >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'too_many',
        'message', 'Trop de demandes pour cette mission. Contactez le support PING.');
    end if;
  end if;
  v_until := now() + case when p_phase = 'arrivee' then interval '3 hours' else interval '48 hours' end;
  code := public._presence_code();
  insert into public.presence_requests (transaction_id, phase, requested_at, code_hash, code_clair, code_expires_at,
                                        confirm_until, lat, lng, distance_m, geo_status)
    values (p_transaction, p_phase, now(), public._presence_hash(p_transaction, p_phase, code), code, exp,
            v_until, p_lat, p_lng, p_distance_m, p_geo_status)
    on conflict (transaction_id, phase) do update set
      requested_at = now(), code_hash = excluded.code_hash, code_clair = excluded.code_clair,
      code_expires_at = excluded.code_expires_at, confirm_until = excluded.confirm_until, attempts = 0,
      issued_count = public.presence_requests.issued_count + 1, lat = excluded.lat, lng = excluded.lng,
      distance_m = excluded.distance_m, geo_status = excluded.geo_status,
      confirmed_at = null, declined_at = null, used_at = null, created_at = now();

  insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'system',
    case when p_phase = 'arrivee'
      then 'Le prestataire indique être sur place et ne pas vous y trouver. Ouvrez « Mission du jour » pour confirmer sa présence en un appui, ou lui dicter le code affiché (valable 15 minutes). Ne confirmez que si c''est normal. '
      else 'Le prestataire indique avoir terminé la mission en votre absence. Ouvrez « Mission du jour » pour voir la durée et le montant, puis confirmer la fin en un appui ou contester. '
    end
    || case when p_geo_status = 'conforme' then 'Sa position déclarée correspond à l''adresse du rendez-vous.'
            else 'Sa position n''a pas pu être comparée à l''adresse du rendez-vous.' end);

  return jsonb_build_object('ok', true, 'expires_at', exp, 'confirm_until', v_until, 'geo', p_geo_status, 'warning', w->>'warning');
end $$;
revoke all on function public.request_remote_presence(uuid, text, double precision, double precision, int, text) from public, anon;
grant execute on function public.request_remote_presence(uuid, text, double precision, double precision, int, text) to authenticated;

-- 9. Client absent : le client confirme (un appui) ou conteste -----------------------------------------------
-- L'heure retenue est celle déclarée par le prestataire (requested_at), pas celle de la confirmation.
create or replace function public.client_confirm_presence(p_transaction uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; rq record; res jsonb;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  select id, buyer_id into t from public.transactions where id = p_transaction for update;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  select * into rq from public.presence_requests where transaction_id = p_transaction and phase = p_phase for update;
  if not found or rq.used_at is not null or rq.declined_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'aucune_demande', 'message', 'Aucune demande en attente.');
  end if;
  if rq.confirm_until <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expiree',
      'message', 'Demande expirée : le prestataire doit en refaire une, ou contactez le support PING.');
  end if;
  update public.presence_requests set confirmed_at = now() where transaction_id = p_transaction and phase = p_phase;
  res := public._presence_apply(p_transaction, p_phase, 'distance_confirmation', rq.requested_at, rq.lat, rq.lng, uid, true);
  if not coalesce((res->>'ok')::boolean, false) then
    update public.presence_requests set confirmed_at = null where transaction_id = p_transaction and phase = p_phase;
  end if;
  return res;
end $$;
revoke all on function public.client_confirm_presence(uuid, text) from public, anon;
grant execute on function public.client_confirm_presence(uuid, text) to authenticated;

create or replace function public.client_decline_presence(p_transaction uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; n int;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  select id, buyer_id into t from public.transactions where id = p_transaction;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  update public.presence_requests set declined_at = now(), code_clair = null
    where transaction_id = p_transaction and phase = p_phase and used_at is null and declined_at is null;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'reason', 'aucune_demande', 'message', 'Aucune demande en attente.'); end if;
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'system',
    case when p_phase = 'arrivee'
      then 'Le client indique que la présence du prestataire n''est pas normale : l''arrivée n''est pas validée. Échangez dans la conversation ou signalez l''échange.'
      else 'Le client conteste la fin de mission annoncée : elle n''est pas validée. Échangez dans la conversation ou signalez l''échange.' end);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.client_decline_presence(uuid, text) from public, anon;
grant execute on function public.client_decline_presence(uuid, text) to authenticated;

-- 10. État de la mission du jour (les deux parties ; le code n'est renvoyé qu'au client) ---------------------
create or replace function public.presence_state(p_transaction uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; v_role text; ph text; rem jsonb := '{}'::jsonb; r record; etat text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from public.transactions where id = p_transaction;
  if not found then raise exception 'Mission introuvable.'; end if;
  v_role := case when uid = t.seller_id then 'prestataire' when uid = t.buyer_id then 'client'
               when public.is_admin() then 'admin' end;
  if v_role is null then raise exception 'Réservé aux parties de la mission.'; end if;
  ph := case when t.status = 'cancelled' then 'annulee' when t.completed_at is not null then 'terminee'
             when t.arrived_at is not null then 'en_cours' when t.en_route_at is not null then 'en_route' else 'avant' end;
  for r in select * from public.presence_requests where transaction_id = p_transaction loop
    etat := case when r.used_at is not null then 'validee' when r.declined_at is not null then 'refusee'
                 when r.confirm_until <= now() then 'expiree' else 'en_attente' end;
    rem := rem || jsonb_build_object(r.phase, jsonb_build_object(
      'etat', etat, 'requested_at', r.requested_at, 'code_expires_at', r.code_expires_at,
      'confirm_until', r.confirm_until, 'geo_status', r.geo_status, 'distance_m', r.distance_m,
      'code', case when v_role = 'client' and etat = 'en_attente' and r.code_expires_at > now() then r.code_clair end,
      'preview', case when r.phase = 'fin' and etat = 'en_attente' then public._presence_amounts(p_transaction, r.requested_at) end));
  end loop;
  return jsonb_build_object(
    'v', 38, 'role', v_role, 'phase', ph, 'scheduled_at', t.scheduled_at,
    'en_route_at', t.en_route_at, 'arrived_at', t.arrived_at, 'completed_at', t.completed_at,
    'arrival_proof', coalesce(t.arrival_proof, case t.arrival_method when 'qr_client' then 'qr' when 'qr_sur_place' then 'qr_sur_place'
                                                                   when 'geoloc_code' then 'distance_code' when 'photo_gps' then 'photo_gps' end),
    'completion_proof', t.completion_proof,
    'remote', rem,
    'window', jsonb_build_object(
      'arrivee', case when t.arrived_at is null and t.status <> 'cancelled' then public._presence_window(p_transaction, 'arrivee', now()) end,
      'fin', case when t.arrived_at is not null and t.completed_at is null then public._presence_window(p_transaction, 'fin', now()) end),
    'preview_now', case when t.arrived_at is not null and t.completed_at is null then public._presence_amounts(p_transaction, now()) end);
end $$;
revoke all on function public.presence_state(uuid) from public, anon;
grant execute on function public.presence_state(uuid) to authenticated;

-- 11. Décision de PING (fin non confirmée, mission hors délai…) ---------------------------------------------
create or replace function public.admin_set_presence(p_transaction uuid, p_phase text, p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Réservé à PING.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  return public._presence_apply(p_transaction, p_phase, 'admin', coalesce(p_at, now()), null, null, auth.uid(), false);
end $$;
revoke all on function public.admin_set_presence(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_presence(uuid, text, timestamptz) to authenticated;

-- 12. Fonctions de 033 / 035 : mêmes signatures, nouveau mécanisme ------------------------------------------
-- QR laissé sur place : désormais soumis au contrôle d'heure et enregistré par _presence_apply.
create or replace function public.arrive_with_onsite_token(p_transaction uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; ok boolean; res jsonb;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, seller_id, status, arrived_at into t from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then
    raise exception 'Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.';
  end if;
  if t.status = 'cancelled' then raise exception 'Cette réservation a été annulée.'; end if;
  if t.arrived_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  select true into ok from public.mission_onsite_tokens
    where transaction_id = p_transaction and used_at is null and token = p_token;
  if ok is not true then raise exception 'Code invalide ou déjà utilisé.'; end if;
  res := public._presence_apply(p_transaction, 'arrivee', 'qr_sur_place', now(), null, null, uid, true);
  if not coalesce((res->>'ok')::boolean, false) then raise exception '%', coalesce(res->>'message', 'Arrivée refusée.'); end if;
  update public.mission_onsite_tokens set used_at = now() where transaction_id = p_transaction;
  return res;
end $$;
revoke all on function public.arrive_with_onsite_token(uuid, text) from public, anon;
grant execute on function public.arrive_with_onsite_token(uuid, text) to authenticated;

-- Ancienne demande de code (arrivée) : délègue à request_remote_presence.
create or replace function public.request_arrival_code(
  p_transaction uuid, p_lat double precision, p_lng double precision,
  p_distance_m int default null, p_geo_status text default 'non_verifiable')
returns jsonb language sql security definer set search_path = public as $$
  select public.request_remote_presence(p_transaction, 'arrivee', p_lat, p_lng, p_distance_m, p_geo_status)
$$;
revoke all on function public.request_arrival_code(uuid, double precision, double precision, int, text) from public, anon;
grant execute on function public.request_arrival_code(uuid, double precision, double precision, int, text) to authenticated;

-- Le client lit le code d'arrivée à distance (même résultat qu'en 035).
create or replace function public.get_arrival_code(p_transaction uuid)
returns table (code text, expires_at timestamptz, geo_status text, distance_m int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.transactions t where t.id = p_transaction and t.buyer_id = uid) then
    raise exception 'Réservé au client de la mission.';
  end if;
  return query select r.code_clair, r.code_expires_at, r.geo_status, r.distance_m
    from public.presence_requests r
    where r.transaction_id = p_transaction and r.phase = 'arrivee' and r.code_clair is not null
      and r.used_at is null and r.declined_at is null and r.code_expires_at > now() and r.attempts < 5;
end $$;
revoke all on function public.get_arrival_code(uuid) from public, anon;
grant execute on function public.get_arrival_code(uuid) to authenticated;

-- Ancienne saisie du code (arrivée) : délègue à validate_presence (mêmes raisons : bad_code, locked, expired).
create or replace function public.arrive_with_code(p_transaction uuid, p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select public.validate_presence(p_transaction, 'arrivee', p_code)
$$;
revoke all on function public.arrive_with_code(uuid, text) from public, anon;
grant execute on function public.arrive_with_code(uuid, text) to authenticated;

-- 13. Pastille « Messages » : une demande de confirmation en attente compte comme un non-lu pour le client ----
create or replace function public.unread_counts()
returns table (transaction_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select x.transaction_id, sum(x.n)::bigint as n from (
    select m.transaction_id, count(*)::bigint as n
    from public.messages m
    join public.transactions t on t.id = m.transaction_id
    left join public.message_reads r on r.transaction_id = m.transaction_id and r.user_id = auth.uid()
    where auth.uid() is not null
      and auth.uid() in (t.buyer_id, t.seller_id)
      and m.sender_id is not null
      and m.sender_id <> auth.uid()
      and coalesce(m.kind, 'text') <> 'system'
      and (r.last_read_at is null or m.created_at > r.last_read_at)
    group by m.transaction_id
    union all
    select pr.transaction_id, 1::bigint
    from public.presence_requests pr
    join public.transactions t on t.id = pr.transaction_id
    where auth.uid() is not null and t.buyer_id = auth.uid() and t.status <> 'cancelled'
      and pr.used_at is null and pr.declined_at is null and pr.confirm_until > now()
  ) x
  group by x.transaction_id
$$;
revoke execute on function public.unread_counts() from public, anon;
grant execute on function public.unread_counts() to authenticated;

-- 14. Facture : la preuve réelle et le forfait sont recopiés dans la ligne de prestation -------------------
-- (generate_invoices n'est pas modifiée : on complète la ligne au moment de l'insertion.)
create or replace function public.invoice_presence_details() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; l jsonb;
begin
  if new.kind is distinct from 'prestation' or jsonb_typeof(new.lines) is distinct from 'array'
     or jsonb_array_length(new.lines) = 0 or jsonb_typeof(new.lines -> 0) is distinct from 'object' then
    return new;
  end if;
  select arrival_proof, arrival_method, completion_proof, base_forfait_cents, included_hours
    into t from public.transactions where id = new.transaction_id;
  if not found then return new; end if;
  l := (new.lines -> 0) || jsonb_strip_nulls(jsonb_build_object(
    'preuve_arrivee', coalesce(t.arrival_proof, case t.arrival_method when 'qr_client' then 'qr' when 'qr_sur_place' then 'qr_sur_place'
                                                                      when 'geoloc_code' then 'distance_code' when 'photo_gps' then 'photo_gps' end),
    'preuve_depart', t.completion_proof,
    'forfait_cents', t.base_forfait_cents,
    'heures_incluses', t.included_hours));
  new.lines := jsonb_set(new.lines, '{0}', l);
  return new;
end $$;
revoke execute on function public.invoice_presence_details() from public, anon, authenticated;
create or replace trigger trg_invoice_presence_details
  before insert on public.invoices
  for each row execute function public.invoice_presence_details();
