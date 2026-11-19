-- PARTIE 2 / 2 — après la partie 1, même projet wmiawwaxwlvascyflpba

-- ===================== 039_statut_pro_cesu.sql =====================
-- 039 — Statut juridique et fiscal du prestataire, CESU préfinancé (décision Romain du 18/11/2026).
-- NON APPLIQUÉE par Claude. À coller dans l'éditeur SQL Supabase (copie identique dans
-- supabase/a_coller/039_statut_pro_cesu.sql). Uniquement des ajouts : ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE, aucun DROP, aucune suppression de données. Rejouable sans risque.
--
-- L'app fonctionne sans cette migration : l'inscription pro réessaie sans ces colonnes si la base
-- ne les connaît pas, et la carte / la fiche n'affichent rien de plus.

-- 1. Colonnes du statut (provider_profiles est lisible publiquement : rien de confidentiel ici ;
--    un n° de TVA intracommunautaire figure de toute façon sur chaque facture émise).
alter table public.provider_profiles
  add column if not exists legal_form text,
  add column if not exists vat_status text,
  add column if not exists vat_number text,
  add column if not exists accepts_cesu_prefinance boolean not null default false;

do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_legal_form_check
    check (legal_form is null or legal_form in ('micro', 'ei', 'eurl', 'sasu', 'sas', 'sarl', 'autre'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_vat_status_check
    check (vat_status is null or vat_status in ('franchise', 'assujetti'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.provider_profiles add constraint provider_profiles_vat_number_check
    check (vat_number is null or vat_number ~ '^[A-Z]{2}[0-9A-Z]{2,13}$');
exception when duplicate_object then null; end $$;

comment on column public.provider_profiles.legal_form is 'micro | ei | eurl | sasu | sas | sarl | autre ; null = particulier (039)';
comment on column public.provider_profiles.vat_status is 'franchise (art. 293 B du CGI) | assujetti (039)';
comment on column public.provider_profiles.vat_number is 'N° de TVA intracommunautaire, seulement si assujetti (039)';
comment on column public.provider_profiles.accepts_cesu_prefinance is 'Le prestataire accepte le CESU préfinancé (déclaratif, 039)';

-- 2. Facture de prestation : forme juridique et TVA recopiées à l'émission (même principe que
--    trg_invoice_presence_details de la migration 038 : generate_invoices n'est pas modifiée, la
--    ligne est complétée au moment de l'insertion). Un document émis ne change plus ensuite.
create or replace function public.invoice_pro_tax_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare sp record; forme text;
begin
  if new.kind is distinct from 'prestation' or new.template is distinct from 'facture' then
    return new;
  end if;
  select legal_form, vat_status, vat_number into sp from public.provider_profiles where id = new.issuer_id;
  if not found then return new; end if;
  forme := case sp.legal_form
    when 'micro' then 'Entrepreneur individuel (micro-entrepreneur)'
    when 'ei'    then 'Entrepreneur individuel (EI)'
    when 'eurl'  then 'EURL'
    when 'sasu'  then 'SASU'
    when 'sas'   then 'SAS'
    when 'sarl'  then 'SARL'
    else null end;
  new.issuer_snapshot := coalesce(new.issuer_snapshot, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'forme_juridique', sp.legal_form,
    'tva_regime', sp.vat_status,
    'tva_numero', case when sp.vat_status = 'assujetti' then sp.vat_number end));
  if forme is not null then
    new.legal := coalesce(new.legal, '{}'::jsonb) || jsonb_build_object('forme', forme);
  end if;
  if sp.vat_status = 'assujetti' then
    -- Assujetti : jamais la mention de franchise, le n° de TVA à la place.
    new.legal := (coalesce(new.legal, '{}'::jsonb) - 'franchise_tva')
      || jsonb_strip_nulls(jsonb_build_object('tva_intracom', sp.vat_number));
  end if;
  return new;
end $$;
revoke execute on function public.invoice_pro_tax_status() from public, anon, authenticated;
create or replace trigger trg_invoice_pro_tax_status
  before insert on public.invoices
  for each row execute function public.invoice_pro_tax_status();

-- 3. Pièces contrôlées par PING (documents.status = 'valid' posé par un admin) : sert au badge
--    « Nouveau · pièces en cours de contrôle » de la carte et de la fiche. La table documents n'est
--    lisible que par son propriétaire : cette fonction ne renvoie qu'un booléen par prestataire.
--    « Contrôlées » = pièce d'identité validée par un admin.
create or replace function public.provider_docs_checked(p_ids uuid[])
returns table (provider_id uuid, docs_checked boolean)
language sql stable security definer set search_path = public as $$
  select pid, exists (select 1 from public.documents d
                      where d.owner_id = pid and d.kind = 'identite' and d.status = 'valid')
  from unnest(p_ids[1:200]) as pid
$$;
revoke execute on function public.provider_docs_checked(uuid[]) from public;
grant execute on function public.provider_docs_checked(uuid[]) to anon, authenticated;


-- ===================== 040_arrangement_amiable.sql =====================
-- 040 — Arrangement à l'amiable dans un litige (décision Romain du 18/11/2026). NON APPLIQUÉE.
--
-- Un bouton simple dans le litige : une partie propose UN montant (au plus le prix de la prestation),
-- l'autre accepte ou refuse. Quand l'autre accepte :
--   * le litige est clos « résolu », decision « Arrangement à l'amiable : X € » (agreed_cents, closed_at) ;
--   * un AVOIR de X € est émis sur la facture (ou le récapitulatif) de la prestation : numéro AV-AAAA-NNNNN,
--     colonnes credit_* de la ligne invoices (le modèle invoices n'admet qu'un document par type et par
--     mission, et ses types sont figés par une contrainte : l'avoir est donc porté par la facture qu'il corrige) ;
--   * le virement de la prestation (transfer_payments, migration 025) est ajusté :
--       - pas encore payé   -> credit_mode 'deduit' : le client vire le montant de la facture moins l'avoir
--                              (avoir total : virement soldé, statut « reçu ») ;
--       - déjà payé/annoncé -> credit_mode 'a_rembourser' : le prestataire rembourse X € au client,
--                              et le note fait (credit_refunded_at).
--   Les frais de service et la commission PING ne sont pas modifiés (décision à confirmer par Romain).
-- La médiation PING (admin) reste possible tant que le litige est ouvert.
--
-- Additive, idempotente, sans DROP. Les parties n'écrivent jamais directement : tout passe par les RPC
-- SECURITY DEFINER ci-dessous (la RLS disputes ne laisse modifier un litige qu'à l'admin, migration 002).

-- 1. Proposition portée par le litige -------------------------------------------------------------------
alter table public.disputes add column if not exists settlement_cents integer;
alter table public.disputes add column if not exists settlement_by uuid;
alter table public.disputes add column if not exists settlement_at timestamptz;
alter table public.disputes add column if not exists settlement_status text;
alter table public.disputes add column if not exists agreed_cents integer;
alter table public.disputes add column if not exists closed_at timestamptz;

do $$ begin
  alter table public.disputes add constraint disputes_settlement_status_check
    check (settlement_status is null or settlement_status in ('proposee', 'acceptee', 'refusee'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.disputes add constraint disputes_settlement_cents_check
    check (settlement_cents is null or (settlement_cents >= 0 and settlement_cents <= 10000000));
exception when duplicate_object then null; end $$;

-- 2. Avoir porté par la facture de la prestation ---------------------------------------------------------
alter table public.invoices add column if not exists credit_cents integer;
alter table public.invoices add column if not exists credit_number text;
alter table public.invoices add column if not exists credit_issued_at timestamptz;
alter table public.invoices add column if not exists credit_reason text;
alter table public.invoices add column if not exists credit_dispute_id uuid;

do $$ begin
  alter table public.invoices add constraint invoices_credit_check
    check (credit_cents is null or (credit_cents >= 0 and credit_cents <= net_cents));
exception when duplicate_object then null; end $$;

-- 3. Ajustement du virement de la prestation -------------------------------------------------------------
alter table public.transfer_payments add column if not exists credit_cents integer not null default 0;
alter table public.transfer_payments add column if not exists credit_mode text;
alter table public.transfer_payments add column if not exists credit_refunded_at timestamptz;

do $$ begin
  alter table public.transfer_payments add constraint transfer_payments_credit_check
    check (credit_cents >= 0 and credit_cents <= amount_cents
           and (credit_mode is null or credit_mode in ('deduit', 'a_rembourser')));
exception when duplicate_object then null; end $$;

-- Garde de 025, reprise à l'identique avec une seule ligne de plus : quand une RPC d'arrangement est en
-- cours (réglage local à la transaction 'ping.amiable', posé uniquement par les fonctions ci-dessous),
-- elle peut solder le virement. Un appel PostgREST ne peut pas poser ce réglage.
create or replace function public.guard_transfer_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' then return new; end if;
  if uid is null or public.is_admin() then
    if new.status = 'recu' and new.received_at is null then new.received_at := now(); end if;
    if new.status = 'declare_paye' and new.declared_at is null then new.declared_at := now(); end if;
    return new;
  end if;
  if row(new.invoice_id, new.transaction_id, new.payer_role, new.payee, new.payer_id, new.payee_id,
         new.reference, new.amount_cents, new.due_at, new.created_at)
     is distinct from
     row(old.invoice_id, old.transaction_id, old.payer_role, old.payee, old.payer_id, old.payee_id,
         old.reference, old.amount_cents, old.due_at, old.created_at) then
    raise exception 'Seul le statut du virement peut être modifié.';
  end if;
  if new.status = old.status then
    new.declared_at := old.declared_at; new.received_at := old.received_at; return new;
  end if;
  if old.status = 'recu' then raise exception 'Virement déjà noté reçu.'; end if;
  if new.status = 'declare_paye' and uid = old.payer_id then
    new.declared_at := now(); new.received_at := null; return new;
  end if;
  if new.status = 'a_payer' and uid = old.payer_id and old.status = 'declare_paye' then
    new.declared_at := null; return new;
  end if;
  if new.status = 'recu' and old.payee = 'pro' and uid = old.payee_id then
    new.received_at := now(); new.declared_at := old.declared_at; return new;
  end if;
  raise exception 'Action non autorisée sur ce virement.';
end $$;

-- Les colonnes d'avoir du virement ne bougent que par les fonctions d'arrangement (ou l'admin).
create or replace function public.guard_transfer_credit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ping.amiable', true), '') = 'on' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if row(new.credit_cents, new.credit_mode, new.credit_refunded_at)
     is distinct from row(old.credit_cents, old.credit_mode, old.credit_refunded_at) then
    raise exception 'L''avoir d''un virement est posé par l''arrangement à l''amiable.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_transfer_credit() from public, anon, authenticated;
create or replace trigger trg_guard_transfer_credit before update on public.transfer_payments
  for each row execute function public.guard_transfer_credit();

-- 4. Outils internes ---------------------------------------------------------------------------------------
create or replace function public.amiable_eur(p_cents integer) returns text
language sql immutable set search_path = public as $$
  select replace(to_char(coalesce(p_cents, 0) / 100.0, 'FM999999990.00'), '.', ',') || ' €'
$$;
grant execute on function public.amiable_eur(integer) to authenticated;

-- Montant maximal d'un arrangement : le prix de la prestation (facture émise, sinon montant de la mission).
create or replace function public.amiable_ceiling(p_transaction uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select i.net_cents from public.invoices i where i.transaction_id = p_transaction and i.kind = 'prestation' limit 1),
    (select t.subtotal_cents from public.transactions t where t.id = p_transaction))
$$;
revoke execute on function public.amiable_ceiling(uuid) from public, anon, authenticated;

-- Applique un arrangement accepté : avoir sur la facture de la prestation + ajustement du virement.
-- Idempotente (un seul avoir par facture). Sans facture encore émise (litige ouvert pendant la mission),
-- elle ne fait rien : le trigger du §6 l'applique à la création du virement de la prestation.
create or replace function public.apply_amicable_settlement(p_dispute uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; inv record; credit integer;
begin
  select * into d from public.disputes where id = p_dispute;
  if not found or d.settlement_status is distinct from 'acceptee' or coalesce(d.agreed_cents, 0) <= 0 then return; end if;
  select * into inv from public.invoices
   where transaction_id = d.transaction_id and kind = 'prestation' for update;
  if not found then return; end if;
  if inv.credit_dispute_id is not null and inv.credit_dispute_id <> d.id then return; end if;

  credit := least(d.agreed_cents, inv.net_cents);
  if inv.credit_number is null then
    update public.invoices
       set credit_cents = credit,
           credit_number = 'AV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0'),
           credit_issued_at = now(),
           credit_reason = 'Arrangement à l''amiable (litige du ' || to_char(d.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY') || ')',
           credit_dispute_id = d.id
     where id = inv.id;
  end if;

  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments tp
     set credit_cents = least(credit, tp.amount_cents),
         credit_mode = case when tp.status in ('declare_paye', 'recu') then 'a_rembourser' else 'deduit' end,
         status = case when tp.status in ('a_payer', 'en_retard') and credit >= tp.amount_cents then 'recu' else tp.status end,
         received_at = case when tp.status in ('a_payer', 'en_retard') and credit >= tp.amount_cents then now() else tp.received_at end
   where tp.invoice_id = inv.id and tp.payee = 'pro' and tp.credit_mode is null;
  perform set_config('ping.amiable', 'off', true);
end $$;
revoke execute on function public.apply_amicable_settlement(uuid) from public, anon, authenticated;

-- 5. RPC des parties ---------------------------------------------------------------------------------------
-- Proposer (ou reproposer, après un refus ou pour remplacer sa propre proposition) un montant.
create or replace function public.propose_settlement(p_dispute uuid, p_amount_cents integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record; plafond integer; who text;
begin
  if uid is null then raise exception 'Connectez-vous pour proposer un arrangement.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission proposent un arrangement.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if exists (select 1 from public.invoices i where i.transaction_id = d.transaction_id and i.kind = 'prestation'
              and i.credit_number is not null) then
    raise exception 'Un avoir a déjà été émis sur cette prestation.';
  end if;
  plafond := public.amiable_ceiling(d.transaction_id);
  if p_amount_cents is null or p_amount_cents < 0 then raise exception 'Indiquez un montant.'; end if;
  if plafond is null then raise exception 'Le montant de la prestation n''est pas encore connu.'; end if;
  if p_amount_cents > plafond then
    raise exception 'Le montant ne peut pas dépasser celui de la prestation (%).', public.amiable_eur(plafond);
  end if;

  update public.disputes
     set settlement_cents = p_amount_cents, settlement_by = uid, settlement_at = now(), settlement_status = 'proposee'
   where id = d.id;
  who := case when uid = t.buyer_id then 'Le client' else 'Le prestataire' end;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', who || ' propose un arrangement à l''amiable : ' || public.amiable_eur(p_amount_cents)
          || ' déduits de la prestation. L''autre partie accepte ou refuse.');
  return jsonb_build_object('status', 'proposee', 'amount_cents', p_amount_cents);
end $$;
revoke execute on function public.propose_settlement(uuid, integer) from public, anon;
grant execute on function public.propose_settlement(uuid, integer) to authenticated;

-- Accepter la proposition de l'autre partie : litige clos, avoir, virement ajusté.
create or replace function public.accept_settlement(p_dispute uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record; label text;
begin
  if uid is null then raise exception 'Connectez-vous pour répondre.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission répondent.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if d.settlement_status is distinct from 'proposee' then raise exception 'Aucune proposition en attente.'; end if;
  if d.settlement_by = uid then raise exception 'C''est à l''autre partie d''accepter votre proposition.'; end if;
  if d.settlement_cents > coalesce(public.amiable_ceiling(d.transaction_id), 0) then
    raise exception 'Le montant proposé dépasse désormais celui de la prestation : proposez-en un autre.';
  end if;

  label := 'Arrangement à l''amiable : ' || public.amiable_eur(d.settlement_cents);
  update public.disputes
     set settlement_status = 'acceptee', agreed_cents = d.settlement_cents,
         status = 'resolved', resolution = label, closed_at = now()
   where id = d.id;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', label || ', accepté par les deux parties. Litige clos.'
          || case when d.settlement_cents > 0 then ' Un avoir de ce montant est émis sur la facture de la prestation.' else '' end);
  insert into public.messages (transaction_id, sender_id, kind, body)
  values (d.transaction_id, uid, 'system', 'Litige clos. ' || label || '.');
  perform public.apply_amicable_settlement(d.id);
  return jsonb_build_object('status', 'acceptee', 'agreed_cents', d.settlement_cents);
end $$;
revoke execute on function public.accept_settlement(uuid) from public, anon;
grant execute on function public.accept_settlement(uuid) to authenticated;

-- Refuser la proposition de l'autre partie (le litige reste ouvert ; chacun peut reproposer).
create or replace function public.decline_settlement(p_dispute uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; t record;
begin
  if uid is null then raise exception 'Connectez-vous pour répondre.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Litige introuvable.'; end if;
  select buyer_id, seller_id into t from public.transactions where id = d.transaction_id;
  if t is null or uid not in (t.buyer_id, t.seller_id) then raise exception 'Seules les deux parties de la mission répondent.'; end if;
  if d.status::text <> 'open' then raise exception 'Ce litige est déjà clos.'; end if;
  if d.settlement_status is distinct from 'proposee' then raise exception 'Aucune proposition en attente.'; end if;
  if d.settlement_by = uid then raise exception 'C''est à l''autre partie de répondre à votre proposition.'; end if;

  update public.disputes set settlement_status = 'refusee' where id = d.id;
  insert into public.dispute_messages (dispute_id, sender_id, kind, body)
  values (d.id, uid, 'system', 'Arrangement à l''amiable de ' || public.amiable_eur(d.settlement_cents)
          || ' refusé. Chacun peut proposer un autre montant, ou demander la médiation de PING.');
  return jsonb_build_object('status', 'refusee');
end $$;
revoke execute on function public.decline_settlement(uuid) from public, anon;
grant execute on function public.decline_settlement(uuid) to authenticated;

-- Le prestataire note qu'il a remboursé l'avoir au client (cas où la prestation était déjà réglée).
create or replace function public.mark_settlement_refunded(p_transfer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tp record;
begin
  select * into tp from public.transfer_payments where id = p_transfer for update;
  if not found or uid is null or (tp.payee_id is distinct from uid and not public.is_admin()) then
    raise exception 'Seul le prestataire note le remboursement de l''avoir.';
  end if;
  if tp.credit_mode is distinct from 'a_rembourser' then raise exception 'Aucun avoir à rembourser sur ce virement.'; end if;
  if tp.credit_refunded_at is not null then return; end if;
  perform set_config('ping.amiable', 'on', true);
  update public.transfer_payments set credit_refunded_at = now() where id = tp.id;
  perform set_config('ping.amiable', 'off', true);
end $$;
revoke execute on function public.mark_settlement_refunded(uuid) from public, anon;
grant execute on function public.mark_settlement_refunded(uuid) to authenticated;

-- 6. Arrangement conclu avant la facture : appliqué quand le virement de la prestation est créé
--    (après l'insertion de la facture, donc la facture existe déjà).
create or replace function public.amiable_on_transfer_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if new.payee <> 'pro' then return new; end if;
  select id into did from public.disputes
   where transaction_id = new.transaction_id and settlement_status = 'acceptee' and coalesce(agreed_cents, 0) > 0
   order by closed_at desc nulls last limit 1;
  if did is not null then perform public.apply_amicable_settlement(did); end if;
  return new;
end $$;
revoke execute on function public.amiable_on_transfer_insert() from public, anon, authenticated;
create or replace trigger trg_amiable_on_transfer_insert after insert on public.transfer_payments
  for each row execute function public.amiable_on_transfer_insert();

-- Relance quotidienne (025, inchangée) : un avoir total passe le virement à « reçu » ; un avoir partiel
-- laisse un reste dû (amount_cents - credit_cents) qui suit l'échéance habituelle.


-- ===================== 041_prestations_photos.sql =====================
-- 041 — Prestations : métier, photo, « masquée » (demande Romain du 18/11/2026). NON APPLIQUÉE.
--
-- « Il faut que l'on puisse avoir plusieurs prestations puis plusieurs prix : prix à l'heure, prix au
-- forfait, prix sur devis, photo. » Chaque ligne de `services` (écran « Mes tarifs ») porte déjà son
-- nom, sa description et sa fiche de prix (migration 008 : pricing_type forfait | horaire | devis,
-- base_price_cents, included_hours, hourly_rate_cents). Il manquait :
--   * trade      : le métier de la prestation (clé de src/lib/trades.ts : menage, repassage…). Avant,
--                  il était deviné depuis le nom, ce qui empêchait deux prestations du même métier
--                  (« Ménage 2 h », « Grand ménage ») ou un nom libre rattaché à un métier ;
--   * photo_path : photo facultative, dans le bucket public `service-photos` (<uid>/<id>/<fichier>) ;
--   * hidden     : prestation masquée (gardée dans « Mes tarifs », invisible et non réservable sur la fiche).
--
-- L'app fonctionne avant et après : src/lib/prestations.ts relit sans ces colonnes si elles manquent
-- (métier déduit du nom, rien de masqué, aucune photo).
-- Additive, idempotente, sans DROP ni DELETE.

-- 1. Colonnes ---------------------------------------------------------------------------------------
-- Rappel 008 (sans effet si déjà là).
alter table public.services add column if not exists description text;
alter table public.services add column if not exists pricing_type pricing_type not null default 'forfait';
alter table public.services add column if not exists base_price_cents integer not null default 0;
alter table public.services add column if not exists included_hours numeric;
alter table public.services add column if not exists hourly_rate_cents integer;

alter table public.services add column if not exists trade text;
alter table public.services add column if not exists photo_path text;
alter table public.services add column if not exists hidden boolean not null default false;

do $$ begin
  alter table public.services add constraint services_description_len
    check (description is null or char_length(description) <= 280) not valid;
exception when duplicate_object then null; end $$;

comment on column public.services.trade is 'Métier de la prestation (clé de src/lib/trades.ts). Null = prestation libre, métier déduit du nom.';
comment on column public.services.photo_path is 'Photo facultative : chemin dans le bucket public service-photos (<uid>/<id prestation>/<fichier>).';
comment on column public.services.hidden is 'Prestation masquée : visible du seul prestataire dans Mes tarifs, ni affichée ni réservable sur la fiche.';

-- Métier des lignes existantes, déduit du nom comme le fait tradeOfServiceName() (« Ménage », « menage »,
-- « Repassage (en complément du ménage) »…). Ne touche que les lignes sans métier.
update public.services s set trade = m.k
from (values ('menage', 'ménage'), ('repassage', 'repassage'), ('nettoyage', 'nettoyage'), ('vitres', 'vitres')) as m(k, l)
where s.trade is null
  and (lower(trim(s.name)) in (m.k, m.l)
       or lower(trim(s.name)) like m.l || ' %' or lower(trim(s.name)) like m.l || '(%'
       or lower(trim(s.name)) like m.k || ' %');

create index if not exists services_provider_visible_idx on public.services (provider_id) where not hidden;

-- 2. Bucket public `service-photos` : lisible par tous, écrit par le seul propriétaire dans `<uid>/…` ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_public_read') then
    create policy service_photos_public_read on storage.objects for select using (bucket_id = 'service-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_insert_own') then
    create policy service_photos_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_update_own') then
    create policy service_photos_update_own on storage.objects for update to authenticated
      using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_photos_delete_own') then
    create policy service_photos_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;


-- ===================== provider_services_public.sql =====================
-- PROPOSÉ, NON APPLIQUÉ (à coller dans l'éditeur SQL Supabase après relecture).
--
-- Carte client multi-activités (/map) : pour savoir qu'un prestataire fait aussi « Vitres » ou
-- « Repassage » en plus de son métier principal (provider_profiles.trade), le client lit les noms
-- de ses prestations du catalogue `services` (/pro/tarifs). La RLS de `services` n'est décrite dans
-- aucune migration du dépôt ; cette fonction rend la lecture indépendante de cette RLS, en ne
-- sortant QUE l'identifiant du prestataire et le nom de la prestation (ni prix, ni description).
-- Le code client (fetchProviderActivities, src/lib/services.ts) l'utilise si elle existe et se
-- replie sinon sur une lecture directe de `services`, puis sur le seul métier principal.

create or replace function public.provider_services_public(p_provider_ids uuid[])
returns table (provider_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.provider_id, s.name
  from public.services s
  where s.provider_id = any (p_provider_ids)
  limit 2000
$$;

revoke all on function public.provider_services_public(uuid[]) from public;
grant execute on function public.provider_services_public(uuid[]) to anon, authenticated;


-- ===================== 042_pieces_motif_expiration.sql =====================
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


-- ===================== 043_signalements.sql =====================
-- 043 — Signalement d'un échange, distinct du litige (lot 24, 18/11/2026). NON APPLIQUÉE par Claude.
-- Copie identique dans supabase/a_coller/043_signalements.sql. Additive, idempotente, sans DROP ni DELETE.
--
-- Un litige porte sur la PRESTATION (montant, qualité, retard) : il est vu par les deux parties et a son
-- dossier (/litiges/[id]). Un signalement porte sur le COMPORTEMENT dans l'échange (propos déplacés,
-- coordonnées partagées pour contourner PING, sollicitation suspecte) : il est privé, seul PING le lit,
-- l'autre partie n'en est pas informée. PING le classe (sans suite, avertissement, blocage).
--
-- L'app fonctionne avant et après : la conversation ne propose « Signaler l'échange à PING » que si la
-- table existe (sinon seul « Ouvrir un litige » reste, comme aujourd'hui) ; l'admin affiche
-- « disponible après la migration 043 » tant qu'elle manque.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  category text not null,
  body text not null,
  status text not null default 'nouveau',
  admin_note text,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.reports add constraint reports_category_check
    check (category in ('propos', 'coordonnees', 'sollicitation', 'comportement', 'autre'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_status_check
    check (status in ('nouveau', 'classe', 'averti', 'bloque'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_body_len
    check (char_length(trim(body)) between 1 and 2000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports add constraint reports_admin_note_len
    check (admin_note is null or char_length(admin_note) <= 2000);
exception when duplicate_object then null; end $$;

comment on table public.reports is 'Signalements de modération (043) : privés, lus par PING seul. Distincts des litiges (disputes).';
comment on column public.reports.category is 'propos | coordonnees | sollicitation | comportement | autre';
comment on column public.reports.status is 'nouveau | classe (sans suite) | averti | bloque — posé par un admin PING';

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_transaction_idx on public.reports (transaction_id);

-- Droits : l'auteur crée et lit les siens, l'admin lit tout et décide. Personne ne supprime.
alter table public.reports enable row level security;
revoke all on table public.reports from anon;
revoke delete on table public.reports from authenticated;
grant select, insert, update on table public.reports to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_insert_own') then
    create policy reports_insert_own on public.reports for insert to authenticated
      with check (reporter_id = auth.uid() and (transaction_id is null or exists (
        select 1 from public.transactions t where t.id = reports.transaction_id and auth.uid() in (t.buyer_id, t.seller_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_read_own_or_admin') then
    create policy reports_read_own_or_admin on public.reports for select to authenticated
      using (reporter_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_admin_update') then
    create policy reports_admin_update on public.reports for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Garde : à la création, l'auteur, le statut et la personne signalée sont posés par la base (jamais par
-- l'app) ; 10 signalements au plus par compte et par 24 h. Ensuite, seul l'admin change le statut et sa
-- note ; le contenu du signalement ne change plus.
create or replace function public.guard_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t record;
begin
  if tg_op = 'INSERT' then
    if uid is null then return new; end if;  -- serveur
    new.reporter_id := uid;
    if not public.is_admin() then
      new.status := 'nouveau';
      new.admin_note := null;
      new.handled_by := null;
      new.handled_at := null;
      if (select count(*) from public.reports r where r.reporter_id = uid and r.created_at > now() - interval '24 hours') >= 10 then
        raise exception 'Trop de signalements en peu de temps : écrivez au Support PING.';
      end if;
    end if;
    new.reported_user_id := null;
    if new.transaction_id is not null then
      select buyer_id, seller_id into t from public.transactions where id = new.transaction_id;
      if found then
        new.reported_user_id := case when uid = t.buyer_id then t.seller_id when uid = t.seller_id then t.buyer_id end;
      end if;
    end if;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE
  if uid is not null and not public.is_admin() then
    raise exception 'Un signalement est traité par PING.';
  end if;
  new.reporter_id := old.reporter_id;
  new.transaction_id := old.transaction_id;
  new.reported_user_id := old.reported_user_id;
  new.category := old.category;
  new.body := old.body;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    new.handled_at := now();
    new.handled_by := uid;
  end if;
  return new;
end $$;
revoke execute on function public.guard_report() from public, anon, authenticated;
create or replace trigger trg_guard_report before insert or update on public.reports
  for each row execute function public.guard_report();


-- ===================== 044_droits_litiges_profils.sql =====================
-- 044 — Contrôle des droits en base : fil des litiges et lecture des profils (lot 25, 18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/044_droits_litiges_profils.sql.
-- Rapport : docs/droits-base-2026-11-18.md. Sans DROP ni DELETE : on resserre (ALTER POLICY, politiques
-- RESTRICTIVE qui ne peuvent que restreindre, déclencheur de garde). Rejouable sans risque.
--
-- AVANT DE COLLER, lire l'état réel (lecture seule) et le garder dans le rapport :
--   select policyname, permissive, roles, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename in ('profiles', 'dispute_messages', 'disputes') order by 1, 2;
--
-- L'app fonctionne avant et après : aucun écran ne lit le profil d'un autre compte en direct (les noms
-- passent par provider_public_name, transaction_counterparts, review_rater_names), et le fil des litiges
-- n'écrit que ce que la règle ci-dessous autorise (message de la partie, médiation de l'admin, messages
-- « système » des fonctions SECURITY DEFINER de la 040).

-- 1. profiles : plus aucune lecture publique ------------------------------------------------------------------
--    La 001 créait « profile_public_read » (SELECT USING (true)) : téléphone chiffré, adresse, date de
--    naissance… lisibles par tout visiteur via l'API. CLAUDE.md la dit retirée, mais aucune migration du
--    dépôt ne le prouve. Toute politique SELECT/ALL de `profiles` dont la condition est « true » est
--    ramenée à « soi-même ou admin ». Sans effet si elle n'existe plus.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'profiles' and permissive = 'PERMISSIVE'
              and cmd in ('SELECT', 'ALL') and coalesce(trim(qual), '') in ('true', '(true)')
  loop
    execute format('alter policy %I on public.profiles using ((auth.uid() = id) or public.is_admin())', p.policyname);
    raise notice 'profiles : politique « % » ramenée à soi-même ou admin', p.policyname;
  end loop;
end $$;

-- 2. dispute_messages ------------------------------------------------------------------------------------------
--    Les politiques posées par la 021 (appliquée par le connecteur) ne figurent pas dans le dépôt. Les règles
--    voulues sont donc ré-affirmées ici, indépendamment de ce qui existe :
--      lecture   : une partie de la mission du litige, ou un admin ;
--      écriture  : une partie (en son nom, litige ouvert, message ordinaire) ou un admin (médiation) ;
--      un message envoyé ne se modifie ni ne se supprime (sauf admin).
--    Les politiques RESTRICTIVE s'ajoutent en ET aux politiques existantes : elles ne peuvent que retirer
--    des droits, jamais en donner.
alter table public.dispute_messages enable row level security;
revoke all on table public.dispute_messages from anon;

create or replace function public.dispute_party_or_admin(p_dispute uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.disputes d join public.transactions t on t.id = d.transaction_id
    where d.id = p_dispute and auth.uid() in (t.buyer_id, t.seller_id))
$$;
revoke execute on function public.dispute_party_or_admin(uuid) from public, anon;
grant execute on function public.dispute_party_or_admin(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_read') then
    create policy dm_restrict_read on public.dispute_messages as restrictive for select
      using (public.dispute_party_or_admin(dispute_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_insert') then
    create policy dm_restrict_insert on public.dispute_messages as restrictive for insert
      with check (public.is_admin() or (sender_id = auth.uid() and public.dispute_party_or_admin(dispute_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_update') then
    create policy dm_restrict_update on public.dispute_messages as restrictive for update
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dispute_messages' and policyname = 'dm_restrict_delete') then
    create policy dm_restrict_delete on public.dispute_messages as restrictive for delete
      using (public.is_admin());
  end if;
end $$;

--    Le « kind » ne se contrôle pas bien par politique : une partie qui écrit en direct ne poste que du
--    texte, dans un litige ouvert. Les messages « system » des RPC de la 040 (propose/accept/decline_settlement,
--    SECURITY DEFINER) passent : elles s'exécutent sous leur propriétaire, pas sous le rôle de l'API.
create or replace function public.dispute_status_text(p_dispute uuid) returns text
language sql stable security definer set search_path = public as $$
  select d.status::text from public.disputes d where d.id = p_dispute
$$;
revoke execute on function public.dispute_status_text(uuid) from public, anon;
grant execute on function public.dispute_status_text(uuid) to authenticated;

-- SECURITY INVOKER exprès : current_user doit être celui de la requête (« authenticated » sous l'API,
-- le propriétaire de la fonction quand le message vient d'une RPC SECURITY DEFINER de la 040).
create or replace function public.guard_dispute_message() returns trigger
language plpgsql set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.is_admin() then return new; end if;
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op <> 'INSERT' then
    raise exception 'Un message du litige ne se modifie pas.';
  end if;
  if new.sender_id is distinct from uid then
    raise exception 'Un message est envoyé en son propre nom.';
  end if;
  if new.kind is distinct from 'text' then
    raise exception 'Seul PING écrit en médiation.';
  end if;
  if public.dispute_status_text(new.dispute_id) is distinct from 'open' then
    raise exception 'Ce litige est clos : écrivez au Support PING.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_dispute_message() from public, anon, authenticated;
create or replace trigger trg_guard_dispute_message before insert or update on public.dispute_messages
  for each row execute function public.guard_dispute_message();


-- ===================== 045_reservation_directe.sql =====================
-- 045 — Réservation directe calculée en base (18/11/2026). NON APPLIQUÉE par Claude.
-- Copie identique dans supabase/a_coller/045_reservation_directe.sql. Additive (une fonction), idempotente,
-- sans DROP ni DELETE.
--
-- Constat : `mission/new` calcule le prix et les commissions dans le navigateur, puis insère lui-même la
-- demande et la mission « tarif validé » (price_confirmed = true). La garde de la 027 ne contrôle à
-- l'insertion que le statut : un appel direct à l'API peut créer une mission confirmée à n'importe quel
-- prix, ou avec 0 % de commission.
--
-- Cette fonction crée la demande et la mission à partir de la fiche de prix EN BASE (prestation du
-- catalogue `services`, ou métier principal `provider_profiles`) et des taux de `app_settings`
-- (`commission_buyer_rate`, `commission_seller_rate`). Le navigateur ne transmet que des choix : la
-- prestation, la manière de tarifer quand il y en a deux, la durée estimée pour un tarif horaire,
-- l'adresse, la date. Les montants qu'il affichait ne sont jamais relus.
--
-- L'app fonctionne avant et après : `mission/new` appelle book_service si elle existe, et retombe sur
-- l'ancien chemin (insertions directes) si la fonction est absente (erreur PGRST202 / 42883).
-- Étape suivante, une fois l'app déployée et la fonction collée : interdire l'insertion directe d'une
-- mission déjà confirmée (garde 027, branche INSERT) — non fait ici pour garder le repli de l'app.

create or replace function public._setting_rate(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select case when r is null or r < 0 or r > 0.5 then p_default else r end
  from (select (select case
                  when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric
                  when jsonb_typeof(s.value) = 'string' and (s.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (s.value #>> '{}')::numeric
                end
                from public.app_settings s where s.key = p_key) as r) x
$$;
revoke all on function public._setting_rate(text, numeric) from public, anon, authenticated;

create or replace function public.book_service(
  p_provider uuid,
  p_service uuid default null,          -- null = métier principal (provider_profiles)
  p_mode text default null,             -- 'forfait' | 'horaire' quand la fiche propose les deux
  p_estimated_hours numeric default null,
  p_address text default null,
  p_address_status text default 'profil',
  p_scheduled_at timestamptz default null,
  p_description text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_payment_pref text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  src jsonb;                  -- fiche de prix lue en base
  cat text; label text;
  base_c integer; hourly_c integer; incl numeric; ptype text;
  has_flat boolean; has_hourly boolean; has_overtime boolean; mode text;
  sub integer; bfee integer; sfee integer; brate numeric; srate numeric;
  req_id uuid; tx_id uuid;
begin
  if uid is null then raise exception 'Connectez-vous pour réserver.'; end if;
  if p_provider is null or p_provider = uid then raise exception 'Vous ne pouvez pas réserver vos propres services.'; end if;
  if p_address is null or char_length(trim(p_address)) < 5 then raise exception 'Indiquez l''adresse de l''intervention.'; end if;
  if char_length(p_address) > 300 then raise exception 'Adresse trop longue.'; end if;
  if coalesce(p_address_status, 'profil') not in ('profil', 'a_valider') then raise exception 'Adresse : statut inconnu.'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '5 minutes' then raise exception 'Choisissez une date à venir.'; end if;
  if p_payment_pref is not null and p_payment_pref not in ('cesu', 'direct', 'indifferent') then raise exception 'Mode de paiement inconnu.'; end if;
  if p_description is not null and char_length(p_description) > 2000 then raise exception 'Description trop longue.'; end if;

  -- Fiche de prix. to_jsonb : la fonction ne dépend pas des colonnes facultatives (hidden, trade : 041).
  if p_service is not null then
    select to_jsonb(s) into src from public.services s where s.id = p_service and s.provider_id = p_provider;
    if src is null then raise exception 'Cette prestation n''existe plus.'; end if;
    if coalesce((src ->> 'hidden')::boolean, false) then raise exception 'Cette prestation n''est plus proposée.'; end if;
  else
    select to_jsonb(pp) into src from public.provider_profiles pp where pp.id = p_provider;
    if src is null then raise exception 'Prestataire introuvable.'; end if;
  end if;
  select coalesce(nullif(src ->> 'trade', ''), pp.trade), pp.trade into cat, label
    from public.provider_profiles pp where pp.id = p_provider;
  if not found then raise exception 'Prestataire introuvable.'; end if;

  ptype    := coalesce(src ->> 'pricing_type', 'forfait');
  base_c   := coalesce((src ->> 'base_price_cents')::integer, 0);
  hourly_c := nullif((src ->> 'hourly_rate_cents')::integer, 0);
  incl     := (src ->> 'included_hours')::numeric;
  if ptype = 'devis' then raise exception 'Prestation sur devis : demandez un devis dans la conversation.'; end if;

  has_flat     := base_c > 0;
  has_hourly   := hourly_c is not null and hourly_c > 0;
  has_overtime := has_flat and has_hourly and incl is not null;
  -- Même règle que l'écran : forfait par défaut s'il existe ; l'horaire seulement s'il est proposé.
  mode := case
    when has_overtime then 'forfait'
    when p_mode = 'horaire' and has_hourly then 'horaire'
    when p_mode = 'forfait' and has_flat then 'forfait'
    when has_flat then 'forfait'
    when has_hourly then 'horaire'
  end;
  if mode is null then raise exception 'Ce prestataire n''a pas encore de prix.'; end if;

  if mode = 'horaire' and not has_overtime then
    if p_estimated_hours is null or p_estimated_hours <= 0 or p_estimated_hours > 24 then
      raise exception 'Indiquez une durée estimée (entre 0,5 et 24 h).';
    end if;
    sub := round(hourly_c * p_estimated_hours)::integer;
  else
    sub := base_c;
  end if;
  if sub is null or sub <= 0 then raise exception 'Montant de la prestation invalide.'; end if;

  brate := public._setting_rate('commission_buyer_rate', 0.08);
  srate := public._setting_rate('commission_seller_rate', 0.17);
  bfee := round(sub * brate)::integer;
  sfee := round(sub * srate)::integer;

  insert into public.requests (requester_id, category, description, address, budget_cents, status, payment_pref, lat, lng)
  values (uid, coalesce(cat, label), coalesce(nullif(trim(p_description), ''), coalesce(src ->> 'name', '')),
          trim(p_address), sub + bfee, 'matched', p_payment_pref, p_lat, p_lng)
  returning id into req_id;

  insert into public.transactions (
    kind, buyer_id, seller_id, request_id,
    subtotal_cents, buyer_fee_cents, seller_fee_cents, total_charged_cents, payout_cents,
    hourly_rate_cents, included_hours, base_forfait_cents,
    status, price_confirmed, address_status, scheduled_at)
  values (
    'service', uid, p_provider, req_id,
    sub, bfee, sfee, sub + bfee, sub - sfee,
    case when has_overtime or mode = 'horaire' then hourly_c end,
    case when has_overtime then incl end,
    case when has_overtime then base_c end,
    'pending', true, coalesce(p_address_status, 'profil'), p_scheduled_at)
  returning id into tx_id;

  return jsonb_build_object(
    'transaction_id', tx_id, 'request_id', req_id, 'mode', mode,
    'subtotal_cents', sub, 'buyer_fee_cents', bfee, 'seller_fee_cents', sfee,
    'total_charged_cents', sub + bfee, 'payout_cents', sub - sfee,
    'base_price_cents', base_c, 'hourly_rate_cents', hourly_c, 'included_hours', incl,
    'buyer_rate', brate, 'seller_rate', srate);
end $$;
revoke all on function public.book_service(uuid, uuid, text, numeric, text, text, timestamptz, text, double precision, double precision, text) from public, anon;
grant execute on function public.book_service(uuid, uuid, text, numeric, text, text, timestamptz, text, double precision, double precision, text) to authenticated;


-- ===================== 046_avance_immediate_verrou.sql =====================
-- 046 — Avance immédiate (Urssaf) : seul le serveur ou un admin écrit les statuts (18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/046_avance_immediate_verrou.sql.
-- Sans DROP ni DELETE : on retire des droits (REVOKE) et on ajoute une garde. Rejouable sans risque.
--
-- Faille (contrôle qualité du 18/11, C7) : la 013 donne au prestataire une politique « aid seller write »
-- FOR ALL sur avance_immediate_demandes, plus INSERT/UPDATE à `authenticated`. Un prestataire peut donc,
-- par un appel direct à l'API, créer ou modifier la demande de SA mission avec statut « payée »
-- (ou changer le montant), sans que l'Urssaf n'ait rien validé. Même chose côté client sur
-- avance_immediate_clients (« aic self » FOR ALL) : un client peut se déclarer « actif » avec un
-- identifiant Urssaf inventé.
--
-- Après cette migration : les deux tables restent LISIBLES par les mêmes personnes qu'avant (la mission
-- pour ses deux parties, son inscription pour le client), mais seuls le serveur (clé service, routes
-- /api/avance-immediate/**) et un admin PING y écrivent.
--
-- L'app fonctionne avant et après : les routes serveur écrivent avec la clé service
-- (SUPABASE_SERVICE_ROLE_KEY) quand elle est posée, et retombent sur la session de l'utilisateur sinon
-- (ce qui ne marche plus qu'avant cette migration). Le module est éteint tant que les identifiants Urssaf
-- ne sont pas posés : aucun écran actuel n'écrit dans ces tables depuis le navigateur.
-- Prérequis avant d'activer l'avance immédiate : SUPABASE_SERVICE_ROLE_KEY sur Vercel.

revoke insert, update, delete on table public.avance_immediate_demandes from anon, authenticated;
revoke insert, update, delete on table public.avance_immediate_clients from anon, authenticated;
grant select on table public.avance_immediate_demandes to authenticated;
grant select on table public.avance_immediate_clients to authenticated;
revoke all on table public.avance_immediate_demandes from anon;
revoke all on table public.avance_immediate_clients from anon;

-- Garde en plus des droits (au cas où un GRANT serait reposé un jour par erreur) : une écriture faite
-- avec une session utilisateur qui n'est pas admin est refusée. La clé service n'a pas de auth.uid().
create or replace function public.guard_avance_immediate_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Le statut de l''avance immédiate est posé par PING et l''Urssaf, pas depuis l''application.';
end $$;
revoke execute on function public.guard_avance_immediate_write() from public, anon, authenticated;

create or replace trigger trg_guard_avance_immediate_demandes
  before insert or update or delete on public.avance_immediate_demandes
  for each row execute function public.guard_avance_immediate_write();
create or replace trigger trg_guard_avance_immediate_clients
  before insert or update or delete on public.avance_immediate_clients
  for each row execute function public.guard_avance_immediate_write();


-- ===================== 047_commission_sur_avoir.sql =====================
-- 047 — Commission après un arrangement à l'amiable : réglage préparé, DÉSACTIVÉ (18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/047_commission_sur_avoir.sql.
-- Une seule ligne de réglage, idempotente (ON CONFLICT DO NOTHING), sans DROP ni DELETE.
--
-- Décision EN ATTENTE de Romain : après un avoir (migration 040, arrangement à l'amiable), les frais de
-- service du client (PING-C) et la commission du prestataire (PING-V) doivent-ils être recalculés sur le
-- montant après avoir, ou rester ceux de la réservation ?
--
-- Aujourd'hui (040) : ils restent inchangés. Cette migration NE CHANGE RIEN à ce comportement : elle pose
-- seulement le réglage `commission_on_credit` à false, pour que la décision, une fois prise, se branche
-- sans nouvelle colonne. Aucun code (ni base, ni app) ne lit encore ce réglage.
--
-- Valeurs prévues :
--   false (défaut) : commissions de la réservation conservées après un avoir (comportement actuel) ;
--   true           : à coder le jour où Romain tranche — avoir proportionnel sur PING-C et PING-V
--                    (taux figés de la mission appliqués au montant de l'avoir), virements PING ajustés.
-- Ne pas passer à true tant que ce code n'existe pas : le réglage seul n'a aucun effet.

insert into public.app_settings (key, value)
values ('commission_on_credit', 'false'::jsonb)
on conflict (key) do nothing;


-- ===================== 050_catalogue_services.sql =====================
-- 050 — Catalogue des services EN DONNÉES (lots 26 et 27, refonte du 18/11/2026). NON APPLIQUÉE.
--
-- Décision Romain du 07/11/2026 (« services extensibles ») : une ligne = un service, avec sa manière
-- de tarifer, son éligibilité CESU / crédit d'impôt, les champs de son annonce et les pièces ou
-- qualifications demandées aux prestataires. Ajouter un service = ajouter une ligne (écran admin
-- « Catalogue des services », public/admin.html), sans déploiement.
--
-- Données de départ : les métiers actuels, À L'IDENTIQUE de src/lib/trades.ts — ménage, repassage,
-- nettoyage proposés au choix ; vitres présent (libellé, puces de la carte, CESU) mais non proposé.
-- AUCUN nouveau métier n'est activé (décision Romain : pas d'ouverture sans sa décision).
--
-- Droits : lecture publique (anon + authenticated : la carte et l'inscription en ont besoin) ; écriture
-- par l'admin seul (public.is_admin()). Pas de suppression : un service se MASQUE (hidden), pour que
-- les missions, demandes et prestations anciennes gardent leur libellé.
--
-- Pièces par service (lot 27) : `required_docs` range chaque pièce dans une rubrique EXISTANTE de
-- « Mes pièces » (valeur déjà présente de l'enum doc_kind : identite, rcpro, kbis, diplome, sap, rib)
-- sous un type propre (ex. {"kind":"rcpro","type":"decennale","label":"Garantie décennale",
-- "required":true}). Le fichier est stocké `<uid>/<kind>--<type>-<horodatage>`, comme les autres pièces :
-- aucun ALTER TYPE doc_kind n'est nécessaire.
--
-- L'app fonctionne AVANT et APRÈS : src/lib/catalog.ts relit src/lib/trades.ts si la table manque ou
-- est vide. Additive, idempotente, sans DROP ni DELETE.

-- 1. Table ------------------------------------------------------------------------------------------
create table if not exists public.service_catalog (
  key            text primary key,
  label          text not null,
  icon           text not null default 's_autre',
  domain         text not null default 'Nettoyage',
  pricing_modes  text[] not null default array['forfait','horaire','forfait_heures','devis']::text[],
  unit           text,
  cesu_eligible  boolean not null default false,
  request_fields text[] not null default array[]::text[],
  required_docs  jsonb not null default '[]'::jsonb,
  active         boolean not null default false,
  hidden         boolean not null default true,   -- un service ajouté naît masqué : rien ne s'affiche sans décision
  sort_order     integer not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.service_catalog is 'Catalogue des services PING (une ligne = un service). Lecture publique, écriture admin (is_admin). Lu par src/lib/catalog.ts, repli src/lib/trades.ts.';
comment on column public.service_catalog.key is 'Clé technique, stable (requests.category, provider_profiles.trade, services.trade). Jamais modifiée.';
comment on column public.service_catalog.icon is 'Pictogramme SVG (clé de src/components/PingIcons.tsx, ex. s_menage). Jamais d''emoji.';
comment on column public.service_catalog.domain is 'Domaine des qualifications (Nettoyage, Bâtiment, Garde d''enfants, Autre).';
comment on column public.service_catalog.pricing_modes is 'Manières de tarifer autorisées : forfait, horaire, forfait_heures (forfait + heures incluses), devis.';
comment on column public.service_catalog.unit is 'Unité d''un futur prix unitaire (panier, fenêtre, m²). Null = forfait ou à l''heure (seul cas géré par l''app aujourd''hui).';
comment on column public.service_catalog.cesu_eligible is 'Éligible au CESU préfinancé et au crédit d''impôt (services à la personne).';
comment on column public.service_catalog.request_fields is 'Champs de l''annonce du client : surface_m2, nombre_pieces, hours_wanted, linen_kg, linen_types, household_size.';
comment on column public.service_catalog.required_docs is 'Pièces et qualifications demandées : [{kind (rubrique doc_kind), type (a-z et tirets), label, required}].';
comment on column public.service_catalog.active is 'Proposé au choix : inscription pro, dépôt de demande, Mes tarifs.';
comment on column public.service_catalog.hidden is 'Masqué partout, y compris des puces de la carte. Les libellés restent lus pour l''historique.';

-- 2. Contraintes (doublons refusés, valeurs connues de l'app) --------------------------------------
do $$ begin
  alter table public.service_catalog add constraint service_catalog_key_format
    check (key ~ '^[a-z][a-z0-9_]{1,31}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_label_len
    check (char_length(btrim(label)) between 2 and 60);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_icon_format
    check (icon ~ '^s_[a-z0-9_]{1,30}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_pricing_modes_ok
    check (cardinality(pricing_modes) >= 1
           and pricing_modes <@ array['forfait','horaire','forfait_heures','devis']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_request_fields_ok
    check (request_fields <@ array['surface_m2','nombre_pieces','hours_wanted','linen_kg','linen_types','household_size']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_required_docs_array
    check (jsonb_typeof(required_docs) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.service_catalog add constraint service_catalog_unit_len
    check (unit is null or char_length(unit) <= 20);
exception when duplicate_object then null; end $$;

-- Un même libellé (casse et espaces ignorés) ne peut exister deux fois.
create unique index if not exists service_catalog_label_uniq on public.service_catalog (lower(btrim(label)));
create index if not exists service_catalog_order_idx on public.service_catalog (sort_order, label);

-- 3. Garde : clé immuable, pièces bien formées, horodatage ------------------------------------------
create or replace function public.service_catalog_guard()
returns trigger language plpgsql as $$
declare d jsonb;
begin
  if tg_op = 'UPDATE' and new.key is distinct from old.key then
    raise exception 'La clé d''un service ne se modifie pas (elle est portée par les demandes et les missions).';
  end if;
  new.label := btrim(new.label);
  for d in select * from jsonb_array_elements(new.required_docs) loop
    if jsonb_typeof(d) <> 'object'
       or coalesce(d->>'kind', '') not in ('identite','rcpro','kbis','diplome','sap','rib')
       or coalesce(d->>'type', '') !~ '^[a-z][a-z-]{0,39}$'
       or char_length(btrim(coalesce(d->>'label', ''))) < 2 then
      raise exception 'Pièce demandée mal formée : %', d;
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_service_catalog_guard'
                 and tgrelid = 'public.service_catalog'::regclass) then
    create trigger trg_service_catalog_guard before insert or update on public.service_catalog
      for each row execute function public.service_catalog_guard();
  end if;
end $$;

-- 4. Droits : lecture publique, écriture admin, aucune suppression ----------------------------------
alter table public.service_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_public_read') then
    create policy service_catalog_public_read on public.service_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_admin_insert') then
    create policy service_catalog_admin_insert on public.service_catalog for insert
      to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_catalog'
                 and policyname = 'service_catalog_admin_update') then
    create policy service_catalog_admin_update on public.service_catalog for update
      to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select on public.service_catalog to anon, authenticated;
grant insert, update on public.service_catalog to authenticated;
-- Aucune policy de suppression : avec la RLS, personne ne retire une ligne depuis l'app (on masque).

-- 5. Données de départ : src/lib/trades.ts à l'identique (aucun nouveau métier) ---------------------
-- on conflict do nothing : rejouer la migration ne réécrit jamais un réglage fait par l'admin.
insert into public.service_catalog
  (key, label, icon, domain, pricing_modes, unit, cesu_eligible, request_fields, required_docs, active, hidden, sort_order)
values
  ('menage',    'Ménage',    's_menage',    'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, true,  false, 10),
  ('repassage', 'Repassage', 's_repassage', 'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['linen_kg','linen_types','household_size'],                     '[]'::jsonb, true,  false, 20),
  ('nettoyage', 'Nettoyage', 's_nettoyage', 'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, true,  false, 30),
  -- Vitres : présent en base chez certains prestataires, affiché (puces de la carte), non proposé au choix.
  ('vitres',    'Vitres',    's_vitres',    'Nettoyage', array['forfait','horaire','forfait_heures','devis'], null, true,
     array['surface_m2','nombre_pieces','hours_wanted','household_size'], '[]'::jsonb, false, false, 40)
on conflict (key) do nothing;

-- Vérification après coup :
--   select key, label, active, hidden, cesu_eligible from public.service_catalog order by sort_order;
--   -> menage/repassage/nettoyage actifs, vitres inactif non masqué, tous éligibles CESU.


-- ===================== comptes_qa.sql =====================
-- Comptes de TEST identifiés (audit 10/10, 07/11/2026). Mot de passe : QaPing2026!
-- Tous les e-mails se terminent par @qa.ping-test.invalid : retrait facile (voir la fin du fichier).
with new_users as (
  select gen_random_uuid() as id, e.email, e.fn, e.ln, e.ph
  from (values
    ('qa.client1@qa.ping-test.invalid','QA','Client1','0600000001'),
    ('qa.client2@qa.ping-test.invalid','QA','Client2','0600000002'),
    ('qa.pro1@qa.ping-test.invalid','QA','Pro1','0600000003'),
    ('qa.pro2@qa.ping-test.invalid','QA','Pro2','0600000004'),
    ('qa.double1@qa.ping-test.invalid','QA','Double1','0600000005')
  ) as e(email, fn, ln, ph)
  where not exists (select 1 from auth.users u where u.email = e.email)
), ins as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, crypt('QaPing2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', fn, 'last_name', ln, 'phone', ph, 'birthdate', '1990-01-01', 'address', '1 place Massena, 06000 Nice', 'role', 'client'),
    now(), now(), '', '', '', ''
  from new_users returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now() from ins;

-- Retrait des comptes de test (à exécuter à la fin ; supprime aussi leurs données liées par cascade) :
-- delete from auth.users where email like 'qa.%@qa.ping-test.invalid';


-- Vérification finale (doit renvoyer des valeurs non nulles)
select to_regclass('public.mission_proofs') m038, to_regclass('public.service_catalog') m050, to_regclass('public.reports') m043, (select count(*) from information_schema.columns where table_name='transactions' and column_name='client_presence') m048;
