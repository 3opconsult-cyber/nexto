-- 025 — Paiement par virement SEPA (décision Romain du 31/10/2026 : « virement SEPA dans un premier
-- temps ; le compte séquestre, on le met en suspens »).
--
-- Principe : PING n'encaisse JAMAIS l'argent de la prestation pour le compte d'autrui (ce serait un
-- service de paiement soumis à agrément). Après l'intervention, 3 virements suivent les 3 factures :
--   * le client vire le prix de la prestation DIRECTEMENT au prestataire (IBAN du pro, réf. FACT-/RECAP-) ;
--   * le client vire ses frais de service à PING (réf. PING-C-) ;
--   * le prestataire vire sa commission à PING (réf. PING-V-).
-- Chaque virement a une ligne dans transfer_payments : le payeur déclare « j'ai fait le virement »,
-- le destinataire (PING = l'admin, ou le pro pour SA prestation) note « reçu ».
-- Une commission du prestataire non reçue 15 jours après la facture passe « en retard » et devient une
-- dette (commission_debts) : même pare-feu que le prélèvement SEPA rejeté (suspension au-delà du plafond).

-- 1. Coordonnées bancaires : celles du pro restent privées (provider_private, RLS self + admin) ;
--    celles de PING sont publiques par nature (app_settings, lecture publique, écriture admin).
alter table public.provider_private
  add column if not exists iban text,
  add column if not exists iban_holder text,
  add column if not exists bic text;

do $$ begin
  alter table public.provider_private add constraint provider_private_iban_format
    check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');
exception when duplicate_object then null; end $$;

insert into public.app_settings (key, value) values
  ('ping_iban', '""'::jsonb), ('ping_bic', '""'::jsonb), ('ping_beneficiary', '"OpConsult (PING)"'::jsonb),
  ('transfer_due_days', '15'::jsonb)
on conflict (key) do nothing;

-- 2. Suivi des virements.
create table if not exists public.transfer_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id),
  transaction_id uuid not null references public.transactions(id),
  payer_role text not null check (payer_role in ('client','pro')),
  payee text not null check (payee in ('pro','ping')),
  payer_id uuid not null,
  payee_id uuid,                       -- le prestataire pour la prestation, null pour PING
  reference text not null,             -- numéro de la facture, à mettre en libellé du virement
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'a_payer' check (status in ('a_payer','declare_paye','recu','en_retard')),
  due_at timestamptz not null default now() + interval '15 days',
  declared_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists transfer_payments_tx on public.transfer_payments (transaction_id);
create index if not exists transfer_payments_status on public.transfer_payments (status);

alter table public.transfer_payments enable row level security;
-- Chacun ne voit que les virements qu'il doit faire ou recevoir (le client ne voit pas la commission
-- du pro, et inversement : plus strict que la RLS invoices).
create policy "transfer_payments read" on public.transfer_payments for select
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin());
create policy "transfer_payments update" on public.transfer_payments for update
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin())
  with check (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin());
grant select, update on public.transfer_payments to authenticated;
-- Pas de policy d'insertion ni de suppression : seuls les triggers (security definer) créent les lignes.

-- Garde : hors admin/serveur, seul le statut bouge, et seulement dans le bon sens.
--   payeur       : a_payer / en_retard -> declare_paye (et retour a_payer s'il s'est trompé)
--   destinataire : -> recu, uniquement le prestataire pour SA prestation (PING = l'admin seul)
create or replace function public.guard_transfer_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
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
create or replace trigger trg_guard_transfer_payment before update on public.transfer_payments
  for each row execute function public.guard_transfer_payment();

-- Commission reçue après un retard : la dette correspondante est soldée.
create or replace function public.transfer_payment_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'recu' and old.status is distinct from 'recu' and new.payer_role = 'pro' then
    update public.commission_debts set status = 'recovered', recovered_at = now()
     where transaction_id = new.transaction_id and provider_id = new.payer_id
       and reason = 'Commission non réglée par virement' and status = 'open';
  end if;
  return new;
end $$;
create or replace trigger trg_transfer_payment_received after update on public.transfer_payments
  for each row execute function public.transfer_payment_received();

-- 3. Une ligne de virement par facture, créée en même temps que la facture.
create or replace function public.transfer_for_invoice()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; days int;
begin
  select buyer_id, seller_id into t from public.transactions where id = new.transaction_id;
  if t is null then return new; end if;
  select coalesce((value #>> '{}')::int, 15) into days from public.app_settings where key = 'transfer_due_days';
  insert into public.transfer_payments (invoice_id, transaction_id, payer_role, payee, payer_id, payee_id,
                                        reference, amount_cents, due_at)
  values (new.id, new.transaction_id,
          case when new.kind = 'commission_pro' then 'pro' else 'client' end,
          case when new.kind = 'prestation' then 'pro' else 'ping' end,
          case when new.kind = 'commission_pro' then t.seller_id else t.buyer_id end,
          case when new.kind = 'prestation' then t.seller_id else null end,
          new.number, new.net_cents,
          coalesce(new.issued_at, now()) + make_interval(days => coalesce(days, 15)))
  on conflict (invoice_id) do nothing;
  return new;
end $$;
create or replace trigger trg_transfer_for_invoice after insert on public.invoices
  for each row execute function public.transfer_for_invoice();

-- 4. Coordonnées du prestataire pour le client : seulement l'acheteur de CETTE mission, et seulement
--    une fois la facture émise (mission terminée). Jamais avant, jamais à quelqu'un d'autre.
create or replace function public.payee_bank_details(p_transaction uuid)
returns table (holder text, iban text, bic text, enseigne text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.transactions t where t.id = p_transaction
                  and t.buyer_id = auth.uid() and t.status in ('completed','released'))
     or not exists (select 1 from public.invoices i where i.transaction_id = p_transaction and i.kind = 'prestation') then
    return;
  end if;
  return query
    select coalesce(nullif(pp.iban_holder,''), pr.full_name), pp.iban, pp.bic,
           coalesce(nullif(sp.company_name,''), pr.full_name)
      from public.transactions t
      join public.profiles pr on pr.id = t.seller_id
      left join public.provider_profiles sp on sp.id = t.seller_id
      left join public.provider_private pp on pp.id = t.seller_id
     where t.id = p_transaction;
end $$;
revoke all on function public.payee_bank_details(uuid) from public, anon;
grant execute on function public.payee_bank_details(uuid) to authenticated;

-- 5. Relance quotidienne (pg_cron, sans dépendre d'une clé serveur Vercel) :
--    commission du pro non déclarée à l'échéance, ou déclarée mais non reçue 10 jours après
--    -> « en retard » + dette ; au-delà du plafond d'impayés -> compte suspendu (comme firewall.ts).
--    Les virements du client (prestation, frais) passent aussi « en retard » pour le suivi, sans dette.
create or replace function public.mark_overdue_transfers()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; owed int; plafond int;
begin
  for r in
    update public.transfer_payments set status = 'en_retard'
     where (status = 'a_payer' and due_at < now())
        or (status = 'declare_paye' and declared_at < now() - interval '10 days')
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

do $$ begin
  perform cron.schedule('ping_virements_en_retard', '23 6 * * *', 'select public.mark_overdue_transfers()');
exception when others then null; end $$;

-- 6. Rattrapage : une ligne par facture déjà émise. Toutes les factures existantes sont fictives
--    (démonstration) : marquées « reçu » pour ne pas créer de fausses dettes.
insert into public.transfer_payments (invoice_id, transaction_id, payer_role, payee, payer_id, payee_id,
                                      reference, amount_cents, status, due_at, declared_at, received_at, created_at)
select i.id, i.transaction_id,
       case when i.kind = 'commission_pro' then 'pro' else 'client' end,
       case when i.kind = 'prestation' then 'pro' else 'ping' end,
       case when i.kind = 'commission_pro' then t.seller_id else t.buyer_id end,
       case when i.kind = 'prestation' then t.seller_id else null end,
       i.number, i.net_cents,
       case when t.fictif then 'recu' else 'a_payer' end,
       i.issued_at + interval '15 days',
       case when t.fictif then i.issued_at + interval '1 day' end,
       case when t.fictif then i.issued_at + interval '2 days' end,
       i.created_at
  from public.invoices i join public.transactions t on t.id = i.transaction_id
on conflict (invoice_id) do nothing;
