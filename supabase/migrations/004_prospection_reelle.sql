-- 004 — Prospection réelle et attribution des inscriptions (28/08/2026)
--
-- Ces objets ont d'abord été appliqués directement sur le projet distant
-- wmiawwaxwlvascyflpba (versions 20260828130527, 20260828130544 et
-- 20260828131750). Ce fichier les remet dans l'historique versionné : sans lui,
-- un `supabase db reset`, une branche de preview ou un nouvel environnement
-- repart sans les tables, et l'admin échoue au premier `.from('prospects')` en
-- affichant « vérifiez que ce compte a bien is_admin = true » — un diagnostic
-- qui envoie chercher au mauvais endroit.
--
-- Entièrement idempotent : réappliquer ce fichier sur la base distante, où les
-- objets existent déjà, ne casse rien.
--
-- Contexte : l'onglet Prospection de l'admin existait déjà, complet côté
-- interface, mais tournait sur quatre tableaux JavaScript en dur. Rien n'était
-- persisté et les fiches étaient fictives. Les tables ci-dessous sont créées
-- VIDES, volontairement : on n'injecte pas des prospects inventés dans une base
-- réelle.

-- --- Prospects : les gens qu'on démarche, pas encore inscrits -------------
create table if not exists public.prospects (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  seg         text not null default 'pro'   check (seg in ('pro','part')),
  source      text,
  zone        text,
  telephone   text,
  email       text,
  statut      text not null default 'a_contacter'
              check (statut in ('a_contacter','contacte','a_relancer','interessee',
                                'inscrite','waitlist','partenaire','perdu')),
  action      text,                      -- la prochaine chose à faire, en clair
  notes       text,
  link_code   text not null default 'dm',-- code de lien court porté par son invitation
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.prospects is
  'CRM de prospection. Remplace le tableau PROSPECTS en dur de admin.html.';

-- --- Partenaires : syndics, conciergeries, associations, campus -----------
create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  categorie   text,
  zone        text,
  telephone   text,
  email       text,
  statut      text not null default 'identifie'
              check (statut in ('identifie','contacte','rdv','actif','decline')),
  action      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- Cahier des actions commerciales --------------------------------------
create table if not exists public.commercial_actions (
  id           uuid primary key default gen_random_uuid(),
  action_date  date not null default current_date,
  type         text not null default 'autre'
               check (type in ('terrain','appel','email','rdv','social','autre')),
  cible        text not null,
  description  text,
  resultat     text not null default 'a_suivre'
               check (resultat in ('a_suivre','positif','sans_reponse','negatif')),
  next_step    text,
  prospect_id  uuid references public.prospects(id) on delete set null,
  partner_id   uuid references public.partners(id)  on delete set null,
  created_at   timestamptz not null default now()
);

-- --- Attribution : d'où vient chaque inscription --------------------------
-- Ferme la boucle d'acquisition : flyer -> /l/<code> -> landing -> inscription
-- -> lead attribué à sa campagne dans l'admin.
create table if not exists public.signup_attributions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  landing_path text,
  created_at   timestamptz not null default now()
);
comment on table public.signup_attributions is
  'Une ligne par inscription portant une attribution UTM. Alimente l''onglet '
  'Leads entrants. Ecrite par un trigger serveur, jamais par le client.';

create index if not exists prospects_statut_idx   on public.prospects(statut);
create index if not exists partners_statut_idx    on public.partners(statut);
create index if not exists actions_date_idx       on public.commercial_actions(action_date desc);
create index if not exists attributions_camp_idx  on public.signup_attributions(utm_campaign, utm_source);

-- --- updated_at automatique ----------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists prospects_touch on public.prospects;
create trigger prospects_touch before update on public.prospects
  for each row execute function public.touch_updated_at();

drop trigger if exists partners_touch on public.partners;
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();

-- --- RLS ------------------------------------------------------------------
alter table public.prospects           enable row level security;
alter table public.partners            enable row level security;
alter table public.commercial_actions  enable row level security;
alter table public.signup_attributions enable row level security;

-- Le CRM est un outil interne : admin uniquement, en lecture comme en écriture.
drop policy if exists prospects_admin on public.prospects;
create policy prospects_admin on public.prospects
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists partners_admin on public.partners;
create policy partners_admin on public.partners
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists actions_admin on public.commercial_actions;
create policy actions_admin on public.commercial_actions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists attributions_admin_read on public.signup_attributions;
create policy attributions_admin_read on public.signup_attributions
  for select using (public.is_admin());

-- Aucune policy d'insertion côté client, volontairement. Voir plus bas : c'est
-- un trigger serveur qui écrit, et personne ne doit pouvoir s'attribuer à la
-- campagne de son choix pour fausser les chiffres.
drop policy if exists attributions_self_insert on public.signup_attributions;

-- --- Leads entrants : de vraies inscriptions ------------------------------
create or replace function public.admin_leads()
returns table (
  id uuid, prenom text, nom text, type text, email text, telephone text,
  zone text, canal text, campagne text, contenu text,
  inscrit_le timestamptz, statut text
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'access denied'; end if;
  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    case when p.is_pro then 'pro' else 'particulier' end,
    u.email::text,
    p.phone_enc,
    p.city,
    coalesce(a.utm_source, 'direct'),
    a.utm_campaign,
    a.utm_content,
    p.created_at,
    -- Le statut est déduit de l'état réel du compte, pas saisi à la main :
    -- il ne peut donc pas mentir sur l'avancement.
    case
      when exists (select 1 from transactions t
                   where t.buyer_id = p.id or t.seller_id = p.id) then 'actif'
      when p.is_pro and exists (select 1 from provider_profiles pp
                   where pp.user_id = p.id and pp.is_active) then 'inscrit'
      when p.is_pro then 'kyc_en_cours'
      else 'nouveau'
    end
  from profiles p
  join auth.users u on u.id = p.id
  left join signup_attributions a on a.user_id = p.id
  where coalesce(p.is_admin, false) = false
  order by p.created_at desc;
end;
$$;

-- Ce que chaque campagne a réellement ramené.
create or replace function public.admin_campaign_stats()
returns table (utm_source text, utm_campaign text, utm_content text,
               inscriptions bigint, actifs bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'access denied'; end if;
  return query
  select a.utm_source, a.utm_campaign, a.utm_content,
         count(*)::bigint,
         count(*) filter (where exists (
           select 1 from transactions t
           where t.buyer_id = a.user_id or t.seller_id = a.user_id))::bigint
  from signup_attributions a
  group by 1,2,3
  order by 4 desc;
end;
$$;

-- --- L'attribution est écrite côté serveur, pas par le client -------------
--
-- Piège trouvé en relecture, à ne pas réintroduire : supabase.auth.signUp() ne
-- renvoie PAS de session quand la confirmation d'e-mail est active (elle l'est
-- sur ce projet). Un insert client partait donc avec le rôle anon, auth.uid()
-- valait null, et la policy le refusait — en silence. signup_attributions
-- serait resté vide pour toujours et tous les leads seraient remontés en
-- « direct », c'est-à-dire que le seul indicateur du retour des supports
-- imprimés aurait été mort à 100 %.
--
-- L'UTM voyage donc dans raw_user_meta_data (options.data de signUp) et c'est
-- ce trigger qui l'enregistre, exactement comme pour le profil.
create or replace function public.handle_new_user_attribution()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- Pas d'UTM = inscription directe, on ne crée pas de ligne vide.
  if coalesce(new.raw_user_meta_data->>'utm_source','') = '' then
    return new;
  end if;
  insert into public.signup_attributions
    (user_id, utm_source, utm_medium, utm_campaign, utm_content, landing_path)
  values (
    new.id,
    left(new.raw_user_meta_data->>'utm_source',   60),
    left(new.raw_user_meta_data->>'utm_medium',   60),
    left(new.raw_user_meta_data->>'utm_campaign', 60),
    left(new.raw_user_meta_data->>'utm_content',  60),
    left(new.raw_user_meta_data->>'landing_path', 200)
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_attribution on auth.users;
create trigger on_auth_user_attribution
  after insert on auth.users
  for each row execute function public.handle_new_user_attribution();
