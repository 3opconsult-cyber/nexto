"use client"
import { useState, useEffect, Suspense } from 'react'
import DayTimePicker from '@/components/DayTimePicker'
import AddressChoice, { resolveAddress, type AddressValue } from '@/components/AddressChoice'
import { maskAddress } from '@/lib/address'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { getRates, DEFAULT_BUYER_RATE, DEFAULT_SELLER_RATE } from '@/lib/pricing'
import { geocodeAddress } from '@/lib/geocode'
import { startCheckout, usePaymentsActive } from '@/lib/paymentsClient'
import { shortName } from '@/lib/ratePrompt'
import { TRADES, cesuEligible } from '@/lib/trades'
import { EUR } from '@/lib/invoice-pdf'
import { fetchSlots, dayLabel, hhmm, slotEnd, type Slot } from '@/lib/slots'
import Calendar, { type CalEvent } from '@/components/calendar/Calendar'
import { AVANCE_IMMEDIATE_ACTIVE, isEligible, partClientCents } from '@/lib/creditImpot'
import { systemSender } from '@/lib/systemMessage'
import { notifyOther } from '@/lib/notify'
import { fetchPrestations, prestationName, prestationPhotoUrl, type Prestation } from '@/lib/prestations'
import { openConversation } from '@/lib/services'
import { pricingShort, pricingSummary } from '@/lib/servicePricing'
import { markFirstAction } from '@/lib/firstAction'
import { bookingAvailable } from '@/lib/booking'

// Passe à « Remplacé » (offer_status declined + message système) les devis en attente des
// conversations non confirmées entre ce client et ce prestataire, autres que la réservation
// qui vient d'être créée. Échec silencieux : la réservation elle-même est déjà enregistrée.
async function replacePendingOffers(supabase: ReturnType<typeof createClient>, buyerId: string, sellerId: string, newTxId: string, what: string) {
  try {
    const { data: open } = await supabase.from('transactions').select('id')
      .eq('buyer_id', buyerId).eq('seller_id', sellerId)
      .eq('status', 'pending').eq('price_confirmed', false).neq('id', newTxId)
    const ids = (open ?? []).map((t: any) => t.id as string)
    if (!ids.length) return
    const { data: offers } = await supabase.from('messages').select('id, transaction_id')
      .in('transaction_id', ids).eq('kind', 'offer').eq('offer_status', 'pending')
    const list = (offers ?? []) as { id: string; transaction_id: string }[]
    if (!list.length) return
    await supabase.from('messages').update({ offer_status: 'declined' }).in('id', list.map(o => o.id))
    const sender = await systemSender(supabase)
    const touched = Array.from(new Set(list.map(o => o.transaction_id)))
    await supabase.from('messages').insert(touched.map(id => ({
      transaction_id: id, ...sender,
      body: `Proposition remplacée par la réservation directe (${what}).`,
    })))
  } catch { /* la réservation reste valable */ }
}

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const serviceParam = params.get('service')
  // Préremplissage depuis « Trouver un prestataire » (carte) : métier, moment (AAAA-MM-JJTHH:MM, heure locale) et besoin.
  // Rien n'est envoyé ni calculé ici : le client voit le prix et confirme comme d'habitude.
  const tradeParam = params.get('trade')
  const whenParam = params.get('when') || ''
  const needParam = (params.get('need') || '').slice(0, 120)
  const [pro, setPro] = useState<any>(null)
  const [proName, setProName] = useState('')
  // Prestations visibles du catalogue (table services) ; `selId` = celle réservée (null = métier
  // principal, provider_profiles). Le client choisit ici ; ?service= présélectionne depuis la fiche.
  const [catalog, setCatalog] = useState<Prestation[] | null>(null)
  const [selId, setSelId] = useState<string | null>(serviceParam)
  const [devisBusy, setDevisBusy] = useState(false)
  const article: any = selId ? (catalog?.find(x => x.id === selId) ?? null) : null
  const serviceId = article ? article.id as string : null
  // Adresse d'intervention : celle du profil par défaut, confirmée par le client (Romain 31/10).
  const [profileAddress, setProfileAddress] = useState<string | null>(null)
  const [addr, setAddr] = useState<AddressValue>({ mode: 'profil', other: '', confirmed: true })
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb.from('profiles').select('address').eq('id', user.id).maybeSingle()
      setProfileAddress(data?.address?.trim() || null)
    })
  }, [])
  const [description, setDescription] = useState(needParam ? `Services souhaités : ${needParam}` : '')
  // Migration 052 : la réservation part « en attente d'acceptation » ; on le dit avant le bouton.
  const [needsAccept, setNeedsAccept] = useState(false)
  useEffect(() => { bookingAvailable(createClient()).then(setNeedsAccept).catch(() => { }) }, [])
  // Sans créneaux publiés par le pro, le client indique lui-même la date et l'heure souhaitées.
  const [wantedAt, setWantedAt] = useState(() => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(whenParam) && new Date(whenParam).getTime() > Date.now() ? whenParam : ''))
  const [estimatedHours, setEstimatedHours] = useState('2')
  const [mode, setMode] = useState<'forfait' | 'horaire' | null>(null)
  const [error, setError] = useState('')
  // Erreur rattachée à un champ (adresse, date, créneau, durée) : affichée à côté de lui, AVANT
  // d'ouvrir la fenêtre de paiement (audit ergonomie 18/11, amélioration 5).
  const [fieldErr, setFieldErr] = useState<{ field: 'addr' | 'date' | 'slot' | 'hours'; msg: string } | null>(null)
  // « Payer en CESU préfinancé » : service éligible ET prestataire qui l'accepte (colonne de la migration 039 ;
  // absente = undefined = option masquée). Phase 1 : le client règle le pro avec ses titres, PING n'encaisse rien.
  const [payCesu, setPayCesu] = useState(false)
  // Créneaux publiés par le pro (migration 012). null = fonctionnalité pas encore en base.
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  // Taux pilotés depuis l'admin (app_settings) — valeurs par défaut le temps
  // du chargement, jamais utilisées pour le calcul final (submit() relit
  // getRates(), qui a déjà mis le cache à jour à ce moment-là).
  const [rates, setRates] = useState({ buyer: DEFAULT_BUYER_RATE, seller: DEFAULT_SELLER_RATE })
  useEffect(() => { getRates().then(setRates) }, [])

  // `article` : prix de l'article précis choisi sur la fiche du pro (migration
  // 008, table services) ; sans ?service=, on retombe sur le métier principal
  // (provider_profiles) comme avant.
  const pricing = article ?? pro

  useEffect(() => {
    if (!proId) return
    createClient().from('provider_profiles').select('*').eq('id', proId).single()
      .then(({ data }) => { setPro(data) })
    // Nom affiché par la fonction dédiée (profiles est en lecture personnelle : jamais d'embed).
    createClient().rpc('provider_public_name', { provider_id: proId })
      .then(({ data }) => { const n = Array.isArray(data) ? data[0]?.full_name : null; if (n && String(n).trim()) setProName(shortName(n)) }, () => { })
    fetchSlots(createClient(), proId, 21).then(list => {
      const free = list ? list.filter(x => !x.transaction_id) : null
      setSlots(free)
    })
  }, [proId])

  // Même calendrier que l'agenda et les disponibilités du pro : le client ne voit que les créneaux libres.
  const slotEvents: CalEvent[] = (slots ?? []).filter(x => new Date(x.starts_at) > new Date()).map(x => ({
    id: x.id, start: new Date(x.starts_at), end: slotEnd(x), kind: 'free', title: 'Disponible',
    selected: x.id === slotId, onClick: () => setSlotId(x.id),
  }))
  const chosen = slots?.find(x => x.id === slotId) || null
  const needsSlot = !!slots && slots.length > 0

  useEffect(() => {
    if (!proId) return
    fetchPrestations(createClient(), proId, { visibleOnly: true }).then(({ rows }) => setCatalog(rows))
  }, [proId])

  // Options de réservation : le métier principal puis chaque prestation visible.
  const options: { id: string | null; name: string; trade: string | null; photo_path: string | null; cols: any }[] = pro ? [
    { id: null, name: TRADES[pro.trade] || pro.trade, trade: pro.trade, photo_path: null, cols: pro },
    ...(catalog ?? []).map(c => ({ id: c.id, name: prestationName(c), trade: c.trade, photo_path: c.photo_path, cols: c })),
  ] : []
  // Prestation demandée introuvable (masquée ou retirée entre-temps) : on le dit, plutôt que de
  // réserver en silence le métier principal à un autre prix.
  const missingService = !!selId && catalog !== null && !article
  // Arrivée sans ?service= sur un métier principal « sur devis » : on présélectionne la première
  // prestation à prix fixe s'il y en a une.
  useEffect(() => {
    if (!pro || catalog === null || selId) return
    // Métier demandé depuis la carte : le métier principal du prestataire s'il correspond, sinon sa première prestation à prix fixe de ce métier.
    if (tradeParam && pro.trade !== tradeParam) {
      const t = catalog.find(c => c.trade === tradeParam && c.pricing_type !== 'devis')
      if (t) { setSelId(t.id); return }
    }
    if (pro.pricing_type === 'devis') {
      const first = catalog.find(c => c.pricing_type !== 'devis')
      if (first) setSelId(first.id)
    }
  }, [pro, catalog]) // eslint-disable-line react-hooks/exhaustive-deps
  const selected = options.find(o => o.id === (article ? article.id : null)) ?? null
  const isDevis = !missingService && !!pricing && pricing.pricing_type === 'devis'
  const serviceTrade: string | null = (article?.trade as string | null) ?? pro?.trade ?? null

  async function askQuote() {
    if (!pro || !selected) return
    setDevisBusy(true); setError('')
    const { missionId, error: e } = await openConversation(pro.id, { name: selected.name, trade: selected.trade })
    setDevisBusy(false)
    if (missionId) { router.push(`/mission/${missionId}/chat?devis=${encodeURIComponent(selected.name)}`); return }
    if (e === 'not_authenticated') { router.push(`/auth/login?next=${encodeURIComponent(`/pro/${pro.id}`)}`); return }
    if (e === 'own_profile') { setError('Vous ne pouvez pas réserver vos propres services.'); return }
    setError('La conversation n’a pas pu s’ouvrir. Réessayez dans un instant.')
  }

  useEffect(() => {
    if (!pricing) return
    const hasFlat = pricing.base_price_cents > 0
    const hasHourly = pricing.hourly_rate_cents != null && pricing.hourly_rate_cents > 0
    setMode(hasFlat ? 'forfait' : hasHourly ? 'horaire' : null)
  }, [pricing])

  const hasFlat = !!pricing && pricing.base_price_cents > 0
  const hasHourly = !!pricing && pricing.hourly_rate_cents != null && pricing.hourly_rate_cents > 0
  // Forfait + depassement : le taux horaire n'est pas un mode alternatif, il ne
  // s'applique qu'au-dela des heures incluses — le client ne choisit pas entre
  // les deux, il n'y a qu'un seul prix de depart (le forfait).
  const hasOvertime = hasFlat && hasHourly && pricing?.included_hours != null
  const subtotalCents = pricing
    ? (hasOvertime ? pricing.base_price_cents
        : mode === 'horaire' ? Math.round((pricing.hourly_rate_cents || 0) * Number(estimatedHours || 0))
        : pricing.base_price_cents)
    : 0
  const buyerFee = Math.round(subtotalCents * rates.buyer)
  const totalTtc = subtotalCents + buyerFee

  const [creating, setCreating] = useState(false)
  const cesuOk = cesuEligible(serviceTrade) && pro?.accepts_cesu_prefinance === true
  // Paiement en ligne actif : on saute la simulation et on envoie le client vers la vraie page de paiement.
  const paymentsOn = usePaymentsActive()

  // Contrôle complet du formulaire, sans rien envoyer : l'erreur va à côté du champ et l'écran y défile.
  function validate(): boolean {
    const chosenAddr = resolveAddress(profileAddress, addr)
    const fe: { field: 'addr' | 'date' | 'slot' | 'hours'; msg: string } | null =
      'error' in chosenAddr ? { field: 'addr', msg: chosenAddr.error as string }
        : needsSlot && !chosen ? { field: 'slot', msg: 'Choisissez un créneau.' }
          : !needsSlot && !wantedAt ? { field: 'date', msg: 'Indiquez la date et l\u2019heure souhaitées.' }
            : !needsSlot && new Date(wantedAt).getTime() < Date.now() ? { field: 'date', msg: 'Choisissez une date à venir.' }
              : !(subtotalCents > 0) ? { field: 'hours', msg: 'Indiquez une durée estimée.' }
                : null
    setFieldErr(fe)
    if (fe) {
      setError('')
      try { document.getElementById(`mn-${fe.field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* rien */ }
      return false
    }
    return true
  }
  // Plus de fenêtre « Paiement par virement » entre le bouton et la réservation (audit 19/11,
  // correction 10) : l'information est dans le récapitulatif, juste au-dessus du bouton.
  function onConfirmClick() {
    if (!validate()) return
    submit()
  }

  async function submit() {
    if (!validate()) return
    const chosenAddr = resolveAddress(profileAddress, addr)
    if ('error' in chosenAddr) return
    const address = chosenAddr.address
    if (!pro || !mode || isDevis || missingService) return
    setError('')
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (user.id === pro.id) { setError('Vous ne pouvez pas réserver vos propres services.'); setCreating(false); return }

    if (chosen) {
      const { data: still } = await supabase.from('provider_slots').select('id').eq('id', chosen.id).is('transaction_id', null).maybeSingle()
      if (!still) {
        setError("Ce créneau vient d'être réservé. Choisissez-en un autre.")
        setSlots(prev => prev ? prev.filter(x => x.id !== chosen.id) : prev); setSlotId(null); setCreating(false)
        return
      }
    }

    // Coordonnées de l'adresse : servent au contrôle de vraisemblance du départ et au scan.
    const pos = await geocodeAddress(address.trim()).catch(() => null)
    const desc = description.trim() || (article ? prestationName(article) : '')
    // Réservation calculée en base (migration 045) : prix, frais et commission recalculés côté serveur
    // depuis la fiche de prix et les taux de app_settings. Repli sur l'ancien chemin si la fonction manque.
    let tx: { id: string } | null = null
    // Réservation à accepter par le prestataire (migration 052) : book_service la crée « en attente ».
    let awaiting = false
    const { data: booked, error: bookErr } = await supabase.rpc('book_service', {
      p_provider: pro.id,
      p_service: serviceId,
      p_mode: mode,
      p_estimated_hours: mode === 'horaire' && !hasOvertime ? Number(estimatedHours || 0) : null,
      p_address: address.trim(),
      p_address_status: chosenAddr.status,
      p_scheduled_at: !needsSlot && wantedAt ? new Date(wantedAt).toISOString() : null,
      p_description: desc,
      p_lat: pos?.lat ?? null,
      p_lng: pos?.lng ?? null,
      p_payment_pref: payCesu && cesuOk ? 'cesu' : null,
    })
    if (!bookErr && booked && (booked as any).transaction_id) {
      tx = { id: (booked as any).transaction_id as string }
      awaiting = (booked as any).booking_status === 'en_attente'
    } else if (bookErr && !missingRpc(bookErr)) {
      // Refus explicite de la base (prestation masquée, sur devis, adresse…) : message en français.
      setError(bookErr.message || 'Impossible de créer la réservation.'); setCreating(false); return
    } else {
      const { data: req, error: reqErr } = await supabase.from('requests').insert({
        // description est NOT NULL en base : le champ est facultatif a l'ecran,
        // "|| null" faisait donc echouer la reservation des que le client ne
        // remplissait pas la description (jamais declenche par les tests, ou
        // elle etait toujours remplie a la main).
        requester_id: user.id, category: serviceTrade || pro.trade,
        description: description.trim() || (article ? prestationName(article) : ''),
        address: address.trim(), budget_cents: totalTtc, status: 'matched',
        ...(payCesu && cesuOk ? { payment_pref: 'cesu' } : {}),
        ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
      }).select().single()
      if (reqErr || !req) { setError("Impossible de créer la demande."); setCreating(false); return }

      // Relit les taux à l'instant T (pas le state React, qui peut dater de
      // l'affichage initial) : la source de vérité au moment de l'écriture.
      const liveRates = await getRates()
      const liveBuyerFee = Math.round(subtotalCents * liveRates.buyer)
      const sellerFee = Math.round(subtotalCents * liveRates.seller)
      const liveTotalTtc = subtotalCents + liveBuyerFee
      const { data: txRow, error: txErr } = await supabase.from('transactions').insert({
        kind: 'service', buyer_id: user.id, seller_id: pro.id, request_id: req.id,
        subtotal_cents: subtotalCents, buyer_fee_cents: liveBuyerFee, seller_fee_cents: sellerFee,
        total_charged_cents: liveTotalTtc, payout_cents: subtotalCents - sellerFee,
        hourly_rate_cents: hasOvertime ? pricing.hourly_rate_cents : (mode === 'horaire' ? pricing.hourly_rate_cents : null),
        included_hours: hasOvertime ? pricing.included_hours : null,
        base_forfait_cents: hasOvertime ? pricing.base_price_cents : null,
        status: 'pending',
        price_confirmed: true,
        address_status: chosenAddr.status,
        ...(!needsSlot && wantedAt ? { scheduled_at: new Date(wantedAt).toISOString() } : {}),
      }).select().single()
      if (txErr || !txRow) { setError('Impossible de créer la réservation.'); setCreating(false); return }
      tx = txRow
    }
    if (!tx) { setError('Impossible de créer la réservation.'); setCreating(false); return }
    if (chosenAddr.saveToProfile) await supabase.from('profiles').update({ address }).eq('id', user.id)

    // Sans ça, le chat s'ouvrait totalement vide malgré un prix déjà validé
    // (règle suprême du tarif) — rien ne rappelait ce qui avait été réservé.
    const label = article ? prestationName(article) : (TRADES[pro.trade] || pro.trade)
    const priceLabel = hasOvertime
      ? `${(pricing.base_price_cents / 100).toFixed(0)} € (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}, puis ${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h au-delà)`
      : mode === 'horaire' ? `${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h`
        : `${(pricing.base_price_cents / 100).toFixed(0)} €`
    let when = ''
    if (chosen) {
      const { error: slotErr } = await supabase.rpc('book_slot', { p_slot: chosen.id, p_transaction: tx.id })
      when = slotErr
        ? ' · créneau à convenir dans la conversation (celui choisi vient d\'être pris)'
        : ` · ${dayLabel(chosen.starts_at)} à ${hhmm(chosen.starts_at)}`
    } else if (wantedAt) {
      const d = new Date(wantedAt)
      when = ` · ${dayLabel(d.toISOString())} à ${hhmm(d.toISOString())}`
    }
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      // En attente d'acceptation (052) : l'adresse exacte n'est pas écrite dans le fil (le prestataire la reçoit
      // quand il accepte, dans le récapitulatif de la mission).
      body: awaiting
        ? `Réservation envoyée — ${label} · ${priceLabel}${when} · ${maskAddress(address)} · en attente de l’acceptation du prestataire`
        : chosenAddr.status === 'a_valider'
          ? `✓ Réservation confirmée — ${label} · ${priceLabel}${when} · autre adresse à valider par le prestataire : ${maskAddress(address)}`
          : `✓ Réservation confirmée — ${label} · ${priceLabel}${when} · ${address.trim()}`,
    })

    // Fonction serveur absente (migration 045 pas encore collée) : PostgREST répond PGRST202, Postgres 42883.
function missingRpc(e: { code?: string; message?: string } | null) {
  return !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function|function .* does not exist/i.test(e.message || ''))
}

// Conversations encore en négociation avec ce prestataire (« Contacter », devis en attente) :
    // la réservation à prix figé les remplace. Sans ça, un ancien devis restait « Accepter »
    // et l'accepter créait une deuxième mission confirmée chez le même pro (lot 1, constat n° 2).
    // Le client a le droit de refuser une proposition (comme declineOffer dans le chat).
    await replacePendingOffers(supabase, user.id, pro.id, tx.id, `${label}${when}`)

    trackEvent('mission_booked', { pro_id: proId, service_id: serviceId, subtotal_cents: subtotalCents })
    markFirstAction('reservation')
    notifyOther(tx.id, awaiting ? 'booking_request' : 'booking')
    if (paymentsOn) {
      // Si le prestataire n'a pas encore de compte de paiement, la mission reste réservée et le
      // bouton « Payer » de l'écran suivant prendra le relais.
      const pay = await startCheckout(tx.id)
      if (pay.redirectUrl) { window.location.href = pay.redirectUrl; return }
    }
    // « Commande validée » : récapitulatif du paiement, puis « Serez-vous sur place ? » (maquette 18/11).
    router.push(`/mission/${tx.id}/commande`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div style={{ padding: '10px 20px 12px', borderBottom: '1px solid #E7EDEB', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => router.back()} aria-label="Retour" style={{ color: '#123644', background: 'none', border: 'none', width: 44, height: 44, marginLeft: -12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644', margin: 0 }}>{proName ? `Réserver ${proName}` : 'Réserver'}</h1>
        </div>
        <p style={{ fontSize: 13, color: '#4E6470', margin: '2px 0 0' }}>
          {pricing
            ? hasOvertime
              ? `${article ? prestationName(article) : TRADES[pro.trade] || pro.trade} — ${EUR(pricing.base_price_cents)} (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}), puis ${EUR(pricing.hourly_rate_cents)}/h au-delà`
              : isDevis ? `${article ? prestationName(article) : TRADES[pro.trade] || pro.trade} — sur devis`
              : `${article ? prestationName(article) : TRADES[pro.trade] || pro.trade} — ${[hasFlat ? EUR(pricing.base_price_cents)+' forfait' : null, hasHourly ? EUR(pricing.hourly_rate_cents)+'/h' : null].filter(Boolean).join(' · ')}`
            : 'Chargement…'}
        </p>
      </div>

      <div style={{ background: '#fff', padding: '20px 20px', minHeight: 'calc(100vh - 110px)' }}>
        {/* Choix de la prestation : son prix et sa manière de tarifer sont figés sur la réservation. */}
        {options.length > 1 && (
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Prestation</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {options.map(o => {
                const on = !missingService && (o.id ?? null) === (article ? article.id : null)
                const photo = prestationPhotoUrl(o.photo_path)
                return (
                  <button key={o.id ?? 'primary'} type="button" onClick={() => { setSelId(o.id); setError('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: on ? '2px solid #12B39C' : '2px solid #E7EDEB', background: on ? 'rgba(18,179,156,.06)' : '#fff' }}>
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#F3F6F5' }} />
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{o.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{pricingSummary(o.cols)}</span>
                    </span>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', whiteSpace: 'nowrap' }}>{pricingShort(o.cols) ?? ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {missingService && (
          <div style={{ padding: 13, borderRadius: 12, background: '#FFF4DD', fontSize: 12.5, color: '#8A5A00', marginBottom: 16, lineHeight: 1.5 }}>
            Cette prestation n&apos;est plus proposée par ce prestataire.{options.length > 1 ? ' Choisissez-en une autre ci-dessus.' : ''}
          </div>
        )}

        {isDevis ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: 14, borderRadius: 12, background: '#F3F6F5', fontSize: 13, color: '#123644', lineHeight: 1.55, marginBottom: 14 }}>
              <b>Prestation sur devis.</b> Pas de prix à l&apos;avance : décrivez votre besoin dans la conversation,
              le prestataire vous envoie un tarif que vous acceptez ou non. Rien n&apos;est réservé tant que vous
              n&apos;avez pas accepté son tarif.
            </div>
            {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
            <button onClick={askQuote} disabled={devisBusy}
              style={{ width: '100%', border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, opacity: devisBusy ? 0.7 : 1 }}>
              {devisBusy ? 'Ouverture…' : 'Demander un devis'}
            </button>
          </div>
        ) : (<>
        <div id="mn-addr" style={{ marginBottom: 16 }}>
          <AddressChoice profileAddress={profileAddress} value={addr} onChange={v => { setAddr(v); if (fieldErr?.field === 'addr') setFieldErr(null) }}
            error={fieldErr?.field === 'addr' ? fieldErr.msg : undefined} />
        </div>

        {!needsSlot && (
          <div id="mn-date" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Date et heure souhaitées</span>
            <div style={{ marginTop: 6 }}><DayTimePicker value={wantedAt} onChange={v => { setWantedAt(v); if (fieldErr?.field === 'date') setFieldErr(null) }} /></div>
            {fieldErr?.field === 'date' && <p role="alert" style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{fieldErr.msg}</p>}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Description (facultatif)</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit' }} />
        </label>

        {hasFlat && hasHourly && !hasOvertime && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['forfait', 'horaire'] as const).map(t => (
              <button key={t} onClick={() => setMode(t)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: mode === t ? '2px solid #12B39C' : '2px solid #E7EDEB', background: mode === t ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                {t === 'forfait' ? `Forfait — ${EUR(pricing.base_price_cents)}` : `À l'heure — ${EUR(pricing.hourly_rate_cents)}/h`}
              </button>
            ))}
          </div>
        )}

        {hasOvertime && (
          <div style={{ padding: 13, borderRadius: 12, background: 'rgba(242,169,59,.1)', fontSize: 12.5, color: '#8a6520', marginBottom: 16, lineHeight: 1.5 }}>
            Forfait de {EUR(pricing.base_price_cents)} incluant {pricing.included_hours} h. Au-delà,
            {' '}{EUR(pricing.hourly_rate_cents)}/h supplémentaire — ajusté automatiquement au scan de sortie selon la durée réelle.
          </div>
        )}

        {mode === 'horaire' && !hasOvertime && (
          <label id="mn-hours" style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Durée estimée (heures) — ajustée au réel après le scan de sortie</span>
            <input type="number" value={estimatedHours} onChange={e => { setEstimatedHours(e.target.value); if (fieldErr?.field === 'hours') setFieldErr(null) }} min="0.5" step="0.5"
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
            {fieldErr?.field === 'hours' && <span role="alert" style={{ display: 'block', color: '#c0503a', fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{fieldErr.msg}</span>}
          </label>
        )}

        {needsSlot && (
          <div id="mn-slot" style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Choisir un créneau</span>
            <div style={{ marginTop: 8 }}>
              <Calendar events={slotEvents} views={['week', 'day']} defaultView="week"
                initialDate={slotEvents[0]?.start} />
            </div>
            <div style={{ fontSize: 11.5, color: chosen ? '#0B8374' : '#6E8592', fontWeight: chosen ? 700 : 400, marginTop: 8 }}>
              {chosen ? `Créneau choisi : ${dayLabel(chosen.starts_at)} à ${hhmm(chosen.starts_at)}` : 'Touchez un créneau disponible publié par le prestataire.'}
            </div>
            {fieldErr?.field === 'slot' && !chosen && <p role="alert" style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{fieldErr.msg}</p>}
          </div>
        )}

        {/* Prix tout compris, façon Airbnb/Booking : un seul montant à l'écran,
            pas une addition qui s'allonge sous les yeux du client — le détail
            reste disponible (facture, mission/[id]/facture) sans être imposé
            ici. Les montants envoyés en base ne changent pas (subtotal_cents,
            buyer_fee_cents...) : c'est la présentation qui change, pas le prix. */}
        <div style={{ background: '#F3F6F5', borderRadius: 14, padding: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Total</span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{EUR(totalTtc)}</span>
          </div>
          <div style={{ fontSize: 11, color: '#6E8592', marginTop: 4 }}>Frais de service PING inclus</div>
          {/* Paiement (ex-fenêtre PaymentPendingModal) : dit AVANT que le client valide, sans fenêtre. */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2ECEA', fontSize: 12, color: '#123644', lineHeight: 1.5 }}>
            {paymentsOn
              ? 'Paiement sécurisé par carte à l’étape suivante.'
              : <><b>Rien n&apos;est débité à la réservation.</b> Vous réglez après l&apos;intervention, sur facture, par virement : la prestation directement à {pro?.company_name || 'votre prestataire'}, vos frais de service à PING.{(hasOvertime || mode === 'horaire') ? ' Montant recalculé sur la durée réelle, relevée par les codes d’arrivée et de fin.' : ''}</>}
          </div>
          {AVANCE_IMMEDIATE_ACTIVE && pro?.sap_number && isEligible(pro?.trade) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2ECEA', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, color: '#0B8374', fontWeight: 600 }}>Avec le crédit d&apos;impôt immédiat</span>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#0B8374' }}>{EUR(partClientCents(totalTtc))}</span>
            </div>
          )}
        </div>

        {cesuOk && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, border: payCesu ? '1.5px solid #12B39C' : '1.5px solid #DCE5E3', background: payCesu ? 'rgba(18,179,156,.06)' : '#fff', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={payCesu} onChange={e => setPayCesu(e.target.checked)} style={{ marginTop: 0, width: 24, height: 24, accentColor: '#12B39C', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#123644', lineHeight: 1.5 }}>
              <b>Payer en CESU préfinancé</b>
              <span style={{ display: 'block', fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>Ce prestataire accepte les titres CESU remis par votre employeur ou votre comité d&apos;entreprise : vous les lui remettez directement après l&apos;intervention. Vous gérez vous-même votre crédit d&apos;impôt.</span>
            </span>
          </label>
        )}

        {/* Argument de confiance discret, façon Airbnb : une ligne, pas un pavé —
            cf. critique "pas d'argumentaire visible" + décision de garder la
            sobriété plutôt que lister des badges. Politique honnête vu l'état
            actuel (rien n'est débité avant la prestation, Stripe non branché) :
            l'annulation est donc réellement gratuite jusqu'à l'arrivée, ce n'est
            pas une promesse en avance sur la fonctionnalité. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(18,179,156,.07)', marginBottom: 14 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
          <span style={{ fontSize: 12, color: '#123644', lineHeight: 1.5 }}>
            {needsAccept && <><b>Le prestataire accepte votre réservation sous 24 h</b> (au plus tard 2 h avant le rendez-vous), sinon la réservation est annulée sans frais. </>}
            Annulation gratuite tant que le prestataire n'est pas en route — des frais s'appliquent au-delà. Pas satisfait ? Vous pouvez ouvrir une réclamation après la prestation.
          </span>
        </div>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        {/* Bouton collant au-dessus de la barre du bas : jamais sous le pli (audit 19/11, correction 10). */}
        <div style={{ position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 20, margin: '0 -20px', padding: '10px 20px calc(10px + env(safe-area-inset-bottom, 0px))', background: '#fff', borderTop: '1px solid #EEF2F1' }}>
          <button onClick={onConfirmClick} disabled={!pro || !mode || creating || paymentsOn === null || missingService} style={{ width: '100%', minHeight: 50, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 999, opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Confirmation…' : `${chosen ? `Confirmer · ${dayLabel(chosen.starts_at, { weekday: 'short', day: 'numeric' })} ${hhmm(chosen.starts_at)}` : 'Confirmer la réservation'}${totalTtc > 0 ? ` · ${EUR(totalTtc)}` : ''}`}
          </button>
        </div>
        </>)}
      </div>
    </div>
  )
}

export default function MissionNew() {
  return <Suspense fallback={null}><MissionForm /></Suspense>
}
