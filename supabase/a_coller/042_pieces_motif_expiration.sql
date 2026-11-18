-- 042 — Pièces : motif de refus, date d'expiration, « Profil vérifié par PING » (lots 21 et 22, 18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/042_pieces_motif_expiration.sql.
-- Uniquement des ajouts : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE. Aucun DROP, aucune suppression de
-- données. Rejouable sans risque. Peut être collée avant ou après la 039.
--
-- L'app fonctionne avant et après :
--   * avant : Mes pièces, Mon entreprise et l'admin relisent `documents` sans les nouvelles colonnes
--     (aucun motif, aucune échéance affichés) ; la fiche utilise provider_docs_checked (039) si elle existe ;
--   * après : le prestataire voit « Refusée : motif » et « Expire dans N jours » (alerte à 45 jours),
--     l'admin saisit l'échéance à la validation et voit « À renouveler bientôt » dans Conformité,
--     la carte et la fiche affichent « Profil vérifié par PING » seulement pour une pièce d'identité
--     validée par un admin ET non expirée (exception de langage du 03/11).
--
-- Échéance : la table `documents` a déjà une colonne `valid_until date` (posée hors migration, utilisée
-- par la 005 pour les prestataires de test). On la réutilise comme date d'expiration plutôt que d'en créer
-- une seconde (`expires_at`) qui dirait la même chose. La ligne ci-dessous ne fait rien si elle existe.

-- 1. Colonnes -----------------------------------------------------------------------------------------------
alter table public.documents add column if not exists valid_until date;
alter table public.documents add column if not exists rejection_reason text;
alter table public.documents add column if not exists reviewed_at timestamptz;
alter table public.documents add column if not exists reviewed_by uuid;

do $$ begin
  alter table public.documents add constraint documents_rejection_reason_len
    check (rejection_reason is null or char_length(rejection_reason) <= 500) not valid;
exception when duplicate_object then null; end $$;

comment on column public.documents.valid_until is 'Date d''expiration de la pièce (saisie par PING à la validation). Null = sans échéance connue (042).';
comment on column public.documents.rejection_reason is 'Motif du refus, posé par PING, lu par le prestataire dans Mes pièces (042).';
comment on column public.documents.reviewed_at is 'Dernière décision de PING (validation ou refus) (042).';
comment on column public.documents.reviewed_by is 'Administrateur qui a pris la dernière décision (042).';

-- 2. Garde (027, étendue) : seul PING pose le statut, le motif, l'échéance et la date de décision -------------
--    * un dépôt (nouvelle ligne ou nouveau fichier) repasse « en cours de traitement » et efface motif,
--      échéance et décision précédents : c'est une nouvelle pièce à contrôler ;
--    * le prestataire ne touche jamais ces champs (ils sont remis à leur valeur précédente, sans erreur,
--      pour ne pas casser un upsert de l'app qui n'en parle pas) ;
--    * l'admin qui change le statut horodate sa décision ; une validation efface l'ancien motif de refus.
create or replace function public.guard_document_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- serveur (clé service), scripts SQL
  if public.is_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
      if new.status = 'valid' then new.rejection_reason := null; end if;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' or new.storage_path is distinct from old.storage_path then
    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.valid_until := null;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Le statut d''une pièce est posé par PING.';
  end if;
  new.rejection_reason := old.rejection_reason;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.valid_until := old.valid_until;
  return new;
end $$;
revoke execute on function public.guard_document_status() from public, anon, authenticated;
create or replace trigger trg_guard_document_status before insert or update on public.documents
  for each row execute function public.guard_document_status();

-- 3. « Profil vérifié par PING » (lot 21) -----------------------------------------------------------------
--    Même signature que la 039 (l'app l'appelle déjà) : on ajoute seulement « et pas expirée ».
create or replace function public.provider_docs_checked(p_ids uuid[])
returns table (provider_id uuid, docs_checked boolean)
language sql stable security definer set search_path = public as $$
  select pid, exists (select 1 from public.documents d
                      where d.owner_id = pid and d.kind = 'identite' and d.status = 'valid'
                        and (d.valid_until is null or d.valid_until >= current_date))
  from unnest(p_ids[1:200]) as pid
$$;
revoke execute on function public.provider_docs_checked(uuid[]) from public;
grant execute on function public.provider_docs_checked(uuid[]) to anon, authenticated;

--    Détail par pièce pour la fiche (« Pièce d'identité : validée », « Assurance RC : attestation
--    contrôlée par PING »). Uniquement des booléens : ni fichier, ni date, ni motif ne sortent.
create or replace function public.provider_docs_status(p_ids uuid[])
returns table (provider_id uuid, identity_checked boolean, rcpro_checked boolean)
language sql stable security definer set search_path = public as $$
  select pid,
    exists (select 1 from public.documents d where d.owner_id = pid and d.kind = 'identite' and d.status = 'valid'
                                              and (d.valid_until is null or d.valid_until >= current_date)),
    exists (select 1 from public.documents d where d.owner_id = pid and d.kind = 'rcpro' and d.status = 'valid'
                                              and (d.valid_until is null or d.valid_until >= current_date))
  from unnest(p_ids[1:200]) as pid
$$;
revoke execute on function public.provider_docs_status(uuid[]) from public;
grant execute on function public.provider_docs_status(uuid[]) to anon, authenticated;

create index if not exists documents_valid_until_idx on public.documents (valid_until) where valid_until is not null;
