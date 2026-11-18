-- 040 — Arrangement à l'amiable dans un litige (décision Romain du 18/11/2026). NON APPLIQUÉE.
--
-- Un bouton simple dans le litige : une partie propose UN montant (au plus le prix de la prestation),
-- l'autre accepte ou refuse. Quand l'autre accepte :
--   * le litige est clos « résolu », decision « Arrangement à l'amiable : X € » (agreed_cents, closed_at) ;
--   * un AVOIR de X € est émis sur la facture (ou le récapitulatif) de la prestation : numéro AV-AAAA-NNNNN,
--     colonnes credit_* de la ligne invoices (le modèle invoices n'admet qu'un document par type et par
--     mission, et ses types sont figés par une contrainte : l'avoir est donc porté par la facture qu'il corrige) ;
--   * le virement de la prestation (transfer_payments, migration 025) est ajusté :
--       - pas encore payé   -> credit_mode 'deduit' : le client vire le montant de la facture moins l'avoir
--                              (avoir total : virement soldé, statut « reçu ») ;
--       - déjà payé/annoncé -> credit_mode 'a_rembourser' : le prestataire rembourse X € au client,
--                              et le note fait (credit_refunded_at).
--   Les frais de service et la commission PING ne sont pas modifiés (décision à confirmer par Romain).
-- La médiation PING (admin) reste possible tant que le litige est ouvert.
--
-- Additive, idempotente, sans DROP. Les parties n'écrivent jamais directement : tout passe par les RPC
-- SECURITY DEFINER ci-dessous (la RLS disputes ne laisse modifier un litige qu'à l'admin, migration 002).

-- 1. Proposition portée par le litige -------------------------------------------------------------------
alter table public.disputes add column if not exists settlement_cents integer;
alter table public.disputes add column if not exists settlement_by uuid;
alter table public.disputes add column if not exists settlement_at timestamptz;
alter table public.disputes add column if not exists settlement_status text;
alter table public.disputes add column if not exists agreed_cents integer;
alter table public.disputes add column if not exists closed_at timestamptz;

do $$ begin
  alter table public.disputes add constraint disputes_settlement_status_check
    check (settlement_status is null or settlement_status in ('proposee', 'acceptee', 'refusee'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.disputes add constraint disputes_settlement_cents_check
    check (settlement_cents is null or (settlement_cents >= 0 and settlement_cents <= 10000000));
exception when duplicate_object then null; end $$;

-- 2. Avoir porté par la facture de la prestation ---------------------------------------------------------
alter table public.invoices add column if not exists credit_cents integer;
alter table public.invoices add column if not exists credit_number text;
alter table public.invoices add column if not exists credit_issued_at timestamptz;
alter table public.invoices add column if not exists credit_reason text;
alter table public.invoices add column if not exists credit_dispute_id uuid;

do $$ begin
  alter table public.invoices add constraint invoices_credit_check
    check (credit_cents is null or (credit_cents >= 0 and credit_cents <= net_cents));
exception when duplicate_object then null; end $$;

-- 3. Ajustement du virement de la prestation -------------------------------------------------------------
alter table public.transfer_payments add column if not exists credit_cents integer not null default 0;
alter table public.transfer_payments add column if not exists credit_mode text;
alter table public.transfer_payments add column if not exists credit_refunded_at timestamptz;

do $$ begin
  alter table public.transfer_payments add constraint transfer_payments_credit_check
    check (credit_cents >= 0 and credit_cents <= amount_cents
           and (credit_mode is null or credit_mode in ('deduit', 'a_rembourser')));
exception when duplicate_object then null; end $$;

-- Garde de 025, reprise à l'identique avec une seule ligne de plus : quand une RPC d'arrangement est en
-- cours (réglage local à la transaction 'ping.amiable', posé uniquement par les fonctions ci-dessous),
-- elle peut solder le virement. Un appel PostgREST ne peut pas poser ce réglage.
create or replace function public.guard_transfer_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' then return new; end if;
  if uid is null or public.is_admin() then
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

-- Les colonnes d'avoir du virement ne bougent que par les fonctions d'arrangement (ou l'admin).
create or replace function public.guard_transfer_credit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if row(new.credit_cents, new.credit_mode, new.credit_refunded_at)
     is distinct from row(old.credit_cents, old.credit_mode, old.credit_refunded_at) then
    raise exception 'L''avoir d''un virement est posé par l''arrangement à l''amiable.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_transfer_credit() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_credit before update on public.transfer_payments
  for each row execute function public.guard_transfer_credit();

-- 4. Outils internes ---------------------------------------------------------------------------------------
create or replace function public.amiable_eur(p_cents integer) returns text
language sql immutable set search_path = public as $$
  select replace(to_char(coalesce(p_cents, 0) / 100.0, 'FM999999990.00'), '.', ',') || ' €'
$$;
grant execute on function public.amiable_eur(integer) to authenticated;

-- Montant maximal d'un arrangement : le prix de la prestation (facture émise, sinon montant de la mission).
create or replace function public.amiable_ceiling(p_transaction uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select i.net_cents from public.invoices i where i.transaction_id = p_transaction and i.kind = 'prestation' limit 1),
    (select t.subtotal_cents from public.transactions t where t.id = p_transaction))
$$;
revoke execute on function public.amiable_ceiling(uuid) from public, anon, authenticated;

-- Applique un arrangement accepté : avoir sur la facture de la prestation + ajustement du virement.
-- Idempotente (un seul avoir par facture). Sans facture encore émise (litige ouvert pendant la mission),
-- elle ne fait rien : le trigger du §6 l'applique à la création du virement de la prestation.
create or replace function public.apply_amicable_settlement(p_dispute uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; inv record; credit integer;
begin
  select * into d from public.disputes where id = p_dispute;
  if not found or d.settlement_status is distinct from 'acceptee' or coalesce(d.agreed_cents, 0) <= 0 then return; end if;
  select * into inv from public.invoices
   where transaction_id = d.transaction_id and kind = 'prestation' for update;
  if not found then return; end if;
  if inv.credit_dispute_id is not null and inv.credit_dispute_id <> d.id then return; end if;

  credit := least(d.agreed_cents, inv.net_cents);
  if inv.credit_number is null then
    update public.invoices
       set credit_cents = credit,
           credit_number = 'AV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0'),
           credit_issued_at = now(),
           credit_reason = 'Arrangement à l''amiable (litige du ' || to_char(d.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')',
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
revoke execute on function public.apply_amicable_settlement(uuid) from public, anon, authenticated;

-- 5. RPC des parties ---------------------------------------------------------------------------------------
-- Proposer (ou reproposer, après un refus ou pour remplacer sa propre proposition) un montant.
create or replace function public.propose_settlement(p_dispute uuid, p_amount_cents integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record; plafond integer; who text;
begin
  if uid is null then raise exception 'Connectez-vous pour proposer un arrangement.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission proposent un arrangement.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if exists (select 1 from public.invoices i where i.transaction_id = d.transaction_id and i.kind = 'prestation'
              and i.credit_number is not null) then
    raise exception 'Un avoir a déjà été émis sur cette prestation.';
  end if;
  plafond := public.amiable_ceiling(d.transaction_id);
  if p_amount_cents is null or p_amount_cents < 0 then raise exception 'Indiquez un montant.'; end if;
  if plafond is null then raise exception 'Le montant de la prestation n''est pas encore connu.'; end if;
  if p_amount_cents > plafond then
    raise exception 'Le montant ne peut pas dépasser celui de la prestation (%).', public.amiable_eur(plafond);
  end if;

  update public.disputes
     set settlement_cents = p_amount_cents, settlement_by = uid, settlement_at = now(), settlement_status = 'proposee'
   where id = d.id;
  who := case when uid = t.buyer_id then 'Le client' else 'Le prestataire' end;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', who || ' propose un arrangement à l''amiable : ' || public.amiable_eur(p_amount_cents)
          || ' déduits de la prestation. L''autre partie accepte ou refuse.');
  return jsonb_build_object('status', 'proposee', 'amount_cents', p_amount_cents);
end $$;
revoke execute on function public.propose_settlement(uuid, integer) from public, anon;
grant execute on function public.propose_settlement(uuid, integer) to authenticated;

-- Accepter la proposition de l'autre partie : litige clos, avoir, virement ajusté.
create or replace function public.accept_settlement(p_dispute uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record; label text;
begin
  if uid is null then raise exception 'Connectez-vous pour répondre.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission répondent.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if d.settlement_status is distinct from 'proposee' then raise exception 'Aucune proposition en attente.'; end if;
  if d.settlement_by = uid then raise exception 'C''est à l''autre partie d''accepter votre proposition.'; end if;
  if d.settlement_cents > coalesce(public.amiable_ceiling(d.transaction_id), 0) then
    raise exception 'Le montant proposé dépasse désormais celui de la prestation : proposez-en un autre.';
  end if;

  label := 'Arrangement à l''amiable : ' || public.amiable_eur(d.settlement_cents);
  update public.disputes
     set settlement_status = 'acceptee', agreed_cents = d.settlement_cents,
         status = 'resolved', resolution = label, closed_at = now()
   where id = d.id;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', label || ', accepté par les deux parties. Litige clos.'
          || case when d.settlement_cents > 0 then ' Un avoir de ce montant est émis sur la facture de la prestation.' else '' end);
  insert into public.messages (transaction_id, sender_id, kind, body)
  values (d.transaction_id, uid, 'system', 'Litige clos. ' || label || '.');
  perform public.apply_amicable_settlement(d.id);
  return jsonb_build_object('status', 'acceptee', 'agreed_cents', d.settlement_cents);
end $$;
revoke execute on function public.accept_settlement(uuid) from public, anon;
grant execute on function public.accept_settlement(uuid) to authenticated;

-- Refuser la proposition de l'autre partie (le litige reste ouvert ; chacun peut reproposer).
create or replace function public.decline_settlement(p_dispute uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record;
begin
  if uid is null then raise exception 'Connectez-vous pour répondre.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission répondent.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if d.settlement_status is distinct from 'proposee' then raise exception 'Aucune proposition en attente.'; end if;
  if d.settlement_by = uid then raise exception 'C''est à l''autre partie de répondre à votre proposition.'; end if;

  update public.disputes set settlement_status = 'refusee' where id = d.id;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', 'Arrangement à l''amiable de ' || public.amiable_eur(d.settlement_cents)
          || ' refusé. Chacun peut proposer un autre montant, ou demander la médiation de PING.');
  return jsonb_build_object('status', 'refusee');
end $$;
revoke execute on function public.decline_settlement(uuid) from public, anon;
grant execute on function public.decline_settlement(uuid) to authenticated;

-- Le prestataire note qu'il a remboursé l'avoir au client (cas où la prestation était déjà réglée).
create or replace function public.mark_settlement_refunded(p_transfer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tp record;
begin
  select * into tp from public.transfer_payments where id = p_transfer for update;
  if not found or uid is null or (tp.payee_id is distinct from uid and not public.is_admin()) then
    raise exception 'Seul le prestataire note le remboursement de l''avoir.';
  end if;
  if tp.credit_mode is distinct from 'a_rembourser' then raise exception 'Aucun avoir à rembourser sur ce virement.'; end if;
  if tp.credit_refunded_at is not null then return; end if;
  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments set credit_refunded_at = now() where id = tp.id;
  perform set_config('ping.amiable', 'off', true);
end $$;
revoke execute on function public.mark_settlement_refunded(uuid) from public, anon;
grant execute on function public.mark_settlement_refunded(uuid) to authenticated;

-- 6. Arrangement conclu avant la facture : appliqué quand le virement de la prestation est créé
--    (après l'insertion de la facture, donc la facture existe déjà).
create or replace function public.amiable_on_transfer_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if new.payee <> 'pro' then return new; end if;
  select id into did from public.disputes
   where transaction_id = new.transaction_id and settlement_status = 'acceptee' and coalesce(agreed_cents, 0) > 0
   order by closed_at desc nulls last limit 1;
  if did is not null then perform public.apply_amicable_settlement(did); end if;
  return new;
end $$;
revoke execute on function public.amiable_on_transfer_insert() from public, anon, authenticated;
create or replace trigger trg_amiable_on_transfer_insert after insert on public.transfer_payments
  for each row execute function public.amiable_on_transfer_insert();

-- Relance quotidienne (025, inchangée) : un avoir total passe le virement à « reçu » ; un avoir partiel
-- laisse un reste dû (amount_cents - credit_cents) qui suit l'échéance habituelle.
