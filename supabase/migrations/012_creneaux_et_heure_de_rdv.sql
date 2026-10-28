-- 012 — Réservation par créneau et heure de rendez-vous (28/10/2026)
--
-- Décision Romain (28/10) : l'app doit faire ce que montrent la démo (v_booking, p_agenda) et
-- l'animation : le pro publie ses disponibilités, le client choisit un créneau et la réservation
-- est faite ; le rendez-vous apparaît à l'heure dans l'agenda des deux côtés.
--
-- Avant cette migration, aucune date de rendez-vous n'était stockée : l'agenda classait les
-- missions à leur date de création.
--
-- Le code (mission/new, /pro/disponibilites, /agenda) masque les créneaux tant que cette
-- migration n'est pas appliquée. Idempotent.

alter table public.transactions
  add column if not exists scheduled_at timestamptz;

create table if not exists public.provider_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 120 check (duration_minutes between 30 and 600),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider_id, starts_at)
);
create index if not exists provider_slots_provider_starts on public.provider_slots (provider_id, starts_at);

alter table public.provider_slots enable row level security;

-- Disponibilités publiques (libre / pris), comme l'agenda d'un pro sur la démo : aucune donnée
-- client n'est exposée, seulement l'heure et l'état.
drop policy if exists "slots public read" on public.provider_slots;
create policy "slots public read" on public.provider_slots for select using (true);

-- Le pro gère ses propres créneaux libres ; un créneau réservé ne se modifie plus que via book_slot.
drop policy if exists "slots owner insert" on public.provider_slots;
create policy "slots owner insert" on public.provider_slots for insert
  with check (provider_id = auth.uid() and transaction_id is null);
drop policy if exists "slots owner delete free" on public.provider_slots;
create policy "slots owner delete free" on public.provider_slots for delete
  using (provider_id = auth.uid() and transaction_id is null);

grant select on public.provider_slots to anon, authenticated;
grant insert, delete on public.provider_slots to authenticated;

-- Réservation atomique : le créneau doit être libre, appartenir au pro de la transaction, et la
-- transaction doit appartenir au client connecté. Pose aussi transactions.scheduled_at.
create or replace function public.book_slot(p_slot uuid, p_transaction uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_start timestamptz;
begin
  select * into v_tx from public.transactions where id = p_transaction;
  if v_tx.id is null or v_tx.buyer_id <> auth.uid() then
    raise exception 'transaction introuvable';
  end if;

  update public.provider_slots
     set transaction_id = p_transaction
   where id = p_slot and provider_id = v_tx.seller_id and transaction_id is null and starts_at > now()
  returning starts_at into v_start;

  if v_start is null then
    raise exception 'créneau indisponible';
  end if;

  update public.transactions set scheduled_at = v_start where id = p_transaction;
  return v_start;
end;
$$;

revoke all on function public.book_slot(uuid, uuid) from public;
grant execute on function public.book_slot(uuid, uuid) to authenticated;

-- Une réservation annulée libère son créneau.
create or replace function public.release_slot_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.provider_slots set transaction_id = null where transaction_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_release_slot_on_cancel on public.transactions;
create trigger trg_release_slot_on_cancel
  after update of status on public.transactions
  for each row execute function public.release_slot_on_cancel();
