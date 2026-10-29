-- 014 — Paiement en ligne sous séquestre (Stripe Connect, Mangopay ou Lemonway) — 29/10/2026
--
-- Prépare le branchement d'un prestataire de paiement agréé, sans en choisir un : le code
-- (src/lib/payments) sait parler aux trois, la variable Vercel PAYMENT_PROVIDER désigne le bon.
-- Rien ne s'active tant que les clés ne sont pas renseignées. Idempotent.
--
-- Choix volontaire : on ne touche PAS à transactions.status (pending → arrived → completed reste
-- le cycle de la mission). L'argent a son propre statut, transactions.payment_status, pour ne pas
-- casser le scan QR, l'agenda ou la facturation qui lisent status.

alter table public.transactions
  add column if not exists payment_provider text check (payment_provider in ('stripe', 'mangopay', 'lemonway')),
  add column if not exists payment_status text not null default 'none'
    check (payment_status in ('none', 'awaiting', 'held', 'complement_due', 'released', 'refunded', 'failed'));
comment on column public.transactions.payment_status is
  'none = paiement en ligne non utilisé ; awaiting = client renvoyé vers la page de paiement ; held = payé, '
  'sous séquestre ; complement_due = dépassement horaire à régler ; released = versé au prestataire ; '
  'refunded = remboursé ; failed = paiement refusé. Posé uniquement par le serveur (clé service).';

-- Comptes ouverts chez le prestataire de paiement : compte connecté Stripe, utilisateur + porte-monnaie
-- Mangopay, compte de paiement Lemonway. Un même utilisateur peut avoir un compte payeur et un compte
-- bénéficiaire (comme voyageur / hôte). Jamais d'IBAN ni de carte stockés ici : ils restent chez le PSP.
create table if not exists public.payment_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'mangopay', 'lemonway')),
  role text not null check (role in ('buyer', 'seller')),
  external_id text not null,
  wallet_id text,
  bank_account_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'restricted')),
  message text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, role)
);
alter table public.payment_accounts enable row level security;
drop policy if exists "pa self read" on public.payment_accounts;
create policy "pa self read" on public.payment_accounts for select using (user_id = auth.uid());
grant select on public.payment_accounts to authenticated;

-- Journal des mouvements : encaissement, complément, transfert au prestataire, virement, remboursement.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'mangopay', 'lemonway')),
  kind text not null check (kind in ('charge', 'transfer', 'payout', 'refund')),
  external_id text,
  amount_cents integer not null check (amount_cents >= 0),
  fee_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  redirect_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payments_provider_external on public.payments (provider, external_id) where external_id is not null;
create index if not exists payments_tx on public.payments (transaction_id);
alter table public.payments enable row level security;
drop policy if exists "payments parties read" on public.payments;
create policy "payments parties read" on public.payments for select
  using (exists (select 1 from public.transactions t where t.id = transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));
grant select on public.payments to authenticated;

-- Verrou : la policy « tx participants update » laisse le client et le prestataire modifier leur
-- transaction (scan QR). Sans ce verrou, un client pourrait se déclarer « payé » lui-même.
-- Seuls le serveur (clé service : pas d'auth.uid()) et un admin posent le statut de paiement.
create or replace function public.guard_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.payment_status <> 'none' or new.payment_provider is not null then
      raise exception 'Statut de paiement réservé au serveur';
    end if;
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status
     or new.payment_provider is distinct from old.payment_provider then
    raise exception 'Statut de paiement réservé au serveur';
  end if;
  if old.payment_status = 'none' then return new; end if;

  -- Paiement engagé : antifraude (décision Romain 29/10, « seul PING libère le séquestre »).
  -- 1. Montants figés (sinon un client baisserait le total et se ferait rembourser la différence).
  --    Seule exception : le scan de fin par le prestataire, qui calcule le dépassement horaire.
  if (new.total_charged_cents is distinct from old.total_charged_cents
      or new.payout_cents is distinct from old.payout_cents
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.buyer_fee_cents is distinct from old.buyer_fee_cents
      or new.seller_fee_cents is distinct from old.seller_fee_cents)
     and not (auth.uid() = old.seller_id and old.completed_at is null and new.completed_at is not null) then
    raise exception 'Montants figés : un paiement est en cours sur cette mission';
  end if;
  -- 2. « En route » posé par le prestataire seul, jamais effacé (il décide des frais d'annulation).
  if new.en_route_at is distinct from old.en_route_at
     and (auth.uid() <> old.seller_id or new.en_route_at is null) then
    raise exception 'Départ du prestataire non modifiable';
  end if;
  -- 3. Plus d'annulation une fois le prestataire arrivé : c'est un litige.
  if new.status = 'cancelled' and old.status <> 'cancelled' and old.arrived_at is not null then
    raise exception 'Mission commencée : ouvrez un litige plutôt qu''une annulation';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_payment_status on public.transactions;
create trigger trg_guard_payment_status
  before insert or update on public.transactions
  for each row execute function public.guard_payment_status();
