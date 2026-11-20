-- 055 — Délai de 24 h pour déclarer un incident (décision Romain 20/11/2026).
-- Après la fin de la mission (completed_at), client et prestataire ont 24 h pour ouvrir un litige.
-- Passé ce délai, ou si le paiement a déjà été versé au prestataire, aucun litige ne peut plus être ouvert :
-- le paiement est libéré, il n'y a jamais de remboursement « à la main » après versement.
-- Réglage : app_settings.incident_window_hours (24 par défaut). Rejouable, sans DROP ni DELETE. À coller après 054.

insert into public.app_settings (key, value)
values ('incident_window_hours', '24'::jsonb)
on conflict (key) do nothing;

create or replace function public.enforce_incident_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed timestamptz;
  v_pay text;
  v_hours numeric;
begin
  select completed_at, payment_status::text into v_completed, v_pay
    from public.transactions where id = new.transaction_id;
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'incident_window_hours'), 24)
    into v_hours;
  if v_pay = 'released' then
    raise exception 'Le paiement a déjà été versé au prestataire : un litige n''est plus possible.' using errcode = 'P0001';
  end if;
  if v_completed is not null and now() > v_completed + make_interval(secs => v_hours * 3600) then
    raise exception 'Le délai de % h pour signaler un incident est dépassé : le paiement est libéré.', v_hours using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_incident_window') then
    create trigger trg_enforce_incident_window
      before insert on public.disputes
      for each row execute function public.enforce_incident_window();
  end if;
end $$;

-- Vérification : select tgname from pg_trigger where tgname = 'trg_enforce_incident_window';
