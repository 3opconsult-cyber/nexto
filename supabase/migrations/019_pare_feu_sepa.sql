-- 019 — Pare-feu SEPA, CGV prestataire, profil fiscal (30/10/2026, demande Romain)
--
-- Le prestataire paie ses commissions à PING : compensées sur ses versements quand le paiement en
-- ligne passe par la plateforme, sinon prélevées par mandat SEPA. Si le mandat est révoqué ou qu'un
-- prélèvement est rejeté, PING doit le savoir et pouvoir suspendre le compte :
--   · provider_profiles : statut du mandat, suspension, acceptation des CGV (date + version) ;
--   · provider_private : numéro fiscal (DAC7) et motif de suspension — PAS dans provider_profiles,
--     lisible par tous (fiche publique) ;
--   · commission_debts : commissions impayées, compensées sur le prochain versement ;
--   · payment_alerts : événements à traiter par l'admin (mandat révoqué, rejet, rétrofacturation…).
-- Seul l'admin ou le serveur (clé service, auth.uid() nul) change le mandat ou lève une suspension.
-- Idempotent, aucune donnée supprimée.

alter table public.provider_profiles
  add column if not exists cgv_accepted_at timestamptz,
  add column if not exists cgv_version text,
  add column if not exists sepa_mandate_status text not null default 'none',
  add column if not exists payments_suspended_at timestamptz;

do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_sepa_mandate_status_check
    check (sepa_mandate_status in ('none', 'pending', 'active', 'revoked', 'failed'));
exception when duplicate_object then null; end $$;

-- Données privées du prestataire (jamais sur la fiche publique).
create table if not exists public.provider_private (
  id uuid primary key references auth.users(id) on delete cascade,
  tax_id text,                -- numéro fiscal (NIF), pour la déclaration DAC7 des plateformes
  suspension_reason text,     -- posé par l'admin ou le serveur uniquement
  updated_at timestamptz not null default now()
);
alter table public.provider_private enable row level security;
drop policy if exists "provider_private self" on public.provider_private;
create policy "provider_private self" on public.provider_private for all
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
grant select, insert, update on public.provider_private to authenticated;

-- Commissions impayées (prélèvement rejeté, mandat révoqué, rétrofacturation).
create table if not exists public.commission_debts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'recovered', 'written_off')),
  created_at timestamptz not null default now(),
  recovered_at timestamptz
);
alter table public.commission_debts enable row level security;
drop policy if exists "commission_debts read" on public.commission_debts;
create policy "commission_debts read" on public.commission_debts for select
  using (provider_id = auth.uid() or public.is_admin());
drop policy if exists "commission_debts admin write" on public.commission_debts;
create policy "commission_debts admin write" on public.commission_debts for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.commission_debts to authenticated;
grant insert, update on public.commission_debts to authenticated; -- filtré par la policy admin

-- Alertes de paiement pour l'administration.
create table if not exists public.payment_alerts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references auth.users(id) on delete cascade,
  kind text not null,          -- mandate_revoked | debit_rejected | chargeback | suspended | unsuspended
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.payment_alerts enable row level security;
drop policy if exists "payment_alerts admin" on public.payment_alerts;
create policy "payment_alerts admin" on public.payment_alerts for all
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.payment_alerts to authenticated;

-- Garde : un prestataire ne touche ni à son mandat, ni à sa suspension, et ne se rend pas visible
-- sur la carte tant qu'il est suspendu.
create or replace function public.guard_provider_payment_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.sepa_mandate_status := 'none';
    new.payments_suspended_at := null;
    return new;
  end if;
  if new.sepa_mandate_status is distinct from old.sepa_mandate_status
     or new.payments_suspended_at is distinct from old.payments_suspended_at then
    raise exception 'Mandat de prélèvement et suspension : réservés à PING.';
  end if;
  if old.payments_suspended_at is not null and new.is_active and not coalesce(old.is_active, false) then
    raise exception 'Compte suspendu : contactez le support PING pour le réactiver.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_provider_payment_fields on public.provider_profiles;
create trigger trg_guard_provider_payment_fields before insert or update on public.provider_profiles
  for each row execute function public.guard_provider_payment_fields();

create or replace function public.guard_provider_private()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.suspension_reason := null; return new; end if;
  if new.suspension_reason is distinct from old.suspension_reason then
    raise exception 'Motif de suspension : réservé à PING.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_provider_private on public.provider_private;
create trigger trg_guard_provider_private before insert or update on public.provider_private
  for each row execute function public.guard_provider_private();

-- Plafond de commissions impayées au-delà duquel le compte est suspendu (réglable sans déploiement).
insert into public.app_settings (key, value) values ('unpaid_ceiling_cents', '5000'::jsonb)
on conflict (key) do nothing;
