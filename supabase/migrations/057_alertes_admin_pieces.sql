-- 057 — Alerte à PING (admin) à chaque dépôt de pièce, message au déposant à la décision, expiration des pièces
-- (demande Romain 20/11/2026). NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/057_alertes_admin_pieces.sql.
-- À coller APRÈS 042 (colonnes valid_until, rejection_reason, reviewed_at ; elles sont aussi ajoutées ici si besoin).
-- Uniquement des ajouts : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS. Aucune instruction de suppression, aucune
-- suppression de données. Rejouable sans risque.
--
-- Contenu
--   1. admin_notifications : file d'alertes pour l'admin (lecture et traitement réservés à is_admin()).
--      Une alerte « document_pending » par pièce à valider, créée par trigger au dépôt (prestataire OU client) ou au
--      remplacement d'un fichier ; marquée traitée par trigger dès que PING décide (valide, refuse, expire).
--   2. Message « Support PING » au déposant à chaque décision (validée, refusée avec motif, expirée), dans la messagerie
--      Support existante (admin_conversations / admin_messages). Un échec d'envoi ne bloque jamais la décision.
--   3. expire_documents() : pose status = 'expired' quand valid_until est dépassé ; envoie un rappel unique 45 jours
--      avant l'échéance (dédoublonné par pièce et par date d'échéance). Planifiée chaque jour par pg_cron si l'extension
--      est installée (l'app ne dépend pas du cron : les écrans calculent l'échéance eux-mêmes).
--   4. La pièce refusée ou expirée ne compte pas dans « profil vérifié par PING » : provider_docs_checked et
--      provider_docs_status (042) exigent déjà status = 'valid' ET une échéance non dépassée ; rien à changer ici.
--
-- L'e-mail à PING est envoyé par l'application (route serveur /api/admin/document-alert, variable ADMIN_NOTIFY_EMAIL,
-- repli info@opconsult.co, 1 e-mail par déposant toutes les 10 min). Le trigger ne fait que poser l'alerte.

-- 0. Colonnes de 042 (sans effet si elles existent) --------------------------------------------------------------
alter table public.documents add column if not exists valid_until date;
alter table public.documents add column if not exists rejection_reason text;
alter table public.documents add column if not exists reviewed_at timestamptz;
alter table public.documents add column if not exists reviewed_by uuid;

-- 1. File d'alertes admin -----------------------------------------------------------------------------------------
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- 'document_pending' (à valider) | 'document_expiring' (rappel 45 j, déjà traité)
  user_id uuid,                       -- déposant (prestataire ou client)
  ref_id uuid,                        -- documents.id
  title text not null,                -- « Pièce à valider : Assurance de Marie Dupont » (jamais le contenu de la pièce)
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  handled_at timestamptz,             -- posé quand PING a décidé
  emailed_at timestamptz              -- posé par le serveur quand l'e-mail à PING est parti
);
create index if not exists admin_notifications_open_idx on public.admin_notifications (created_at desc) where handled_at is null;
-- Une seule alerte ouverte par pièce : un nouveau fichier déposé avant la décision met l'alerte à jour.
create unique index if not exists admin_notifications_one_open_doc
  on public.admin_notifications (ref_id) where kind = 'document_pending' and handled_at is null;
-- Un seul rappel d'échéance par pièce et par date d'échéance.
create unique index if not exists admin_notifications_one_expiring
  on public.admin_notifications (ref_id, (detail ->> 'valid_until')) where kind = 'document_expiring';

alter table public.admin_notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_notifications' and policyname = 'admin_notifications admin') then
    create policy "admin_notifications admin" on public.admin_notifications for all
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
revoke all on public.admin_notifications from anon, authenticated;
grant select, update on public.admin_notifications to authenticated;   -- filtré par la policy : admin seulement

-- Libellé lisible d'une rubrique de pièce (même vocabulaire que src/lib/pieces.ts : DOC_TITLES).
create or replace function public._doc_label(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind
    when 'identite' then 'Pièce d''identité'
    when 'rcpro' then 'Assurance'
    when 'kbis' then 'Statut de l''entreprise'
    when 'diplome' then 'Diplôme ou qualification'
    when 'sap' then 'Récépissé SAP'
    when 'rib' then 'RIB'
    else p_kind end
$$;
revoke execute on function public._doc_label(text) from public, anon, authenticated;

-- 2. Message Support PING au déposant ---------------------------------------------------------------------------
create or replace function public._support_say(p_user uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  select id into v_conv from public.admin_conversations where user_id = p_user limit 1;
  if v_conv is null then
    insert into public.admin_conversations (user_id) values (p_user) returning id into v_conv;
  end if;
  insert into public.admin_messages (conversation_id, sender_is_admin, body, read_by_admin)
  values (v_conv, true, p_body, true);
  update public.admin_conversations set last_message_at = now() where id = v_conv;
exception when others then
  null;  -- la messagerie ne doit jamais bloquer une décision sur une pièce
end $$;
revoke execute on function public._support_say(uuid, text) from public, anon, authenticated;

-- 3. Trigger : alerte au dépôt, alerte traitée + message à la décision -----------------------------------------
create or replace function public.documents_admin_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_role text;
  v_label text;
  v_body text;
begin
  v_label := public._doc_label(new.kind::text);

  if tg_op = 'UPDATE' and new.status::text is distinct from old.status::text and new.status::text <> 'pending' then
    -- Décision de PING (ou expiration) : l'alerte est traitée, le déposant est prévenu dans l'application.
    update public.admin_notifications set handled_at = now()
      where kind = 'document_pending' and ref_id = new.id and handled_at is null;
    if new.status::text = 'valid' then
      v_body := 'Votre pièce « ' || v_label || ' » a été contrôlée par PING : elle est validée.'
        || case when new.valid_until is not null then ' Elle est valable jusqu''au ' || to_char(new.valid_until, 'DD/MM/YYYY') || '.' else '' end;
    elsif new.status::text = 'rejected' then
      v_body := 'Votre pièce « ' || v_label || ' » n''a pas pu être validée.'
        || case when coalesce(new.rejection_reason, '') <> '' then ' Motif : ' || new.rejection_reason || '.' else '' end
        || ' Vous pouvez en renvoyer une nouvelle depuis Mon entreprise, rubrique Mes pièces (Mon profil, Mes documents pour un particulier).';
    elsif new.status::text = 'expired' then
      v_body := 'Votre pièce « ' || v_label || ' »'
        || case when new.valid_until is not null then ' a expiré le ' || to_char(new.valid_until, 'DD/MM/YYYY') else ' a expiré' end
        || '. Déposez la nouvelle version depuis Mes pièces : tant qu''elle n''est pas contrôlée, votre fiche affiche « Nouveau · pièces en cours de contrôle ». Vous restez réservable.';
    end if;
    if v_body is not null then perform public._support_say(new.owner_id, v_body); end if;
    return new;
  end if;

  -- Dépôt : nouvelle ligne en cours de traitement, nouveau fichier, ou pièce décidée qui repart en contrôle.
  if new.status::text <> 'pending' then return new; end if;
  if tg_op = 'UPDATE' and not (new.storage_path is distinct from old.storage_path or old.status::text <> 'pending') then
    return new;
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'un utilisateur') into v_name from public.profiles where id = new.owner_id;
  v_name := coalesce(v_name, 'un utilisateur');
  v_role := case when exists (select 1 from public.provider_profiles where id = new.owner_id) then 'prestataire' else 'client' end;

  insert into public.admin_notifications (kind, user_id, ref_id, title, detail)
  values ('document_pending', new.owner_id, new.id, 'Pièce à valider : ' || v_label || ' de ' || v_name,
          jsonb_build_object('doc_kind', new.kind::text, 'name', v_name, 'role', v_role))
  on conflict (ref_id) where kind = 'document_pending' and handled_at is null
  do update set created_at = now(), emailed_at = null, title = excluded.title, detail = excluded.detail;
  return new;
exception when others then
  return new;  -- une alerte ratée ne doit jamais empêcher un dépôt ni une décision
end $$;
revoke execute on function public.documents_admin_alert() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_documents_admin_alert') then
    create trigger trg_documents_admin_alert after insert or update on public.documents
      for each row execute function public.documents_admin_alert();
  end if;
end $$;

-- Rattrapage : les pièces déjà en attente apparaissent dans la file (marquées « e-mail envoyé » : pas de rafale).
insert into public.admin_notifications (kind, user_id, ref_id, title, detail, created_at, emailed_at)
select 'document_pending', d.owner_id, d.id,
       'Pièce à valider : ' || public._doc_label(d.kind::text) || ' de ' || coalesce(nullif(btrim(p.full_name), ''), 'un utilisateur'),
       jsonb_build_object('doc_kind', d.kind::text, 'name', coalesce(nullif(btrim(p.full_name), ''), 'un utilisateur'),
                          'role', case when exists (select 1 from public.provider_profiles pp where pp.id = d.owner_id) then 'prestataire' else 'client' end),
       coalesce(d.created_at, now()), now()
from public.documents d left join public.profiles p on p.id = d.owner_id
where d.status::text = 'pending'
on conflict (ref_id) where kind = 'document_pending' and handled_at is null do nothing;

-- 4. Expiration et rappel à 45 jours --------------------------------------------------------------------------
-- Appelée chaque jour par pg_cron (superutilisateur : auth.uid() est nul, la garde 042 laisse passer) ou, à défaut,
-- par la route serveur /api/bookings/expire (clé service). Renvoie le nombre de pièces passées à « expirée ».
create or replace function public.expire_documents() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n integer := 0;
begin
  -- a) Rappel 45 jours avant l'échéance (une fois par pièce et par date d'échéance).
  for r in
    select d.id, d.owner_id, d.kind::text as kind, d.valid_until
    from public.documents d
    where d.status::text = 'valid' and d.valid_until is not null
      and d.valid_until >= current_date and d.valid_until <= current_date + 45
  loop
    insert into public.admin_notifications (kind, user_id, ref_id, title, detail, handled_at)
    values ('document_expiring', r.owner_id, r.id,
            'À renouveler avant le ' || to_char(r.valid_until, 'DD/MM/YYYY') || ' : ' || public._doc_label(r.kind),
            jsonb_build_object('doc_kind', r.kind, 'valid_until', r.valid_until::text), now())
    on conflict (ref_id, (detail ->> 'valid_until')) where kind = 'document_expiring' do nothing;
    if found then
      perform public._support_say(r.owner_id,
        'Rappel : votre pièce « ' || public._doc_label(r.kind) || ' » expire le ' || to_char(r.valid_until, 'DD/MM/YYYY')
        || ' (dans ' || (r.valid_until - current_date) || ' jour' || case when r.valid_until - current_date > 1 then 's' else '' end
        || '). Déposez la nouvelle version depuis Mon entreprise, rubrique Mes pièces, pour garder « profil vérifié par PING ».');
    end if;
  end loop;

  -- b) Expiration : le trigger documents_admin_alert prévient le déposant par un message Support PING.
  for r in
    select d.id from public.documents d
    where d.status::text = 'valid' and d.valid_until is not null and d.valid_until < current_date
  loop
    update public.documents set status = 'expired' where id = r.id and status::text = 'valid';
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.expire_documents() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.expire_documents() to service_role;
  end if;
end $$;

-- 5. Planification quotidienne (6 h 41 UTC), si pg_cron est installé. Sans unschedule : on ne crée que si absent.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'ping_pieces_expirees') then
      perform cron.schedule('ping_pieces_expirees', '41 6 * * *', 'select public.expire_documents()');
    end if;
  end if;
end $$;

-- Vérification :
--   select tgname from pg_trigger where tgname = 'trg_documents_admin_alert';
--   select kind, title, handled_at from public.admin_notifications order by created_at desc limit 10;   -- en admin
--   select public.expire_documents();                                                                    -- en SQL Editor
--   select jobname, schedule from cron.job where jobname = 'ping_pieces_expirees';
