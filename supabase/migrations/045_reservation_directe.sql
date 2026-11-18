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
