-- 054 — Fin de mission et argent : paiement bloqué pendant un litige, intervention de PING, décision PING
-- (demande Romain du 20/11/2026). NON APPLIQUÉE par Claude. Copie identique dans
-- supabase/a_coller/054_litige_decision_ping.sql. À coller APRÈS 040 (arrangement à l'amiable) et 053.
-- Additive et idempotente : aucun DROP, aucun DELETE, aucune ligne existante modifiée (les colonnes ajoutées sont
-- vides ; les virements déjà en cours ne sont suspendus que si un litige est ouvert APRÈS la migration, ou s'ils
-- sont créés pendant un litige ouvert).
--
-- Les 3 fins de mission, côté argent :
--   a) Mission exécutée, sans litige : séquestre -> versement 24 h après la fin (cron /api/payments/release,
--      inchangé) ; virement -> factures et virements normaux (025, inchangé).
--   b) Litige + arrangement à l'amiable accepté par les deux (040, inchangé en base) : avoir de X € sur la
--      facture, virement ajusté ; séquestre -> la route serveur /api/disputes/apply rend X € au client et verse
--      le reste au prestataire (colonnes money_* ci-dessous pour la trace et la reprise par le cron).
--   c) Litige + intervention de PING : une partie la demande (request_ping_mediation) ; l'admin rend sa décision
--      (ping_decide_dispute) : X € rendus au client (0 à prix de la prestation), le reste au prestataire, motif.
--      Virement -> avoir de X € sur la facture et virement ajusté (comme 040) ; séquestre -> /api/disputes/apply
--      (remboursement partiel puis versement du reste). Litige clos, les deux parties prévenues.
--   Dès l'ouverture d'un litige : message « Le paiement est bloqué jusqu'à la résolution du litige » dans le fil
--   du litige ; séquestre -> versement déjà bloqué (release) ; virement -> le virement de la prestation est
--   « suspendu » (suspended_at), sans relance de retard (mark_overdue_transfers l'ignore) ; à la clôture, il
--   reprend et son échéance est décalée de la durée de la suspension.
--   Les frais de service et la commission PING ne changent pas après un avoir (047 : commission_on_credit = false).

-- 1. Colonnes ----------------------------------------------------------------------------------------------
alter table public.disputes add column if not exists mediation_requested_at timestamptz;
alter table public.disputes add column if not exists mediation_requested_by uuid;
alter table public.disputes add column if not exists decision_refund_cents integer;
alter table public.disputes add column if not exists decision_payout_cents integer;
alter table public.disputes add column if not exists decision_reason text;
alter table public.disputes add column if not exists decided_by uuid;
alter table public.disputes add column if not exists decided_at timestamptz;
-- Exécution de la répartition chez le prestataire de paiement (séquestre) : posée par le serveur (clé service).
alter table public.disputes add column if not exists money_applied_at timestamptz;
alter table public.disputes add column if not exists money_result jsonb;
alter table public.disputes add column if not exists money_error text;

do $$ begin
  alter table public.disputes add constraint disputes_decision_cents_check
    check ((decision_refund_cents is null or decision_refund_cents >= 0)
       and (decision_payout_cents is null or decision_payout_cents >= 0));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.disputes add constraint disputes_decision_reason_len
    check (decision_reason is null or char_length(decision_reason) <= 1000);
exception when duplicate_object then null; end $$;

alter table public.transfer_payments add column if not exists suspended_at timestamptz;
alter table public.transfer_payments add column if not exists suspended_dispute_id uuid;

-- 2. La suspension ne se pose et ne se lève que par la base (litige ouvert / clos) ou l'admin.
--    Même réglage local que 040 ('ping.amiable'), posé uniquement par les fonctions ci-dessous.
create or replace function public.guard_transfer_suspension()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if row(new.suspended_at, new.suspended_dispute_id) is distinct from row(old.suspended_at, old.suspended_dispute_id) then
    raise exception 'Le virement est suspendu tant que le litige est ouvert.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_transfer_suspension() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_suspension before update on public.transfer_payments
  for each row execute function public.guard_transfer_suspension();

-- Virement créé pendant un litige ouvert (litige ouvert pendant la mission, facture émise à la fin) : suspendu.
create or replace function public.transfer_suspend_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if new.payee = 'pro' and new.suspended_at is null then
    select id into did from public.disputes
     where transaction_id = new.transaction_id and status::text = 'open' order by created_at limit 1;
    if did is not null then new.suspended_at := now(); new.suspended_dispute_id := did; end if;
  end if;
  return new;
end $$;
revoke execute on function public.transfer_suspend_on_insert() from public, anon, authenticated;
create or replace trigger trg_transfer_suspend_on_insert before insert on public.transfer_payments
  for each row execute function public.transfer_suspend_on_insert();

-- 3. Ouverture d'un litige : virement de la prestation suspendu + message aux deux parties.
create or replace function public.dispute_block_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments
     set suspended_at = now(), suspended_dispute_id = new.id
   where transaction_id = new.transaction_id and payee = 'pro' and status <> 'recu' and suspended_at is null;
  perform set_config('ping.amiable', 'off', true);
  if new.opener_id is not null then
    insert into public.dispute_messages (dispute_id, sender_id, kind, body)
    values (new.id, new.opener_id, 'system',
      'Le paiement est bloqué jusqu''à la résolution du litige : rien n''est versé au prestataire et aucune relance de virement n''est envoyée d''ici là. '
      || 'Trouvez un arrangement à l''amiable, ou demandez l''intervention de PING.');
  end if;
  return new;
end $$;
revoke execute on function public.dispute_block_payment() from public, anon, authenticated;
create or replace trigger trg_dispute_block_payment after insert on public.disputes
  for each row execute function public.dispute_block_payment();

-- 4. Clôture d'un litige (arrangement, décision PING, ou clôture admin) : le virement reprend, son échéance est
--    décalée de la durée de la suspension (pas de relance immédiate pour un délai mangé par le litige).
create or replace function public.dispute_unblock_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status::text = 'open' and new.status::text <> 'open'
     and not exists (select 1 from public.disputes x where x.transaction_id = new.transaction_id
                      and x.id <> new.id and x.status::text = 'open') then
    perform set_config('ping.amiable', 'on', true);
    update public.transfer_payments
       set due_at = due_at + (now() - suspended_at), suspended_at = null, suspended_dispute_id = null
     where transaction_id = new.transaction_id and suspended_at is not null;
    perform set_config('ping.amiable', 'off', true);
  end if;
  return new;
end $$;
revoke execute on function public.dispute_unblock_payment() from public, anon, authenticated;
create or replace trigger trg_dispute_unblock_payment after update on public.disputes
  for each row execute function public.dispute_unblock_payment();

-- 5. Relance quotidienne (025) : reprise à l'identique, sauf les virements suspendus par un litige ouvert.
create or replace function public.mark_overdue_transfers()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; owed int; plafond int;
begin
  for r in
    update public.transfer_payments set status = 'en_retard'
     where suspended_at is null
       and ((status = 'a_payer' and due_at < now())
         or (status = 'declare_paye' and declared_at < now() - interval '10 days'))
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

-- 6. Avoir d'une décision PING (même mécanique que l'arrangement à l'amiable de 040, montant passé en argument).
create or replace function public.apply_dispute_credit(p_dispute uuid, p_cents integer, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare d record; inv record; credit integer;
begin
  if coalesce(p_cents, 0) <= 0 then return; end if;
  select * into d from public.disputes where id = p_dispute;
  if not found then return; end if;
  select * into inv from public.invoices
   where transaction_id = d.transaction_id and kind = 'prestation' for update;
  if not found then return; end if;  -- pas encore de facture : appliqué à la création du virement (§7)
  if inv.credit_dispute_id is not null and inv.credit_dispute_id <> d.id then return; end if;

  credit := least(p_cents, inv.net_cents);
  if inv.credit_number is null then
    update public.invoices
       set credit_cents = credit,
           credit_number = 'AV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0'),
           credit_issued_at = now(),
           credit_reason = coalesce(nullif(p_reason, ''), 'Décision de PING')
                           || ' (litige du ' || to_char(d.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')',
           credit_dispute_id = d.id
     where id = inv.id;
  end if;

  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments tp
     set credit_cents = least(credit, tp.amount_cents),
         credit_mode = case when tp.status in ('declare_paye', 'recu') then 'a_rembourser' else 'deduit' end,
         status = case when tp.status in ('a_payer', 'en_retard') and credit >= tp.amount_cents then 'recu' else tp.status end,
         received_at = case when tp.status in ('a_payer', 'en_retard') and credit >= tp.amount_cents then now() else tp.received_at end
   where tp.invoice_id = inv.id and tp.payee = 'pro' and tp.credit_mode is null;
  perform set_config('ping.amiable', 'off', true);
end $$;
revoke execute on function public.apply_dispute_credit(uuid, integer, text) from public, anon, authenticated;

-- 7. Arrangement ou décision rendus avant la facture : appliqués quand le virement de la prestation est créé
--    (reprise de 040, plus le cas de la décision PING).
create or replace function public.amiable_on_transfer_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare did uuid; dc integer;
begin
  if new.payee <> 'pro' then return new; end if;
  select id into did from public.disputes
   where transaction_id = new.transaction_id and settlement_status = 'acceptee' and coalesce(agreed_cents, 0) > 0
   order by closed_at desc nulls last limit 1;
  if did is not null then perform public.apply_amicable_settlement(did); return new; end if;
  select id, decision_refund_cents into did, dc from public.disputes
   where transaction_id = new.transaction_id and decided_at is not null and coalesce(decision_refund_cents, 0) > 0
   order by decided_at desc limit 1;
  if did is not null then perform public.apply_dispute_credit(did, dc, 'Décision de PING'); end if;
  return new;
end $$;
revoke execute on function public.amiable_on_transfer_insert() from public, anon, authenticated;

-- 8. Une partie demande l'intervention de PING (client ou prestataire, litige ouvert). Idempotente.
create or replace function public.request_ping_mediation(p_dispute uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record; who text;
begin
  if uid is null then raise exception 'Connectez-vous pour demander l''intervention de PING.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission demandent l''intervention de PING.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if d.mediation_requested_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'requested_at', d.mediation_requested_at);
  end if;
  update public.disputes set mediation_requested_at = now(), mediation_requested_by = uid where id = d.id;
  who := case when uid = t.buyer_id then 'Le client' else 'Le prestataire' end;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', who || ' demande l''intervention de PING. PING prend le relais dans ce fil : il lit les échanges '
    || 'et les pièces, puis rend sa décision (montant rendu au client, reste versé au prestataire). Le paiement reste bloqué d''ici là.');
  insert into public.messages (transaction_id, sender_id, kind, body)
  values (d.transaction_id, uid, 'system', 'Intervention de PING demandée sur le litige : la médiation continue dans le dossier du litige.');
  return jsonb_build_object('ok', true, 'requested_at', now());
end $$;
revoke all on function public.request_ping_mediation(uuid) from public, anon;
grant execute on function public.request_ping_mediation(uuid) to authenticated;

-- 9. Décision de PING (admin seulement) : X € rendus au client, le reste du prix de la prestation au prestataire.
--    Clôt le litige, émet l'avoir (virement ajusté comme 040), prévient les deux parties dans les deux fils.
--    Séquestre : la répartition chez le PSP est exécutée ensuite par /api/disputes/apply (money_applied_at).
create or replace function public.ping_decide_dispute(p_dispute uuid, p_refund_cents integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; plafond integer; payout integer; why text := nullif(trim(coalesce(p_reason, '')), ''); label text;
begin
  if uid is null or not public.is_admin() then raise exception 'Décision réservée à PING (administration).'; end if;
  if why is null then raise exception 'Indiquez le motif de la décision.'; end if;
  if char_length(why) > 1000 then raise exception 'Motif trop long (1000 caractères au plus).'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  plafond := public.amiable_ceiling(d.transaction_id);
  if plafond is null then raise exception 'Le montant de la prestation n''est pas encore connu.'; end if;
  if p_refund_cents is null or p_refund_cents < 0 then raise exception 'Indiquez le montant rendu au client (0 ou plus).'; end if;
  if p_refund_cents > plafond then
    raise exception 'Le montant rendu ne peut pas dépasser le prix de la prestation (%).', public.amiable_eur(plafond);
  end if;
  if p_refund_cents > 0 and exists (select 1 from public.invoices i where i.transaction_id = d.transaction_id
                                     and i.kind = 'prestation' and i.credit_number is not null) then
    raise exception 'Un avoir a déjà été émis sur cette prestation.';
  end if;
  payout := plafond - p_refund_cents;
  label := 'Décision de PING : ' || public.amiable_eur(p_refund_cents) || ' rendus au client, '
           || public.amiable_eur(payout) || ' pour le prestataire. Motif : ' || why;

  if p_refund_cents > 0 then
    update public.disputes
       set decision_refund_cents = p_refund_cents, decision_payout_cents = payout, decision_reason = why,
           decided_by = uid, decided_at = now(), status = 'resolved', resolution = left(label, 1000), closed_at = now()
     where id = d.id;
  else
    update public.disputes
       set decision_refund_cents = 0, decision_payout_cents = payout, decision_reason = why,
           decided_by = uid, decided_at = now(), status = 'rejected', resolution = left(label, 1000), closed_at = now()
     where id = d.id;
  end if;
  perform public.apply_dispute_credit(d.id, p_refund_cents, 'Décision de PING');

  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'mediation', label || '. Litige clos.'
    || case when p_refund_cents > 0 then ' Un avoir de ' || public.amiable_eur(p_refund_cents) || ' est émis sur la facture de la prestation.' else '' end
    || ' Le paiement est débloqué selon cette décision.');
  insert into public.messages (transaction_id, sender_id, kind, body)
  values (d.transaction_id, uid, 'system', 'Litige clos. ' || label || '.');
  return jsonb_build_object('ok', true, 'refund_cents', p_refund_cents, 'payout_cents', payout, 'ceiling_cents', plafond);
end $$;
revoke all on function public.ping_decide_dispute(uuid, integer, text) from public, anon;
grant execute on function public.ping_decide_dispute(uuid, integer, text) to authenticated;

-- Vérification :
--   select proname from pg_proc where proname in ('request_ping_mediation', 'ping_decide_dispute', 'apply_dispute_credit',
--     'dispute_block_payment', 'dispute_unblock_payment', 'guard_transfer_suspension');
--   select id, status, suspended_at from public.transfer_payments where suspended_at is not null;
