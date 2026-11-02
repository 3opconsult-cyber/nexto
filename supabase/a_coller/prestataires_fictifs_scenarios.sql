-- Nouveaux prestataires FICTIFS (Nice, Antibes, Cannes, Monaco, Menton) avec créneaux et avis 5 étoiles.
-- À coller dans l'éditeur SQL Supabase : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new
--
-- Ce que ça crée (9 prestataires « Fictif 11 » à « Fictif 19 », fictif11..19@ping-demo.invalid, mot de passe
-- commun PingDemo2026!), pour tester la recherche, les fiches et la réservation avec des cas de prix variés :
--   11 repassage horaire 15 €/h · 12 repassage forfait 50 € · 13 ménage horaire 22 €/h
--   14 ménage forfait 60 € (3 h incluses, 20 €/h au-delà) · 15 nettoyage de vitres forfait 80 €
--   16 nettoyage forfait 90 € (3 h incluses, 28 €/h au-delà) · 17 ménage 24 €/h + repassage 18 €/h
--   18 ménage forfait 55 € (2 h incluses, 22 €/h au-delà) · 19 repassage horaire 16 €
-- + 6 clients fictifs (client.demo1..6@ping-demo.invalid) pour porter les avis (réutilise ceux de la
--   migration 007 s'ils existent), des créneaux libres dans provider_slots (J+1 à J+7, dates relatives à
--   now(), heure de Paris), 3 à 6 avis par prestataire, TOUJOURS 5 étoiles, certains avec pourboire, sur
--   des missions terminées marquées fictif = true (colonne posée par la migration 020).
--
-- Idempotent : rejouable sans doublon (comptes par e-mail, créneaux par (prestataire, heure), avis par
-- (client, prestataire, commentaire)). Les créneaux déjà passés d'une exécution précédente ne sont pas
-- renouvelés : rejouer le script ajoute les nouveaux jours.
--
-- Choix techniques, à connaître :
--  * Pas de session_replication_role = replica : inutile. Les missions sont insérées DIRECTEMENT au statut
--    « completed » (colonnes completed_at, arrived_at, durée renseignées), et les verrous (027, 014, 019)
--    laissent passer une session sans auth.uid() comme l'éditeur SQL. Les triggers utiles restent actifs
--    (création du profil à l'inscription, note moyenne du prestataire recalculée à chaque avis).
--  * AUCUNE FACTURE n'est générée : le trigger de facturation (transactions_invoice_on_complete) ne réagit
--    qu'à un UPDATE du statut, pas à un INSERT déjà « completed ». C'est voulu : des factures fictives
--    créeraient des virements « à payer », puis « en retard » après 15 jours (cron mark_overdue_transfers),
--    donc des dettes de commission et la suspension du prestataire fictif. Conséquence : le bouton
--    facture est absent de ces missions, et leurs fils de discussion sont vides.
--  * Les comptes sont créés dans auth.users comme en 005 (trigger handle_new_user -> profiles), sans ligne
--    auth.identities : même méthode que les Fictif 1 à 10.
--  * Taux de commission figés sur les missions : 8 % client + 17 % prestataire (valeur du 26/10/2026).
--
-- NETTOYAGE (à coller seul pour tout retirer ; avis, missions, demandes, créneaux, comptes) :
--   begin;
--   create temp table _f as select id from auth.users where email ~ '^fictif1[1-9]@ping-demo\.invalid$';
--   create temp table _t as select id from public.transactions where seller_id in (select id from _f);
--   delete from public.reviews          where transaction_id in (select id from _t);
--   delete from public.client_reviews   where transaction_id in (select id from _t);
--   delete from public.provider_slots   where provider_id in (select id from _f);
--   delete from public.messages         where transaction_id in (select id from _t);
--   delete from public.invoices         where transaction_id in (select id from _t);
--   create temp table _r as select request_id as id from public.transactions where id in (select id from _t);
--   delete from public.transactions     where id in (select id from _t);
--   delete from public.requests         where id in (select id from _r);
--   delete from public.services         where provider_id in (select id from _f);
--   delete from auth.users              where id in (select id from _f);   -- profils, fiches, pièces en cascade
--   -- clients client.demo5 et client.demo6 (créés ici) :
--   delete from auth.users where email in ('client.demo5@ping-demo.invalid','client.demo6@ping-demo.invalid');
--   commit;

-- 1) Clients fictifs (demo1..4 = migration 007, demo5 et demo6 ajoutés ici).
do $$
declare r record; uid uuid; pwd text := 'PingDemo2026!';
begin
  for r in
    select * from (values
      ('client.demo1@ping-demo.invalid','Camille'), ('client.demo2@ping-demo.invalid','Thomas'),
      ('client.demo3@ping-demo.invalid','Léa'),     ('client.demo4@ping-demo.invalid','Antoine'),
      ('client.demo5@ping-demo.invalid','Julie'),   ('client.demo6@ping-demo.invalid','Marc')
    ) as t(email, prenom)
  loop
    select id into uid from auth.users where email = r.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at,
                              raw_app_meta_data, raw_user_meta_data)
      values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              r.email, crypt(pwd, gen_salt('bf')), now(), now(), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name', r.prenom, 'last_name', '', 'role', 'client'));
    end if;
    update public.profiles set full_name = r.prenom, first_name = r.prenom, last_name = '',
      city = 'Nice', is_pro = false, phone_enc = coalesce(phone_enc, '06 39 97 00 00'),
      avatar_hue = (('x' || substr(md5(r.email), 1, 6))::bit(24)::int) % 360
    where id = uid;
  end loop;
end $$;

-- 2) Prestataires fictifs : compte, profil, fiche, pièces.
do $$
declare r record; uid uuid; pwd text := 'PingDemo2026!';
  has_inc boolean := exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'provider_profiles' and column_name = 'included_hours');
begin
  for r in
    select * from (values
      -- n, ville, lat, lng, métier, statut, siret, société, mode de prix, forfait (cts), horaire (cts), heures incluses
      (11, 'Nice — Libération',        43.7110, 7.2570, 'repassage', 'auto_entrepreneur', '81234500100011', null,                         'horaire',    0,    1500, null),
      (12, 'Antibes — Juan-les-Pins',  43.5680, 7.1110, 'repassage', 'particulier',       null,             null,                         'forfait',    5000, null, null),
      (13, 'Cannes — centre',          43.5513, 7.0128, 'menage',    'auto_entrepreneur', '82345600200022', null,                         'horaire',    0,    2200, null),
      (14, 'Cannes — La Bocca',        43.5530, 6.9587, 'menage',    'particulier',       null,             null,                         'forfait',    6000, 2000, 3),
      (15, 'Antibes — centre',         43.5808, 7.1239, 'nettoyage', 'eurl',              '83456700300033', 'Reflets d''Antibes (EURL)',  'forfait',    8000, null, null),
      (16, 'Beausoleil (près de Monaco)', 43.7425, 7.4230, 'nettoyage', 'sasu',           '84567800400044', 'Rocher Net (SASU)',          'forfait',    9000, 2800, 3),
      (17, 'Nice — Port',              43.6955, 7.2858, 'menage',    'auto_entrepreneur', '85678900500055', null,                         'horaire',    0,    2400, null),
      (18, 'Menton',                   43.7745, 7.4975, 'menage',    'particulier',       null,             null,                         'forfait',    5500, 2200, 2),
      (19, 'Roquebrune-Cap-Martin',    43.7600, 7.4630, 'repassage', 'auto_entrepreneur', '86789000600066', null,                         'horaire',    0,    1600, null)
    ) as t(n, ville, lat, lng, trade, statut, siret, societe, mode, forfait, horaire, inclus)
  loop
    select id into uid from auth.users where email = 'fictif' || r.n || '@ping-demo.invalid';
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at,
                              raw_app_meta_data, raw_user_meta_data)
      values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'fictif' || r.n || '@ping-demo.invalid', crypt(pwd, gen_salt('bf')), now(), now(), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name', 'Fictif ' || r.n, 'last_name', '', 'role', 'pro'));
    end if;

    update public.profiles set
      full_name = 'Fictif ' || r.n, first_name = 'Fictif ' || r.n, last_name = '',
      city = r.ville, is_pro = true,
      phone_enc = '06 39 98 76 ' || lpad(r.n::text, 2, '0'),
      avatar_hue = (r.n * 37) % 360
    where id = uid;

    insert into public.provider_profiles
      (id, trade, legal_status, siret, company_name, bio, pricing_type,
       base_price_cents, hourly_rate_cents, lat, lng, location, rating, reviews_count, is_active)
    values (uid, r.trade, r.statut::legal_status, r.siret, r.societe,
      'Profil de démonstration PING — ' || r.ville || '. Utilisé pour faire tester l''application, ne correspond à aucun prestataire réel.',
      r.mode::pricing_type, r.forfait, r.horaire, r.lat, r.lng,
      ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography, 0, 0, true)
    on conflict (id) do update set
      trade = excluded.trade, legal_status = excluded.legal_status, siret = excluded.siret,
      company_name = excluded.company_name, bio = excluded.bio, pricing_type = excluded.pricing_type,
      base_price_cents = excluded.base_price_cents, hourly_rate_cents = excluded.hourly_rate_cents,
      lat = excluded.lat, lng = excluded.lng, location = excluded.location, is_active = true;

    -- Heures incluses du forfait : colonne posée hors fichiers de migration, on vérifie qu'elle existe.
    if has_inc then
      execute 'update public.provider_profiles set included_hours = $1 where id = $2' using r.inclus, uid;
    end if;

    insert into public.documents (owner_id, kind, status, valid_until)
    select uid, 'identite'::doc_kind, 'valid'::doc_status, current_date + 365
    where not exists (select 1 from public.documents d where d.owner_id = uid and d.kind = 'identite');
    if r.statut <> 'particulier' then
      insert into public.documents (owner_id, kind, status, valid_until)
      select uid, 'rcpro'::doc_kind, 'valid'::doc_status, current_date + 365
      where not exists (select 1 from public.documents d where d.owner_id = uid and d.kind = 'rcpro');
    end if;
  end loop;
end $$;

-- 3) Prestations complémentaires (table services, colonnes de la migration 008).
insert into public.services (provider_id, name, price_cents, description, pricing_type, base_price_cents, hourly_rate_cents)
select u.id, s.name, s.price_cents, s.descr, s.mode::pricing_type, s.base, s.hourly
from auth.users u, (values
  ('fictif15@ping-demo.invalid', 'Nettoyage de vitres (maison, jusqu''à 10 fenêtres)', 8000, 'Vitres intérieures et extérieures accessibles, encadrements compris.', 'forfait', 8000, null::integer),
  ('fictif17@ping-demo.invalid', 'Repassage (en complément du ménage)', 1800, 'Repassage du linge courant, à l''heure.', 'horaire', 0, 1800)
) as s(email, name, price_cents, descr, mode, base, hourly)
where u.email = s.email
  and not exists (select 1 from public.services x where x.provider_id = u.id and x.name = s.name);

-- 4) Créneaux libres : J+1 à J+7, 9 h et 14 h (heure de Paris), un jour sur trois sauté pour varier.
insert into public.provider_slots (provider_id, starts_at, duration_minutes)
select u.id,
       ((date_trunc('day', now() at time zone 'Europe/Paris') + make_interval(days => d, hours => h)) at time zone 'Europe/Paris'),
       case when pp.base_price_cents > 0 and pp.hourly_rate_cents is not null then 180 else 120 end
from auth.users u
join public.provider_profiles pp on pp.id = u.id
cross join generate_series(1, 7) as d
cross join (values (9), (14)) as hh(h)
where u.email ~ '^fictif1[1-9]@ping-demo\.invalid$'
  and (d + substring(u.email from 7 for 2)::int + (h / 14)) % 3 <> 0
on conflict (provider_id, starts_at) do nothing;

-- 5) Missions terminées fictives + avis (toujours 5 étoiles). Chaque ligne = une mission réelle en base.
do $$
declare
  r record; buyer uuid; seller uuid; req_id uuid; tx_id uuid; trade text; mode text; ville text; hourly int; incl numeric; base int;
  done_at timestamptz; buyer_fee int; seller_fee int;
begin
  for r in
    select * from (values
      -- prestataire, client, montant (cts), minutes sur place, pourboire (cts), il y a N jours, commentaire
      (11, 1, 3000, 120, 0,   6, 'Linge repassé comme je l''aime, rendu à l''heure.'),
      (11, 2, 4500, 180, 300, 17, 'Chemises impeccables, merci.'),
      (11, 5, 2250,  90, 0,   29, 'Rapide et soigneuse, je referai appel à elle.'),
      (11, 3, 3000, 120, 0,   41, 'Très bien, ponctuel.'),
      (11, 6, 4500, 180, 0,   55, 'Du bon travail, rien à signaler.'),
      (12, 4, 5000, 150, 0,   8,  'Un panier entier repassé pour un tarif clair, parfait.'),
      (12, 1, 5000, 140, 500, 22, 'Très minutieuse sur les cols et les manches.'),
      (12, 6, 5000, 160, 0,   36, 'Sérieux et sympathique.'),
      (12, 2, 5000, 145, 0,   52, 'Prix annoncé respecté, linge bien plié.'),
      (13, 3, 6600, 180, 0,   5,  'Appartement propre, arrivée à l''heure prévue.'),
      (13, 5, 4400, 120, 0,   13, 'Efficace, les sols sont nickel.'),
      (13, 1, 8800, 240, 1000, 21, 'Quatre heures bien employées, salle de bain remarquable.'),
      (13, 4, 5500, 150, 0,   34, 'Je recommande, travail soigné.'),
      (13, 2, 6600, 180, 0,   47, 'Discret et professionnel.'),
      (13, 6, 4400, 120, 0,   60, 'Tout était en ordre en rentrant.'),
      (14, 2, 6000, 170, 0,   7,  'Forfait respecté, cuisine et salon impeccables.'),
      (14, 6, 6000, 175, 300, 19, 'Très agréable, travail soigné.'),
      (14, 4, 8000, 240, 0,   33, 'Un peu plus long que prévu, mais le résultat est là.'),
      (14, 1, 6000, 180, 0,   48, 'Rien à redire, merci.'),
      (15, 5, 8000, 150, 0,   9,  'Vitres propres, sans traces, même les baies coulissantes.'),
      (15, 3, 8000, 160, 500, 26, 'Intervention propre et rapide.'),
      (15, 1, 8000, 155, 0,   44, 'Bon travail sur les fenêtres en hauteur.'),
      (16, 6, 9000, 175, 0,   10, 'Remise en état très correcte après notre déménagement.'),
      (16, 2, 9000, 170, 1000, 24, 'Équipe organisée, résultat net.'),
      (16, 3, 11800, 220, 0,  40, 'Un peu plus d''une heure de plus que prévu, expliquée et bien facturée.'),
      (17, 1, 7200, 180, 0,   4,  'Appartement lumineux et propre, merci.'),
      (17, 4, 4800, 120, 0,   15, 'Ménage minutieux, repassage compris, pratique.'),
      (17, 5, 9600, 240, 500, 27, 'Quatre heures de travail sérieux.'),
      (17, 2, 7200, 185, 0,   39, 'À l''heure, aimable, appartement net.'),
      (17, 6, 7200, 180, 0,   58, 'Je la reprendrai volontiers.'),
      (18, 3, 5500, 115, 0,   11, 'Forfait clair, logement bien rangé après son passage.'),
      (18, 5, 5500, 120, 300, 25, 'Très soigneuse, merci.'),
      (18, 1, 7700, 170, 0,   42, 'Dépassement signalé à l''avance, travail propre.'),
      (18, 4, 5500, 118, 0,   57, 'Sérieuse et ponctuelle.'),
      (19, 6, 3200, 120, 0,   12, 'Linge de maison repassé avec soin.'),
      (19, 2, 4800, 180, 200, 30, 'Beau travail, délais tenus.'),
      (19, 3, 2400,  90, 0,   46, 'Efficace, je recommande.')
    ) as t(n, c, montant, minutes, tip, jours, comment)
  loop
    select id into seller from auth.users where email = 'fictif' || r.n || '@ping-demo.invalid';
    select id into buyer  from auth.users where email = 'client.demo' || r.c || '@ping-demo.invalid';
    if seller is null or buyer is null or seller = buyer then continue; end if;
    if exists (select 1 from public.reviews rv where rv.rater_id = buyer and rv.ratee_id = seller and rv.comment = r.comment) then continue; end if;

    select pp.trade, pp.pricing_type::text, pp.hourly_rate_cents into trade, mode, hourly from public.provider_profiles pp where pp.id = seller;
    done_at := now() - make_interval(days => r.jours) - interval '3 hours';
    buyer_fee  := round(r.montant * 0.08);
    seller_fee := round(r.montant * 0.17);

    insert into public.requests (requester_id, category, title, description, address, budget_cents, status)
    values (buyer, trade, 'Exemple — ' || case trade when 'menage' then 'Ménage' when 'repassage' then 'Repassage' else 'Nettoyage' end || ' (démonstration)',
            'Demande de démonstration (Donnée fictive de démonstration)', 'Côte d''Azur', r.montant, 'matched')
    returning id into req_id;

    insert into public.transactions (kind, buyer_id, seller_id, request_id,
      subtotal_cents, buyer_fee_cents, seller_fee_cents, total_charged_cents, payout_cents,
      status, price_confirmed, scheduled_at, arrived_at, completed_at, duration_minutes, created_at)
    values ('service', buyer, seller, req_id,
      r.montant, buyer_fee, seller_fee, r.montant + buyer_fee, r.montant - seller_fee,
      'completed', true, done_at - make_interval(mins => r.minutes), done_at - make_interval(mins => r.minutes), done_at, r.minutes,
      done_at - interval '5 days')
    returning id into tx_id;

    -- Colonne de marquage (migration 020) : posée seulement si elle existe.
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'transactions' and column_name = 'fictif') then
      execute 'update public.transactions set fictif = true where id = $1' using tx_id;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'requests' and column_name = 'fictif') then
      execute 'update public.requests set fictif = true where id = $1' using req_id;
    end if;

    -- Tarification de la mission (forfait, heures incluses, taux horaire), si les colonnes existent.
    begin
      if mode = 'horaire' then
        execute 'update public.transactions set hourly_rate_cents = $2 where id = $1' using tx_id, hourly;
      else
        select pp.base_price_cents, pp.hourly_rate_cents into base, hourly from public.provider_profiles pp where pp.id = seller;
        execute 'update public.transactions set base_forfait_cents = $2, hourly_rate_cents = $3 where id = $1' using tx_id, base, hourly;
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_profiles' and column_name = 'included_hours')
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'transactions' and column_name = 'included_hours') then
          execute 'update public.transactions t set included_hours = (select included_hours from public.provider_profiles where id = $2) where t.id = $1' using tx_id, seller;
        end if;
      end if;
    exception when undefined_column then null;
    end;

    insert into public.reviews (transaction_id, rater_id, ratee_id, stars, quality_stars, service_stars,
                                recommend, tip_cents, comment, created_at)
    values (tx_id, buyer, seller, 5, 5, 5, true, r.tip, r.comment, done_at + interval '2 hours');
  end loop;
end $$;

-- 6) Note moyenne et nombre d'avis des fiches (le trigger les recalcule déjà, ceci sécurise).
update public.provider_profiles pp set
  rating = coalesce((select round(avg(stars)::numeric, 1) from public.reviews where ratee_id = pp.id), 0),
  reviews_count = (select count(*) from public.reviews where ratee_id = pp.id)
where pp.id in (select id from auth.users where email ~ '^fictif1[1-9]@ping-demo\.invalid$');

-- Contrôle (facultatif) :
--   select u.email, pp.trade, pp.pricing_type, pp.base_price_cents, pp.hourly_rate_cents, pp.rating, pp.reviews_count,
--          (select count(*) from public.provider_slots s where s.provider_id = pp.id and s.starts_at > now()) as creneaux
--   from public.provider_profiles pp join auth.users u on u.id = pp.id
--   where u.email ~ '^fictif1[1-9]@ping-demo\.invalid$' order by 1;
