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

alter table public.transfer_payments add column if not exists not_received_at timestamptz;
alter table public.transfer_payments add column if not exists not_received_by uuid;
alter table public.transfer_payments add column if not exists not_received_note text;
alter table public.transfer_payments add column if not exists reaffirmed_at timestamptz;
alter table public.transfer_payments add column if not exists reaffirmed_note text;
do $$ begin
  alter table public.transfer_payments add constraint transfer_payments_notes_len
    check (char_length(coalesce(not_received_note, '')) <= 500 and char_length(coalesce(reaffirmed_note, '')) <= 500);
exception when duplicate_object then null; end $$;
insert into public.app_settings (key, value) values ('transfer_not_received_days', '3'::jsonb) on conflict (key) do nothing;

-- Verrou : ces colonnes ne se modifient que par les RPC ci-dessous (réglage local 'ping.amiable', déjà utilisé
-- par 040 et 054, qu'un appel PostgREST ne peut pas poser) ou par l'admin / le serveur.
create or replace function public.guard_transfer_not_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or public.is_admin() then
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
revoke execute on function public.guard_transfer_not_received() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_not_received before update on public.transfer_payments
  for each row execute function public.guard_transfer_not_received();

-- Message système dans la conversation de la mission (kind 'system', émis au nom de l'auteur de l'action).
create or replace function public._transfer_say(p_tx uuid, p_by uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.messages (transaction_id, sender_id, kind, body) values (p_tx, p_by, 'system', p_body);
end $$;
revoke execute on function public._transfer_say(uuid, uuid, text) from public, anon, authenticated;

-- « Non reçu » : le prestataire (sa prestation) ou l'admin (tout virement). Le virement doit avoir été annoncé.
create or replace function public.transfer_report_not_received(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
        adm boolean := public.is_admin(); who text; what text; alert_for uuid;
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from public.transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if not adm and not (t.payee = 'pro' and t.payee_id = uid) then
    raise exception 'Seul le destinataire du virement (ou PING) peut dire qu''il n''est pas arrivé.';
  end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.declared_at is null then raise exception 'Le virement n''a pas encore été annoncé : rien à contester.'; end if;
  who := case when adm and not (t.payee = 'pro' and t.payee_id = uid) then 'PING' else 'Le prestataire' end;
  what := case when t.payee = 'pro' then 'le virement de la prestation' when t.payer_role = 'client' then 'le virement des frais de service' else 'le virement de la commission' end;
  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments
     set not_received_at = now(), not_received_by = uid, not_received_note = note, reaffirmed_at = null, reaffirmed_note = null
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform public._transfer_say(t.transaction_id, uid,
    who || ' n''a pas reçu ' || what || ' ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €) annoncé le ' || to_char(t.declared_at at time zone 'Europe/Paris', 'DD/MM') || '. Merci de vérifier le montant, la référence et l''IBAN, puis de confirmer dans '
    || 'l''écran Facturation de la mission. PING est informé.' || case when note is not null then ' Précision : ' || note else '' end);
  alert_for := case when t.payee = 'pro' then t.payee_id else t.payer_id end;
  insert into public.payment_alerts (provider_id, kind, detail)
  values (alert_for, 'transfer_not_received', jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents,
          'transactionId', t.transaction_id, 'transferId', t.id, 'payee', t.payee, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function public.transfer_report_not_received(uuid, text) from public, anon;
grant execute on function public.transfer_report_not_received(uuid, text) to authenticated;

-- « Mon virement est bien parti » : le payeur maintient. Désaccord visible de l'admin ; l'échéance de 10 jours repart.
create or replace function public.transfer_reaffirm(p_transfer uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record; note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  select * into t from public.transfer_payments where id = p_transfer for update;
  if not found then raise exception 'Virement introuvable.'; end if;
  if t.payer_id <> uid then raise exception 'Seul le payeur peut confirmer son virement.'; end if;
  if t.status = 'recu' then raise exception 'Ce virement est déjà noté reçu.'; end if;
  if t.not_received_at is null then raise exception 'Ce virement n''est pas contesté.'; end if;
  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments
     set status = 'declare_paye', declared_at = now(), received_at = null, reaffirmed_at = now(), reaffirmed_note = note
   where id = t.id;
  perform set_config('ping.amiable', 'off', true);
  perform public._transfer_say(t.transaction_id, uid,
    'Le payeur maintient avoir fait le virement ' || t.reference || ' (' || replace(to_char(t.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || ' €). Désaccord signalé à PING, qui peut intervenir dans cette conversation.' || case when note is not null then ' Précision : ' || note else '' end);
  insert into public.payment_alerts (provider_id, kind, detail)
  values (case when t.payee = 'pro' then t.payee_id else t.payer_id end, 'transfer_disagreement',
          jsonb_build_object('reference', t.reference, 'amountCents', t.amount_cents, 'transactionId', t.transaction_id, 'transferId', t.id, 'note', note));
  return jsonb_build_object('ok', true, 'transfer', t.id);
end $$;
revoke all on function public.transfer_reaffirm(uuid, text) from public, anon;
grant execute on function public.transfer_reaffirm(uuid, text) to authenticated;

-- Relance quotidienne : reprise de 054 (virements suspendus par un litige ignorés) + virement contesté sans
-- réponse du payeur après `transfer_not_received_days` jours -> « en retard ».
create or replace function public.mark_overdue_transfers()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; owed int; plafond int; nr_days int;
begin
  select coalesce((value #>> '{}')::int, 3) into nr_days from public.app_settings where key = 'transfer_not_received_days';
  nr_days := coalesce(nr_days, 3);
  for r in
    update public.transfer_payments set status = 'en_retard'
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
      insert into public.commission_debts (provider_id, transaction_id, amount_cents, reason)
      select r.payer_id, r.transaction_id, r.amount_cents, 'Commission non réglée par virement'
       where not exists (select 1 from public.commission_debts d where d.transaction_id = r.transaction_id
                          and d.provider_id = r.payer_id and d.reason = 'Commission non réglée par virement');
      insert into public.payment_alerts (provider_id, kind, detail)
      values (r.payer_id, 'transfer_overdue', jsonb_build_object('reference', r.reference, 'amountCents', r.amount_cents, 'transactionId', r.transaction_id));
      select coalesce(sum(amount_cents), 0) into owed from public.commission_debts where provider_id = r.payer_id and status = 'open';
      select coalesce((value #>> '{}')::int, 5000) into plafond from public.app_settings where key = 'unpaid_ceiling_cents';
      if owed > coalesce(plafond, 5000)
         and exists (select 1 from public.provider_profiles where id = r.payer_id and payments_suspended_at is null) then
        update public.provider_profiles set is_active = false, payments_suspended_at = now() where id = r.payer_id;
        insert into public.provider_private (id, suspension_reason, updated_at)
        values (r.payer_id, 'Commissions impayées : ' || to_char(owed / 100.0, 'FM999990.00') || ' € (plafond ' || to_char(coalesce(plafond,5000) / 100.0, 'FM999990.00') || ' €).', now())
        on conflict (id) do update set suspension_reason = excluded.suspension_reason, updated_at = now();
        insert into public.payment_alerts (provider_id, kind, detail)
        values (r.payer_id, 'suspended', jsonb_build_object('reason', 'virements de commission en retard', 'openDebtCents', owed));
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.mark_overdue_transfers() from public, anon, authenticated;

-- Vérification après coup :
--   select column_name from information_schema.columns where table_name = 'transfer_payments' and column_name like 'not_received%';
--   select proname from pg_proc where proname in ('transfer_report_not_received', 'transfer_reaffirm');
