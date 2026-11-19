-- 048 — Process, paiement et validation commande (maquette validée par Romain le 18/11/2026, section
-- « Process, paiement et validation commande »). NON APPLIQUÉE par Claude.
-- Copie identique dans supabase/a_coller/048_process_commande.sql. À coller APRÈS 038 (elle en réécrit
-- plusieurs fonctions avec CREATE OR REPLACE et lit ses tables). Additive et idempotente : rien n'est retiré, aucune
-- suppression de données, aucune ligne existante modifiée.
--
-- Ce qu'elle ajoute :
--   1. Présence annoncée par le client, juste après la commande : « Je serai sur place » / « Je ne serai pas
--      sur place » (transactions.client_presence), modifiable jusqu'à l'arrivée, posée par le client SEUL
--      (set_client_presence ; toute écriture directe est refusée par trg_guard_client_presence). Le prestataire
--      la voit sur le billet de mission ; un message système et la pastille Messages le préviennent.
--   2. Client absent, arrivée : photo OBLIGATOIRE prise par le prestataire (bucket privé `presence-photos`,
--      `<uid du prestataire>/<id mission>/<fichier>`, écrite par le prestataire de la mission, lue par les deux
--      parties et PING), envoyée dans la messagerie avec la distance à l'adresse et l'heure (un seul message,
--      `messages.photo_path`, kind = 'system'). RPC request_absent_arrival. Le client confirme en un appui
--      (client_confirm_presence, 038) ou envoie un code de validation (client_send_presence_code) que le
--      prestataire saisit (validate_presence).
--   3. Client absent, fin : le prestataire « demande le code de fin » (request_end_code, sans position), le
--      client « envoie son code de fin » (client_send_presence_code : affiché dans son application et posté dans
--      la messagerie), le prestataire le SAISIT pour clôturer (validate_presence). Jamais de validation par le
--      prestataire seul ; sans réponse sous 24 h, PING décide (admin_set_presence, 038).
--   4. L'heure retenue pour une validation à distance est celle annoncée par le prestataire (photo envoyée,
--      fin annoncée), pas celle de la saisie du code. La facture reprend le mode réel (photo d'arrivée, code).
--
-- Fonctions de 038 réécrites (mêmes signatures) : _presence_apply, validate_presence, request_remote_presence,
-- presence_state, unread_counts. La voie GPS « fin à distance » de 038 reste appelable (compatibilité), mais
-- une arrivée à distance exige désormais la photo (request_absent_arrival).

-- 1. Colonnes ------------------------------------------------------------------------------------------------
alter table public.transactions add column if not exists client_presence text;
alter table public.transactions add column if not exists client_presence_at timestamptz;
alter table public.transactions add column if not exists arrival_photo_path text;
alter table public.presence_requests add column if not exists photo_path text;
alter table public.presence_requests add column if not exists code_sent_at timestamptz;
-- Déjà présente en production (photo d'une proposition de tarif) ; ajoutée ici si elle manque.
alter table public.messages add column if not exists photo_path text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_client_presence_check') then
    alter table public.transactions add constraint transactions_client_presence_check
      check (client_presence is null or client_presence in ('sur_place', 'absent'));
  end if;
end $$;

-- 2. Verrou : la présence annoncée et la photo d'arrivée ne s'écrivent que par les fonctions ci-dessous -------
-- SECURITY INVOKER (comme trg_enforce_arrival_departure, 038) : current_user vaut 'authenticated' pour un appel
-- direct de l'API, et le propriétaire des fonctions quand l'écriture vient d'une fonction definer.
create or replace function public.guard_client_presence() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.client_presence is not null or new.client_presence_at is not null or new.arrival_photo_path is not null then
      raise exception 'La présence du client se déclare depuis son application, après la commande.';
    end if;
    return new;
  end if;
  if new.client_presence is distinct from old.client_presence
     or new.client_presence_at is distinct from old.client_presence_at
     or new.arrival_photo_path is distinct from old.arrival_photo_path then
    raise exception 'La présence du client se déclare depuis son application (« Je serai sur place »).';
  end if;
  return new;
end $$;
revoke execute on function public.guard_client_presence() from public, anon, authenticated;
create or replace trigger trg_guard_client_presence
  before insert or update on public.transactions
  for each row execute function public.guard_client_presence();

-- 3. Le client annonce sa présence ----------------------------------------------------------------------------
create or replace function public.set_client_presence(p_transaction uuid, p_presence text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; body text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_presence is null or p_presence not in ('sur_place', 'absent') then raise exception 'Réponse inconnue.'; end if;
  select id, buyer_id, status, price_confirmed, arrived_at, client_presence into t
    from public.transactions where id = p_transaction for update;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  if t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'annulee', 'message', 'Cette réservation a été annulée.');
  end if;
  if not coalesce(t.price_confirmed, false) then
    return jsonb_build_object('ok', false, 'reason', 'non_confirmee', 'message', 'Le tarif de cette mission n''est pas encore validé.');
  end if;
  if t.arrived_at is not null or t.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'commencee', 'message', 'La mission a commencé : votre réponse ne se modifie plus.');
  end if;
  if exists (select 1 from public.presence_requests r where r.transaction_id = p_transaction and r.phase = 'arrivee'
             and r.used_at is null and r.declined_at is null and r.confirm_until > now()) then
    return jsonb_build_object('ok', false, 'reason', 'demarche_en_cours',
      'message', 'Le prestataire vous a déjà envoyé sa photo d''arrivée : confirmez-la, ou répondez-lui dans la conversation.');
  end if;
  if t.client_presence is not distinct from p_presence then
    return jsonb_build_object('ok', true, 'presence', p_presence, 'unchanged', true);
  end if;
  update public.transactions set client_presence = p_presence, client_presence_at = now() where id = p_transaction;
  body := case when t.client_presence is null then '' else 'Changement : ' end
    || case when p_presence = 'sur_place'
         then 'le client sera sur place. Le prestataire scanne son QR à l''arrivée, puis à la fin.'
         else 'le client ne sera pas sur place. Démarche client absent : photo, position et heure dans la messagerie, puis validation ou code du client ; à la fin, code de fin du client.' end;
  body := upper(left(body, 1)) || substr(body, 2);
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'system', body);
  return jsonb_build_object('ok', true, 'presence', p_presence, 'at', now());
end $$;
revoke all on function public.set_client_presence(uuid, text) from public, anon;
grant execute on function public.set_client_presence(uuid, text) to authenticated;

-- 4. Photo d'arrivée : bucket privé et droits ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presence-photos', 'presence-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Lecture : les deux parties de la mission (2e dossier du chemin) et PING.
create or replace function public._presence_photo_reader(p_folder text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  begin v := p_folder::uuid; exception when others then return false; end;
  return public.is_admin() or exists (select 1 from public.transactions t
    where t.id = v and auth.uid() is not null and auth.uid() in (t.buyer_id, t.seller_id));
end $$;
revoke all on function public._presence_photo_reader(text) from public, anon;
grant execute on function public._presence_photo_reader(text) to authenticated;

-- Écriture : le prestataire de la mission, dans son dossier, tant que la mission n'est ni terminée ni annulée.
create or replace function public._presence_photo_writer(p_folder text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  begin v := p_folder::uuid; exception when others then return false; end;
  return exists (select 1 from public.transactions t
    where t.id = v and auth.uid() is not null and t.seller_id = auth.uid()
      and t.status in ('pending', 'arrived') and t.completed_at is null);
end $$;
revoke all on function public._presence_photo_writer(text) from public, anon;
grant execute on function public._presence_photo_writer(text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'presence_photos_read') then
    create policy presence_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'presence-photos' and public._presence_photo_reader((storage.foldername(name))[2]));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'presence_photos_insert') then
    create policy presence_photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'presence-photos' and (storage.foldername(name))[1] = auth.uid()::text
                  and public._presence_photo_writer((storage.foldername(name))[2]));
  end if;
end $$;
-- Aucune policy de modification ni de suppression : une photo envoyée reste la preuve.

-- 5. Application d'une validation (réécrit 038 : libellés selon la phase, photo recopiée sur la mission) -----
create or replace function public._presence_apply(
  p_tx uuid, p_phase text, p_proof text, p_at timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_actor uuid default null, p_check_window boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; w jsonb := jsonb_build_object('ok', true); a jsonb; prev_claims text; prev_sub text;
  hhmm text; how text; body text; mins int; dur text; remote boolean := p_proof in ('distance_code', 'distance_confirmation');
  v_photo text;
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
  if p_phase = 'arrivee' and remote then
    select r.photo_path into v_photo from public.presence_requests r where r.transaction_id = p_tx and r.phase = 'arrivee';
  end if;

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
      arrival_photo_path = coalesce(v_photo, arrival_photo_path),
      presence_notes = coalesce(presence_notes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'phase', p_phase, 'preuve', p_proof, 'heure', p_at, 'par', p_actor, 'le', now(), 'avertissement', w->>'warning',
        'photo', v_photo is not null))
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

  update public.mission_proofs set used_at = now(), code_clair = null
    where transaction_id = p_tx and phase = p_phase and used_at is null;
  update public.presence_requests set used_at = coalesce(used_at, now()), code_clair = null
    where transaction_id = p_tx and phase = p_phase and used_at is null;

  hhmm := to_char(p_at at time zone 'Europe/Paris', 'HH24:MI');
  how := case
    when p_proof = 'qr' then 'QR du client scanné par le prestataire'
    when p_proof = 'code' then 'code du client saisi par le prestataire'
    when p_proof = 'qr_sur_place' then 'QR laissé sur place par le client'
    when p_proof = 'distance_code' and p_phase = 'arrivee' then 'client absent, photo et position envoyées, code de validation du client saisi par le prestataire'
    when p_proof = 'distance_code' then 'client absent, code de fin envoyé par le client et saisi par le prestataire'
    when p_proof = 'distance_confirmation' and p_phase = 'arrivee' then 'client absent, photo et position envoyées, arrivée confirmée par le client'
    when p_proof = 'distance_confirmation' then 'client absent, fin confirmée par le client'
    when p_proof = 'admin' then 'heure fixée par PING'
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

-- 6. Saisie d'un QR ou d'un code par le prestataire (réécrit 038 : heure annoncée retenue à distance) --------
create or replace function public.validate_presence(p_transaction uuid, p_phase text, p_proof text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; pr record; rq record; proof text := regexp_replace(coalesce(p_proof, ''), '\s', '', 'g');
        h text; w jsonb; kind text; pr_live boolean := false; rq_live boolean := false; used int := 0;
        res jsonb; lat double precision; lng double precision; v_at timestamptz := now();
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
      -- Heure annoncée par le prestataire (photo envoyée, fin annoncée), pas celle de la saisie.
      v_at := least(now(), greatest(rq.requested_at, coalesce(t.arrived_at, rq.requested_at)));
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
          'message', 'Code expiré ou pas encore envoyé : demandez au client d''envoyer son code depuis l''application.');
      elsif used >= 5 then
        return jsonb_build_object('ok', false, 'reason', 'locked', 'remaining', 0,
          'message', 'Trop d''essais : le client doit envoyer un nouveau code.');
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

  res := public._presence_apply(p_transaction, p_phase, kind, v_at, lat, lng, uid, true);
  return res;
end $$;
revoke all on function public.validate_presence(uuid, text, text) from public, anon;
grant execute on function public.validate_presence(uuid, text, text) to authenticated;

-- 7. Demande à distance (cœur commun) -------------------------------------------------------------------------
-- Arrivée : photo obligatoire (déposée par le prestataire dans presence-photos/<uid>/<mission>/…), position
-- relevée une fois avec son accord, déjà comparée à l'adresse par /api/arrival. Un seul message dans le fil,
-- avec la photo, la distance et l'heure. Fin : voir request_end_code (sans position).
create or replace function public._request_remote_presence(
  p_transaction uuid, p_phase text, p_lat double precision, p_lng double precision,
  p_distance_m int, p_geo_status text, p_photo_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; c record; w jsonb; code text;
        exp timestamptz := now() + interval '15 minutes'; v_until timestamptz; photo text := nullif(trim(coalesce(p_photo_path, '')), '');
        hhmm text := to_char(now() at time zone 'Europe/Paris', 'HH24:MI'); body text;
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
    if photo is null then
      return jsonb_build_object('ok', false, 'reason', 'photo_requise', 'message', 'Prenez d''abord une photo sur place.');
    end if;
    if split_part(photo, '/', 1) <> uid::text or split_part(photo, '/', 2) <> p_transaction::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'presence-photos' and o.name = photo) then
      return jsonb_build_object('ok', false, 'reason', 'photo_invalide', 'message', 'Photo introuvable : reprenez-la, puis renvoyez-la.');
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
                                        confirm_until, lat, lng, distance_m, geo_status, photo_path, code_sent_at)
    values (p_transaction, p_phase, now(), public._presence_hash(p_transaction, p_phase, code), code, exp,
            v_until, p_lat, p_lng, p_distance_m, p_geo_status, photo, null)
    on conflict (transaction_id, phase) do update set
      requested_at = now(), code_hash = excluded.code_hash, code_clair = excluded.code_clair,
      code_expires_at = excluded.code_expires_at, confirm_until = excluded.confirm_until, attempts = 0,
      issued_count = public.presence_requests.issued_count + 1, lat = excluded.lat, lng = excluded.lng,
      distance_m = excluded.distance_m, geo_status = excluded.geo_status, photo_path = excluded.photo_path,
      code_sent_at = null, confirmed_at = null, declined_at = null, used_at = null, created_at = now();

  if p_phase = 'arrivee' then
    body := format('Photo d''arrivée du prestataire, %s — %s. Confirmez son arrivée dans « Mission du jour » (« Je confirme »), ou envoyez-lui un code de validation. Ne confirmez que si c''est normal.',
      hhmm,
      case when p_geo_status = 'conforme' and p_distance_m is not null
             then format('position à %s m de l''adresse du rendez-vous, relevée une fois avec son accord', p_distance_m)
           when p_geo_status = 'conforme' then 'position conforme à l''adresse du rendez-vous, relevée une fois avec son accord'
           else 'position relevée une fois avec son accord, non comparable à l''adresse' end);
    insert into public.messages (transaction_id, sender_id, kind, body, photo_path)
      values (p_transaction, uid, 'system', body, photo);
  else
    insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'system',
      'Le prestataire indique avoir terminé la mission en votre absence. Ouvrez « Mission du jour » pour voir la durée et le montant, puis envoyer votre code de fin ou contester.');
  end if;

  return jsonb_build_object('ok', true, 'expires_at', exp, 'confirm_until', v_until, 'geo', p_geo_status, 'warning', w->>'warning');
end $$;
revoke all on function public._request_remote_presence(uuid, text, double precision, double precision, int, text, text)
  from public, anon, authenticated;

-- Nouvelle API (arrivée, client absent) : photo obligatoire.
create or replace function public.request_absent_arrival(
  p_transaction uuid, p_lat double precision, p_lng double precision,
  p_distance_m int default null, p_geo_status text default 'non_verifiable', p_photo_path text default null)
returns jsonb language sql security definer set search_path = public as $$
  select public._request_remote_presence(p_transaction, 'arrivee', p_lat, p_lng, p_distance_m, p_geo_status, p_photo_path)
$$;
revoke all on function public.request_absent_arrival(uuid, double precision, double precision, int, text, text) from public, anon;
grant execute on function public.request_absent_arrival(uuid, double precision, double precision, int, text, text) to authenticated;

-- Ancienne API de 038 (même signature) : l'arrivée exige désormais la photo (renvoie photo_requise).
create or replace function public.request_remote_presence(
  p_transaction uuid, p_phase text, p_lat double precision, p_lng double precision,
  p_distance_m int default null, p_geo_status text default 'non_verifiable')
returns jsonb language sql security definer set search_path = public as $$
  select public._request_remote_presence(p_transaction, p_phase, p_lat, p_lng, p_distance_m, p_geo_status, null)
$$;
revoke all on function public.request_remote_presence(uuid, text, double precision, double precision, int, text) from public, anon;
grant execute on function public.request_remote_presence(uuid, text, double precision, double precision, int, text) to authenticated;

-- 8. Client absent, fin : le prestataire demande le code de fin (aucune position) -----------------------------
-- Aucun code n'existe encore : le client le crée en l'envoyant (client_send_presence_code). Sans réponse sous
-- 24 h, la fin reste non confirmée et PING décide (admin_set_presence) : jamais de validation automatique.
create or replace function public.request_end_code(p_transaction uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; c record; w jsonb; a jsonb; v_until timestamptz := now() + interval '24 hours';
        mins int; dur text; body text;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select id, seller_id, status, price_confirmed, arrived_at, completed_at into t
    from public.transactions where id = p_transaction for update;
  if not found or t.seller_id <> uid then raise exception 'Réservé au prestataire de la mission.'; end if;
  if t.status = 'cancelled' or not coalesce(t.price_confirmed, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'Cette mission n''est pas confirmée ou a été annulée.');
  end if;
  if t.arrived_at is null or t.completed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'message', 'La mission n''est pas en cours.');
  end if;
  w := public._presence_window(p_transaction, 'fin', now());
  if not coalesce((w->>'ok')::boolean, false) then return w; end if;

  select * into c from public.presence_requests where transaction_id = p_transaction and phase = 'fin' for update;
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
  insert into public.presence_requests (transaction_id, phase, requested_at, code_hash, code_clair, code_expires_at,
                                        confirm_until, lat, lng, distance_m, geo_status, photo_path, code_sent_at)
    values (p_transaction, 'fin', now(), public._presence_hash(p_transaction, 'fin', gen_random_uuid()::text), null, now(),
            v_until, null, null, null, null, null, null)
    on conflict (transaction_id, phase) do update set
      requested_at = now(), code_hash = excluded.code_hash, code_clair = null, code_expires_at = now(),
      confirm_until = excluded.confirm_until, attempts = 0, issued_count = public.presence_requests.issued_count + 1,
      lat = null, lng = null, distance_m = null, geo_status = null, photo_path = null,
      code_sent_at = null, confirmed_at = null, declined_at = null, used_at = null, created_at = now();

  a := public._presence_amounts(p_transaction, now());
  mins := coalesce((a->>'duration_minutes')::int, 0);
  dur := case when mins >= 60 then (mins / 60)::text || ' h ' || lpad((mins % 60)::text, 2, '0') else mins::text || ' min' end;
  body := format('Le prestataire indique avoir terminé : %s sur place%s, prestation %s. Envoyez votre code de fin depuis « Mission du jour » : le prestataire le saisit pour clôturer. Contestez si ce n''est pas normal.',
    dur,
    case when (a->>'recalcule')::boolean and (a->>'billed_hours') is not null
         then format(' → %s h facturée%s', replace((a->>'billed_hours')::numeric::text, '.', ','),
                     case when (a->>'billed_hours')::numeric > 1 then 's' else '' end)
         else '' end,
    replace(to_char(coalesce((a->>'subtotal_cents')::numeric, 0) / 100.0, 'FM999999990.00'), '.', ',') || ' €');
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'system', body);
  return jsonb_build_object('ok', true, 'confirm_until', v_until, 'warning', w->>'warning',
    'duration_minutes', a->'duration_minutes', 'billed_hours', a->'billed_hours', 'subtotal_cents', a->'subtotal_cents');
end $$;
revoke all on function public.request_end_code(uuid) from public, anon;
grant execute on function public.request_end_code(uuid) to authenticated;

-- 9. Client absent : le client envoie son code (validation d'arrivée ou code de fin) --------------------------
-- Le code s'affiche dans son application et part dans la messagerie (message du client) ; le prestataire le
-- saisit (validate_presence). Valable 15 min à l'arrivée, 30 min pour la fin ; renvoyé au besoin.
create or replace function public.client_send_presence_code(p_transaction uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; rq record; code text; exp timestamptz;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if p_phase not in ('arrivee', 'fin') then raise exception 'Phase inconnue.'; end if;
  select id, buyer_id, status into t from public.transactions where id = p_transaction for update;
  if not found or t.buyer_id <> uid then raise exception 'Réservé au client de la mission.'; end if;
  if t.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'annulee', 'message', 'Cette réservation a été annulée.');
  end if;
  select * into rq from public.presence_requests where transaction_id = p_transaction and phase = p_phase for update;
  if not found or rq.used_at is not null or rq.declined_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'aucune_demande', 'message', 'Aucune demande en attente.');
  end if;
  if rq.confirm_until <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expiree',
      'message', 'Demande expirée : le prestataire doit en refaire une, ou contactez le support PING.');
  end if;
  -- Code encore valable : le même est renvoyé (pas de nouveau message à chaque appui).
  if rq.code_sent_at is not null and rq.code_clair is not null and rq.attempts < 5
     and rq.code_expires_at > now() + interval '2 minutes' then
    return jsonb_build_object('ok', true, 'code', rq.code_clair, 'expires_at', rq.code_expires_at, 'already', true);
  end if;
  code := case when rq.code_sent_at is null and rq.code_clair is not null and rq.attempts < 5
                    and rq.code_expires_at > now() + interval '2 minutes' then rq.code_clair
               else public._presence_code() end;
  exp := now() + case when p_phase = 'arrivee' then interval '15 minutes' else interval '30 minutes' end;
  update public.presence_requests set code_hash = public._presence_hash(p_transaction, p_phase, code), code_clair = code,
      code_expires_at = exp, attempts = 0, code_sent_at = now()
    where transaction_id = p_transaction and phase = p_phase;
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_transaction, uid, 'text',
    format('%s : %s %s (à saisir dans « Mission du jour », valable jusqu''à %s).',
      case when p_phase = 'arrivee' then 'Code de validation de votre arrivée' else 'Mon code de fin' end,
      substr(code, 1, 3), substr(code, 4, 3), to_char(exp at time zone 'Europe/Paris', 'HH24:MI')));
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);
end $$;
revoke all on function public.client_send_presence_code(uuid, text) from public, anon;
grant execute on function public.client_send_presence_code(uuid, text) to authenticated;

-- 10. État de la mission du jour (réécrit 038 : v = 48, présence annoncée, photo, code envoyé) ---------------
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
      'photo_path', r.photo_path, 'code_sent_at', r.code_sent_at,
      'code', case when v_role = 'client' and etat = 'en_attente' and r.code_expires_at > now() then r.code_clair end,
      'preview', case when r.phase = 'fin' and etat = 'en_attente' then public._presence_amounts(p_transaction, r.requested_at) end));
  end loop;
  return jsonb_build_object(
    'v', 48, 'role', v_role, 'phase', ph, 'scheduled_at', t.scheduled_at,
    'en_route_at', t.en_route_at, 'arrived_at', t.arrived_at, 'completed_at', t.completed_at,
    'client_presence', t.client_presence, 'client_presence_at', t.client_presence_at,
    'arrival_photo_path', t.arrival_photo_path,
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

-- 11. Pastille « Messages » (réécrit 038) ----------------------------------------------------------------------
-- Client : une demande à distance en attente sans code envoyé. Prestataire : la présence annoncée (ou changée)
-- par le client, tant qu'il n'a pas rouvert la conversation et que la mission n'a pas commencé.
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
      and pr.used_at is null and pr.declined_at is null and pr.confirm_until > now() and pr.code_sent_at is null
    union all
    select t.id, 1::bigint
    from public.transactions t
    left join public.message_reads r on r.transaction_id = t.id and r.user_id = auth.uid()
    where auth.uid() is not null and t.seller_id = auth.uid() and t.status = 'pending' and t.arrived_at is null
      and t.client_presence_at is not null and (r.last_read_at is null or t.client_presence_at > r.last_read_at)
  ) x
  group by x.transaction_id
$$;
revoke execute on function public.unread_counts() from public, anon;
grant execute on function public.unread_counts() to authenticated;

-- 12. Facture : la photo d'arrivée est signalée dans la ligne de prestation -----------------------------------
create or replace function public.invoice_presence_details() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; l jsonb;
begin
  if new.kind is distinct from 'prestation' or jsonb_typeof(new.lines) is distinct from 'array'
     or jsonb_array_length(new.lines) = 0 or jsonb_typeof(new.lines -> 0) is distinct from 'object' then
    return new;
  end if;
  select arrival_proof, arrival_method, completion_proof, base_forfait_cents, included_hours, arrival_photo_path
    into t from public.transactions where id = new.transaction_id;
  if not found then return new; end if;
  l := (new.lines -> 0) || jsonb_strip_nulls(jsonb_build_object(
    'preuve_arrivee', coalesce(t.arrival_proof, case t.arrival_method when 'qr_client' then 'qr' when 'qr_sur_place' then 'qr_sur_place'
                                                                      when 'geoloc_code' then 'distance_code' when 'photo_gps' then 'photo_gps' end),
    'preuve_depart', t.completion_proof,
    'photo_arrivee', case when t.arrival_photo_path is not null then true end,
    'forfait_cents', t.base_forfait_cents,
    'heures_incluses', t.included_hours));
  new.lines := jsonb_set(new.lines, '{0}', l);
  return new;
end $$;
revoke execute on function public.invoice_presence_details() from public, anon, authenticated;
