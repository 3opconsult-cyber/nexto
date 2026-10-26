-- 007 — Enrichir les 10 prestataires de démonstration (26/10/2026)
--
-- Demande de Romain : pour la version bêta de test, les comptes « Fictif N »
-- (créés en 005) doivent avoir une vraie épaisseur — des métiers variés
-- (ménage, repassage, ménage+repassage, nettoyage, mise en blanc), des tarifs
-- différents, et des avis/étoiles — pour que les testeurs vivent une
-- expérience complète de bout en bout (recherche → fiche détaillée →
-- réservation → paiement simulé), pas des fiches vides.
--
-- ATTENTION — ceci revient sur une décision documentée en 005 : « Note et
-- nombre d'avis à zéro : la table reviews est vide, afficher des étoiles
-- sans avis derrière serait un mensonge d'interface. » Romain a explicitement
-- demandé des avis fictifs « même si les informations sont fausses », pour
-- CETTE phase de test fermé (lien partagé, pas une fiche App Store publique).
-- Ce n'est donc pas un oubli de cette règle, mais un choix assumé et borné :
-- uniquement sur les comptes « Fictif N » (bio déjà explicite : « Profil de
-- démonstration PING [...] ne correspond à aucun prestataire réel »),
-- jamais sur un vrai compte testeur qui s'inscrit pour de vrai.
--
-- Idempotent comme 005 : rejouable sans dupliquer.

-- 1) Quatre clients fictifs pour porter les avis (sinon un seul nom reviendrait
--    dix fois, ce qui serait plus louche qu'autre chose).
do $$
declare r record; uid uuid; pwd text := 'PingDemo2026!';
begin
  for r in
    select * from (values
      ('client.demo1@ping-demo.invalid','Camille'),
      ('client.demo2@ping-demo.invalid','Thomas'),
      ('client.demo3@ping-demo.invalid','Léa'),
      ('client.demo4@ping-demo.invalid','Antoine')
    ) as t(email,prenom)
  loop
    select id into uid from auth.users where email = r.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                              email_confirmed_at, created_at, updated_at,
                              raw_app_meta_data, raw_user_meta_data)
      values (uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
              r.email, crypt(pwd, gen_salt('bf')),
              now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name',r.prenom,'last_name','','role','client'));
    end if;
    update public.profiles set full_name = r.prenom, first_name = r.prenom, last_name = '',
      city = 'Nice', is_pro = false, phone_enc = '06 39 97 00 00',
      avatar_hue = (('x'||substr(md5(r.email),1,6))::bit(24)::int) % 360
    where id = uid;
  end loop;
end $$;

-- 2) Variété de métiers et de tarifs. Les trades restent dans la liste
--    officielle (menage/repassage/nettoyage, src/lib/trades.ts) ; "ménage +
--    repassage" et "mise en blanc" passent par la table `services` (texte
--    libre, déjà le mécanisme des prestations complémentaires — cf.
--    /pro/tarifs), pas par un nouveau trade inventé en base.
update public.provider_profiles set hourly_rate_cents = 2000, base_price_cents = 0, pricing_type = 'horaire' where id = (select id from auth.users where email = 'fictif7@ping-demo.invalid');

insert into public.services (provider_id, name, price_cents)
select u.id, s.name, s.price_cents
from auth.users u, (values
  ('fictif3@ping-demo.invalid', 'Repassage (en complément du ménage)', 1500),
  ('fictif6@ping-demo.invalid', 'Ménage (en complément du repassage)', 2000),
  ('fictif9@ping-demo.invalid', 'Repassage (en complément du ménage)', 1600),
  ('fictif4@ping-demo.invalid', 'Mise en blanc (changement de draps)', 2500),
  ('fictif8@ping-demo.invalid', 'Mise en blanc (changement de draps)', 2200)
) as s(email, name, price_cents)
where u.email = s.email
  and not exists (
    select 1 from public.services x where x.provider_id = u.id and x.name = s.name
  );

-- 3) Avis fictifs : chaque prestataire reçoit 2 avis d'un client de démo
--    différent, via une vraie demande + transaction 'completed' (même chemin
--    que le trigger de facturation réel, pas un raccourci qui contournerait
--    le schéma). `on conflict` impossible ici (pas de contrainte unique
--    naturelle) donc on protège par une recherche d'avis existant du même
--    rater sur le même ratee avant d'insérer.
do $$
declare
  r record; buyer uuid; seller uuid; req_id uuid; tx_id uuid;
  subtotal int; buyer_fee int; seller_fee int;
begin
  for r in
    select * from (values
      ('fictif1@ping-demo.invalid', 'client.demo1@ping-demo.invalid', 'menage',    2600, 5, 'Ponctuelle et minutieuse, appartement nickel à chaque passage.'),
      ('fictif1@ping-demo.invalid', 'client.demo2@ping-demo.invalid', 'menage',    2600, 5, 'Très sérieuse, je recommande sans hésiter.'),
      ('fictif2@ping-demo.invalid', 'client.demo2@ping-demo.invalid', 'repassage', 1700, 5, 'Linge impeccable, plis parfaits, livré à l''heure.'),
      ('fictif2@ping-demo.invalid', 'client.demo3@ping-demo.invalid', 'repassage', 1700, 4, 'Très bien, juste un peu de retard sur le créneau.'),
      ('fictif3@ping-demo.invalid', 'client.demo3@ping-demo.invalid', 'menage',    1900, 5, 'Fait le ménage et le repassage en même temps, un vrai gain de temps.'),
      ('fictif3@ping-demo.invalid', 'client.demo4@ping-demo.invalid', 'menage',    1900, 5, 'Efficace et discrète, je la reprendrai.'),
      ('fictif4@ping-demo.invalid', 'client.demo1@ping-demo.invalid', 'nettoyage', 9000, 5, 'Vitres impeccables, travail pro du sol au plafond.'),
      ('fictif4@ping-demo.invalid', 'client.demo4@ping-demo.invalid', 'nettoyage', 9000, 4, 'Bon travail, un peu cher mais le résultat est là.'),
      ('fictif5@ping-demo.invalid', 'client.demo2@ping-demo.invalid', 'menage',    2400, 5, 'Toujours à l''heure, maison impeccable.'),
      ('fictif5@ping-demo.invalid', 'client.demo3@ping-demo.invalid', 'menage',    2400, 5, 'Très satisfaite, rien à redire.'),
      ('fictif6@ping-demo.invalid', 'client.demo1@ping-demo.invalid', 'repassage', 2200, 5, 'Propose aussi le ménage, pratique pour tout faire d''un coup.'),
      ('fictif6@ping-demo.invalid', 'client.demo4@ping-demo.invalid', 'repassage', 2200, 4, 'Bon rapport qualité-prix.'),
      ('fictif7@ping-demo.invalid', 'client.demo2@ping-demo.invalid', 'menage',    2000, 5, 'Rapide à répondre, intervention nickel.'),
      ('fictif7@ping-demo.invalid', 'client.demo3@ping-demo.invalid', 'menage',    2000, 5, 'Très pro, je recommande.'),
      ('fictif8@ping-demo.invalid', 'client.demo1@ping-demo.invalid', 'nettoyage', 3900, 5, 'Mise en blanc avant l''arrivée des locataires, très réactif.'),
      ('fictif8@ping-demo.invalid', 'client.demo4@ping-demo.invalid', 'nettoyage', 3900, 5, 'Service complet et sérieux.'),
      ('fictif9@ping-demo.invalid', 'client.demo2@ping-demo.invalid', 'menage',    2100, 5, 'Fait aussi le repassage, parfait pour gagner du temps.'),
      ('fictif9@ping-demo.invalid', 'client.demo3@ping-demo.invalid', 'menage',    2100, 4, 'Bien, quelques oublis mineurs.'),
      ('fictif10@ping-demo.invalid','client.demo1@ping-demo.invalid', 'repassage', 2300, 5, 'Linge rendu nickel, très ponctuelle.'),
      ('fictif10@ping-demo.invalid','client.demo4@ping-demo.invalid', 'repassage', 2300, 5, 'Au top, je recommande.')
    ) as t(seller_email, buyer_email, trade, price_cents, stars, comment)
  loop
    select id into seller from auth.users where email = r.seller_email;
    select id into buyer  from auth.users where email = r.buyer_email;
    if seller is null or buyer is null then continue; end if;
    if exists (select 1 from public.reviews where rater_id = buyer and ratee_id = seller) then continue; end if;

    insert into public.requests (requester_id, category, description, address, budget_cents, status)
    values (buyer, r.trade, 'Demande de démonstration (avis bêta-test)', 'Côte d''Azur', r.price_cents, 'matched')
    returning id into req_id;

    subtotal := r.price_cents;
    buyer_fee := round(subtotal * 0.05);
    seller_fee := round(subtotal * 0.11);

    insert into public.transactions (kind, buyer_id, seller_id, request_id,
      subtotal_cents, buyer_fee_cents, seller_fee_cents, total_charged_cents, payout_cents,
      status, price_confirmed, created_at)
    values ('service', buyer, seller, req_id,
      subtotal, buyer_fee, seller_fee, subtotal + buyer_fee, subtotal - seller_fee,
      'completed', true, now() - (random()*60 || ' days')::interval)
    returning id into tx_id;

    insert into public.reviews (transaction_id, rater_id, ratee_id, stars, quality_stars, service_stars,
      recommend, tip_cents, comment, created_at)
    values (tx_id, buyer, seller, r.stars, r.stars, r.stars, true, 0, r.comment,
      now() - (random()*60 || ' days')::interval);
  end loop;
end $$;

-- 4) Recalcule note moyenne et nombre d'avis affichés sur la fiche, à partir
--    des vrais avis insérés ci-dessus (pas de chiffre en dur).
update public.provider_profiles pp set
  rating = coalesce((select round(avg(stars)::numeric, 1) from public.reviews where ratee_id = pp.id), 0),
  reviews_count = (select count(*) from public.reviews where ratee_id = pp.id)
where pp.id in (select id from auth.users where email like 'fictif%@ping-demo.invalid');
