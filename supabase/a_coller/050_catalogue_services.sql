-- 050 — Catalogue des services EN DONNÉES (lots 26 et 27, refonte du 18/11/2026). NON APPLIQUÉE.
--
-- Décision Romain du 07/11/2026 (« services extensibles ») : une ligne = un service, avec sa manière
-- de tarifer, son éligibilité CESU / crédit d'impôt, les champs de son annonce et les pièces ou
-- qualifications demandées aux prestataires. Ajouter un service = ajouter une ligne (écran admin
-- « Catalogue des services », public/admin.html), sans déploiement.
--
-- Données de départ : les métiers actuels, À L'IDENTIQUE de src/lib/trades.ts — ménage, repassage,
-- nettoyage proposés au choix ; vitres présent (libellé, puces de la carte, CESU) mais non proposé.
-- AUCUN nouveau métier n'est activé (décision Romain : pas d'ouverture sans sa décision).
--
-- Droits : lecture publique (anon + authenticated : la carte et l'inscription en ont besoin) ; écriture
-- par l'admin seul (public.is_admin()). Pas de suppression : un service se MASQUE (hidden), pour que
-- les missions, demandes et prestations anciennes gardent leur libellé.
--
-- Pièces par service (lot 27) : `required_docs` range chaque pièce dans une rubrique EXISTANTE de
-- « Mes pièces » (valeur déjà présente de l'enum doc_kind : identite, rcpro, kbis, diplome, sap, rib)
-- sous un type propre (ex. {"kind":"rcpro","type":"decennale","label":"Garantie décennale",
-- "required":true}). Le fichier est stocké `<uid>/<kind>--<type>-<horodatage>`, comme les autres pièces :
-- aucun ALTER TYPE doc_kind n'est nécessaire.
--
-- L'app fonctionne AVANT et APRÈS : src/lib/catalog.ts relit src/lib/trades.ts si la table manque ou
-- est vide. Additive, idempotente, sans DROP ni DELETE.

-- 1. Table ------------------------------------------------------------------------------------------
create table if not exists public.service_catalog (
  key            text primary key,
  label          text not null,
  icon           text not null default 's_autre',
  domain         text not null default 'Nettoyage',
  pricing_modes  text[] not null default array['forfait','horaire','forfait_heures','devis']::text[],
  unit           text,
  cesu_eligible  boolean not null default false,
  request_fields text[] not null default array[]::text[],
  required_docs  jsonb not null default '[]'::jsonb,
  active         boolean not null default false,
  hidden         boolean not null default true,   -- un service ajouté naît masqué : rien ne s'affiche sans décision
  sort_order     integer not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.service_catalog is 'Catalogue des services PING (une ligne = un service). Lecture publique, écriture admin (is_admin). Lu par src/lib/catalog.ts, repli src/lib/trades.ts.';
comment on column public.service_catalog.key is 'Clé technique, stable (requests.category, provider_profiles.trade, services.trade). Jamais modifiée.';
comment on column public.service_catalog.icon is 'Pictogramme SVG (clé de src/components/PingIcons.tsx, ex. s_menage). Jamais d''emoji.';
comment on column public.service_catalog.domain is 'Domaine des qualifications (Nettoyage, Bâtiment, Garde d''enfants, Autre).';
comment on column public.service_catalog.pricing_modes is 'Manières de tarifer autorisées : forfait, horaire, forfait_heures (forfait + heures incluses), devis.';
comment on column public.service_catalog.unit is 'Unité d''un futur prix unitaire (panier, fenêtre, m²). Null = forfait ou à l''heure (seul cas géré par l''app aujourd''hui).';
comment on column public.service_catalog.cesu_eligible is 'Éligible au CESU préfinancé et au crédit d''impôt (services à la personne).';
comment on column public.service_catalog.request_fields is 'Champs de l''annonce du client : surface_m2, nombre_pieces, hours_wanted, linen_kg, linen_types, household_size.';
comment on column public.service_catalog.required_docs is 'Pièces et qualifications demandées : [{kind (rubrique doc_kind), type (a-z et tirets), label, required}].';
comment on column public.service_catalog.active is 'Proposé au choix : inscription pro, dépôt de demande, Mes tarifs.';
comment on column public.service_catalog.hidden is 'Masqué partout, y compris des puces de la carte. Les libellés restent lus pour l''historique.';

-- 2. Contraintes (doublons refusés, valeurs connues de l'app) --------------------------------------
do $$ begin
  alter table public.service_catalog add constraint service_catalog_key_format
    check (key ~ '^[a-z][a-z0-9_]{1,31}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_label_len
    check (char_length(btrim(label)) between 2 and 60);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_icon_format
    check (icon ~ '^s_[a-z0-9_]{1,30}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_pricing_modes_ok
    check (cardinality(pricing_modes) >= 1
           and pricing_modes <@ array['forfait','horaire','forfait_heures','devis']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_request_fields_ok
    check (request_fields <@ array['surface_m2','nombre_pieces','hours_wanted','linen_kg','linen_types','household_size']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_required_docs_array
    check (jsonb_typeof(required_docs) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_unit_len
    check (unit is null or char_length(unit) <= 20);
exception when duplicate_object then null; end $$;

-- Un même libellé (casse et espaces ignorés) ne peut exister deux fois.
create unique index if not exists service_catalog_label_uniq on public.service_catalog (lower(btrim(label)));
create index if not exists service_catalog_order_idx on public.service_catalog (sort_order, label);

-- 3. Garde : clé immuable, pièces bien formées, horodatage ------------------------------------------
create or replace function public.service_catalog_guard()
returns trigger language plpgsql as $$
declare d jsonb;
begin
  if tg_op = 'UPDATE' and new.key is distinct from old.key then
    raise exception 'La clé d''un service ne se modifie pas (elle est portée par les demandes et les missions).';
  end if;
  new.label := btrim(new.label);
  for d in select * from jsonb_array_elements(new.required_docs) loop
    if jsonb_typeof(d) <> 'object'
       or coalesce(d->>'kind', '') not in ('identite','rcpro','kbis','diplome','sap','rib')
       or coalesce(d->>'type', '') !~ '^[a-z][a-z-]{0,39}$'
       or char_length(btrim(coalesce(d->>'label', ''))) < 2 then
      raise exception 'Pièce demandée mal formée : %', d;
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_service_catalog_guard'
                 and tgrelid = 'public.service_catalog'::regclass) then
    create trigger trg_service_catalog_guard before insert or update on public.service_catalog
      for each row execute function public.service_catalog_guard();
  end if;
end $$;

-- 4. Droits : lecture publique, écriture admin, aucune suppression ----------------------------------
alter table public.service_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_public_read') then
    create policy service_catalog_public_read on public.service_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_admin_insert') then
    create policy service_catalog_admin_insert on public.service_catalog for insert
      to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_admin_update') then
    create policy service_catalog_admin_update on public.service_catalog for update
      to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select on public.service_catalog to anon, authenticated;
grant insert, update on public.service_catalog to authenticated;
-- Aucune policy de suppression : avec la RLS, personne ne retire une ligne depuis l'app (on masque).

-- 5. Données de départ : src/lib/trades.ts à l'identique (aucun nouveau métier) ---------------------
-- on conflict do nothing : rejouer la migration ne réécrit jamais un réglage fait par l'admin.
insert into public.service_catalog
  (key, label, icon, domain, pricing_modes, unit, cesu_eligible, request_fields, required_docs, active, hidden, sort_order)
values
  ('menage',    'Ménage',    's_menage',    'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, true,  false, 10),
  ('repassage', 'Repassage', 's_repassage', 'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['linen_kg','linen_types','household_size'],                     '[]'::jsonb, true,  false, 20),
  ('nettoyage', 'Nettoyage', 's_nettoyage', 'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, true,  false, 30),
  -- Vitres : présent en base chez certains prestataires, affiché (puces de la carte), non proposé au choix.
  ('vitres',    'Vitres',    's_vitres',    'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, false, false, 40)
on conflict (key) do nothing;

-- Vérification après coup :
--   select key, label, active, hidden, cesu_eligible from public.service_catalog order by sort_order;
--   -> menage/repassage/nettoyage actifs, vitres inactif non masqué, tous éligibles CESU.
