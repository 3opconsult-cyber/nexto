-- 039 — Statut juridique et fiscal du prestataire, CESU préfinancé (décision Romain du 18/11/2026).
-- NON APPLIQUÉE par Claude. À coller dans l'éditeur SQL Supabase (copie identique dans
-- supabase/a_coller/039_statut_pro_cesu.sql). Uniquement des ajouts : ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE, aucun DROP, aucune suppression de données. Rejouable sans risque.
--
-- L'app fonctionne sans cette migration : l'inscription pro réessaie sans ces colonnes si la base
-- ne les connaît pas, et la carte / la fiche n'affichent rien de plus.

-- 1. Colonnes du statut (provider_profiles est lisible publiquement : rien de confidentiel ici ;
--    un n° de TVA intracommunautaire figure de toute façon sur chaque facture émise).
alter table public.provider_profiles
  add column if not exists legal_form text,
  add column if not exists vat_status text,
  add column if not exists vat_number text,
  add column if not exists accepts_cesu_prefinance boolean not null default false;

do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_legal_form_check
    check (legal_form is null or legal_form in ('micro', 'ei', 'eurl', 'sasu', 'sas', 'sarl', 'autre'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_vat_status_check
    check (vat_status is null or vat_status in ('franchise', 'assujetti'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_vat_number_check
    check (vat_number is null or vat_number ~ '^[A-Z]{2}[0-9A-Z]{2,13}$');
exception when duplicate_object then null; end $$;

comment on column public.provider_profiles.legal_form is 'micro | ei | eurl | sasu | sas | sarl | autre ; null = particulier (039)';
comment on column public.provider_profiles.vat_status is 'franchise (art. 293 B du CGI) | assujetti (039)';
comment on column public.provider_profiles.vat_number is 'N° de TVA intracommunautaire, seulement si assujetti (039)';
comment on column public.provider_profiles.accepts_cesu_prefinance is 'Le prestataire accepte le CESU préfinancé (déclaratif, 039)';

-- 2. Facture de prestation : forme juridique et TVA recopiées à l'émission (même principe que
--    trg_invoice_presence_details de la migration 038 : generate_invoices n'est pas modifiée, la
--    ligne est complétée au moment de l'insertion). Un document émis ne change plus ensuite.
create or replace function public.invoice_pro_tax_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare sp record; forme text;
begin
  if new.kind is distinct from 'prestation' or new.template is distinct from 'facture' then
    return new;
  end if;
  select legal_form, vat_status, vat_number into sp from public.provider_profiles where id = new.issuer_id;
  if not found then return new; end if;
  forme := case sp.legal_form
    when 'micro' then 'Entrepreneur individuel (micro-entrepreneur)'
    when 'ei'    then 'Entrepreneur individuel (EI)'
    when 'eurl'  then 'EURL'
    when 'sasu'  then 'SASU'
    when 'sas'   then 'SAS'
    when 'sarl'  then 'SARL'
    else null end;
  new.issuer_snapshot := coalesce(new.issuer_snapshot, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'forme_juridique', sp.legal_form,
    'tva_regime', sp.vat_status,
    'tva_numero', case when sp.vat_status = 'assujetti' then sp.vat_number end));
  if forme is not null then
    new.legal := coalesce(new.legal, '{}'::jsonb) || jsonb_build_object('forme', forme);
  end if;
  if sp.vat_status = 'assujetti' then
    -- Assujetti : jamais la mention de franchise, le n° de TVA à la place.
    new.legal := (coalesce(new.legal, '{}'::jsonb) - 'franchise_tva')
      || jsonb_strip_nulls(jsonb_build_object('tva_intracom', sp.vat_number));
  end if;
  return new;
end $$;
revoke execute on function public.invoice_pro_tax_status() from public, anon, authenticated;
create or replace trigger trg_invoice_pro_tax_status
  before insert on public.invoices
  for each row execute function public.invoice_pro_tax_status();

-- 3. Pièces contrôlées par PING (documents.status = 'valid' posé par un admin) : sert au badge
--    « Nouveau · pièces en cours de contrôle » de la carte et de la fiche. La table documents n'est
--    lisible que par son propriétaire : cette fonction ne renvoie qu'un booléen par prestataire.
--    « Contrôlées » = pièce d'identité validée par un admin.
create or replace function public.provider_docs_checked(p_ids uuid[])
returns table (provider_id uuid, docs_checked boolean)
language sql stable security definer set search_path = public as $$
  select pid, exists (select 1 from public.documents d
                      where d.owner_id = pid and d.kind = 'identite' and d.status = 'valid')
  from unnest(p_ids[1:200]) as pid
$$;
revoke execute on function public.provider_docs_checked(uuid[]) from public;
grant execute on function public.provider_docs_checked(uuid[]) to anon, authenticated;
