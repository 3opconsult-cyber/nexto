-- 026 — « Mon annonce » du prestataire (Romain 31/10, « comme un hôte Airbnb qui publie son annonce ») :
-- accroche, rayon d'intervention, galerie de photos (0 à 6), points forts. La photo de couverture et le
-- logo restent `photo_url` / `logo_url` (déjà existants). Mise en ligne / en pause = `is_active` (inchangé ;
-- le trigger 019 refuse déjà la remise en ligne d'un compte suspendu).
-- Aucune suppression : uniquement des ajouts.
alter table public.provider_profiles add column if not exists headline text
  check (headline is null or char_length(headline) <= 90);
alter table public.provider_profiles add column if not exists service_radius_km integer default 15
  check (service_radius_km is null or (service_radius_km between 1 and 100));
alter table public.provider_profiles add column if not exists gallery_paths text[] default '{}'::text[]
  check (gallery_paths is null or coalesce(array_length(gallery_paths, 1), 0) <= 6);
alter table public.provider_profiles add column if not exists highlights text[] default '{}'::text[]
  check (highlights is null or coalesce(array_length(highlights, 1), 0) <= 12);

-- Bucket public `listing` : photos de l'annonce, lisibles par tous, écrites par le seul propriétaire
-- dans son dossier `<uid>/…`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing', 'listing', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_public_read') then
    create policy listing_public_read on storage.objects for select using (bucket_id = 'listing');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_insert_own') then
    create policy listing_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'listing' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_update_own') then
    create policy listing_update_own on storage.objects for update to authenticated
      using (bucket_id = 'listing' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'listing' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_delete_own') then
    create policy listing_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'listing' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  -- Au passage : le bucket `avatars` (couverture + logo de Mon entreprise) n'avait qu'une règle
  -- d'insertion — remplacer sa photo (upsert) échouait en silence dès le deuxième envoi.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_update_own') then
    create policy avatars_update_own on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
