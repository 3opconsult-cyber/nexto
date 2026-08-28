-- 005 — La carte ne montrait aucun prestataire, et dix profils de test (28/08/2026)
--
-- Appliqué d'abord sur le projet distant wmiawwaxwlvascyflpba. Idempotent.
--
-- LE BUG
-- providers_nearby() était en LANGUAGE sql sans SECURITY DEFINER : elle
-- s'exécutait avec les droits de l'appelant, RLS comprise. Elle fait un
-- « join profiles » pour le nom, or profiles est en lecture strictement
-- personnelle (auth.uid() = id). Le join ne ramenait donc rien.
-- Mesuré en simulant les deux rôles avant correctif :
--   role anon                         -> 0 prestataire
--   role authenticated (vrai sub JWT) -> 1 prestataire (lui-même)
-- Autrement dit la carte était vide pour tout le monde, connecté ou non.
--
-- LE CORRECTIF
-- La fonction devient SECURITY DEFINER : c'est elle, et pas la table, qui
-- décide ce qui sort — prestataires actifs uniquement, et de leur profil
-- seulement le nom affiché et la teinte d'avatar. Ouvrir profiles en lecture
-- publique aurait exposé téléphone, adresse et date de naissance.
--
-- provider_public_name() règle la même cause sur /pro/[id], dont l'embed
-- profiles(full_name) renvoyait null : la fiche s'affichait sans nom.

create or replace function public.providers_nearby(
  lat double precision, lng double precision,
  radius_m integer default 15000, p_trade text default null)
returns table(
  id uuid, trade text, legal_status legal_status, base_price_cents integer,
  rating numeric, reviews_count integer, is_active boolean, distance_m double precision,
  bio text, lat double precision, lng double precision, pricing_type pricing_type,
  hourly_rate_cents integer, full_name text, avatar_hue integer,
  has_identity boolean, has_rcpro boolean)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.trade, p.legal_status, p.base_price_cents, p.rating, p.reviews_count, p.is_active,
    ST_Distance(p.location, ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography) as distance_m,
    p.bio,
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng,
    p.pricing_type, p.hourly_rate_cents,
    pr.full_name, pr.avatar_hue,
    exists(select 1 from documents d where d.owner_id = p.id and d.kind = 'identite' and d.status in ('pending','valid')) as has_identity,
    exists(select 1 from documents d where d.owner_id = p.id and d.kind = 'rcpro'    and d.status in ('pending','valid')) as has_rcpro
  from provider_profiles p
  join profiles pr on pr.id = p.id
  where p.is_active = true
    and p.location is not null
    and ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography, radius_m)
    and (p_trade is null or p.trade = p_trade)
  order by distance_m
  limit 50;
$$;

create or replace function public.provider_public_name(provider_id uuid)
returns table(full_name text, avatar_hue integer)
language sql stable security definer set search_path to 'public' as $$
  select pr.full_name, pr.avatar_hue
  from provider_profiles p join profiles pr on pr.id = p.id
  where p.id = provider_id and p.is_active = true;
$$;

grant execute on function public.providers_nearby(double precision,double precision,integer,text) to anon, authenticated;
grant execute on function public.provider_public_name(uuid) to anon, authenticated;

-- LES DIX PRESTATAIRES DE TEST
-- Nommés « Fictif N », entre Vence et Nice, pour faire tester l'application.
-- Ils passent par auth.users afin que le trigger handle_new_user crée le profil
-- exactement comme pour une vraie inscription : aucun chemin parallèle.
-- Domaine .invalid : réservé par la RFC 2606, il ne peut appartenir à personne.
-- Téléphones en 06 39 98 xx xx : plage réservée à la fiction, jamais attribuée.
-- Mot de passe commun PingDemo2026! pour pouvoir aussi tester le côté pro.
-- Note et nombre d'avis à zéro : la table reviews est vide, afficher des étoiles
-- sans avis derrière serait un mensonge d'interface.
do $$
declare r record; uid uuid; pwd text := 'PingDemo2026!';
begin
  for r in
    select * from (values
      ( 1,'Fictif 1','Vence',                43.7225,7.1130,'menage',   'auto_entrepreneur','83912400500018',null,                      2600,0),
      ( 2,'Fictif 2','Saint-Paul-de-Vence',  43.6960,7.1220,'repassage','particulier',       null,            null,                      1700,0),
      ( 3,'Fictif 3','La Colle-sur-Loup',    43.6860,7.1040,'menage',   'particulier',       null,            null,                      1900,0),
      ( 4,'Fictif 4','Cagnes-sur-Mer',       43.6640,7.1490,'nettoyage','sasu',              '90233118700024','Vitres du Littoral (SASU)',   0,9000),
      ( 5,'Fictif 5','Villeneuve-Loubet',    43.6580,7.1220,'menage',   'auto_entrepreneur','81455203900017',null,                      2400,0),
      ( 6,'Fictif 6','Saint-Laurent-du-Var', 43.6680,7.1880,'repassage','auto_entrepreneur','84771902200011',null,                      2200,0),
      ( 7,'Fictif 7','Nice — Lingostière',   43.7050,7.2000,'menage',   'particulier',       null,            null,                      2000,0),
      ( 8,'Fictif 8','Nice — Cimiez',        43.7190,7.2760,'nettoyage','eurl',              '52099471300036','Azur Net Services (EURL)',3900,0),
      ( 9,'Fictif 9','Nice — centre',        43.7009,7.2683,'menage',   'particulier',       null,            null,                      2100,0),
      (10,'Fictif 10','Nice — Riquier',      43.7080,7.2900,'repassage','auto_entrepreneur','88301244600015',null,                      2300,0)
    ) as t(n,prenom,ville,lat,lng,trade,statut,siret,societe,horaire,forfait)
  loop
    select id into uid from auth.users where email = 'fictif'||r.n||'@ping-demo.invalid';
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at,
                              raw_app_meta_data, raw_user_meta_data)
      values (uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
              'fictif'||r.n||'@ping-demo.invalid', crypt(pwd, gen_salt('bf')),
              now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name',r.prenom,'last_name','','role','pro'));
    end if;

    update public.profiles set
      full_name = r.prenom, first_name = r.prenom, last_name = '',
      city = r.ville, is_pro = true,
      phone_enc = '06 39 98 76 '||lpad(r.n::text,2,'0'),
      avatar_hue = (r.n * 37) % 360
    where id = uid;

    insert into public.provider_profiles
      (id, trade, legal_status, siret, company_name, bio, pricing_type,
       base_price_cents, hourly_rate_cents, lat, lng, location, rating, reviews_count, is_active)
    values (uid, r.trade, r.statut::legal_status, r.siret, r.societe,
      'Profil de démonstration PING — '||r.prenom||' à '||r.ville||
      '. Utilisé pour faire tester l''application, ne correspond à aucun prestataire réel.',
      (case when r.forfait > 0 then 'forfait' else 'horaire' end)::pricing_type,
      r.forfait, nullif(r.horaire,0), r.lat, r.lng,
      ST_SetSRID(ST_MakePoint(r.lng, r.lat),4326)::geography, 0, 0, true)
    on conflict (id) do update set
      trade=excluded.trade, legal_status=excluded.legal_status, siret=excluded.siret,
      company_name=excluded.company_name, bio=excluded.bio, pricing_type=excluded.pricing_type,
      base_price_cents=excluded.base_price_cents, hourly_rate_cents=excluded.hourly_rate_cents,
      lat=excluded.lat, lng=excluded.lng, location=excluded.location, is_active=true;

    insert into public.documents (owner_id, kind, status, valid_until)
    select uid,'identite'::doc_kind,'valid'::doc_status,current_date+365
    where not exists (select 1 from documents d where d.owner_id=uid and d.kind='identite');

    if r.statut <> 'particulier' then
      insert into public.documents (owner_id, kind, status, valid_until)
      select uid,'rcpro'::doc_kind,'valid'::doc_status,current_date+365
      where not exists (select 1 from documents d where d.owner_id=uid and d.kind='rcpro');
    end if;
  end loop;
end $$;

-- Pour les retirer un jour :
--   delete from auth.users where email like 'fictif%@ping-demo.invalid';
-- (les profils, fiches et documents suivent en cascade)
