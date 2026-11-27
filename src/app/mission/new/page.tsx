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
import '../../aere.css'

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

// Fonction serveur absente (migration 045 pas encore collée) : PostgREST répond PGRST202, Postgres 42883.
function missingRpc(e: { code?: string; message?: string } | null) {
  return !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function|function .* does not exist/i.test(e.message || ''))
}
const WEEKS = 4

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
  // Étapes déjà connues (carte, profil) : repliées sur une ligne, « Modifier » les rouvre.
  const [openSvc, setOpenSvc] = useState(false)
  const [openWhen, setOpenWhen] = useState(false)
  const [openAddr, setOpenAddr] = useState(false)
  const [weekly, setWeekly] = useState(false)
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
    // 29 jours : le créneau choisi et ses trois reprises hebdomadaires (+7, +14, +21 jours).
    fetchSlots(createClient(), proId, 29).then(list => {
      const free = list ? list.filter(x => !x.transaction_id) : null
      setSlots(free)
      // Moment venu de la carte : le créneau publié qui correspond exactement est présélectionné.
      if (free && whenParam) {
        const t = new Date(whenParam).getTime()
        const m = free.find(x => new Date(x.starts_at).getTime() === t)
        if (m) setSlotId(m.id)
      }
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

  // ---- Fréquence (maquette : « Une fois » / « Chaque semaine (4 semaines) ») ----
  // « Chaque semaine » = 4 réservations INDÉPENDANTES (même service, même heure, +7, +14, +21 jours),
  // créées une à une avec la même fonction book_service : prix figé, acceptation et règles
  // d'annulation propres à chacune. Aucun calcul d'argent nouveau.
  type PlanItem = { idx: number; slot: Slot | null; whenIso: string | null; label: string; skip?: string }
  type Result = { idx: number; label: string; status: 'ok' | 'skipped' | 'fail'; txId?: string; msg?: string }
  type RunCtx = { userId: string; address: string; addrStatus: 'profil' | 'a_valider'; pos: { lat: number; lng: number } | null; plan: PlanItem[] }
  function buildPlan(): PlanItem[] {
    const baseIso = chosen ? chosen.starts_at : wantedAt ? new Date(wantedAt).toISOString() : null
    if (!baseIso) return []
    const n = weekly ? WEEKS : 1
    const out: PlanItem[] = []
    for (let k = 0; k < n; k++) {
      const d = new Date(baseIso); d.setDate(d.getDate() + 7 * k)
      const iso = d.toISOString()
      const label = `${dayLabel(iso, { weekday: 'long', day: 'numeric', month: 'long' })} à ${hhmm(iso)}`
      if (chosen) {
        const slot = k === 0 ? chosen : (slots ?? []).find(x => !x.transaction_id && new Date(x.starts_at).getTime() === d.getTime()) ?? null
        out.push(slot ? { idx: k, slot, whenIso: null, label } : { idx: k, slot: null, whenIso: null, label, skip: 'Aucun créneau publié ce jour-là.' })
      } else out.push({ idx: k, slot: null, whenIso: iso, label })
    }
    return out
  }
  const plan = buildPlan()
  const planOk = plan.filter(x => !x.skip).length
  const [results, setResults] = useState<Result[] | null>(null)
  const [runCtx, setRunCtx] = useState<RunCtx>({ userId: '', address: '', addrStatus: 'profil', pos: null, plan: [] })

  // Crée UNE réservation (même chemin qu'avant : book_service, repli ancien chemin, créneau, message système).
  async function createOne(c: RunCtx, item: PlanItem): Promise<{ txId?: string; awaiting?: boolean; error?: string }> {
    const supabase = createClient()
    const slot = item.slot
    if (slot) {
      const { data: still } = await supabase.from('provider_slots').select('id').eq('id', slot.id).is('transaction_id', null).maybeSingle()
      if (!still) {
        setSlots(prev => prev ? prev.filter(x => x.id !== slot.id) : prev)
        if (item.idx === 0) setSlotId(null)
        return { error: "Ce créneau vient d'être réservé. Choisissez-en un autre." }
      }
    }
    const desc = description.trim() || (article ? prestationName(article) : '')
    let tx: { id: string } | null = null
    let awaiting = false
    const { data: booked, error: bookErr } = await supabase.rpc('book_service', {
      p_provider: pro.id,
      p_service: serviceId,
      p_mode: mode,
      p_estimated_hours: mode === 'horaire' && !hasOvertime ? Number(estimatedHours || 0) : null,
      p_address: c.address.trim(),
      p_address_status: c.addrStatus,
      p_scheduled_at: item.whenIso,
      p_description: desc,
      p_lat: c.pos?.lat ?? null,
      p_lng: c.pos?.lng ?? null,
      p_payment_pref: payCesu && cesuOk ? 'cesu' : null,
    })
    if (!bookErr && booked && (booked as any).transaction_id) {
      tx = { id: (booked as any).transaction_id as string }
      awaiting = (booked as any).booking_status === 'en_attente'
    } else if (bookErr && !missingRpc(bookErr)) {
      // Refus explicite de la base (prestation masquée, sur devis, adresse…) : message en français.
      return { error: bookErr.message || 'Impossible de créer la réservation.' }
    } else {
      const { data: req, error: reqErr } = await supabase.from('requests').insert({
        // description est NOT NULL en base : le champ est facultatif a l'ecran,
        // "|| null" faisait donc echouer la reservation des que le client ne
        // remplissait pas la description.
        requester_id: c.userId, category: serviceTrade || pro.trade,
        description: description.trim() || (article ? prestationName(article) : ''),
        address: c.address.trim(), budget_cents: totalTtc, status: 'matched',
        ...(payCesu && cesuOk ? { payment_pref: 'cesu' } : {}),
        ...(c.pos ? { lat: c.pos.lat, lng: c.pos.lng } : {}),
      }).select().single()
      if (reqErr || !req) return { error: "Impossible de créer la demande." }

      // Relit les taux à l'instant T : la source de vérité au moment de l'écriture.
      const liveRates = await getRates()
      const liveBuyerFee = Math.round(subtotalCents * liveRates.buyer)
      const sellerFee = Math.round(subtotalCents * liveRates.seller)
      const liveTotalTtc = subtotalCents + liveBuyerFee
      const { data: txRow, error: txErr } = await supabase.from('transactions').insert({
        kind: 'service', buyer_id: c.userId, seller_id: pro.id, request_id: req.id,
        subtotal_cents: subtotalCents, buyer_fee_cents: liveBuyerFee, seller_fee_cents: sellerFee,
        total_charged_cents: liveTotalTtc, payout_cents: subtotalCents - sellerFee,
        hourly_rate_cents: hasOvertime ? pricing.hourly_rate_cents : (mode === 'horaire' ? pricing.hourly_rate_cents : null),
        included_hours: hasOvertime ? pricing.included_hours : null,
        base_forfait_cents: hasOvertime ? pricing.base_price_cents : null,
        status: 'pending',
        price_confirmed: true,
        address_status: c.addrStatus,
        ...(item.whenIso ? { scheduled_at: item.whenIso } : {}),
      }).select().single()
      if (txErr || !txRow) return { error: 'Impossible de créer la réservation.' }
      tx = txRow
    }
    if (!tx) return { error: 'Impossible de créer la réservation.' }

    // Sans ça, le chat s'ouvrait totalement vide malgré un prix déjà validé
    // (règle suprême du tarif) — rien ne rappelait ce qui avait été réservé.
    const label = article ? prestationName(article) : (TRADES[pro.trade] || pro.trade)
    const priceLabel = hasOvertime
      ? `${(pricing.base_price_cents / 100).toFixed(0)} € (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}, puis ${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h au-delà)`
      : mode === 'horaire' ? `${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h`
        : `${(pricing.base_price_cents / 100).toFixed(0)} €`
    let when = ''
    if (slot) {
      const { error: slotErr } = await supabase.rpc('book_slot', { p_slot: slot.id, p_transaction: tx.id })
      when = slotErr
        ? ' · créneau à convenir dans la conversation (celui choisi vient d\'être pris)'
        : ` · ${dayLabel(slot.starts_at)} à ${hhmm(slot.starts_at)}`
    } else if (item.whenIso) {
      when = ` · ${dayLabel(item.whenIso)} à ${hhmm(item.whenIso)}`
    }
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      // En attente d'acceptation (052) : l'adresse exacte n'est pas écrite dans le fil.
      body: awaiting
        ? `Réservation envoyée — ${label} · ${priceLabel}${when} · ${maskAddress(c.address)} · en attente de l’acceptation du prestataire`
        : c.addrStatus === 'a_valider'
          ? `✓ Réservation confirmée — ${label} · ${priceLabel}${when} · autre adresse à valider par le prestataire : ${maskAddress(c.address)}`
          : `✓ Réservation confirmée — ${label} · ${priceLabel}${when} · ${c.address.trim()}`,
    })
    // La réservation à prix figé remplace les devis en attente avec ce prestataire (lot 1, constat n° 2).
    await replacePendingOffers(supabase, c.userId, pro.id, tx.id, `${label}${when}`)
    trackEvent('mission_booked', { pro_id: proId, service_id: serviceId, subtotal_cents: subtotalCents })
    markFirstAction('reservation')
    notifyOther(tx.id, awaiting ? 'booking_request' : 'booking')
    return { txId: tx.id, awaiting }
  }

  async function goAfter(txId: string) {
    if (paymentsOn) {
      // Si le prestataire n'a pas encore de compte de paiement, la mission reste réservée et le
      // bouton « Payer » de l'écran suivant prendra le relais.
      const pay = await startCheckout(txId)
      if (pay.redirectUrl) { window.location.href = pay.redirectUrl; return }
    }
    // « Commande validée » : récapitulatif du paiement, puis « Serez-vous sur place ? » (maquette 18/11).
    router.push(`/mission/${txId}/commande`)
  }

  async function submit() {
    if (!validate()) return
    const chosenAddr = resolveAddress(profileAddress, addr)
    if ('error' in chosenAddr) return
    if (!pro || !mode || isDevis || missingService) return
    const items = buildPlan()
    if (!items.length) return
    setError(''); setResults(null)
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (user.id === pro.id) { setError('Vous ne pouvez pas réserver vos propres services.'); setCreating(false); return }
    // Coordonnées de l'adresse : servent au contrôle de vraisemblance du départ et au scan.
    const pos = await geocodeAddress(chosenAddr.address.trim()).catch(() => null)
    const c: RunCtx = { userId: user.id, address: chosenAddr.address, addrStatus: chosenAddr.status as 'profil' | 'a_valider', pos: pos ? { lat: pos.lat, lng: pos.lng } : null, plan: items }
    setRunCtx(c)
    const res: Result[] = []
    for (const it of items) {
      if (it.skip) { res.push({ idx: it.idx, label: it.label, status: 'skipped', msg: it.skip }); continue }
      const r = await createOne(c, it)
      res.push(r.txId ? { idx: it.idx, label: it.label, status: 'ok', txId: r.txId } : { idx: it.idx, label: it.label, status: 'fail', msg: r.error })
      if (r.txId && chosenAddr.saveToProfile) await supabase.from('profiles').update({ address: chosenAddr.address }).eq('id', user.id)
    }
    setCreating(false)
    finish(res, items.length === 1)
  }

  function finish(res: Result[], single: boolean) {
    const firstOk = res.find(r => r.status === 'ok')
    if (single) {
      if (firstOk?.txId) { goAfter(firstOk.txId); return }
      setError(res[0]?.msg || 'Impossible de créer la réservation.'); return
    }
    setResults(res)
    if (res.every(r => r.status === 'ok') && firstOk?.txId) goAfter(firstOk.txId)
    else try { document.getElementById('mn-results')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* rien */ }
  }

  // Réessaie une seule semaine : les autres réservations ne sont pas touchées.
  async function retryOne(idx: number) {
    const it = runCtx.plan.find(x => x.idx === idx)
    if (!it || !results) return
    setCreating(true)
    let item = it
    if (it.skip || !it.slot) {
      // Créneau pas publié au départ : on cherche à nouveau dans la liste (le prestataire a pu en ouvrir un).
      const base = new Date(runCtx.plan[0].slot?.starts_at ?? runCtx.plan[0].whenIso ?? '')
      base.setDate(base.getDate() + 7 * idx)
      const again = runCtx.plan[0].slot ? (slots ?? []).find(x => !x.transaction_id && new Date(x.starts_at).getTime() === base.getTime()) ?? null : null
      if (runCtx.plan[0].slot && !again) { setCreating(false); return }
      item = { ...it, slot: again, skip: undefined }
    }
    const r = await createOne(runCtx, item)
    setCreating(false)
    const next = results.map(x => x.idx !== idx ? x : r.txId ? { ...x, status: 'ok' as const, txId: r.txId, msg: undefined } : { ...x, status: 'fail' as const, msg: r.error })
    setResults(next)
    if (next.every(x => x.status === 'ok')) { const f = next.find(x => x.txId); if (f?.txId) goAfter(f.txId) }
  }

  const sectionTitle: React.CSSProperties = { font: '700 18px/1.5 Quicksand, sans-serif', color: '#123644', margin: '36px 0 14px' }
  const chip = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '10px 20px', borderRadius: 999, border: on ? '1px solid #123644' : '1px solid #CFDAD7', background: on ? '#123644' : '#fff', color: on ? '#fff' : '#123644', fontWeight: 600, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' })
  const card: React.CSSProperties = { marginBottom: 12 }
  // Étape repliée : la valeur déjà connue (venue de la carte ou du profil) en une ligne, « Modifier » la rouvre.
  const folded = (value: string, onOpen: (() => void) | null, what: string) => (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', minHeight: 56 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M5 12l5 5 9-10" /></svg>
      <span style={{ flex: 1, minWidth: 0, fontSize: 17, lineHeight: 1.5, fontWeight: 700, color: '#123644', overflowWrap: 'anywhere' }}>{value}</span>
      {onOpen && <button type="button" onClick={onOpen} aria-label={`Modifier : ${what}`} style={{ minHeight: 48, minWidth: 48, border: 'none', background: 'none', color: '#097A6C', fontWeight: 700, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>Modifier</button>}
    </div>
  )
  const svcLabel = article ? prestationName(article) : (pro ? (TRADES[pro.trade] || pro.trade) : '')
  const svcFolded = !openSvc && !!pricing && !missingService && (options.length <= 1 || !!serviceParam || !!tradeParam)
  const whenPrefilled = !!whenParam && (needsSlot ? !!chosen : !!wantedAt)
  const whenFolded = !openWhen && whenPrefilled
  const whenText = chosen ? `${dayLabel(chosen.starts_at)} à ${hhmm(chosen.starts_at)}` : wantedAt ? `${dayLabel(new Date(wantedAt).toISOString())} à ${hhmm(new Date(wantedAt).toISOString())}` : ''
  const addrFolded = !openAddr && !!profileAddress && addr.mode === 'profil'
  const nOk = results ? results.filter(r => r.status === 'ok').length : 0

  return (
    <div className="aere a-lift" style={{ minHeight: '100vh', background: '#fff' }}>
      <div style={{ padding: '10px 20px 12px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => router.back()} aria-label="Retour" style={{ color: '#123644', background: 'none', border: 'none', width: 44, height: 44, marginLeft: -12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644', margin: 0 }}>{proName ? `Réserver ${proName}` : 'Réserver'}</h1>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '4px 20px 24px', minHeight: 'calc(100vh - 110px)' }}>
        <div style={{ ...sectionTitle, marginTop: 16 }}>1. Prestation</div>
        {missingService && (
          <div style={{ padding: 16, borderRadius: 14, background: '#FFF4DD', fontSize: 15, color: '#7A4D00', marginBottom: 16, lineHeight: 1.55 }}>
            Cette prestation n&apos;est plus proposée par ce prestataire.{options.length > 1 ? ' Choisissez-en une autre ci-dessous.' : ''}
          </div>
        )}
        {svcFolded ? folded(`${svcLabel}${pricing ? ` · ${isDevis ? 'sur devis' : (pricingShort(pricing) ?? '')}` : ''}`, options.length > 1 ? () => setOpenSvc(true) : null, 'prestation') : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {options.map(o => {
              const on = !missingService && (o.id ?? null) === (article ? article.id : null)
              const photo = prestationPhotoUrl(o.photo_path)
              return (
                <button key={o.id ?? 'primary'} type="button" aria-pressed={on} onClick={() => { setSelId(o.id); setError('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, textAlign: 'left', padding: '14px 14px', borderRadius: 14, cursor: 'pointer', border: on ? '2px solid #12B39C' : '2px solid transparent', background: on ? 'rgba(18,179,156,.07)' : '#F6F9F8' }}>
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#F3F6F5' }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644' }}>{o.name}</span>
                    <span style={{ display: 'block', fontSize: 15, color: '#4E6470', marginTop: 2 }}>{pricingSummary(o.cols)}</span>
                  </span>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', whiteSpace: 'nowrap' }}>{pricingShort(o.cols) ?? ''}</span>
                </button>
              )
            })}
          </div>
        )}

        {isDevis ? (
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ padding: 18, borderRadius: 14, background: '#F6F9F8', fontSize: 16, color: '#123644', lineHeight: 1.6, marginBottom: 20 }}>
              <b>Prestation sur devis.</b> Pas de prix à l&apos;avance : décrivez votre besoin dans la conversation,
              le prestataire vous envoie un tarif que vous acceptez ou non. Rien n&apos;est réservé tant que vous
              n&apos;avez pas accepté son tarif.
            </div>
            {error && <p style={{ color: '#B3402F', fontSize: 15, marginBottom: 12 }}>{error}</p>}
            <button onClick={askQuote} disabled={devisBusy}
              style={{ width: '100%', minHeight: 54, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, padding: 15, borderRadius: 16, opacity: devisBusy ? 0.7 : 1 }}>
              {devisBusy ? 'Ouverture…' : 'Demander un devis'}
            </button>
          </div>
        ) : (<>
        <div style={sectionTitle}>2. Quand ? {proName && <span style={{ display: 'block', font: '500 15px/1.5 Inter, sans-serif', color: '#4E6470', marginTop: 4 }}>créneaux ouverts par {proName}</span>}</div>
        <div id={needsSlot ? 'mn-slot' : 'mn-date'}>
          {whenFolded ? folded(whenText, () => setOpenWhen(true), 'date et heure') : needsSlot ? (
            <div style={card}>
              <Calendar events={slotEvents} views={['week', 'day']} defaultView="week" initialDate={slotEvents[0]?.start} />
              <div style={{ fontSize: 15, color: chosen ? '#0B6F63' : '#4E6470', fontWeight: chosen ? 700 : 400, marginTop: 12 }}>
                {chosen ? `Créneau choisi : ${dayLabel(chosen.starts_at)} à ${hhmm(chosen.starts_at)}` : 'Touchez un créneau disponible publié par le prestataire.'}
              </div>
              {fieldErr?.field === 'slot' && !chosen && <p role="alert" style={{ color: '#B3402F', fontSize: 15, fontWeight: 600, margin: '8px 0 0' }}>{fieldErr.msg}</p>}
            </div>
          ) : (
            <div style={card}>
              <span style={{ fontSize: 16, color: '#123644', fontWeight: 600 }}>Date et heure souhaitées</span>
              <div style={{ marginTop: 12 }}><DayTimePicker value={wantedAt} onChange={v => { setWantedAt(v); if (fieldErr?.field === 'date') setFieldErr(null) }} /></div>
              {fieldErr?.field === 'date' && <p role="alert" style={{ color: '#B3402F', fontSize: 15, fontWeight: 600, margin: '8px 0 0' }}>{fieldErr.msg}</p>}
            </div>
          )}
        </div>

        <div style={sectionTitle}>3. Fréquence</div>
        <div style={card} data-step="frequence">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([['once', 'Une fois'], ['weekly', 'Chaque semaine (4 semaines)']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={(k === 'weekly') === weekly} onClick={() => { setWeekly(k === 'weekly'); setResults(null) }} style={chip((k === 'weekly') === weekly)}>{l}</button>
            ))}
          </div>
          {weekly && <p style={{ color: '#4E6470', fontSize: 15, lineHeight: 1.55, margin: '12px 0 0' }}>Même jour, même heure, pendant 4 semaines : une mission (et une facture) par passage. Les semaines où le créneau est déjà pris sont signalées.</p>}
        </div>

        <div style={sectionTitle}>4. Adresse</div>
        <div id="mn-addr">
          {addrFolded ? folded(`${profileAddress} (votre profil)`, () => setOpenAddr(true), 'adresse') : (
            <div style={card}>
              <AddressChoice profileAddress={profileAddress} value={addr} onChange={v => { setAddr(v); if (fieldErr?.field === 'addr') setFieldErr(null) }}
                error={fieldErr?.field === 'addr' ? fieldErr.msg : undefined} />
            </div>
          )}
        </div>

        {cesuEligible(serviceTrade) && (
          <>
            <div style={sectionTitle}>5. Paiement</div>
            <div style={card}>
              {cesuOk ? (<>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {([[false, 'Virement sur facture'], [true, 'Payer en CESU préfinancé']] as const).map(([v, l]) => (
                    <button key={String(v)} type="button" aria-pressed={payCesu === v} onClick={() => setPayCesu(v)} style={chip(payCesu === v)}>{l}</button>
                  ))}
                </div>
                <p style={{ color: '#4E6470', fontSize: 15, lineHeight: 1.55, margin: '12px 0 0' }}>
                  {payCesu ? `Vous remettez vos titres CESU (ou e-CESU) à ${pro?.company_name || 'votre prestataire'} ; vos frais de service PING se règlent par virement. ` : ''}
                  Service éligible au crédit d&apos;impôt de 50 % : vous le déclarez vous-même.
                </p>
              </>) : (
                <p style={{ color: '#4E6470', fontSize: 15, lineHeight: 1.55, margin: 0 }}>Virement sur facture : {pro?.company_name || 'ce prestataire'} n&apos;accepte pas le CESU préfinancé.</p>
              )}
            </div>
          </>
        )}

        <label style={{ display: 'block', marginTop: 36, marginBottom: 24 }}>
          <span style={{ fontSize: 16, color: '#123644', fontWeight: 600 }}>Description (facultatif)</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            style={{ display: 'block', width: '100%', marginTop: 10, border: '1.5px solid #CFDAD7', borderRadius: 14, padding: '14px 16px', fontSize: 16, lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </label>

        {hasFlat && hasHourly && !hasOvertime && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {(['forfait', 'horaire'] as const).map(t => (
              <button key={t} onClick={() => setMode(t)}
                style={{ flex: 1, minHeight: 56, padding: '12px 8px', borderRadius: 14, border: mode === t ? '2px solid #12B39C' : '2px solid transparent', background: mode === t ? 'rgba(18,179,156,.07)' : '#F6F9F8', fontWeight: 700, fontSize: 16, color: '#123644' }}>
                {t === 'forfait' ? `Forfait — ${EUR(pricing.base_price_cents)}` : `À l'heure — ${EUR(pricing.hourly_rate_cents)}/h`}
              </button>
            ))}
          </div>
        )}

        {hasOvertime && (
          <div style={{ padding: 16, borderRadius: 14, background: 'rgba(242,169,59,.12)', fontSize: 16, color: '#6F4F12', marginBottom: 24, lineHeight: 1.6 }}>
            Forfait de {EUR(pricing.base_price_cents)} incluant {pricing.included_hours} h. Au-delà,
            {' '}{EUR(pricing.hourly_rate_cents)}/h supplémentaire — ajusté automatiquement au scan de sortie selon la durée réelle.
          </div>
        )}

        {mode === 'horaire' && !hasOvertime && (
          <label id="mn-hours" style={{ display: 'block', marginBottom: 24 }}>
            <span style={{ fontSize: 16, color: '#123644', fontWeight: 600 }}>Durée estimée (heures) — ajustée au réel après le scan de sortie</span>
            <input type="number" value={estimatedHours} onChange={e => { setEstimatedHours(e.target.value); if (fieldErr?.field === 'hours') setFieldErr(null) }} min="0.5" step="0.5"
              style={{ display: 'block', width: '100%', minHeight: 52, marginTop: 10, border: '1.5px solid #CFDAD7', borderRadius: 14, padding: '12px 16px', fontSize: 16, boxSizing: 'border-box' }} />
            {fieldErr?.field === 'hours' && <span role="alert" style={{ display: 'block', color: '#B3402F', fontSize: 15, fontWeight: 600, marginTop: 6 }}>{fieldErr.msg}</span>}
          </label>
        )}

        {/* Prix figé : un seul montant à l'écran ; les montants envoyés en base ne changent pas. */}
        <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#123644' }}>Prix figé</span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644' }} data-testid="prix-un">{EUR(totalTtc)}</span>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: '#4E6470', marginTop: 8 }}>{totalTtc > 0 ? `${EUR(subtotalCents)} + frais de service PING ${EUR(buyerFee)}, facturés à part. ` : ''}Plus de renégociation après la confirmation.</div>
          {weekly && totalTtc > 0 && planOk > 0 && (
            <div data-testid="rep-total" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #D5E5E1', fontSize: 16, fontWeight: 700, color: '#123644' }}>
              {planOk} réservations de {EUR(totalTtc)} = total {EUR(totalTtc * planOk)}
            </div>
          )}
          {weekly && plan.filter(x => x.skip).map(x => (
            <div key={x.idx} style={{ marginTop: 8, fontSize: 15, color: '#6F4F12' }}>Semaine {x.idx + 1} ({x.label}) : {x.skip}</div>
          ))}
          {/* Paiement (ex-fenêtre PaymentPendingModal) : dit AVANT que le client valide, sans fenêtre. */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #D5E5E1', fontSize: 15, color: '#123644', lineHeight: 1.6 }}>
            {paymentsOn
              ? 'Paiement sécurisé par carte à l’étape suivante.'
              : <><b>Rien n&apos;est débité à la réservation.</b> Vous réglez après l&apos;intervention, sur facture, par virement : la prestation directement à {pro?.company_name || 'votre prestataire'}, vos frais de service à PING.{(hasOvertime || mode === 'horaire') ? ' Montant recalculé sur la durée réelle, relevée par les codes d’arrivée et de fin.' : ''}</>}
          </div>
          {AVANCE_IMMEDIATE_ACTIVE && pro?.sap_number && isEligible(pro?.trade) && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #D5E5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, color: '#0B6F63', fontWeight: 600 }}>Avec le crédit d&apos;impôt immédiat</span>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#0B8374' }}>{EUR(partClientCents(totalTtc))}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '4px 0', marginBottom: 24 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
          <span style={{ fontSize: 15, color: '#123644', lineHeight: 1.6 }}>
            {needsAccept && <><b>Le prestataire accepte votre réservation sous 24 h</b> (au plus tard 2 h avant le rendez-vous), sinon la réservation est annulée sans frais. </>}
            Annulation gratuite tant que le prestataire n'est pas en route — des frais s'appliquent au-delà. Pas satisfait ? Vous pouvez ouvrir une réclamation après la prestation.
          </span>
        </div>

        {error && <p role="alert" style={{ color: '#B3402F', fontSize: 15, marginBottom: 12 }}>{error}</p>}

        {results && (
          <div id="mn-results" role="status" style={{ ...card, background: '#FFF7ED', borderRadius: 16, padding: 18 }}>
            <b style={{ fontSize: 17, color: '#123644' }}>{nOk} réservation{nOk > 1 ? 's' : ''} envoyée{nOk > 1 ? 's' : ''} sur {results.length}</b>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#4E6470', margin: '6px 0 10px' }}>Chacune est indépendante : les réservations envoyées ne sont pas annulées.</p>
            {results.map(r => (
              <div key={r.idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid #F0DFC6', minHeight: 52 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.55, color: '#123644' }}>
                  <b>Semaine {r.idx + 1}</b> · {r.label}<br />
                  <span style={{ color: r.status === 'ok' ? '#097A6C' : '#8A5A00' }}>{r.status === 'ok' ? '✓ Envoyée' : r.status === 'skipped' ? `Non créée : ${r.msg}` : `Échec : ${r.msg || 'réessayez'}`}</span>
                </span>
                {r.status !== 'ok' && <button type="button" disabled={creating} onClick={() => retryOne(r.idx)} style={{ minHeight: 48, padding: '0 16px', borderRadius: 999, border: '1px solid #12B39C', background: '#fff', color: '#097A6C', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Réessayer</button>}
              </div>
            ))}
            {nOk > 0 && <button type="button" onClick={() => goAfter(results.find(r => r.txId)!.txId!)} style={{ width: '100%', minHeight: 48, marginTop: 8, border: 'none', background: 'none', color: '#097A6C', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Continuer vers la commande</button>}
          </div>
        )}

        {/* Bouton collant au-dessus de la barre du bas : jamais sous le pli (audit 19/11, correction 10). */}
        <div style={{ position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 20, margin: '0 -20px', padding: '12px 20px calc(12px + env(safe-area-inset-bottom, 0px))', background: '#fff', boxShadow: '0 -1px 0 #EEF2F1' }}>
          <button onClick={onConfirmClick} disabled={!pro || !mode || creating || paymentsOn === null || missingService || !!results} style={{ width: '100%', minHeight: 56, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, padding: 14, borderRadius: 16, opacity: creating || results ? 0.7 : (!chosen && !wantedAt) ? 0.55 : 1 }}>
            {creating ? 'Confirmation…' : weekly && planOk > 1 && totalTtc > 0 ? `Confirmer les ${planOk} réservations · ${EUR(totalTtc * planOk)}` : `Confirmer la réservation${totalTtc > 0 ? ` · ${EUR(totalTtc)}` : ''}`}
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
