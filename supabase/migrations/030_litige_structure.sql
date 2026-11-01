-- 030 — Litige structuré avec photos (audit du 31/10/2026, point 8).
-- Un litige porte maintenant : un motif choisi dans une liste, le montant réclamé (facultatif),
-- jusqu'à 3 photos, et une date cible de réponse (48 h). Additif seulement (aucun DROP).
-- Compatible avec 027 : « disputes opener write » (insertion par une partie à la mission) est inchangée,
-- et seul l'administrateur modifie ensuite un litige (« disputes admin update »).

alter table public.disputes add column if not exists category text;
alter table public.disputes add column if not exists claimed_cents integer;
alter table public.disputes add column if not exists photo_paths text[] not null default '{}';
alter table public.disputes add column if not exists deadline_at timestamptz;

alter table public.disputes add constraint disputes_category_check
  check (category is null or category in ('non_realisee', 'qualite', 'casse', 'retard_absence', 'montant', 'autre'));
alter table public.disputes add constraint disputes_claimed_cents_check
  check (claimed_cents is null or (claimed_cents >= 0 and claimed_cents <= 10000000));
alter table public.disputes add constraint disputes_photo_paths_check
  check (cardinality(photo_paths) <= 3);

-- À l'ouverture : la date cible de réponse est posée par la base (48 h), jamais par le client,
-- et chaque photo doit se trouver dans le dossier de celui qui ouvre le litige.
create or replace function public.guard_dispute_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text;
begin
  if auth.uid() is null or public.is_admin() then
    if new.deadline_at is null then new.deadline_at := now() + interval '48 hours'; end if;
    return new;
  end if;
  new.deadline_at := now() + interval '48 hours';
  foreach p in array coalesce(new.photo_paths, '{}') loop
    if split_part(p, '/', 1) <> new.opener_id::text then
      raise exception 'Une photo de litige doit se trouver dans le dossier de son auteur.';
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.guard_dispute_insert() from public, anon, authenticated;
create trigger trg_guard_dispute_insert before insert on public.disputes
  for each row execute function public.guard_dispute_insert();

-- Lecture des photos : l'autre partie du litige et PING (admin). L'auteur garde « own dispute photos »
-- (dossier = son identifiant). Convention de chemin : <uid de l'auteur>/<id du litige>/<fichier>.
create or replace function public.uuid_or_null(p text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.uuid_or_null(text) to authenticated;

create policy "dispute photos parties read" on storage.objects for select to authenticated
  using (
    bucket_id = 'dispute-photos'
    and (public.is_admin() or public.is_dispute_party(public.uuid_or_null((storage.foldername(name))[2])))
  );

-- Limites du dossier de photos : 10 Mo, images courantes seulement.
update storage.buckets
  set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'dispute-photos';
