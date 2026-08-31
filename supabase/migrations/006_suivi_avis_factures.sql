-- 006 — Suivi d'arrivée, avis client, factures réellement générées (28/08/2026)
--
-- Appliqué d'abord sur le projet distant wmiawwaxwlvascyflpba. Idempotent.
--
-- Trois manques comblés, dans l'ordre où ils se voient à l'écran :
--   · le client ne savait pas quand le prestataire arrivait ;
--   · la table `reviews` existait depuis le premier schéma sans qu'aucun écran
--     ne puisse y écrire — toutes les notes affichées venaient de fixtures ;
--   · le modèle à trois factures était recalculé à la volée dans l'admin,
--     jamais enregistré, et l'écran /mission/[id]/facture interrogeait des
--     tables qui n'existent pas (`missions`, `pro_profiles`).

-- ---------- 1. Suivi d'arrivée ----------
-- Déclaré par le prestataire, pas déduit d'un GPS : on ne piste personne en
-- continu, et ça ne dépend pas d'une permission de géolocalisation.
alter table public.transactions
  add column if not exists en_route_at  timestamptz,
  add column if not exists eta_minutes  integer;
comment on column public.transactions.en_route_at is
  'Horodatage du depart declare par le prestataire. Aucune geolocalisation continue.';
comment on column public.transactions.eta_minutes is
  'Duree de trajet annoncee par le prestataire au moment du depart, en minutes.';

-- ---------- 2. Avis client ----------
alter table public.reviews
  add column if not exists quality_stars integer check (quality_stars between 1 and 5),
  add column if not exists service_stars integer check (service_stars between 1 and 5),
  add column if not exists recommend     boolean,
  add column if not exists tip_cents     integer not null default 0 check (tip_cents >= 0);
comment on column public.reviews.tip_cents is
  'Pourboire promis par le client. Non encaisse tant que Stripe n''est pas branche : '
  'c''est une intention enregistree, pas un paiement. Ne jamais l''afficher comme percu.';

create unique index if not exists reviews_one_per_tx_rater
  on public.reviews(transaction_id, rater_id);

drop policy if exists reviews_buyer_insert on public.reviews;
create policy reviews_buyer_insert on public.reviews
  for insert with check (
    auth.uid() = rater_id
    and exists (select 1 from transactions t
                where t.id = transaction_id and t.buyer_id = auth.uid()
                  and t.seller_id = ratee_id and t.status in ('completed','released'))
  );

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select using (true);

-- La note d'une fiche est desormais calculee, plus saisie : elle ne peut plus mentir.
create or replace function public.refresh_provider_rating()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare pid uuid := coalesce(new.ratee_id, old.ratee_id);
begin
  update provider_profiles set
    rating = coalesce((select round(avg(stars)::numeric, 1) from reviews where ratee_id = pid), 0),
    reviews_count = (select count(*) from reviews where ratee_id = pid)
  where id = pid;
  return null;
end $$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_provider_rating();

-- ---------- 3. Identite de la plateforme ----------
-- VIDE au depart, et c'est voulu : les coordonnees legales de PING ne
-- s'inventent pas. Elles se saisissent dans l'admin, onglet Support commercial.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(key, value) values ('platform_identity', '{}'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select using (true);
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Factures ----------
alter table public.invoices
  add column if not exists kind            text not null default 'prestation'
                           check (kind in ('prestation','commission_client','commission_pro')),
  add column if not exists issuer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists client_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists lines           jsonb not null default '[]'::jsonb,
  add column if not exists legal           jsonb not null default '{}'::jsonb,
  add column if not exists issued_at       timestamptz not null default now();

create unique index if not exists invoices_tx_kind on public.invoices(transaction_id, kind);

drop policy if exists invoices_parties_read on public.invoices;
create policy invoices_parties_read on public.invoices
  for select using (auth.uid() = issuer_id or auth.uid() = client_id or public.is_admin());

create sequence if not exists public.invoice_seq;

create or replace function public.trade_label(t text)
returns text language sql immutable as $$
  select case t when 'menage' then 'Ménage' when 'repassage' then 'Repassage'
                when 'nettoyage' then 'Nettoyage'
                else initcap(coalesce(t, 'Prestation')) end;
$$;

-- Mentions legales. Calendrier verifie le 28/08/2026 :
--   1er sept. 2026 — toutes les entreprises doivent POUVOIR RECEVOIR une facture
--                    electronique ; emission obligatoire pour les grandes entreprises.
--   1er sept. 2027 — emission obligatoire pour ETI, PME, TPE et micro, avec quatre
--                    mentions de plus (SIREN client, adresse de livraison si
--                    differente, categorie d'operation, option de paiement TVA).
--   Franchise      — « art. 293 B du CGI » jusqu'au 31/12/2026, puis
--                    « art. L. 233-1 du CIBS » (ancienne toleree jusqu'au 30/06/2028).
create or replace function public.invoice_legal(p_status legal_status, p_date date)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'franchise_tva',
      case when p_status = 'particulier' then null
           when p_date < date '2027-01-01' then 'TVA non applicable, art. 293 B du CGI'
           else 'TVA non applicable, art. L. 233-1 du CIBS' end,
    'forme', case when p_status = 'auto_entrepreneur' then 'Entrepreneur individuel (EI)' else null end,
    'penalites', 'En cas de retard de paiement, penalites au taux de 3 fois le taux d''interet legal, exigibles sans rappel prealable.',
    'indemnite_recouvrement', 'Indemnite forfaitaire pour frais de recouvrement : 40 EUR (clients professionnels).',
    'escompte', 'Pas d''escompte pour paiement anticipe.',
    'categorie_operation', 'Prestation de services',
    'reforme_2027', p_date >= date '2027-09-01');
$$;

create or replace function public.generate_invoices(p_tx uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare t record; seller record; buyer record; sp record; plat jsonb; yr text; n bigint; d date;
begin
  select * into t from transactions where id = p_tx;
  if t is null or t.status not in ('completed','released') then return; end if;
  if exists (select 1 from invoices where transaction_id = p_tx) then return; end if;

  select * into seller from profiles where id = t.seller_id;
  select * into buyer  from profiles where id = t.buyer_id;
  select * into sp     from provider_profiles where id = t.seller_id;
  select value into plat from app_settings where key = 'platform_identity';

  d := coalesce(t.completed_at, now())::date; yr := to_char(d,'YYYY'); n := nextval('invoice_seq');

  -- Un prestataire declare « particulier » n'est pas une entreprise : on emet un
  -- RECU, pas une facture. Faire l'inverse serait produire un faux.
  insert into invoices (transaction_id, number, kind, issuer_id, client_id, net_cents,
                        issued_at, issuer_snapshot, client_snapshot, lines, legal)
  values (p_tx, 'FACT-'||yr||'-'||lpad(n::text,5,'0'), 'prestation',
          t.seller_id, t.buyer_id, t.subtotal_cents, d,
          jsonb_build_object('nom',seller.full_name,'adresse',seller.address,'ville',seller.city,
                             'siret',sp.siret,'societe',sp.company_name,
                             'statut',sp.legal_status::text,'sap',sp.sap_number,
                             'document', case when sp.legal_status='particulier'
                                              then 'Recu de prestation' else 'Facture' end),
          jsonb_build_object('nom',buyer.full_name,'adresse',buyer.address,'ville',buyer.city),
          jsonb_build_array(jsonb_build_object('libelle',trade_label(sp.trade),
                             'duree_min',t.duration_minutes,
                             'taux_horaire_cents',t.hourly_rate_cents,
                             'montant_cents',t.subtotal_cents)),
          invoice_legal(sp.legal_status, d));

  insert into invoices (transaction_id, number, kind, issuer_id, client_id, net_cents,
                        issued_at, issuer_snapshot, client_snapshot, lines, legal)
  values
    (p_tx,'PING-C-'||yr||'-'||lpad(n::text,5,'0'),'commission_client',
     t.seller_id,t.buyer_id,t.buyer_fee_cents,d,coalesce(plat,'{}'::jsonb),
     jsonb_build_object('nom',buyer.full_name,'adresse',buyer.address,'ville',buyer.city),
     jsonb_build_array(jsonb_build_object('libelle','Frais de service PING (5 %)',
                                          'montant_cents',t.buyer_fee_cents)),
     jsonb_build_object('categorie_operation','Prestation de services')),
    (p_tx,'PING-V-'||yr||'-'||lpad(n::text,5,'0'),'commission_pro',
     t.buyer_id,t.seller_id,t.seller_fee_cents,d,coalesce(plat,'{}'::jsonb),
     jsonb_build_object('nom',seller.full_name,'adresse',seller.address,
                        'ville',seller.city,'siret',sp.siret),
     jsonb_build_array(jsonb_build_object('libelle','Commission PING (11 %)',
                                          'montant_cents',t.seller_fee_cents)),
     jsonb_build_object('categorie_operation','Prestation de services'));
end $$;

create or replace function public.on_transaction_completed()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status in ('completed','released') and coalesce(old.status::text,'') <> new.status::text then
    perform public.generate_invoices(new.id);
  end if;
  return new;
end $$;

drop trigger if exists transactions_invoice_on_complete on public.transactions;
create trigger transactions_invoice_on_complete
  after update on public.transactions
  for each row execute function public.on_transaction_completed();
