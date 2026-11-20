-- 060 — Correctif de 056 : dans cancel_booking, la variable « kind » portait le même nom qu'une colonne (« column reference
-- "kind" is ambiguous »), aucune annulation ne passait. Variable renommée v_kind. À coller APRÈS 056 (rejouable).
create or replace function public.cancel_booking(
  p_transaction uuid, p_reason_kind text default null, p_reason_text text default null, p_confirm_fees boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); t record; is_buyer boolean; tier text; fee integer := 0; v_kind text := nullif(trim(coalesce(p_reason_kind, '')), '');
  why text := nullif(trim(coalesce(p_reason_text, '')), ''); confirmed boolean; body text; label text; motif text;
  grave text[] := array['maladie', 'urgence_familiale', 'accident', 'autre_grave'];
  libre_client text[] := array['maladie', 'urgence_familiale', 'accident', 'autre_grave', 'changement_de_plan', 'autre'];
  libre_pro text[] := array['maladie', 'urgence_familiale', 'accident', 'panne_vehicule', 'indisponibilite', 'autre'];
begin
  if uid is null then raise exception 'Connexion requise.'; end if;
  if why is not null and char_length(why) > 500 then raise exception 'Motif trop long (500 caractères au plus).'; end if;
  select * into t from public.transactions where id = p_transaction for update;
  if not found or uid not in (t.buyer_id, t.seller_id) then raise exception 'Réservé aux parties de cette mission.'; end if;
  is_buyer := uid = t.buyer_id;
  confirmed := coalesce(t.price_confirmed, false);
  if t.status = 'cancelled' then return jsonb_build_object('ok', true, 'already', true, 'tier', t.cancel_tier); end if;
  if t.status in ('completed', 'released') then
    return jsonb_build_object('ok', false, 'reason', 'terminee', 'message', 'Cette mission est terminée.');
  end if;
  if v_kind is not null and not (v_kind = any (case when is_buyer then libre_client else libre_pro end)) then
    return jsonb_build_object('ok', false, 'reason', 'motif_invalide', 'message', 'Motif inconnu : choisissez-en un dans la liste.');
  end if;
  motif := case v_kind when 'maladie' then 'maladie' when 'urgence_familiale' then 'urgence familiale' when 'accident' then 'accident'
    when 'autre_grave' then 'autre motif grave' when 'panne_vehicule' then 'panne ou problème de véhicule'
    when 'indisponibilite' then 'indisponibilité' when 'changement_de_plan' then 'changement de plan' when 'autre' then 'autre motif' end;

  if is_buyer then
    tier := public._cx_tier(p_transaction);
    if tier = 'motif_grave' then
      if v_kind is null or not (v_kind = any (grave)) then
        return jsonb_build_object('ok', false, 'reason', 'motif_requis', 'tier', tier,
          'message', 'Le prestataire est en route : l''annulation n''est possible que pour un motif sérieux (maladie, urgence familiale, accident, autre motif grave).');
      end if;
      if v_kind = 'autre_grave' and (why is null or char_length(why) < 5) then
        return jsonb_build_object('ok', false, 'reason', 'texte_requis', 'tier', tier, 'message', 'Décrivez ce motif grave en quelques mots.');
      end if;
    elsif tier = 'frais_totaux' then
      fee := coalesce(public._cx_fee(p_transaction), 0);
      if not coalesce(p_confirm_fees, false) then
        return jsonb_build_object('ok', false, 'reason', 'confirmation_frais', 'tier', tier, 'fee_cents', fee,
          'message', format('Le prestataire est sur place ou le rendez-vous est imminent : vous serez facturé la totalité (%s).', public._cx_eur(fee)));
      end if;
    end if;
    label := tier;
  else
    tier := 'prestataire';
    if confirmed then
      if v_kind is null then
        return jsonb_build_object('ok', false, 'reason', 'motif_requis', 'tier', tier, 'message', 'Choisissez le motif de l''annulation.');
      end if;
      if v_kind = 'autre' and (why is null or char_length(why) < 5) then
        return jsonb_build_object('ok', false, 'reason', 'texte_requis', 'tier', tier, 'message', 'Décrivez le motif en quelques mots.');
      end if;
    end if;
    label := tier;
  end if;

  -- Autorise l'annulation après l'arrivée pour cette seule RPC (gardes 014 / 027 adaptées plus haut).
  perform set_config('ping.cancel_rpc', '1', true);
  update public.transactions set status = 'cancelled', cancelled_at = now(), cancelled_by = uid,
      cancel_tier = label,
      cancel_reason_kind = v_kind, cancel_reason_text = why, cancel_fee_cents = case when tier = 'frais_totaux' then fee else 0 end
    where id = p_transaction;

  if confirmed then
    insert into public.mission_cancellations (transaction_id, party, actor_id, provider_id, client_id, tier, reason_kind, reason_text, fee_cents)
      values (p_transaction, case when is_buyer then 'client' else 'prestataire' end, uid, t.seller_id, t.buyer_id, label, v_kind, why,
              case when tier = 'frais_totaux' then fee else 0 end);
  end if;

  body := case
    when not is_buyer then
      '✕ Réservation annulée par le prestataire' || coalesce(' — motif : ' || motif, '') || coalesce(' (« ' || why || ' »)', '')
        || '. Aucun frais pour le client ; remboursement à 100 % si le paiement a été fait en ligne.'
    when tier = 'motif_grave' then
      '✕ Réservation annulée par le client alors que le prestataire était en route, pour motif grave (' || coalesce(motif, '') || ')'
        || coalesce(' : « ' || why || ' »', '') || '. Aucun frais ; le motif est enregistré et visible de PING.'
    when tier = 'frais_totaux' then
      '✕ Annulation tardive par le client : frais d''annulation de ' || public._cx_eur(fee)
        || ' (100 % de la prestation et frais de service). Les documents de facturation sont émis ; le client peut ouvrir un litige dans les 24 h.'
    else
      '✕ ' || case when confirmed then 'Réservation' else 'Demande' end || ' annulée par le client'
        || coalesce(' — motif : ' || motif, '') || case when confirmed then '. Aucun frais.' else '.' end
  end;
  perform public._cx_say(p_transaction, uid, body);

  if not is_buyer and confirmed then
    perform public._cx_check_threshold(t.seller_id, p_transaction);
  end if;
  if t.arrived_at is not null or t.status = 'arrived' then
    perform public._cx_alert(t.seller_id, 'cancel_after_arrival',
      jsonb_build_object('transactionId', p_transaction, 'party', case when is_buyer then 'client' else 'prestataire' end,
                         'feeCents', case when tier = 'frais_totaux' then fee else 0 end, 'controle', 'antifraude'));
  end if;
  if tier = 'frais_totaux' then
    perform public._cx_cancellation_invoices(p_transaction);
    perform public._cx_alert(t.seller_id, 'late_cancellation_fees',
      jsonb_build_object('transactionId', p_transaction, 'feeCents', fee, 'clientId', t.buyer_id));
  end if;

  return jsonb_build_object('ok', true, 'tier', label, 'fee_cents', case when tier = 'frais_totaux' then fee else 0 end,
    'refund_online', label <> 'frais_totaux');
end $$;
revoke all on function public.cancel_booking(uuid, text, text, boolean) from public, anon;
grant execute on function public.cancel_booking(uuid, text, text, boolean) to authenticated;
