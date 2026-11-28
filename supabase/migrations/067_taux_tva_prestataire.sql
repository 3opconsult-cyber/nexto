-- 067 : taux de TVA du prestataire assujetti (demande de Romain, 28/11/2026).
-- Le prestataire assujetti choisit son taux (20, 10 ou 5,5 %) dans son profil ; il est recopié sur chaque nouvelle
-- facture de prestation (legal.tva_taux) et l'affichage « dont hors taxe / dont TVA » du PDF s'allume tout seul.
-- Les factures déjà émises ne changent pas. Réécrit seulement invoice_pro_tax_status (définie en 039, reprise à
-- l'identique + le taux). Rejouable, sans DROP ni DELETE. À coller APRÈS 065.
alter table public.provider_profiles add column if not exists vat_rate numeric(4,1);
do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_vat_rate_check
    check (vat_rate is null or vat_rate in (20, 10, 5.5));
exception when duplicate_object then null; end $$;

create or replace function public.invoice_pro_tax_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare sp record; forme text;
begin
  if new.kind is distinct from 'prestation' or new.template is distinct from 'facture' then
    return new;
  end if;
  select legal_form, vat_status, vat_number, vat_rate into sp from public.provider_profiles where id = new.issuer_id;
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
    new.legal := (coalesce(new.legal, '{}'::jsonb) - 'franchise_tva')
      || jsonb_strip_nulls(jsonb_build_object('tva_intracom', sp.vat_number, 'tva_taux', sp.vat_rate));
  end if;
  return new;
end $$;
revoke execute on function public.invoice_pro_tax_status() from public, anon, authenticated;
