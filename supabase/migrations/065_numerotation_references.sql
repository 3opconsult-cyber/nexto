-- 065 : numéros de facture continus par série, références lisibles, vue pour le CRM (demande de Romain, 26/11/2026).
-- Ne réécrit AUCUNE fonction existante (generate_invoices et les avoirs restent tels quels) : un déclencheur remplace le
-- numéro à l'insertion. Les documents déjà émis ne changent pas. Le compteur est mis à jour dans la même transaction que
-- l'insertion : si l'insertion échoue, le numéro est rendu, donc pas de trou (contrairement à nextval).
-- Séries : facture de prestation, une par prestataire et par année (FACT-2026-P000045-0001) ; commission du prestataire
-- PING-CP-2026-000001 ; commission du client PING-CC-2026-000001. Avoirs (AV-) : inchangés, à traiter avec 063.
-- Références : compte PING-C-000123 (tout compte), PING-P-000045 (prestataire), transaction PING-T-2026-000123.
-- Rejouable, sans DROP ni DELETE.

create sequence if not exists public.account_ref_seq;
create sequence if not exists public.pro_ref_seq;
create sequence if not exists public.transaction_ref_seq;

alter table public.profiles          add column if not exists account_ref text;
alter table public.provider_profiles add column if not exists pro_ref text;
alter table public.transactions      add column if not exists reference text;
alter table public.invoices          add column if not exists transaction_ref text;
alter table public.invoices          add column if not exists client_ref text;
alter table public.invoices          add column if not exists issuer_ref text;

-- Rattrapage des lignes existantes (une fois : seulement celles sans numéro)
update public.profiles p set account_ref = 'PING-C-' || lpad(nextval('public.account_ref_seq')::text, 6, '0')
  from (select id from public.profiles where account_ref is null order by id) o where p.id = o.id;
update public.provider_profiles p set pro_ref = 'PING-P-' || lpad(nextval('public.pro_ref_seq')::text, 6, '0')
  from (select id from public.provider_profiles where pro_ref is null order by id) o where p.id = o.id;
update public.transactions t set reference = 'PING-T-' || to_char(coalesce(t.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.transaction_ref_seq')::text, 6, '0')
  from (select id from public.transactions where reference is null order by created_at, id) o where t.id = o.id;

create unique index if not exists profiles_account_ref_key          on public.profiles(account_ref);
create unique index if not exists provider_profiles_pro_ref_key     on public.provider_profiles(pro_ref);
create unique index if not exists transactions_reference_key        on public.transactions(reference);

create or replace function public._set_account_ref() returns trigger language plpgsql as $$
begin if new.account_ref is null then new.account_ref := 'PING-C-' || lpad(nextval('public.account_ref_seq')::text, 6, '0'); end if; return new; end $$;
create or replace function public._set_pro_ref() returns trigger language plpgsql as $$
begin if new.pro_ref is null then new.pro_ref := 'PING-P-' || lpad(nextval('public.pro_ref_seq')::text, 6, '0'); end if; return new; end $$;
create or replace function public._set_tx_ref() returns trigger language plpgsql as $$
begin if new.reference is null then new.reference := 'PING-T-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.transaction_ref_seq')::text, 6, '0'); end if; return new; end $$;
drop trigger if exists trg_set_account_ref on public.profiles;
create trigger trg_set_account_ref before insert on public.profiles for each row execute function public._set_account_ref();
drop trigger if exists trg_set_pro_ref on public.provider_profiles;
create trigger trg_set_pro_ref before insert on public.provider_profiles for each row execute function public._set_pro_ref();
drop trigger if exists trg_set_tx_ref on public.transactions;
create trigger trg_set_tx_ref before insert on public.transactions for each row execute function public._set_tx_ref();

create table if not exists public.invoice_counters (key text primary key, last_n bigint not null default 0);
alter table public.invoice_counters enable row level security;           -- aucune règle : serveur seulement
revoke all on public.invoice_counters from anon, authenticated;

create or replace function public._invoice_number_gapless() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare k text; pref text; n bigint; w int; yr text := to_char(coalesce(new.issued_at, now()), 'YYYY'); pr text;
begin
  if new.kind = 'prestation' then
    select pro_ref into pr from provider_profiles where id = new.issuer_id;
    k := 'F|' || yr || '|' || new.issuer_id::text;
    pref := 'FACT-' || yr || '-' || coalesce(replace(pr, 'PING-', ''), 'P000000') || '-'; w := 4;
  elsif new.kind = 'commission_seller' then k := 'CP|' || yr; pref := 'PING-CP-' || yr || '-'; w := 6;
  elsif new.kind = 'commission_client' then k := 'CC|' || yr; pref := 'PING-CC-' || yr || '-'; w := 6;
  else return new; end if;
  insert into invoice_counters(key, last_n) values (k, 1)
    on conflict (key) do update set last_n = invoice_counters.last_n + 1 returning last_n into n;
  new.number := pref || lpad(n::text, w, '0');
  select reference into new.transaction_ref from transactions where id = new.transaction_id;
  select account_ref into new.client_ref from profiles where id = new.client_id;
  select coalesce(pp.pro_ref, pr2.account_ref) into new.issuer_ref
    from profiles pr2 left join provider_profiles pp on pp.id = pr2.id where pr2.id = new.issuer_id;
  return new;
end $$;
revoke all on function public._invoice_number_gapless() from public, anon, authenticated;
drop trigger if exists trg_invoice_number_gapless on public.invoices;
create trigger trg_invoice_number_gapless before insert on public.invoices for each row execute function public._invoice_number_gapless();

-- Vue pour le CRM : lecture par la clé serveur (service_role) seulement, jamais par le navigateur.
create or replace view public.crm_invoices as
  select i.id as invoice_id, i.number, i.kind, i.issued_at, i.net_cents,
         i.transaction_id, coalesce(i.transaction_ref, t.reference) as transaction_ref,
         i.client_id, coalesce(i.client_ref, c.account_ref) as client_ref,
         i.issuer_id, i.issuer_ref, t.seller_id, pp.pro_ref as seller_ref,
         i.credit_number, i.credit_cents
  from public.invoices i
  left join public.transactions t on t.id = i.transaction_id
  left join public.profiles c on c.id = i.client_id
  left join public.provider_profiles pp on pp.id = t.seller_id;
revoke all on public.crm_invoices from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant select on public.crm_invoices to service_role; end if; end $$;
