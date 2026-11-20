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
