-- 041 — Prestations : métier, photo, « masquée » (demande Romain du 18/11/2026). NON APPLIQUÉE.
--
-- « Il faut que l'on puisse avoir plusieurs prestations puis plusieurs prix : prix à l'heure, prix au
-- forfait, prix sur devis, photo. » Chaque ligne de `services` (écran « Mes tarifs ») porte déjà son
-- nom, sa description et sa fiche de prix (migration 008 : pricing_type forfait | horaire | devis,
-- base_price_cents, included_hours, hourly_rate_cents). Il manquait :
--   * trade      : le métier de la prestation (clé de src/lib/trades.ts : menage, repassage…). Avant,
--                  il était deviné depuis le nom, ce qui empêchait deux prestations du même métier
--                  (« Ménage 2 h », « Grand ménage ») ou un nom libre rattaché à un métier ;
--   * photo_path : photo facultative, dans le bucket public `service-photos` (<uid>/<id>/<fichier>) ;
--   * hidden     : prestation masquée (gardée dans « Mes tarifs », invisible et non réservable sur la fiche).
--
-- L'app fonctionne avant et après : src/lib/prestations.ts relit sans ces colonnes si elles manquent
-- (métier déduit du nom, rien de masqué, aucune photo).
-- Additive, idempotente, sans DROP ni DELETE.

-- 1. Colonnes ---------------------------------------------------------------------------------------
-- Rappel 008 (sans effet si déjà là).
alter table public.services add column if not exists description text;
alter table public.services add column if not exists pricing_type pricing_type not null default 'forfait';
alter table public.services add column if not exists base_price_cents integer not null default 0;
alter table public.services add column if not exists included_hours numeric;
alter table public.services add column if not exists hourly_rate_cents integer;

alter table public.services add column if not exists trade text;
alter table public.services add column if not exists photo_path text;
alter table public.services add column if not exists hidden boolean not null default false;

do $$ begin
  alter table public.services add constraint services_description_len
    check (description is null or char_length(description) <= 280) not valid;
exception when duplicate_object then null; end $$;

comment on column public.services.trade is 'Métier de la prestation (clé de src/lib/trades.ts). Null = prestation libre, métier déduit du nom.';
comment on column public.services.photo_path is 'Photo facultative : chemin dans le bucket public service-photos (<uid>/<id prestation>/<fichier>).';
comment on column public.services.hidden is 'Prestation masquée : visible du seul prestataire dans Mes tarifs, ni affichée ni réservable sur la fiche.';

-- Métier des lignes existantes, déduit du nom comme le fait tradeOfServiceName() (« Ménage », « menage »,
-- « Repassage (en complément du ménage) »…). Ne touche que les lignes sans métier.
update public.services s set trade = m.k
from (values ('menage', 'ménage'), ('repassage', 'repassage'), ('nettoyage', 'nettoyage'), ('vitres', 'vitres')) as m(k, l)
where s.trade is null
  and (lower(trim(s.name)) in (m.k, m.l)
       or lower(trim(s.name)) like m.l || ' %' or lower(trim(s.name)) like m.l || '(%'
       or lower(trim(s.name)) like m.k || ' %');

create index if not exists services_provider_visible_idx on public.services (provider_id) where not hidden;

-- 2. Bucket public `service-photos` : lisible par tous, écrit par le seul propriétaire dans `<uid>/…` ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_public_read') then
    create policy service_photos_public_read on storage.objects for select using (bucket_id = 'service-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_insert_own') then
    create policy service_photos_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_update_own') then
    create policy service_photos_update_own on storage.objects for update to authenticated
      using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_delete_own') then
    create policy service_photos_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
