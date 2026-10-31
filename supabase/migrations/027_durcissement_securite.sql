-- 027 — Durcissement sécurité avant lancement (audit du 31/10/2026).
-- Trouvé en se faisant passer pour de vrais comptes dans la base (tests annulés à la fin) :
--  1. N'importe qui (même non connecté) pouvait appeler auto_release_completed_transactions()
--     et faire passer toutes les missions terminées à « Réglée », ou générer des factures.
--  2. N'importe quel compte pouvait publier un avis sur n'importe quel prestataire (sans mission).
--  3. N'importe quel compte pouvait ouvrir un litige sur la mission de quelqu'un d'autre
--     (ce qui bloque le versement au prestataire).
--  4. Une fois le tarif validé, un client pouvait encore le baisser par un appel direct ;
--     une partie pouvait accepter sa propre proposition de prix ; changer l'acheteur/le vendeur ;
--     poser « Réglée » / « Terminée » à la main.
--  5. Accepter / refuser une proposition dans le chat n'était JAMAIS enregistré (aucune règle
--     d'écriture sur messages) : une proposition refusée revenait au rechargement avec ses boutons.
--  6. Un prestataire pouvait marquer lui-même ses pièces « valides ».
--  7. Photos de mission : n'importe quel compte pouvait déposer un fichier dans le dossier d'une
--     mission qui n'est pas la sienne.
-- Rien n'est supprimé (pas de DROP) : on resserre les règles existantes et on ajoute des verrous.

-- 1. Fonctions internes : plus appelables depuis l'API publique.
revoke execute on function public.auto_release_completed_transactions() from public, anon, authenticated;
revoke execute on function public.generate_invoices(uuid) from public, anon, authenticated;
revoke execute on function public.generate_invoice(uuid) from public, anon, authenticated;
revoke execute on function public.admin_campaign_stats() from anon;
revoke execute on function public.admin_get_email(uuid) from anon;
revoke execute on function public.admin_leads() from anon;
revoke execute on function public.admin_stats() from anon;
-- Fonctions de déclencheur : jamais appelées directement (le déclencheur, lui, fonctionne toujours).
revoke execute on function public.guard_address_status() from public, anon, authenticated;
revoke execute on function public.guard_payment_status() from public, anon, authenticated;
revoke execute on function public.guard_provider_payment_fields() from public, anon, authenticated;
revoke execute on function public.guard_provider_private() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_attribution() from public, anon, authenticated;
revoke execute on function public.on_transaction_completed() from public, anon, authenticated;
revoke execute on function public.refresh_provider_rating() from public, anon, authenticated;
revoke execute on function public.release_slot_on_cancel() from public, anon, authenticated;

alter function public.generate_invoice(uuid) set search_path = public;
alter function public.invoice_legal set search_path = public;
alter function public.compute_final_subtotal set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.trade_label set search_path = public;

-- 2. Avis : seulement l'acheteur d'une mission terminée, sur le prestataire de cette mission.
alter policy "reviews participant write" on public.reviews with check (
  rater_id = auth.uid() and exists (
    select 1 from public.transactions t
    where t.id = reviews.transaction_id and t.buyer_id = auth.uid() and t.seller_id = reviews.ratee_id
      and t.buyer_id <> t.seller_id and t.status in ('completed', 'released')));

-- 3. Litige : seulement par une partie à la mission.
alter policy "disputes opener write" on public.disputes with check (
  opener_id = auth.uid() and exists (
    select 1 from public.transactions t
    where t.id = disputes.transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));

-- 4. Verrous sur les missions (règle suprême du tarif, statuts posés par le bon acteur).
create or replace function public.guard_transaction_core() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  -- Serveur (clé service, cron) et administrateurs PING : non concernés.
  if uid is null or public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.arrived_at is not null or new.completed_at is not null
       or new.en_route_at is not null then
      raise exception 'Une mission commence toujours « en attente ».';
    end if;
    return new;
  end if;

  if new.buyer_id is distinct from old.buyer_id or new.seller_id is distinct from old.seller_id
     or new.request_id is distinct from old.request_id then
    raise exception 'Les parties d''une mission ne se modifient pas.';
  end if;

  -- Statuts : annulation par une partie (avant l'arrivée), arrivée / fin par le prestataire seul.
  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if old.arrived_at is not null then
        raise exception 'Mission commencée : ouvrez un litige plutôt qu''une annulation.';
      end if;
    elsif new.status = 'arrived' then
      if uid <> old.seller_id or new.arrived_at is null or old.status <> 'pending' then
        raise exception 'Seul le prestataire valide son arrivée.';
      end if;
    elsif new.status = 'completed' then
      if uid <> old.seller_id or new.completed_at is null or old.arrived_at is null then
        raise exception 'Seul le prestataire clôture la mission, après son arrivée.';
      end if;
    else
      raise exception 'Statut réservé à PING.';
    end if;
  end if;

  if new.en_route_at is distinct from old.en_route_at and uid <> old.seller_id then
    raise exception 'Seul le prestataire annonce son départ.';
  end if;

  -- Tarif validé : seul un litige (PING) le rouvre. Exception : le scan de fin du prestataire,
  -- qui calcule les heures réellement passées.
  if coalesce(old.price_confirmed, false) then
    if (new.subtotal_cents is distinct from old.subtotal_cents
        or new.buyer_fee_cents is distinct from old.buyer_fee_cents
        or new.seller_fee_cents is distinct from old.seller_fee_cents
        or new.total_charged_cents is distinct from old.total_charged_cents
        or new.payout_cents is distinct from old.payout_cents
        or new.hourly_rate_cents is distinct from old.hourly_rate_cents
        or new.included_hours is distinct from old.included_hours
        or new.base_forfait_cents is distinct from old.base_forfait_cents
        or not coalesce(new.price_confirmed, false))
       and not (uid = old.seller_id and old.completed_at is null and new.completed_at is not null
                and new.hourly_rate_cents is not distinct from old.hourly_rate_cents
                and new.included_hours is not distinct from old.included_hours
                and new.base_forfait_cents is not distinct from old.base_forfait_cents
                and coalesce(new.price_confirmed, false)) then
      raise exception 'Tarif validé : il ne peut plus être modifié (seul un litige le rouvre).';
    end if;
  elsif coalesce(new.price_confirmed, false) then
    -- Validation du tarif : uniquement en acceptant une proposition EN ATTENTE de l'autre partie,
    -- au montant de cette proposition.
    if not exists (
      select 1 from public.messages m
      where m.transaction_id = old.id and m.kind = 'offer' and m.offer_status = 'pending'
        and m.sender_id is distinct from uid and m.offer_cents = new.subtotal_cents) then
      raise exception 'Le tarif se valide en acceptant la proposition de l''autre partie.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_transaction_core() from public, anon, authenticated;
create trigger trg_guard_transaction_core before insert or update on public.transactions
  for each row execute function public.guard_transaction_core();

-- 5. Propositions de prix dans le chat : accepter / refuser enfin enregistré, et rien d'autre.
create policy "messages offer answer" on public.messages for update to authenticated
  using (exists (select 1 from public.transactions t
                 where t.id = messages.transaction_id and auth.uid() in (t.buyer_id, t.seller_id)))
  with check (exists (select 1 from public.transactions t
                 where t.id = messages.transaction_id and auth.uid() in (t.buyer_id, t.seller_id)));

create or replace function public.guard_message_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.kind = 'offer' then new.offer_status := 'pending'; end if;
    return new;
  end if;
  if (to_jsonb(new) - 'offer_status') is distinct from (to_jsonb(old) - 'offer_status') then
    raise exception 'Un message envoyé ne se modifie pas.';
  end if;
  if new.offer_status is distinct from old.offer_status then
    if old.kind <> 'offer' or old.offer_status <> 'pending' or new.offer_status not in ('accepted', 'declined') then
      raise exception 'Cette proposition a déjà reçu une réponse.';
    end if;
    if new.offer_status = 'accepted' and old.sender_id = auth.uid() then
      raise exception 'On n''accepte pas sa propre proposition.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_message_write() from public, anon, authenticated;
create trigger trg_guard_message_write before insert or update on public.messages
  for each row execute function public.guard_message_write();

-- 6. Pièces : seul PING change le statut (le dépôt repasse toujours « en cours de traitement »).
create or replace function public.guard_document_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' or new.storage_path is distinct from old.storage_path then
    new.status := 'pending';
  elsif new.status is distinct from old.status then
    raise exception 'Le statut d''une pièce est posé par PING.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_document_status() from public, anon, authenticated;
create trigger trg_guard_document_status before insert or update on public.documents
  for each row execute function public.guard_document_status();

-- 7. Photos de mission : seulement dans le dossier d'une mission dont on est partie.
alter policy "offer photos insert" on storage.objects with check (
  bucket_id = 'offer-photos' and exists (
    select 1 from public.transactions t
    where t.id::text = (storage.foldername(objects.name))[1] and auth.uid() in (t.buyer_id, t.seller_id)));
