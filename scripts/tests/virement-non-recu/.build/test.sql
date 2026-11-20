-- Schéma minimal (copie des colonnes utiles) pour tester la migration 059 hors Supabase.
drop schema if exists vtest cascade;
create schema vtest;
set search_path = vtest, public;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table app_settings(key text primary key, value jsonb);
create table admins(id uuid primary key);
create or replace function is_admin() returns boolean language sql stable as $$ select exists (select 1 from admins where id = auth.uid()) $$;
create table transactions(id uuid primary key, buyer_id uuid, seller_id uuid);
create table messages(id uuid primary key default gen_random_uuid(), transaction_id uuid, sender_id uuid not null, kind text, body text, created_at timestamptz default now());
create table payment_alerts(id uuid primary key default gen_random_uuid(), provider_id uuid, kind text not null, detail jsonb not null default '{}', created_at timestamptz default now(), handled_at timestamptz);
create table commission_debts(id uuid primary key default gen_random_uuid(), provider_id uuid, transaction_id uuid, amount_cents integer, reason text, status text default 'open', recovered_at timestamptz);
create table provider_profiles(id uuid primary key, is_active boolean default true, payments_suspended_at timestamptz);
create table provider_private(id uuid primary key, suspension_reason text, updated_at timestamptz);
create table transfer_payments (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null unique, transaction_id uuid not null,
  payer_role text not null check (payer_role in ('client','pro')), payee text not null check (payee in ('pro','ping')),
  payer_id uuid not null, payee_id uuid, reference text not null, amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'a_payer' check (status in ('a_payer','declare_paye','recu','en_retard')),
  due_at timestamptz not null default now() + interval '15 days', declared_at timestamptz, received_at timestamptz,
  created_at timestamptz not null default now(), suspended_at timestamptz);
grant usage on schema vtest to authenticated;
grant usage on schema auth to authenticated;
grant select, update on transfer_payments to authenticated;
grant select on messages, payment_alerts to authenticated;

create or replace function guard_transfer_payment()
returns trigger language plpgsql security definer set search_path = vtest, public as $$
declare uid uuid := auth.uid();
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' then return new; end if;
  if uid is null or is_admin() then
    if new.status = 'recu' and new.received_at is null then new.received_at := now(); end if;
    if new.status = 'declare_paye' and new.declared_at is null then new.declared_at := now(); end if;
    return new;
  end if;
  if row(new.invoice_id, new.transaction_id, new.payer_role, new.payee, new.payer_id, new.payee_id,
         new.reference, new.amount_cents, new.due_at, new.created_at)
     is distinct from
     row(old.invoice_id, old.transaction_id, old.payer_role, old.payee, old.payer_id, old.payee_id,
         old.reference, old.amount_cents, old.due_at, old.created_at) then
    raise exception 'Seul le statut du virement peut être modifié.';
  end if;
  if new.status = old.status then
    new.declared_at := old.declared_at; new.received_at := old.received_at; return new;
  end if;
  if old.status = 'recu' then raise exception 'Virement déjà noté reçu.'; end if;
  if new.status = 'declare_paye' and uid = old.payer_id then
    new.declared_at := now(); new.received_at := null; return new;
  end if;
  if new.status = 'a_payer' and uid = old.payer_id and old.status = 'declare_paye' then
    new.declared_at := null; return new;
  end if;
  if new.status = 'recu' and old.payee = 'pro' and uid = old.payee_id then
    new.received_at := now(); new.declared_at := old.declared_at; return new;
  end if;
  raise exception 'Action non autorisée sur ce virement.';
end $$;
create trigger trg_guard_transfer_payment before update on transfer_payments for each row execute function guard_transfer_payment();
create or replace function transfer_payment_received()
returns trigger language plpgsql security definer set search_path = vtest, public as $$
begin
  if new.status = 'recu' and old.status is distinct from 'recu' and new.payer_role = 'pro' then
    update commission_debts set status = 'recovered', recovered_at = now()
     where transaction_id = new.transaction_id and provider_id = new.payer_id
       and reason = 'Commission non réglée par virement' and status = 'open';
  end if;
  return new;
end $$;
create trigger trg_transfer_payment_received after update on transfer_payments for each row execute function transfer_payment_received();
-- 059 — Virement « non reçu » (20/11/2026). À COLLER à la main dans l'éditeur SQL Supabase (rejouable, aucun DROP).
-- Prérequis : 025 (virements), 040 et 054 (gardes, suspension) déjà appliquées.
--
-- Cas traité : le client a cliqué « J'ai fait le virement » (statut declare_paye) mais le destinataire ne l'a pas reçu.
--   * le prestataire (pour SA prestation) ou PING (admin, pour les frais et commissions) répond « Non reçu » :
--     RPC transfer_report_not_received -> le statut reste « annoncé », la ligne est marquée (not_received_*),
--     un message système part dans la conversation de la mission (les deux parties le voient en temps réel),
--     une alerte arrive dans l'admin (payment_alerts, kind transfer_not_received) ;
--   * le payeur répond « Mon virement est bien parti » : RPC transfer_reaffirm -> la ligne devient un DÉSACCORD
--     visible de l'admin (le prestataire peut recocher « Non reçu » ou noter « Reçu ») ; « Pas encore fait » lève la
--     contestation (retour à « À régler ») ;
--   * relance : mark_overdue_transfers passe « en retard » un virement contesté sans réponse du payeur après
--     `transfer_not_received_days` jours (3 par défaut) au lieu d'attendre 10 jours ; commission du prestataire en
--     retard = dette + plafond + suspension, comme avant (reprise à l'identique de 054, sauf cette règle).
-- Les colonnes ne bougent que par ces RPC (ou l'admin) : verrou trg_guard_transfer_not_received.
-- L'application détecte l'absence de ce fichier (colonne not_received_at absente) et masque les boutons.

alter table transfer_payments add column if not exists not_received_at timestamptz;
alter table transfer_payments add column if not exists not_received_by uuid;
alter table transfer_payments add column if not exists not_received_note text;
alter table transfer_payments add column if not exists reaffirmed_at timestamptz;
alter table transfer_payments add column if not exists reaffirmed_note text;
do $$ begin
  alter table transfer_payments add constraint transfer_payments_notes_len
    check (char_length(coalesce(not_received_note, '')) <= 500 and char_length(coalesce(reaffirmed_note, '')) <= 500);
exception when duplicate_object then null; end $$;
insert into app_settings (key, value) values ('transfer_not_received_days', '3'::jsonb) on conflict (key) do nothing;

-- Verrou : ces colonnes ne se modifient que par les RPC ci-dessous (réglage local 'ping.amiable', déjà utilisé
-- par 040 et 054, qu'un appel PostgREST ne peut pas poser) ou par l'admin / le serveur.
create or replace function guard_transfer_not_received()
returns trigger language plpgsql security definer set search_path = vtest, public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or is_admin() then
    return new;
  end if;
  if row(new.not_received_at, new.not_received_by, new.not_received_note, new.reaffirmed_at, new.reaffirmed_note)
     is distinct from row(old.not_received_at, old.not_received_by, old.not_received_note, old.reaffirmed_at, old.reaffirmed_note) then
    raise exception 'Utilisez « Non reçu » ou « Mon virement est bien parti » pour contester ou confirmer un virement.';
  end if;
  -- Le payeur qui revient à « À régler » (« Pas encore fait ») lève la contestation.
  if new.status = 'a_payer' and old.status is distinct from 'a_payer' and old.not_received_at is not null then
    new.not_received_at := null; new.not_received_by := null; new.not_received_note := null;
    new.reaffirmed_at := null; new.reaffirmed_note := null;
  end if;
  return new;
end $$;
revoke execute on function guard_transfer_not_received() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_not_received before update on transfer_payments
  for each row execute function guard_transfer_not_received();

-- Message système dans la conversation de la mission (kind 'system', émis au nom de l'auteur de l'action).
create or replace function _transfer_say(p_tx uuid, p_by uuid, p_body text) returns void
language plpgsql security definer set search_path = vtest, public as $$
begin
  insert into messages (transaction_id, sender_id, kind, body) values (p_tx, p_by, 'system', p_body);
end $$;
revoke execute on function _transfer_say(uuid, uuid, text) from public, anon, authenticated;

-- « Non reçu » : le prestataire (sa prestation) ou l'admin (tout virement). Le virement doit avoir été annoncé.
create or replace function transfer_report_not_received(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = vtest, public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
        adm boolean := is_admin(); who text; what text; alert_for uuid;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if not adm and not (t.payee = 'pro' and t.payee_id = uid) then
    raise exception 'Seul le destinataire du virement (ou PING) peut dire qu''il n''est pas arrivé.';
  end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.declared_at is null then raise exception 'Le virement n''a pas encore été annoncé : rien à contester.'; end if;
  who := case when adm and not (t.payee = 'pro' and t.payee_id = uid) then 'PING' else 'Le prestataire' end;
  what := case when t.payee = 'pro' then 'le virement de la prestation' when t.payer_role = 'client' then 'le virement des frais de service' else 'le virement de la commission' end;
  perform set_config('ping.amiable', 'on', true);
  update transfer_payments
     set not_received_at = now(), not_received_by = uid, not_received_note = note, reaffirmed_at = null, reaffirmed_note = null
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform _transfer_say(t.transaction_id, uid,
    who || ' n''a pas reçu ' || what || ' ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €) annoncé le ' || to_char(t.declared_at at time zone 'Europe/Paris', 'DD/MM') || '. Merci de vérifier le montant, la référence et l''IBAN, puis de confirmer dans '
    || 'l''écran Facturation de la mission. PING est informé.' || case when note is not null then ' Précision : ' || note else '' end);
  alert_for := case when t.payee = 'pro' then t.payee_id else t.payer_id end;
  insert into payment_alerts (provider_id, kind, detail)
  values (alert_for, 'transfer_not_received', jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents,
          'transactionId', t.transaction_id, 'transferId', t.id, 'payee', t.payee, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function transfer_report_not_received(uuid, text) from public, anon;
grant execute on function transfer_report_not_received(uuid, text) to authenticated;

-- « Mon virement est bien parti » : le payeur maintient. Désaccord visible de l'admin ; l'échéance de 10 jours repart.
create or replace function transfer_reaffirm(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = vtest, public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if t.payer_id <> uid then raise exception 'Seul le payeur peut confirmer son virement.'; end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.not_received_at is null then raise exception 'Ce virement n''est pas contesté.'; end if;
  perform set_config('ping.amiable', 'on', true);
  update transfer_payments
     set status = 'declare_paye', declared_at = now(), received_at = null, reaffirmed_at = now(), reaffirmed_note = note
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform _transfer_say(t.transaction_id, uid,
    'Le payeur maintient avoir fait le virement ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €). Désaccord signalé à PING, qui peut intervenir dans cette conversation.' || case when note is not null then ' Précision : ' || note else '' end);
  insert into payment_alerts (provider_id, kind, detail)
  values (case when t.payee = 'pro' then t.payee_id else t.payer_id end, 'transfer_disagreement',
          jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents, 'transactionId', t.transaction_id, 'transferId', t.id, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function transfer_reaffirm(uuid, text) from public, anon;
grant execute on function transfer_reaffirm(uuid, text) to authenticated;

-- Relance quotidienne : reprise de 054 (virements suspendus par un litige ignorés) + virement contesté sans
-- réponse du payeur après `transfer_not_received_days` jours -> « en retard ».
create or replace function mark_overdue_transfers()
returns integer language plpgsql security definer set search_path = vtest, public as $$
declare r record; n int := 0; owed int; plafond int; nr_days int;
begin
  select coalesce((value #>> '{}')::int, 3) into nr_days from app_settings where key = 'transfer_not_received_days';
  nr_days := coalesce(nr_days, 3);
  for r in
    update transfer_payments set status = 'en_retard'
     where suspended_at is null
       and ((status = 'a_payer' and due_at < now())
         or (status = 'declare_paye' and declared_at < now() - interval '10 days')
         or (status = 'declare_paye' and not_received_at is not null
             and (reaffirmed_at is null or reaffirmed_at < not_received_at)
             and not_received_at < now() - make_interval(days => nr_days)))
    returning *
  loop
    n := n + 1;
    if r.payer_role = 'pro' and r.amount_cents > 0 then
      insert into commission_debts (provider_id, transaction_id, amount_cents, reason)
      select r.payer_id, r.transaction_id, r.amount_cents, 'Commission non réglée par virement'
       where not exists (select 1 from commission_debts d where d.transaction_id = r.transaction_id
                          and d.provider_id = r.payer_id and d.reason = 'Commission non réglée par virement');
      insert into payment_alerts (provider_id, kind, detail)
      values (r.payer_id, 'transfer_overdue', jsonb_build_object('reference', r.reference, 'amountCents', r.amount_cents, 'transactionId', r.transaction_id));
      select coalesce(sum(amount_cents), 0) into owed from commission_debts where provider_id = r.payer_id and status = 'open';
      select coalesce((value #>> '{}')::int, 5000) into plafond from app_settings where key = 'unpaid_ceiling_cents';
      if owed > coalesce(plafond, 5000)
         and exists (select 1 from provider_profiles where id = r.payer_id and payments_suspended_at is null) then
        update provider_profiles set is_active = false, payments_suspended_at = now() where id = r.payer_id;
        insert into provider_private (id, suspension_reason, updated_at)
        values (r.payer_id, 'Commissions impayées : ' || to_char(owed / 100.0, 'FM999990.00') || ' € (plafond ' || to_char(coalesce(plafond,5000) / 100.0, 'FM999990.00') || ' €).', now())
        on conflict (id) do update set suspension_reason = excluded.suspension_reason, updated_at = now();
        insert into payment_alerts (provider_id, kind, detail)
        values (r.payer_id, 'suspended', jsonb_build_object('reason', 'virements de commission en retard', 'openDebtCents', owed));
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function mark_overdue_transfers() from public, anon, authenticated;

-- Vérification après coup :
--   select column_name from information_schema.columns where table_name = 'transfer_payments' and column_name like 'not_received%';
--   select proname from pg_proc where proname in ('transfer_report_not_received', 'transfer_reaffirm');

-- 059 — Virement « non reçu » (20/11/2026). À COLLER à la main dans l'éditeur SQL Supabase (rejouable, aucun DROP).
-- Prérequis : 025 (virements), 040 et 054 (gardes, suspension) déjà appliquées.
--
-- Cas traité : le client a cliqué « J'ai fait le virement » (statut declare_paye) mais le destinataire ne l'a pas reçu.
--   * le prestataire (pour SA prestation) ou PING (admin, pour les frais et commissions) répond « Non reçu » :
--     RPC transfer_report_not_received -> le statut reste « annoncé », la ligne est marquée (not_received_*),
--     un message système part dans la conversation de la mission (les deux parties le voient en temps réel),
--     une alerte arrive dans l'admin (payment_alerts, kind transfer_not_received) ;
--   * le payeur répond « Mon virement est bien parti » : RPC transfer_reaffirm -> la ligne devient un DÉSACCORD
--     visible de l'admin (le prestataire peut recocher « Non reçu » ou noter « Reçu ») ; « Pas encore fait » lève la
--     contestation (retour à « À régler ») ;
--   * relance : mark_overdue_transfers passe « en retard » un virement contesté sans réponse du payeur après
--     `transfer_not_received_days` jours (3 par défaut) au lieu d'attendre 10 jours ; commission du prestataire en
--     retard = dette + plafond + suspension, comme avant (reprise à l'identique de 054, sauf cette règle).
-- Les colonnes ne bougent que par ces RPC (ou l'admin) : verrou trg_guard_transfer_not_received.
-- L'application détecte l'absence de ce fichier (colonne not_received_at absente) et masque les boutons.

alter table transfer_payments add column if not exists not_received_at timestamptz;
alter table transfer_payments add column if not exists not_received_by uuid;
alter table transfer_payments add column if not exists not_received_note text;
alter table transfer_payments add column if not exists reaffirmed_at timestamptz;
alter table transfer_payments add column if not exists reaffirmed_note text;
do $$ begin
  alter table transfer_payments add constraint transfer_payments_notes_len
    check (char_length(coalesce(not_received_note, '')) <= 500 and char_length(coalesce(reaffirmed_note, '')) <= 500);
exception when duplicate_object then null; end $$;
insert into app_settings (key, value) values ('transfer_not_received_days', '3'::jsonb) on conflict (key) do nothing;

-- Verrou : ces colonnes ne se modifient que par les RPC ci-dessous (réglage local 'ping.amiable', déjà utilisé
-- par 040 et 054, qu'un appel PostgREST ne peut pas poser) ou par l'admin / le serveur.
create or replace function guard_transfer_not_received()
returns trigger language plpgsql security definer set search_path = vtest, public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or is_admin() then
    return new;
  end if;
  if row(new.not_received_at, new.not_received_by, new.not_received_note, new.reaffirmed_at, new.reaffirmed_note)
     is distinct from row(old.not_received_at, old.not_received_by, old.not_received_note, old.reaffirmed_at, old.reaffirmed_note) then
    raise exception 'Utilisez « Non reçu » ou « Mon virement est bien parti » pour contester ou confirmer un virement.';
  end if;
  -- Le payeur qui revient à « À régler » (« Pas encore fait ») lève la contestation.
  if new.status = 'a_payer' and old.status is distinct from 'a_payer' and old.not_received_at is not null then
    new.not_received_at := null; new.not_received_by := null; new.not_received_note := null;
    new.reaffirmed_at := null; new.reaffirmed_note := null;
  end if;
  return new;
end $$;
revoke execute on function guard_transfer_not_received() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_not_received before update on transfer_payments
  for each row execute function guard_transfer_not_received();

-- Message système dans la conversation de la mission (kind 'system', émis au nom de l'auteur de l'action).
create or replace function _transfer_say(p_tx uuid, p_by uuid, p_body text) returns void
language plpgsql security definer set search_path = vtest, public as $$
begin
  insert into messages (transaction_id, sender_id, kind, body) values (p_tx, p_by, 'system', p_body);
end $$;
revoke execute on function _transfer_say(uuid, uuid, text) from public, anon, authenticated;

-- « Non reçu » : le prestataire (sa prestation) ou l'admin (tout virement). Le virement doit avoir été annoncé.
create or replace function transfer_report_not_received(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = vtest, public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
        adm boolean := is_admin(); who text; what text; alert_for uuid;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if not adm and not (t.payee = 'pro' and t.payee_id = uid) then
    raise exception 'Seul le destinataire du virement (ou PING) peut dire qu''il n''est pas arrivé.';
  end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.declared_at is null then raise exception 'Le virement n''a pas encore été annoncé : rien à contester.'; end if;
  who := case when adm and not (t.payee = 'pro' and t.payee_id = uid) then 'PING' else 'Le prestataire' end;
  what := case when t.payee = 'pro' then 'le virement de la prestation' when t.payer_role = 'client' then 'le virement des frais de service' else 'le virement de la commission' end;
  perform set_config('ping.amiable', 'on', true);
  update transfer_payments
     set not_received_at = now(), not_received_by = uid, not_received_note = note, reaffirmed_at = null, reaffirmed_note = null
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform _transfer_say(t.transaction_id, uid,
    who || ' n''a pas reçu ' || what || ' ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €) annoncé le ' || to_char(t.declared_at at time zone 'Europe/Paris', 'DD/MM') || '. Merci de vérifier le montant, la référence et l''IBAN, puis de confirmer dans '
    || 'l''écran Facturation de la mission. PING est informé.' || case when note is not null then ' Précision : ' || note else '' end);
  alert_for := case when t.payee = 'pro' then t.payee_id else t.payer_id end;
  insert into payment_alerts (provider_id, kind, detail)
  values (alert_for, 'transfer_not_received', jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents,
          'transactionId', t.transaction_id, 'transferId', t.id, 'payee', t.payee, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function transfer_report_not_received(uuid, text) from public, anon;
grant execute on function transfer_report_not_received(uuid, text) to authenticated;

-- « Mon virement est bien parti » : le payeur maintient. Désaccord visible de l'admin ; l'échéance de 10 jours repart.
create or replace function transfer_reaffirm(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = vtest, public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if t.payer_id <> uid then raise exception 'Seul le payeur peut confirmer son virement.'; end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.not_received_at is null then raise exception 'Ce virement n''est pas contesté.'; end if;
  perform set_config('ping.amiable', 'on', true);
  update transfer_payments
     set status = 'declare_paye', declared_at = now(), received_at = null, reaffirmed_at = now(), reaffirmed_note = note
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform _transfer_say(t.transaction_id, uid,
    'Le payeur maintient avoir fait le virement ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €). Désaccord signalé à PING, qui peut intervenir dans cette conversation.' || case when note is not null then ' Précision : ' || note else '' end);
  insert into payment_alerts (provider_id, kind, detail)
  values (case when t.payee = 'pro' then t.payee_id else t.payer_id end, 'transfer_disagreement',
          jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents, 'transactionId', t.transaction_id, 'transferId', t.id, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function transfer_reaffirm(uuid, text) from public, anon;
grant execute on function transfer_reaffirm(uuid, text) to authenticated;

-- Relance quotidienne : reprise de 054 (virements suspendus par un litige ignorés) + virement contesté sans
-- réponse du payeur après `transfer_not_received_days` jours -> « en retard ».
create or replace function mark_overdue_transfers()
returns integer language plpgsql security definer set search_path = vtest, public as $$
declare r record; n int := 0; owed int; plafond int; nr_days int;
begin
  select coalesce((value #>> '{}')::int, 3) into nr_days from app_settings where key = 'transfer_not_received_days';
  nr_days := coalesce(nr_days, 3);
  for r in
    update transfer_payments set status = 'en_retard'
     where suspended_at is null
       and ((status = 'a_payer' and due_at < now())
         or (status = 'declare_paye' and declared_at < now() - interval '10 days')
         or (status = 'declare_paye' and not_received_at is not null
             and (reaffirmed_at is null or reaffirmed_at < not_received_at)
             and not_received_at < now() - make_interval(days => nr_days)))
    returning *
  loop
    n := n + 1;
    if r.payer_role = 'pro' and r.amount_cents > 0 then
      insert into commission_debts (provider_id, transaction_id, amount_cents, reason)
      select r.payer_id, r.transaction_id, r.amount_cents, 'Commission non réglée par virement'
       where not exists (select 1 from commission_debts d where d.transaction_id = r.transaction_id
                          and d.provider_id = r.payer_id and d.reason = 'Commission non réglée par virement');
      insert into payment_alerts (provider_id, kind, detail)
      values (r.payer_id, 'transfer_overdue', jsonb_build_object('reference', r.reference, 'amountCents', r.amount_cents, 'transactionId', r.transaction_id));
      select coalesce(sum(amount_cents), 0) into owed from commission_debts where provider_id = r.payer_id and status = 'open';
      select coalesce((value #>> '{}')::int, 5000) into plafond from app_settings where key = 'unpaid_ceiling_cents';
      if owed > coalesce(plafond, 5000)
         and exists (select 1 from provider_profiles where id = r.payer_id and payments_suspended_at is null) then
        update provider_profiles set is_active = false, payments_suspended_at = now() where id = r.payer_id;
        insert into provider_private (id, suspension_reason, updated_at)
        values (r.payer_id, 'Commissions impayées : ' || to_char(owed / 100.0, 'FM999990.00') || ' € (plafond ' || to_char(coalesce(plafond,5000) / 100.0, 'FM999990.00') || ' €).', now())
        on conflict (id) do update set suspension_reason = excluded.suspension_reason, updated_at = now();
        insert into payment_alerts (provider_id, kind, detail)
        values (r.payer_id, 'suspended', jsonb_build_object('reason', 'virements de commission en retard', 'openDebtCents', owed));
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function mark_overdue_transfers() from public, anon, authenticated;

-- Vérification après coup :
--   select column_name from information_schema.columns where table_name = 'transfer_payments' and column_name like 'not_received%';
--   select proname from pg_proc where proname in ('transfer_report_not_received', 'transfer_reaffirm');

set search_path = vtest, public;
insert into transactions values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'); insert into admins values ('33333333-3333-3333-3333-333333333333');
insert into provider_profiles values ('22222222-2222-2222-2222-222222222222'); insert into app_settings values ('unpaid_ceiling_cents', '5000'::jsonb);
insert into transfer_payments (id, invoice_id, transaction_id, payer_role, payee, payer_id, payee_id, reference, amount_cents, status, declared_at)
 values ('a0000000-0000-0000-0000-000000000001', gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'client', 'pro', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'FACT-1', 9000, 'a_payer', null),
        ('a0000000-0000-0000-0000-000000000002', gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'pro', 'ping', '22222222-2222-2222-2222-222222222222', null, 'PING-V-1', 1530, 'declare_paye', now() - interval '12 days');
grant select, insert on messages, payment_alerts to authenticated; grant select, insert, update on commission_debts, provider_profiles, provider_private to authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
do $$ begin perform transfer_report_not_received('a0000000-0000-0000-0000-000000000001', 'x'); raise notice 'RES|KO|non reçu refusé tant que le client n a rien annoncé|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|non reçu refusé tant que le client n a rien annoncé|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
update transfer_payments set status = 'declare_paye' where id = 'a0000000-0000-0000-0000-000000000001';
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
do $$ begin perform transfer_report_not_received('a0000000-0000-0000-0000-000000000001', 'x'); raise notice 'RES|KO|le payeur ne peut pas se déclarer « non reçu » lui-même|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|le payeur ne peut pas se déclarer « non reçu » lui-même|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
do $$ begin update transfer_payments set not_received_at = now() where id = 'a0000000-0000-0000-0000-000000000001'; raise notice 'RES|KO|le payeur ne peut pas écrire not_received_at en direct|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|le payeur ne peut pas écrire not_received_at en direct|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
do $$ begin update transfer_payments set not_received_at = now() where id = 'a0000000-0000-0000-0000-000000000001'; raise notice 'RES|KO|le prestataire ne peut pas écrire not_received_at en direct|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|le prestataire ne peut pas écrire not_received_at en direct|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
select transfer_report_not_received('a0000000-0000-0000-0000-000000000001', 'Rien sur mon compte depuis 3 jours');
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select status = 'declare_paye' and not_received_at is not null and not_received_by = '22222222-2222-2222-2222-222222222222' and not_received_note like 'Rien%' from transfer_payments where id = 'a0000000-0000-0000-0000-000000000001')) then raise notice 'RES|OK|contestation posée, statut resté « annoncé »|'; else raise notice 'RES|KO|contestation posée, statut resté « annoncé »|condition fausse'; end if; end $$;
do $$ begin if ((select count(*) from messages where transaction_id = '44444444-4444-4444-4444-444444444444' and kind = 'system' and sender_id = '22222222-2222-2222-2222-222222222222' and body like '%n''a pas reçu%FACT-1%90,00 €%') = 1) then raise notice 'RES|OK|message système dans la conversation, signé du prestataire|'; else raise notice 'RES|KO|message système dans la conversation, signé du prestataire|condition fausse'; end if; end $$;
do $$ begin if ((select count(*) from payment_alerts where kind = 'transfer_not_received' and detail->>'reference' = 'FACT-1') = 1) then raise notice 'RES|OK|alerte admin créée|'; else raise notice 'RES|KO|alerte admin créée|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
do $$ begin perform transfer_report_not_received('a0000000-0000-0000-0000-000000000001', null); raise notice 'RES|KO|un tiers (autre compte) ne peut pas contester|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|un tiers (autre compte) ne peut pas contester|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
select transfer_reaffirm('a0000000-0000-0000-0000-000000000001', 'Virement fait mardi, preuve à l''appui');
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select not_received_at is not null and reaffirmed_at is not null and status = 'declare_paye' and declared_at > now() - interval '1 minute' from transfer_payments where id = 'a0000000-0000-0000-0000-000000000001')) then raise notice 'RES|OK|désaccord : contestation gardée, réaffirmation posée, annonce renouvelée|'; else raise notice 'RES|KO|désaccord : contestation gardée, réaffirmation posée, annonce renouvelée|condition fausse'; end if; end $$;
do $$ begin if ((select count(*) from payment_alerts where kind = 'transfer_disagreement') = 1) then raise notice 'RES|OK|alerte « désaccord » pour l admin|'; else raise notice 'RES|KO|alerte « désaccord » pour l admin|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
select transfer_report_not_received('a0000000-0000-0000-0000-000000000001', 'Toujours rien');
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select reaffirmed_at is null from transfer_payments where id = 'a0000000-0000-0000-0000-000000000001')) then raise notice 'RES|OK|nouvelle contestation : la réaffirmation est effacée|'; else raise notice 'RES|KO|nouvelle contestation : la réaffirmation est effacée|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
update transfer_payments set status = 'a_payer' where id = 'a0000000-0000-0000-0000-000000000001';
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select status = 'a_payer' and not_received_at is null and reaffirmed_at is null from transfer_payments where id = 'a0000000-0000-0000-0000-000000000001')) then raise notice 'RES|OK|« Pas encore fait » lève la contestation|'; else raise notice 'RES|KO|« Pas encore fait » lève la contestation|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;
update transfer_payments set status = 'declare_paye' where id = 'a0000000-0000-0000-0000-000000000001';
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
select transfer_report_not_received('a0000000-0000-0000-0000-000000000001', null);
reset role; select set_config('request.jwt.claim.sub', '', false);
update transfer_payments set not_received_at = now() - interval '4 days' where id = 'a0000000-0000-0000-0000-000000000001';
select mark_overdue_transfers();
do $$ begin if ((select status = 'en_retard' from transfer_payments where id = 'a0000000-0000-0000-0000-000000000001')) then raise notice 'RES|OK|contesté depuis 4 j sans réponse du payeur : « en retard » (pas besoin d attendre 10 j)|'; else raise notice 'RES|KO|contesté depuis 4 j sans réponse du payeur : « en retard » (pas besoin d attendre 10 j)|condition fausse'; end if; end $$;
do $$ begin if ((select status = 'en_retard' from transfer_payments where id = 'a0000000-0000-0000-0000-000000000002')) then raise notice 'RES|OK|commission annoncée depuis 12 j : en retard|'; else raise notice 'RES|KO|commission annoncée depuis 12 j : en retard|condition fausse'; end if; end $$;
do $$ begin if ((select count(*) = 1 and sum(amount_cents) = 1530 from commission_debts where provider_id = '22222222-2222-2222-2222-222222222222')) then raise notice 'RES|OK|dette de commission créée (15,30 €), une seule|'; else raise notice 'RES|KO|dette de commission créée (15,30 €), une seule|condition fausse'; end if; end $$;
do $$ begin if ((select payments_suspended_at is null from provider_profiles where id = '22222222-2222-2222-2222-222222222222')) then raise notice 'RES|OK|sous le plafond (50 €) : pas de suspension|'; else raise notice 'RES|KO|sous le plafond (50 €) : pas de suspension|condition fausse'; end if; end $$;
select mark_overdue_transfers();
do $$ begin if ((select count(*) = 1 from commission_debts where provider_id = '22222222-2222-2222-2222-222222222222')) then raise notice 'RES|OK|2e passage : pas de doublon de dette|'; else raise notice 'RES|KO|2e passage : pas de doublon de dette|condition fausse'; end if; end $$;
update app_settings set value = '1000'::jsonb where key = 'unpaid_ceiling_cents';
insert into transfer_payments (invoice_id, transaction_id, payer_role, payee, payer_id, reference, amount_cents, status, declared_at)
 values (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'pro', 'ping', '22222222-2222-2222-2222-222222222222', 'PING-V-2', 2000, 'declare_paye', now() - interval '11 days');
select mark_overdue_transfers();
do $$ begin if ((select payments_suspended_at is not null and is_active = false from provider_profiles where id = '22222222-2222-2222-2222-222222222222')) then raise notice 'RES|OK|plafond dépassé (35,30 € > 10 €) : compte suspendu et masqué|'; else raise notice 'RES|KO|plafond dépassé (35,30 € > 10 €) : compte suspendu et masqué|condition fausse'; end if; end $$;
insert into transfer_payments (id, invoice_id, transaction_id, payer_role, payee, payer_id, reference, amount_cents, status, declared_at)
 values ('a0000000-0000-0000-0000-000000000003', gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'pro', 'ping', '22222222-2222-2222-2222-222222222222', 'PING-V-3', 500, 'declare_paye', now());
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false); set role authenticated;
select transfer_report_not_received('a0000000-0000-0000-0000-000000000003', 'Pas sur le relevé PING');
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select count(*) from messages where body like 'PING n''a pas reçu le virement de la commission PING-V-3%') = 1) then raise notice 'RES|OK|admin : « non reçu » sur une commission, message signé « PING »|'; else raise notice 'RES|KO|admin : « non reçu » sur une commission, message signé « PING »|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
select transfer_reaffirm('a0000000-0000-0000-0000-000000000003', null);
reset role; select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false); set role authenticated;
update transfer_payments set status = 'recu' where id = 'a0000000-0000-0000-0000-000000000003';
reset role; select set_config('request.jwt.claim.sub', '', false);
do $$ begin if ((select status = 'recu' and not_received_at is not null from transfer_payments where id = 'a0000000-0000-0000-0000-000000000003')) then raise notice 'RES|OK|l admin tranche : noté reçu (historique de contestation conservé)|'; else raise notice 'RES|KO|l admin tranche : noté reçu (historique de contestation conservé)|condition fausse'; end if; end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;
do $$ begin perform transfer_report_not_received('a0000000-0000-0000-0000-000000000003', null); raise notice 'RES|KO|un virement reçu ne se conteste plus|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|un virement reçu ne se conteste plus|%', sqlerrm; end $$;
reset role; select set_config('request.jwt.claim.sub', '', false);
reset role;
drop schema vtest cascade;
