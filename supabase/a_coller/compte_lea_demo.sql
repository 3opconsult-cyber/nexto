-- Compte de démonstration « Léa » : prestataire à Nice (ménage, repassage), avec une vraie connexion.
-- E-mail lea.demo@ping-demo.invalid · mot de passe LeaDemo2026! · sert aux captures, à l'Admin et aux tests (pas d'accès libre au public).
-- Idempotent. Nettoyage : delete from auth.users where email = 'lea.demo@ping-demo.invalid';  (profil, fiche, créneaux en cascade)
do $$
declare uid uuid; pwd text := 'LeaDemo2026!'; em text := 'lea.demo@ping-demo.invalid';
begin
  select id into uid from auth.users where email = em;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', em, crypt(pwd, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('first_name','Léa','last_name','Moreau','role','pro'), '', '', '', '');
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false), 'email', uid::text, now(), now(), now());
  end if;
  update public.profiles set full_name='Léa Moreau', first_name='Léa', last_name='Moreau', city='Nice', is_pro=true, phone_enc='06 39 98 70 01', avatar_hue=330 where id = uid;
  insert into public.provider_profiles (id, trade, legal_status, siret, bio, pricing_type, base_price_cents, hourly_rate_cents, lat, lng, location, rating, reviews_count, is_active)
  values (uid, 'menage', 'auto_entrepreneur'::legal_status, '88123400700077',
    'Compte de démonstration PING : Léa, ménage et repassage à Nice. Sert à présenter l''application, ne correspond à aucune personne réelle.',
    'horaire'::pricing_type, 0, 2200, 43.7102, 7.2620, ST_SetSRID(ST_MakePoint(7.2620, 43.7102), 4326)::geography, 0, 0, true)
  on conflict (id) do update set trade='menage', pricing_type='horaire'::pricing_type, hourly_rate_cents=2200, lat=43.7102, lng=7.2620, location=ST_SetSRID(ST_MakePoint(7.2620,43.7102),4326)::geography, is_active=true;
  insert into public.services (provider_id, name, price_cents, description, pricing_type, base_price_cents, hourly_rate_cents)
  select uid, s.name, s.p, s.d, s.m::pricing_type, s.b, s.h from (values
    ('Ménage à domicile', 2200, 'Entretien courant du logement, à l''heure.', 'horaire', 0, 2200),
    ('Repassage', 1500, 'Repassage du linge courant, à l''heure.', 'horaire', 0, 1500),
    ('Repassage, forfait panier', 5000, 'Un panier de linge repassé et plié.', 'forfait', 5000, null::integer)
  ) as s(name,p,d,m,b,h) where not exists (select 1 from public.services x where x.provider_id = uid and x.name = s.name);
  insert into public.documents (owner_id, kind, status, valid_until)
  select uid, 'identite'::doc_kind, 'valid'::doc_status, current_date + 365 where not exists (select 1 from public.documents d where d.owner_id = uid and d.kind='identite');
  insert into public.provider_slots (provider_id, starts_at, duration_minutes)
  select uid, ((date_trunc('day', now() at time zone 'Europe/Paris') + make_interval(days => d, hours => h)) at time zone 'Europe/Paris'), 120
  from generate_series(1,7) d cross join (values (9),(14)) hh(h) on conflict (provider_id, starts_at) do nothing;
end $$;
select u.email, (select count(*) from auth.identities i where i.user_id=u.id) as identites, p.full_name, p.city, p.is_pro, pp.trade, pp.is_active from auth.users u join public.profiles p on p.id=u.id left join public.provider_profiles pp on pp.id=u.id where u.email='lea.demo@ping-demo.invalid';
