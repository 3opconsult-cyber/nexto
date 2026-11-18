"use client"
import { useState, useEffect, useRef, Fragment } from 'react'
import DayTimePicker from '@/components/DayTimePicker'
import RequestDetails from '@/components/RequestDetails'
import AddressChoice, { resolveAddress, type AddressValue } from '@/components/AddressChoice'
import { maskAddress, addressUsable } from '@/lib/address'
import { useParams, useRouter } from 'next/navigation'
import { paymentsActive } from '@/lib/paymentsClient'
import { createClient } from '@/lib/supabase/client'
import { markRead } from '@/lib/unread'
import { notifyOther } from '@/lib/notify'
import DisputeFields, { createDispute, EMPTY_DISPUTE, type DisputeExtra } from '@/components/DisputeFields'
import ReviewModal from '@/components/ReviewModal'
import ClientReviewModal, { CLIENT_TAGS } from '@/components/ClientReviewModal'
import DepartureBar from '@/components/DepartureBar'
import MissionRecap from '@/components/MissionRecap'
import { filterMessage } from '@/lib/chatFilter'
import { getRates } from '@/lib/pricing'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import { geocodeAddress } from '@/lib/geocode'
import { systemSender, isSystemMessage } from '@/lib/systemMessage'
import { isTodayMission } from '@/lib/todayMission'
import { MissionSuivi } from '@/components/presence/MissionTimeline'
import { INSURANCE_REQUEST_BODY, INSURANCE_SENT_PREFIX, INSURANCE_LINK_DAYS, isInsuranceRequest, isInsuranceSent, insuranceLink, signMyInsurance } from '@/lib/insurance'
import { mentionsPrice } from '@/lib/priceMention'
import { REPORT_CATEGORIES, reportsAvailable, createReport } from '@/lib/reports'

// Repères de date dans le fil (façon WhatsApp) : se repérer dans une longue
// conversation sans tout dérouler depuis le haut (demande de Romain, 26/10).
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dayLabel(d: Date) {
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return "Aujourd'hui"
  if (sameDay(d, yesterday)) return 'Hier'
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface Msg {
  id: string
  sender_id: string | null
  body: string
  created_at: string
  kind: 'text' | 'offer'
  offer_cents: number | null
  offer_status: 'pending' | 'accepted' | 'declined' | null
  photo_path: string | null
  offer_hourly_cents: number | null
  offer_included_hours: number | null
}

// Valeur d'un <input type="datetime-local"> (heure locale, sans fuseau).
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const rdvLabel = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const SLOT_LABEL: Record<string, string> = { matin: 'le matin', 'apres-midi': "l'après-midi", soir: 'le soir', flexible: 'horaire flexible' }

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = params.id as string
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState('')
  const [warning, setWarning] = useState('')
  const [tx, setTx] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [reqAddr, setReqAddr] = useState<string | null>(null)
  const [myReview, setMyReview] = useState<{ stars: number; comment: string | null } | null>(null)
  const [counterpart, setCounterpart] = useState<string>('Conversation')
  const [editingPrice, setEditingPrice] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newHourly, setNewHourly] = useState('')
  const [newIncludedHours, setNewIncludedHours] = useState('')
  const [newAmountReason, setNewAmountReason] = useState('')
  const [newAmountPhoto, setNewAmountPhoto] = useState<File | null>(null)
  const [sendingOffer, setSendingOffer] = useState(false)
  const [offerErr, setOfferErr] = useState('')
  const [lastOfferCents, setLastOfferCents] = useState<number | null>(null)
  // Taux de commission du réglage (app_settings), pour le récapitulatif « Vous percevez » avant l'envoi.
  const [rates, setRates] = useState<{ buyer: number; seller: number } | null>(null)
  useEffect(() => { getRates().then(setRates).catch(() => {}) }, [])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [reporting, setReporting] = useState(false)
  // Lot 24 : « Signaler l'échange à PING » (privé, table reports, migration 043) distinct du litige.
  // 'choix' tant que le signalement existe en base ; sinon on ouvre directement le litige, comme avant.
  const [reportKind, setReportKind] = useState<'choix' | 'litige' | 'signalement'>('litige')
  const [reportsOn, setReportsOn] = useState(false)
  useEffect(() => { reportsAvailable(createClient()).then(setReportsOn).catch(() => {}) }, [])
  const [sigCat, setSigCat] = useState('')
  const [sigBody, setSigBody] = useState('')
  const [sigBusy, setSigBusy] = useState(false)
  const [sigErr, setSigErr] = useState('')
  const [sigSent, setSigSent] = useState(false)
  function openReporting() {
    setReportKind(reportsOn ? 'choix' : 'litige'); setSigSent(false); setSigErr(''); setReporting(true)
  }
  async function submitSignalement() {
    if (sigBusy) return
    if (!sigCat) { setSigErr('Choisissez un motif.'); return }
    if (!sigBody.trim()) { setSigErr('Décrivez ce qui s’est passé.'); return }
    setSigBusy(true); setSigErr('')
    const r = await createReport(createClient(), { transactionId, category: sigCat, body: sigBody })
    setSigBusy(false)
    if ('error' in r) { setSigErr(r.error); return }
    setSigSent(true); setSigCat(''); setSigBody('')
  }
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [askReview, setAskReview] = useState(false)
  // Côté prestataire : son avis sur le client (table client_reviews, migration 016).
  const [askClientReview, setAskClientReview] = useState(false)
  const [myClientReview, setMyClientReview] = useState<{ stars: number; is_public: boolean; comment: string | null; tags: string[]; private_note?: string | null } | null>(null)
  const [clientNotes, setClientNotes] = useState<{ note: string; created_at: string; transaction_id: string }[]>([])
  const [clientRating, setClientRating] = useState<{ avg: number; n: number } | null>(null)
  const [req, setReq] = useState<any>(null)
  const [rdvAddr, setRdvAddr] = useState('')
  // Adresse d'intervention : celle du profil du client par défaut, une autre est soumise au prestataire.
  const [myProfileAddr, setMyProfileAddr] = useState<string | null>(null)
  const [rdvChoice, setRdvChoice] = useState<AddressValue>({ mode: 'profil', other: '', confirmed: false })
  const [addrBusy, setAddrBusy] = useState(false)
  const [rdvAt, setRdvAt] = useState('')
  const [rdvSaving, setRdvSaving] = useState(false)
  const [rdvError, setRdvError] = useState('')
  const [reportError, setReportError] = useState('')
  const [reportExtra, setReportExtra] = useState<DisputeExtra>(EMPTY_DISPUTE)
  const [reportBusy, setReportBusy] = useState(false)
  // Paiement en ligne actif : l'adresse du client n'est montrée au prestataire qu'une fois payé.
  const [payOn, setPayOn] = useState(false)
  useEffect(() => { paymentsActive().then(setPayOn) }, [])
  // Attestation d'assurance transmise sur demande (lien signé 7 jours, jamais publique).
  const [insuranceBusy, setInsuranceBusy] = useState(false)
  const [insuranceMissing, setInsuranceMissing] = useState(false)
  const [insuranceErr, setInsuranceErr] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const meRef = useRef<string | null>(null)

  // Raccourcis depuis l'écran QR : ?signaler ouvre le signalement, ?avis l'avis (client, mission terminée).
  const shortcutDone = useRef(false)
  useEffect(() => {
    if (shortcutDone.current || !tx || !userId) return
    shortcutDone.current = true
    const q = new URLSearchParams(window.location.search)
    if (q.has('signaler')) { setReportKind('litige'); setReporting(true) }
    if (q.has('avis') && userId === tx.buyer_id && tx.completed_at) setAskReview(true)
    // ?devis=<prestation> (« Demander un devis » sur la fiche ou à la réservation) : message prérempli,
    // envoyé par le client lui-même, tant que le tarif n'est pas validé.
    const devis = q.get('devis')
    if (devis && userId === tx.buyer_id && !tx.price_confirmed) {
      setInput(`Bonjour, pourriez-vous me faire un devis pour « ${devis.slice(0, 80)} » ? `)
    }
    // ?tarif (« Proposer mon tarif » depuis une demande, carte prestataire) : ouvre le formulaire de tarif,
    // seulement tant que le prix n'est pas fixé (règle suprême du tarif).
    if (q.has('tarif') && userId === tx.seller_id && tx.status === 'pending' && !tx.price_confirmed) openOfferForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, userId])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setUserId(user.id); meRef.current = user.id }
      const { data } = await supabase.from('messages')
        .select('*').eq('transaction_id', transactionId).order('created_at')
      const loaded = (data ?? []) as Msg[]
      setMsgs(loaded)
      if (user) markRead(supabase, user.id, transactionId, loaded.length ? loaded[loaded.length - 1].created_at : null)
      resolvePhotoUrls(loaded)
      const { data: t } = await supabase.from('transactions')
        .select('*, requests(id, address, lat, lng, title, description, category, desired_date, desired_slot, budget_min_cents, budget_max_cents, frequency, hours_wanted, linen_kg, linen_types, household_size, surface_m2, payment_pref)')
        .eq('id', transactionId).single()
      setTx(t)
      if (!t) setMissing(true)
      if (t && user && user.id === t.buyer_id) {
        const { data: pr } = await supabase.from('profiles').select('address').eq('id', user.id).maybeSingle()
        setMyProfileAddr(pr?.address?.trim() || null)
      }
      if (t?.requests) setReq(t.requests)
      if (t?.requests?.address) { setReqAddr(t.requests.address); setRdvAddr(t.requests.address) }
      if (t?.scheduled_at) setRdvAt(toLocalInput(t.scheduled_at))
      if (t && user) {
        // profiles n'est lisible qu'en libre-service (RLS auth.uid() = id) : un
        // select direct sur l'id de l'autre partie ne renvoie rien — le nom passe
        // par une fonction dediee qui ne revele que le vrai interlocuteur.
        const { data: names } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: [t.id] })
        if (names?.[0]?.full_name) setCounterpart(names[0].full_name)

        // Mission terminee et pas encore notee par ce client : on demande son
        // avis ici, c'est l'ecran ou il atterrit apres le scan de sortie.
        if (user.id === t.buyer_id && t.buyer_id !== t.seller_id && ['completed', 'released'].includes(t.status)) {
          const { data: rev } = await supabase.from('reviews')
            .select('stars, comment')
            .eq('transaction_id', t.id).eq('rater_id', user.id).maybeSingle()
          if (rev) setMyReview(rev as any)
          else setAskReview(true)
        }
        if (user.id === t.seller_id && t.buyer_id !== t.seller_id) {
          // Note publique du client (avis des autres prestataires), pour se faire une idée.
          const { data: pub, error: crErr } = await supabase.from('client_reviews').select('stars').eq('client_id', t.buyer_id).eq('is_public', true)
          if (!crErr && pub?.length) setClientRating({ avg: pub.reduce((a: number, r: any) => a + r.stars, 0) / pub.length, n: pub.length })
          // Mes notes personnelles sur ce client (table client_private_notes, RLS prestataire seul).
          const { data: notes, error: nErr } = await supabase.from('client_private_notes').select('note, created_at, transaction_id')
            .eq('seller_id', user.id).eq('client_id', t.buyer_id).order('created_at', { ascending: false }).limit(5)
          if (!nErr && notes) setClientNotes(notes as any)
          if (!crErr && ['completed', 'released'].includes(t.status)) {
            const { data: mine } = await supabase.from('client_reviews').select('stars, is_public, comment, tags')
              .eq('transaction_id', t.id).eq('rater_id', user.id).maybeSingle()
            if (mine) setMyClientReview(mine as any)
            else setAskClientReview(true)
          }
        }
      }
    }
    init()

    async function resolvePhotoUrls(list: Msg[]) {
      const withPhoto = list.filter(m => m.photo_path)
      for (const m of withPhoto) {
        const { data } = await supabase.storage.from('offer-photos').createSignedUrl(m.photo_path as string, 3600)
        if (data?.signedUrl) setPhotoUrls(prev => ({ ...prev, [m.id]: data.signedUrl }))
      }
    }

    const channel = supabase.channel(`chat:${transactionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transactionId}` },
        payload => {
          const m = payload.new as Msg
          setMsgs(prev => [...prev, m])
          // Conversation ouverte : le message de l'autre est lu à l'instant.
          if (meRef.current && m.sender_id !== meRef.current) markRead(supabase, meRef.current, transactionId, m.created_at)
          if (m.photo_path) resolvePhotoUrls([m])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transactionId}` },
        payload => setMsgs(prev => prev.map(m => m.id === payload.new.id ? payload.new as Msg : m)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [transactionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim() || !userId) return
    const result = filterMessage(input)
    if (result.blocked) {
      setWarning(`Message filtré : ${result.reasons.join(', ')} interdits hors plateforme.`)
      setTimeout(() => setWarning(''), 4000)
    }
    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({
      transaction_id: transactionId,
      sender_id: userId,
      body: result.clean,
    })
    if (error) { setWarning('Message non envoyé — vérifiez votre connexion et réessayez.'); setTimeout(() => setWarning(''), 4000); return }
    notifyOther(transactionId, 'message')
    setInput('')
  }

  // Client : demande l'attestation d'assurance du prestataire (message dans le fil + e-mail).
  async function requestInsurance() {
    if (!tx || !userId || insuranceBusy) return
    setInsuranceBusy(true); setInsuranceErr('')
    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)), body: INSURANCE_REQUEST_BODY,
    })
    setInsuranceBusy(false)
    if (error) { setInsuranceErr('Demande non envoyée — réessayez.'); return }
    notifyOther(tx.id, 'message')
  }

  // Prestataire : transmet SA pièce d'assurance par un lien signé de 7 jours (créé par lui, propriétaire).
  async function transmitInsurance() {
    if (!tx || !userId || insuranceBusy) return
    setInsuranceBusy(true); setInsuranceErr(''); setInsuranceMissing(false)
    const supabase = createClient()
    const res = await signMyInsurance(supabase, userId)
    if ('missing' in res) { setInsuranceBusy(false); setInsuranceMissing(true); return }
    if ('error' in res) { setInsuranceBusy(false); setInsuranceErr(res.error); return }
    const until = res.until.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    const { error } = await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: `${INSURANCE_SENT_PREFIX} (lien valable ${INSURANCE_LINK_DAYS} jours, jusqu’au ${until}) : ${res.url}`,
    })
    setInsuranceBusy(false)
    if (error) { setInsuranceErr('Attestation non transmise — réessayez.'); return }
    notifyOther(tx.id, 'message')
  }

  async function proposeOffer() {
    const cents = Math.round(Number(newAmount || 0) * 100)
    if (!cents || cents <= 0 || !userId) return
    // Règle suprême du tarif : une fois le prix validé, plus de proposition (seul un litige le rouvre).
    if (tx?.price_confirmed) { setOfferErr('Le tarif est déjà validé : il ne peut plus être modifié.'); return }
    // Heures incluses sans tarif de dépassement : elles étaient jetées sans prévenir.
    if (newIncludedHours && !(Number(newHourly) > 0)) {
      setOfferErr('Indiquez le tarif horaire appliqué au-delà des heures incluses, ou videz « Heures incluses ».')
      return
    }
    // Garde-fou contre une saisie à la suite (ex. « 3030 € ») : nettement au-dessus du budget du client.
    const ref = offerReference()
    if (ref && cents > 2 * ref.cents && !confirm(`Vous proposez ${EUR(cents)}, soit plus de 2 fois ${ref.label} (${EUR(ref.cents)}). Envoyer quand même ?`)) return
    setOfferErr('')
    setSendingOffer(true)
    const supabase = createClient()

    let photoPath: string | null = null
    if (newAmountPhoto) {
      const ext = newAmountPhoto.name.split('.').pop()
      const path = `${transactionId}/${userId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('offer-photos').upload(path, newAmountPhoto)
      if (!upErr) photoPath = path
    }

    const hourlyCents = newHourly ? Math.round(Number(newHourly) * 100) : null
    const includedHoursNum = (hourlyCents && newIncludedHours) ? Number(newIncludedHours) : null

    const { error: offerErr } = await supabase.from('messages').insert({
      transaction_id: transactionId,
      sender_id: userId,
      kind: 'offer',
      offer_cents: cents,
      offer_hourly_cents: hourlyCents,
      offer_included_hours: includedHoursNum,
      offer_status: 'pending',
      photo_path: photoPath,
      body: newAmountReason.trim() || (tx.subtotal_cents > 0 ? `Nouveau tarif proposé (au lieu de ${EUR(tx.subtotal_cents)})` : 'Proposition de tarif'),
    })
    if (offerErr) {
      setSendingOffer(false)
      setWarning('Proposition non envoyée — réessayez.'); setTimeout(() => setWarning(''), 4000)
      return
    }

    notifyOther(transactionId, 'offer')
    setEditingPrice(false)
    setNewAmount('')
    setNewHourly('')
    setNewIncludedHours('')
    setNewAmountReason('')
    setNewAmountPhoto(null)
    setSendingOffer(false)
  }

  // Repère pour le formulaire de tarif : le budget du client s'il en a donné un, sinon le prix de base.
  function offerReference(): { cents: number; label: string } | null {
    const max = req?.budget_max_cents || req?.budget_min_cents
    if (max > 0) return { cents: max, label: 'le budget du client' }
    if (tx?.subtotal_cents > 0) return { cents: tx.subtotal_cents, label: 'le prix de départ' }
    return null
  }
  function openOfferForm() {
    setLastOfferCents(null)
    setNewAmount(''); setNewHourly(''); setNewIncludedHours(''); setNewAmountReason(''); setNewAmountPhoto(null); setOfferErr('')
    setEditingPrice(true)
  }

  async function acceptOffer(m: Msg) {
    if (!m.offer_cents) return
    if (tx?.price_confirmed) return
    const cents = m.offer_cents
    const rates = await getRates()
    const buyerFee = Math.round(cents * rates.buyer)
    const sellerFee = Math.round(cents * rates.seller)
    // Forfait + depassement si la proposition porte un tarif de depassement ;
    // sinon prix sec, comme avant (efface toute structure de depassement
    // heritee d'une proposition precedente).
    const hasOvertime = m.offer_hourly_cents != null && m.offer_included_hours != null
    // Tarif horaire seul (sans heures incluses) : le montant est une estimation, la facture suit
    // les heures réellement passées au scan de fin.
    const hourlyOnly = m.offer_hourly_cents != null && m.offer_included_hours == null
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('transactions').update({
      subtotal_cents: cents,
      buyer_fee_cents: buyerFee,
      seller_fee_cents: sellerFee,
      total_charged_cents: cents + buyerFee,
      payout_cents: cents - sellerFee,
      price_confirmed: true,
      hourly_rate_cents: (hasOvertime || hourlyOnly) ? m.offer_hourly_cents : null,
      included_hours: hasOvertime ? m.offer_included_hours : null,
      base_forfait_cents: hasOvertime ? cents : null,
    }).eq('id', transactionId).select().single()
    if (error || !updated) {
      setWarning('Acceptation non enregistrée — réessayez.'); setTimeout(() => setWarning(''), 4000)
      return
    }
    {
      setTx(updated)
      await supabase.from('messages').update({ offer_status: 'accepted' }).eq('id', m.id)
      setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, offer_status: 'accepted' } : x))
    }
  }

  async function declineOffer(m: Msg) {
    const supabase = createClient()
    await supabase.from('messages').update({ offer_status: 'declined' }).eq('id', m.id)
    setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, offer_status: 'declined' } : x))
  }

  const [cancelling, setCancelling] = useState(false)
  // Annulation façon Uber : gratuite tant que le prestataire n'a pas annoncé
  // son départ ; des frais s'appliquent une fois en route (il a déjà engagé du
  // temps/trajet) ; impossible une fois arrivé (QR scanné) — ça, c'est un
  // litige, pas une annulation. Les frais restent déclaratifs (pas de
  // prélèvement réel tant que Stripe n'est pas branché), comme le reste du
  // séquestre simulé.
  async function cancelMission() {
    if (!tx || !userId) return
    const isBuyer = userId === tx.buyer_id
    // Les frais d'annulation tardive ne concernent que le client (le prestataire s'est déplacé).
    const late = !!tx.en_route_at && isBuyer
    const feeCents = late ? Math.round((tx.subtotal_cents || 0) * 0.15) : 0
    const what = tx.price_confirmed ? 'cette réservation' : 'cette demande'
    const confirmMsg = late
      ? `Le prestataire est déjà en route : des frais d'annulation de ${EUR(feeCents)} s'appliquent. Annuler quand même ?`
      : isBuyer || !tx.en_route_at
        ? `Annuler ${what} ? Cette action est définitive.`
        : 'Vous avez annoncé votre départ : le client sera prévenu de l\u2019annulation. Annuler quand même ?'
    if (!confirm(confirmMsg)) return
    setCancelling(true)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('transactions')
      .update({ status: 'cancelled' }).eq('id', tx.id).select().maybeSingle()
    if (!error && updated) {
      setTx(updated)
      // Paiement en ligne actif : remboursement (moins les frais d'annulation tardive). Sans effet sinon.
      if (await paymentsActive()) {
        fetch('/api/payments/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: tx.id, motif: 'Annulation' }) }).catch(() => {})
      }
      const who = userId === updated.buyer_id ? 'le client' : 'le prestataire'
      const feeNote = late ? ` — frais d'annulation tardive : ${EUR(feeCents)} (appliqués dès le paiement en ligne actif)` : ''
      await supabase.from('messages').insert({
        transaction_id: tx.id, ...(await systemSender(supabase)),
        body: `✕ ${tx.price_confirmed ? 'Réservation' : 'Demande'} annulée par ${who}${feeNote}.`,
      })
    }
    setCancelling(false)
  }

  async function counterOffer(m: Msg) {
    await declineOffer(m)
    // Montant vide (une saisie à la suite du prix prérempli donnait « 3030 € ») : la proposition
    // précédente reste lisible dans le fil et en indication dans le champ.
    setLastOfferCents(m.offer_cents || null)
    setOfferErr('')
    setNewAmount('')
    setNewHourly(m.offer_hourly_cents ? String(m.offer_hourly_cents / 100) : '')
    setNewIncludedHours(m.offer_included_hours != null ? String(m.offer_included_hours) : '')
    setNewAmountReason('')
    setNewAmountPhoto(null)
    setEditingPrice(true)
  }

  // Après accord sur le prix, le client donne l'adresse et l'heure du rendez-vous (une conversation
  // ouverte depuis la carte n'en a pas encore) : sans elles, le prestataire ne peut pas venir.
  async function saveRdv() {
    if (!tx || !rdvAt) { setRdvError('Choisissez la date et l\u2019heure.'); return }
    const chosenAddr = resolveAddress(myProfileAddr, rdvChoice)
    if ('error' in chosenAddr) { setRdvError(chosenAddr.error as string); return }
    const when = new Date(rdvAt)
    if (isNaN(when.getTime())) { setRdvError('Date invalide.'); return }
    setRdvSaving(true); setRdvError('')
    const supabase = createClient()
    const addr = chosenAddr.address
    if (chosenAddr.saveToProfile && userId) { await supabase.from('profiles').update({ address: addr }).eq('id', userId); setMyProfileAddr(addr) }
    if (req?.id && addr !== reqAddr) {
      const pos = await geocodeAddress(addr).catch(() => null)
      const { error } = await supabase.from('requests')
        .update({ address: addr, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }).eq('id', req.id)
      if (error) { setRdvSaving(false); setRdvError('Adresse non enregistrée — réessayez.'); return }
      setReqAddr(addr)
      setReq((r: any) => ({ ...r, address: addr, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }))
      setTx((t: any) => ({ ...t, requests: { ...(t.requests || {}), address: addr, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) } }))
    }
    const { data: upd, error: txErr } = await supabase.from('transactions')
      .update({ scheduled_at: when.toISOString(), address_status: chosenAddr.status }).eq('id', tx.id).select().maybeSingle()
    if (txErr || !upd) { setRdvSaving(false); setRdvError('Date non enregistrée — réessayez.'); return }
    setTx((t: any) => ({ ...t, scheduled_at: upd.scheduled_at, address_status: upd.address_status }))
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: chosenAddr.status === 'a_valider'
        ? `✓ Rendez-vous proposé : ${rdvLabel(upd.scheduled_at)} — autre adresse à valider par le prestataire : ${maskAddress(addr)}`
        : `✓ Rendez-vous fixé : ${rdvLabel(upd.scheduled_at)} — adresse transmise au prestataire`,
    })
    setRdvSaving(false)
  }

  // Le prestataire accepte ou refuse une adresse différente de celle du profil du client.
  async function answerAddress(ok: boolean) {
    if (!tx) return
    setAddrBusy(true)
    const supabase = createClient()
    const { data: upd, error } = await supabase.from('transactions').update({ address_status: ok ? 'acceptee' : 'refusee' }).eq('id', tx.id).select().maybeSingle()
    setAddrBusy(false)
    if (error || !upd) { setWarning('Réponse non enregistrée — réessayez.'); setTimeout(() => setWarning(''), 4000); return }
    setTx((t: any) => ({ ...t, address_status: upd.address_status }))
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: ok ? '✓ Adresse d’intervention acceptée par le prestataire' : '✕ Adresse d’intervention refusée par le prestataire : le client en propose une autre',
    })
  }

  async function submitReport() {
    if (!userId || reportBusy) return
    if (!reportExtra.category) { setReportError('Choisissez un motif.'); return }
    if (!reportReason.trim()) { setReportError('Décrivez ce qui ne va pas.'); return }
    const supabase = createClient()
    setReportError(''); setReportBusy(true)
    // Motif, montant réclamé et photos (DisputeFields) ; la date cible de réponse (48 h) est posée par la base.
    const created = await createDispute(supabase, { transactionId, userId, reason: reportReason.trim(), extra: reportExtra })
    setReportBusy(false)
    const dsp = 'error' in created ? null : { id: created.id }
    const error = 'error' in created ? created.error : null
    if (error || !dsp) { setReportError(error ?? 'Le litige n\u2019a pas pu être enregistré. Réessayez, ou écrivez à info@opconsult.co.'); return }
    // Le litige a son propre fil (comme Airbnb) : le motif en est le premier message.
    await supabase.from('dispute_messages').insert({ dispute_id: dsp.id, sender_id: userId, body: reportReason.trim(), kind: 'text' })
    await supabase.from('messages').insert({
      transaction_id: transactionId, ...(await systemSender(supabase)),
      body: 'Litige ouvert sur cette mission : la discussion continue dans le dossier du litige.',
    })
    notifyOther(transactionId, 'dispute')
    setReportReason(''); setReportExtra(EMPTY_DISPUTE)
    router.push(`/litiges/${dsp.id}`)
  }

  // Lien vers une mission supprimée ou qui ne concerne pas ce compte : pas de chat vide trompeur.
  if (missing) return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 22, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', margin: 0 }}>Mission introuvable</h2>
        <p style={{ fontSize: 13, color: '#4E6470', marginTop: 6, lineHeight: 1.55 }}>Cette mission n&apos;existe plus ou ne vous concerne pas.</p>
        <a href="/messages" style={{ display: 'inline-block', marginTop: 12, color: '#0C8F7E', fontWeight: 700, fontSize: 13 }}>Ouvrir mes messages</a>
      </div>
    </div>
  )

  // Mission au prix déjà fixé (devis accepté ou réservation directe) : aucune offre ne s'accepte plus.
  const priceLocked = !!tx?.price_confirmed
  // Devis refusé automatiquement par une réservation directe (mission/new) chez le même prestataire.
  const replacedAfter = (m: Msg) => msgs.some(x => isSystemMessage(x) && x.body?.startsWith('Proposition remplacée') && x.created_at >= m.created_at)
  const budgetHint = (() => {
    const lo = req?.budget_min_cents, hi = req?.budget_max_cents
    const f = (c: number) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    if (lo > 0 && hi > 0 && lo !== hi) return `Budget du client : ${f(lo)}–${f(hi)} €`
    if (hi > 0 || lo > 0) return `Budget du client : ${f(hi || lo)} €`
    return ''
  })()
  const amountPlaceholder = lastOfferCents
    ? `Proposition précédente : ${EUR(lastOfferCents)}`
    : budgetHint || (tx?.subtotal_cents > 0 ? `Prix de départ : ${EUR(tx.subtotal_cents)}` : 'Montant en euros')
  // Demande d'attestation en attente : une demande du client sans transmission postée après elle.
  const lastInsReq = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (isSystemMessage(msgs[i]) && isInsuranceRequest(msgs[i].body)) return i; return -1 })()
  const insurancePending = lastInsReq >= 0 && !msgs.slice(lastInsReq + 1).some(m => isSystemMessage(m) && isInsuranceSent(m.body) && m.sender_id === tx?.seller_id)
  const txOpen = !!tx && tx.status !== 'cancelled'
  // Prix écrit dans un message alors qu'aucun tarif n'est validé : rappel sous le dernier message concerné.
  const priceHintId = (() => {
    if (!tx || tx.price_confirmed || tx.status !== 'pending') return null
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.kind !== 'offer' && !isSystemMessage(m) && mentionsPrice(m.body)) return m.id
    }
    return null
  })()
  const hoursWithoutRate = !!newIncludedHours && Number(newIncludedHours) > 0 && !(Number(newHourly) > 0)
  const offerRecap = (() => {
    const cents = Math.round(Number(newAmount || 0) * 100)
    if (!(cents > 0) || !rates || !tx) return ''
    const hourly = Number(newHourly) > 0 ? Math.round(Number(newHourly) * 100) : null
    const hours = hourly && Number(newIncludedHours) > 0 ? Number(newIncludedHours) : null
    const total = cents + Math.round(cents * rates.buyer)
    const payout = cents - Math.round(cents * rates.seller)
    const shape = hourly && hours != null
      ? ` · ${hours} h incluse${hours > 1 ? 's' : ''}, puis ${EUR(hourly)}/h au-delà`
      : hourly ? ` · estimation, facturé ${EUR(hourly)}/h selon le temps réel` : ''
    return userId === tx.seller_id
      ? `Le client paie ${EUR(total)} · Vous percevez ${EUR(payout)} après commission PING${shape}`
      : `Vous paierez ${EUR(total)}, frais de service inclus${shape}`
  })()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      {/* Header — style /demo v_chat */}
      <div className="ping-chatbar">
        <div className="ic" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer' }} onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <b style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {counterpart}
          {clientRating && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, fontWeight: 700, color: '#8a6520', marginLeft: 8 }}>★ {clientRating.avg.toFixed(1).replace('.', ',')} ({clientRating.n})</span>}
        </b>
        {tx && tx.subtotal_cents > 0 && (
          <span style={{ padding: '6px 11px', borderRadius: 999, background: 'var(--paper)', color: 'var(--slate)', fontSize: 11.5, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {EUR(tx.subtotal_cents)}{tx.price_confirmed ? '' : ' · à valider'}
          </span>
        )}
        <button onClick={openReporting} title="Signaler cet échange" style={{ border: 'none', background: 'none', padding: 4, display: 'flex', flexShrink: 0, cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2"><path d="M5 3v18" /><path d="M5 4h11l-1.5 4L16 12H5" /></svg>
        </button>
      </div>

      {tx && tx.buyer_id === tx.seller_id && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(229,72,77,.08)', color: '#C0503A', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          Mission de test invalide : vous êtes à la fois le client et le prestataire. Elle ne correspond à aucun vrai parcours et sera supprimée.
        </div>
      )}

      {/* Notes personnelles du prestataire sur ce client (jamais visibles du client). */}
      {tx && userId === tx.seller_id && clientNotes.length > 0 && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: '#fff', border: '1.5px solid #DCE5E3' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Vos notes personnelles sur ce client · visibles de vous seul
          </div>
          {clientNotes.map((n, i) => (
            <p key={i} style={{ fontSize: 13, color: '#3d5560', lineHeight: 1.5, margin: i ? '6px 0 0' : 0 }}>
              {n.note}
              <span style={{ color: '#6E8592', fontSize: 11 }}> · {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </p>
          ))}
        </div>
      )}

      {/* Récapitulatif complet (contrat, durée, montants, avis, litige, factures), des deux côtés. */}
      {tx && userId && tx.buyer_id !== tx.seller_id && (
        <MissionRecap tx={tx} userId={userId} counterpart={counterpart}
          address={userId === tx.buyer_id || ((!payOn || ['held', 'released'].includes(tx.payment_status)) && addressUsable(tx.address_status)) ? reqAddr : null}
          refreshKey={`${myReview?.stars ?? ''}-${myClientReview?.stars ?? ''}-${myClientReview?.is_public ?? ''}-${reportSent}`} />
      )}

      {/* Le prestataire annonce son depart ; le client suit l'approche. */}
      {tx && userId && (
        <DepartureBar tx={tx} userId={userId} onChange={setTx}
          address={(userId === tx.buyer_id || ((!payOn || ['held', 'released'].includes(tx.payment_status)) && addressUsable(tx.address_status))) ? reqAddr : null}
          confirmed={!!tx && !!tx.price_confirmed} />
      )}

      {/* Récapitulatif de la demande : ce que le client a demandé, visible des deux côtés. */}
      {tx && req && (req.title || req.description || req.desired_date || req.budget_max_cents || req.budget_min_cents) && (
        <div style={{ margin: '10px 16px 0', background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Demande{req.category ? ` · ${TRADES[req.category] || req.category}` : ''}
          </div>
          {req.title && <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', marginTop: 2 }}>{req.title}</div>}
          {req.description && <div style={{ fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, marginTop: 3 }}>{req.description}</div>}
          <div style={{ marginTop: 6 }}><RequestDetails request={req} compact /></div>
          <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>
            {[
              req.desired_date ? `Souhaité le ${new Date(req.desired_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${req.desired_slot ? `, ${SLOT_LABEL[req.desired_slot] || req.desired_slot}` : ''}` : null,
              (req.budget_min_cents || req.budget_max_cents) ? `Budget ${req.budget_min_cents ? EUR(req.budget_min_cents) : ''}${req.budget_min_cents && req.budget_max_cents ? ' – ' : ''}${req.budget_max_cents ? EUR(req.budget_max_cents) : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}

      {/* Autre adresse proposée par le client : le prestataire la voit sans le numéro et l'accepte ou non. */}
      {tx && userId === tx.seller_id && tx.address_status === 'a_valider' && reqAddr && !['cancelled', 'completed', 'released'].includes(tx.status) && (
        <div style={{ margin: '10px 16px 0', background: '#fff', border: '1.5px solid #F2A93B', borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Adresse d&apos;intervention à valider</div>
          <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 8px', lineHeight: 1.5 }}>Le client demande une intervention ailleurs qu&apos;à l&apos;adresse de son profil. Le numéro vous est transmis si vous acceptez.</p>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#123644', marginBottom: 10 }}>{maskAddress(reqAddr)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => answerAddress(true)} disabled={addrBusy} style={{ flex: 1, padding: 11, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Accepter</button>
            <button onClick={() => answerAddress(false)} disabled={addrBusy} style={{ flex: 1, padding: 11, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, cursor: 'pointer' }}>Refuser</button>
          </div>
        </div>
      )}
      {tx && userId === tx.buyer_id && tx.address_status === 'a_valider' && !['cancelled', 'completed', 'released'].includes(tx.status) && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(242,169,59,.12)', color: '#8a6520', fontSize: 12.5, fontWeight: 600 }}>
          Adresse d&apos;intervention en attente de validation par le prestataire.
        </div>
      )}

      {/* Rendez-vous : le client complète l'adresse et l'heure dès que le tarif est validé. */}
      {tx && userId && tx.price_confirmed && !['cancelled', 'completed', 'released'].includes(tx.status) && (
        (!reqAddr || !tx.scheduled_at || tx.address_status === 'refusee') ? (
          userId === tx.buyer_id ? (
            <div style={{ margin: '10px 16px 0', background: '#fff', border: '1.5px solid #12B39C', borderRadius: 14, padding: 14 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Fixez le rendez-vous</div>
              <p style={{ fontSize: 12, color: '#4E6470', margin: '3px 0 10px', lineHeight: 1.5 }}>Le tarif est validé. L&apos;adresse n&apos;est transmise qu&apos;au prestataire de cette mission.</p>
              {tx.address_status === 'refusee' && (
                <p style={{ fontSize: 12.5, color: '#C0503A', fontWeight: 600, margin: '0 0 10px' }}>Le prestataire n&apos;intervient pas à l&apos;adresse proposée : choisissez-en une autre.</p>
              )}
              <div style={{ marginBottom: 12 }}><AddressChoice profileAddress={myProfileAddr} value={rdvChoice} onChange={setRdvChoice} /></div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5 }}>Date et heure</label>
              <div style={{ marginTop: 6 }}><DayTimePicker value={rdvAt} onChange={setRdvAt} /></div><div style={{ height: 10 }} />
              {rdvError && <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 8px' }}>{rdvError}</p>}
              <button onClick={saveRdv} disabled={rdvSaving} style={{ width: '100%', padding: 12, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: rdvSaving ? 0.7 : 1 }}>
                {rdvSaving ? 'Enregistrement…' : 'Confirmer le rendez-vous'}
              </button>
              <button onClick={() => router.push(`/mission/${tx.id}/jour`)} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                Mes codes QR (arrivée et fin)
              </button>
            </div>
          ) : (
            <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(242,169,59,.12)', color: '#8a6520', fontSize: 12.5, fontWeight: 600 }}>
              Tarif validé — en attente de l&apos;adresse et de l&apos;heure du rendez-vous par le client.
            </div>
          )
        ) : (
          <div style={{ margin: '10px 16px 0', background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#123644', fontWeight: 600 }}>Rendez-vous {rdvLabel(tx.scheduled_at)}</span>
              {/* Billet de mission : accès rapide à l'écran « Mission du jour » (QR / scanner / client absent / fin). */}
              {!tx.completed_at && (
                <button onClick={() => router.push(`/mission/${tx.id}/jour`)} style={{ border: 'none', background: '#0C8F7E', color: '#fff', borderRadius: 999, padding: '0 14px', minHeight: 44, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {isTodayMission(tx) ? 'Mission du jour' : userId === tx.buyer_id ? 'Mes codes QR' : 'Voir la mission'}
                </button>
              )}
            </div>
            {/* Frise de suivi (lot 30) : Confirmée → En route → Sur place → Terminée → Facturée. */}
            <div style={{ marginTop: 8 }}><MissionSuivi tx={tx} compact /></div>
          </div>
        )
      )}

      {/* Mission terminée : la frise reste visible, toutes étapes cochées (la facture est posée à la fin). */}
      {tx && tx.price_confirmed && ['completed', 'released'].includes(tx.status) && (
        <div style={{ margin: '10px 16px 0', background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px' }}>
          <MissionSuivi tx={tx} compact />
        </div>
      )}

      {/* Mission terminée : la facture est dans le récapitulatif ci-dessus (bouton « Voir les factures »). */}

      {/* Annulation façon Uber : gratuite avant le départ du prestataire, payante
          une fois en route, impossible une fois arrivé (QR scanné — passe alors
          par un litige, pas une annulation). Rend réelle la promesse affichée à
          la réservation (mission/new) plutôt que de la laisser sans mécanisme. */}
      {tx && userId && !tx.arrived_at && !['cancelled', 'completed', 'released'].includes(tx.status) && (
        <div style={{ padding: '8px 16px', textAlign: 'center' }}>
          <button onClick={cancelMission} disabled={cancelling} style={{ border: 'none', background: 'none', color: tx.en_route_at ? '#c0503a' : '#6E8592', fontSize: 11.5, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
            {cancelling ? 'Annulation…' : (tx.en_route_at && userId === tx.buyer_id) ? 'Annuler (frais applicables)' : tx.price_confirmed ? 'Annuler cette réservation' : 'Annuler cette demande'}
          </button>
        </div>
      )}
      {tx && tx.status === 'cancelled' && (
        <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#6E8592' }}>
          {tx.price_confirmed ? 'Réservation annulée' : 'Demande annulée'}
        </div>
      )}

      {tx && userId && (
        <ReviewModal
          open={askReview}
          onClose={() => setAskReview(false)}
          transactionId={tx.id}
          raterId={userId}
          rateeId={tx.seller_id}
          proName={counterpart}
          onSubmitted={(r) => setMyReview(r)}
        />
      )}

      {tx && userId && userId === tx.seller_id && (
        <ClientReviewModal
          open={askClientReview}
          onClose={() => setAskClientReview(false)}
          transactionId={tx.id}
          raterId={userId}
          clientId={tx.buyer_id}
          clientName={counterpart}
          onSubmitted={(r) => setMyClientReview(r)}
        />
      )}

      {reporting && (
        <div onClick={() => setReporting(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto' }}>
            {reportKind === 'choix' ? (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Signaler</h3>
                <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>Que souhaitez-vous faire ?</p>
                <button type="button" onClick={() => setReportKind('signalement')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: '1px solid #DCE5E3', background: '#fff', marginBottom: 10, cursor: 'pointer' }}>
                  <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 14.5, color: '#123644' }}>Signaler l&apos;échange à PING</b>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#4E6470', marginTop: 3, lineHeight: 1.45 }}>Propos déplacés, coordonnées partagées, demande suspecte. Privé : seul PING le lit, l&apos;autre personne n&apos;est pas prévenue.</span>
                </button>
                <button type="button" onClick={() => setReportKind('litige')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: '1px solid #DCE5E3', background: '#fff', marginBottom: 6, cursor: 'pointer' }}>
                  <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 14.5, color: '#123644' }}>Ouvrir un litige sur la prestation</b>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#4E6470', marginTop: 3, lineHeight: 1.45 }}>Prestation non réalisée, qualité, retard, montant. Visible des deux parties, qui ont 48 h pour répondre.</span>
                </button>
              </>
            ) : reportKind === 'signalement' ? (
              sigSent ? (
                <>
                  <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 6 }}>Signalement transmis</h3>
                  <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14, lineHeight: 1.5 }}>Merci. L&apos;équipe PING l&apos;examine ; l&apos;autre personne n&apos;en est pas informée. Si la prestation elle-même pose problème, vous pouvez aussi ouvrir un litige.</p>
                  <button onClick={() => { setReporting(false); setSigSent(false) }} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>Fermer</button>
                </>
              ) : (
                <>
                  <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Signaler l&apos;échange à PING</h3>
                  <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 12 }}>Privé : seul PING lit ce signalement.</p>
                  <label htmlFor="sig-cat" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Motif</label>
                  <select id="sig-cat" value={sigCat} onChange={e => { setSigCat(e.target.value); setSigErr('') }}
                    style={{ width: '100%', padding: '12px 12px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 10, background: '#fff', fontFamily: 'inherit' }}>
                    <option value="">Choisir…</option>
                    {REPORT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <label htmlFor="sig-body" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Ce qui s&apos;est passé</label>
                  <textarea id="sig-body" value={sigBody} onChange={e => { setSigBody(e.target.value); setSigErr('') }} rows={4} maxLength={2000}
                    style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 12, fontFamily: 'inherit' }} />
                  {sigErr && <p role="alert" style={{ color: '#c0503a', fontSize: 12, margin: '-4px 0 10px' }}>{sigErr}</p>}
                  <button onClick={submitSignalement} disabled={sigBusy} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, opacity: sigBusy ? .6 : 1 }}>
                    {sigBusy ? 'Envoi…' : 'Envoyer à PING'}
                  </button>
                  <button type="button" onClick={() => setReportKind('choix')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: '#4E6470', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Retour</button>
                </>
              )
            ) : reportSent ? (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 6 }}>Litige ouvert</h3>
                <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>C'est publié dans la conversation et visible dans "Litiges" pour les deux parties.</p>
                <button onClick={() => { setReporting(false); setReportSent(false) }} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>Fermer</button>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Signaler un problème</h3>
                <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>Choisissez un motif et décrivez ce qui ne va pas : c'est tracé et visible par les deux parties, qui disposent de 48 h pour répondre.</p>
                <DisputeFields value={reportExtra} onChange={setReportExtra} />
                <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 14, fontFamily: 'inherit' }} />
                {reportError && <p style={{ color: '#c0503a', fontSize: 12, margin: '-6px 0 10px' }}>{reportError}</p>}
                <button onClick={submitReport} disabled={reportBusy} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#FF7A66', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, opacity: reportBusy ? .6 : 1 }}>
                  {reportBusy ? 'Envoi…' : 'Ouvrir le litige'}
                </button>
                {reportsOn && (
                  <button type="button" onClick={() => setReportKind('choix')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: '#4E6470', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Retour</button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {editingPrice && (
        <div onClick={() => setEditingPrice(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
            <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Proposer un nouveau tarif</h3>
            <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>Ce n'est pas appliqué tout de suite — l'autre partie doit valider dans la conversation, avec la photo si elle justifie le changement.</p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Montant (€)</label>
            <input type="number" inputMode="decimal" value={newAmount} onChange={e => { setNewAmount(e.target.value); setOfferErr('') }} min="0" step="0.5"
              placeholder={amountPlaceholder}
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 15, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Heures incluses</label>
                <input type="number" inputMode="decimal" value={newIncludedHours} onChange={e => { setNewIncludedHours(e.target.value); setOfferErr('') }} min="0" step="0.5"
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 13.5 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Tarif horaire (€/h)</label>
                <input type="number" inputMode="decimal" value={newHourly} onChange={e => { setNewHourly(e.target.value); setOfferErr('') }} min="0" step="0.5"
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 13.5 }} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#6E8592', marginBottom: 10 }}>Les deux vides : prix fixe. Tarif horaire seul : le montant est une estimation, la facture suit les heures réelles. Les deux remplis : forfait avec dépassement au-delà des heures incluses.</p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Motif (facultatif)</label>
            <textarea value={newAmountReason} onChange={e => setNewAmountReason(e.target.value)} rows={2}
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 10, fontFamily: 'inherit' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, border: '1px dashed #DCE5E3', marginBottom: 14, cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
              <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>{newAmountPhoto ? newAmountPhoto.name : 'Ajouter une photo à l\u2019appui (facultatif)'}</span>
              <input type="file" accept="image/*" onChange={e => setNewAmountPhoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </label>
            {offerRecap && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(18,179,156,.08)', color: '#123644', fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>
                {offerRecap}
              </div>
            )}
            {hoursWithoutRate && (
              <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 10px' }}>Heures incluses sans tarif horaire : indiquez le tarif appliqué au-delà, ou videz « Heures incluses ».</p>
            )}
            {offerErr && !hoursWithoutRate && <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 10px' }}>{offerErr}</p>}
            <button onClick={proposeOffer} disabled={sendingOffer || !(Number(newAmount) > 0) || hoursWithoutRate} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: (sendingOffer || !(Number(newAmount) > 0) || hoursWithoutRate) ? '#DCE5E3' : '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
              {sendingOffer ? 'Envoi…' : 'Envoyer la proposition'}
            </button>
          </div>
        </div>
      )}

      {/* Bannière sécurité */}
      <div style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 600, textAlign: 'center', background: 'rgba(18,179,156,.1)', color: '#0C8F7E' }}>
        Téléphone et e-mail restent masqués : échangez ici, l&apos;adresse s&apos;affiche une fois la mission validée et réglée
      </div>

      {/* Client : demander l'attestation d'assurance du prestataire (transmise dans ce fil, lien de 7 jours). */}
      {txOpen && userId && userId === tx.buyer_id && tx.buyer_id !== tx.seller_id && (
        <div style={{ padding: '8px 16px 0', textAlign: 'center' }}>
          {insurancePending ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6E8592' }}>Attestation d&apos;assurance demandée au prestataire</span>
          ) : (
            <button onClick={requestInsurance} disabled={insuranceBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: insuranceBusy ? .6 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" /></svg>
              {insuranceBusy ? 'Envoi…' : 'Demander l’attestation d’assurance'}
            </button>
          )}
          {insuranceErr && <div style={{ color: '#C0503A', fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>{insuranceErr}</div>}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 8px' }}>
            <div style={{ color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Démarrez la conversation</div>
            <div style={{ color: '#4E6470', fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
              {tx && userId === tx.buyer_id ? 'Décrivez votre besoin : surface, date souhaitée, fréquence.' : 'Présentez-vous et posez vos questions avant de proposer un tarif.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {(tx && userId === tx.buyer_id
                ? ['Bonjour, êtes-vous disponible cette semaine ?', 'Il s’agit d’un appartement de 60 m².', 'Quel serait votre tarif ?']
                : ['Bonjour, merci pour votre demande.', 'Quelle est la surface à traiter ?', 'Quel jour vous arrangerait ?']
              ).map(t => (
                <button key={t} type="button" onClick={() => setInput(t)}
                  style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          const msgDate = new Date(m.created_at)
          const showDatePill = i === 0 || !sameDay(msgDate, new Date(msgs[i - 1].created_at))
          const datePill = showDatePill ? (
            <div key={`date-${m.id}`} style={{ alignSelf: 'center', margin: '4px 0', padding: '5px 14px', borderRadius: 999, background: 'rgba(18,54,68,.06)', color: '#4E6470', fontSize: 11, fontWeight: 700 }}>
              {dayLabel(msgDate)}
            </div>
          ) : null

          if (m.kind === 'offer') {
            const mine = m.sender_id === userId
            return (
              <Fragment key={m.id}>
                {datePill}
                <div style={{ alignSelf: 'center', maxWidth: '90%', width: '100%', background: '#fff', border: '1.5px solid #12B39C', borderRadius: 16, padding: '16px 18px', boxShadow: '0 4px 16px rgba(18,179,156,.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(18,179,156,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0C8F7E', textTransform: 'uppercase', letterSpacing: '.05em' }}>Devis</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: m.body ? 6 : 0 }}>
                  <span style={{ fontSize: 12, color: '#4E6470', lineHeight: 1.4 }}>{m.body}</span>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', whiteSpace: 'nowrap' }}>{EUR(m.offer_cents || 0)}</span>
                </div>
                {m.offer_hourly_cents != null && m.offer_included_hours != null && (
                  <div style={{ fontSize: 11, color: '#8a6520', marginBottom: 6 }}>
                    {m.offer_included_hours} h incluse{m.offer_included_hours > 1 ? 's' : ''}, puis {EUR(m.offer_hourly_cents)}/h au-delà
                  </div>
                )}
                {m.offer_hourly_cents != null && m.offer_included_hours == null && (
                  <div style={{ fontSize: 11, color: '#8a6520', marginBottom: 6 }}>
                    Estimation — facturé {EUR(m.offer_hourly_cents)}/h selon le temps réel
                  </div>
                )}
                {userId === tx?.seller_id && (m.offer_cents || 0) > 0 && tx?.subtotal_cents > 0 && (
                  <div style={{ fontSize: 11, color: '#4E6470', marginBottom: 6 }}>
                    Vous percevez environ {EUR(Math.round((m.offer_cents || 0) * (1 - (tx.seller_fee_cents || 0) / tx.subtotal_cents)))} après commission PING
                  </div>
                )}
                {m.photo_path && (
                  photoUrls[m.id]
                    ? <img src={photoUrls[m.id]} alt="Photo à l'appui" style={{ width: '100%', borderRadius: 10, marginTop: 8, display: 'block' }} />
                    : <div style={{ fontSize: 11, color: '#6E8592', marginTop: 8 }}>Photo jointe…</div>
                )}
                {m.offer_status === 'pending' && priceLocked && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#6E8592' }}>Tarif déjà validé : proposition sans effet</div>
                )}
                {m.offer_status === 'pending' && !priceLocked && !mine && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => counterOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#4E6470', fontWeight: 700, fontSize: 12.5 }}>Refaire une proposition</button>
                    <button onClick={() => acceptOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontWeight: 700, fontSize: 12.5 }}>Accepter</button>
                  </div>
                )}
                {m.offer_status === 'pending' && !priceLocked && mine && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#8a6520', marginBottom: 8 }}>En attente de validation</div>
                    <button onClick={() => counterOffer(m)} style={{ width: '100%', padding: 9, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#0C8F7E', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Modifier ma proposition</button>
                  </div>
                )}
                {m.offer_status === 'accepted' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#0C8F7E' }}>✓ Accepté — appliqué à la mission</div>
                )}
                {m.offer_status === 'declined' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#6E8592' }}>
                    {replacedAfter(m) ? 'Remplacé par une réservation' : 'Refusé'}
                  </div>
                )}
                </div>
              </Fragment>
            )
          }
          if (isSystemMessage(m)) {
            // Attestation d'assurance transmise : lien signé (7 jours) du bucket privé, posté par le prestataire.
            if (isInsuranceSent(m.body) && m.sender_id === tx?.seller_id) {
              const link = insuranceLink(m.body)
              const expired = Date.now() - new Date(m.created_at).getTime() > INSURANCE_LINK_DAYS * 24 * 3600 * 1000
              const until = m.body.match(/\(([^)]*)\)/)?.[1]
              return (
                <Fragment key={m.id}>
                  {datePill}
                  <div style={{ alignSelf: 'center', maxWidth: '90%', background: '#fff', border: '1.5px solid #12B39C', borderRadius: 16, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#123644' }}>Attestation d&apos;assurance transmise par le prestataire</div>
                    <div style={{ fontSize: 11, color: '#4E6470', marginTop: 2 }}>{expired ? 'Lien expiré : demandez-la à nouveau si besoin.' : until ? `Visible des seules parties de cette mission · ${until}` : 'Visible des seules parties de cette mission'}</div>
                    {link && !expired && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: 8, background: '#0C8F7E', color: '#fff', borderRadius: 999, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                        Ouvrir l&apos;attestation
                      </a>
                    )}
                  </div>
                </Fragment>
              )
            }
            const insReq = isInsuranceRequest(m.body) && i === lastInsReq && insurancePending && userId === tx?.seller_id && txOpen
            return (
              <Fragment key={m.id}>
                {datePill}
                <div style={{ alignSelf: 'center', maxWidth: '85%', background: 'rgba(18,179,156,.1)', color: '#0C8F7E', fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textAlign: 'center' }}>
                  {m.body}
                </div>
                {insReq && (
                  <div style={{ alignSelf: 'center', maxWidth: '90%', textAlign: 'center' }}>
                    {insuranceMissing ? (
                      <div style={{ background: '#fff', border: '1.5px solid #F2A93B', borderRadius: 14, padding: '10px 14px' }}>
                        <div style={{ fontSize: 12.5, color: '#123644', fontWeight: 600, lineHeight: 1.5 }}>Vous n&apos;avez pas encore déposé d&apos;attestation d&apos;assurance (ou elle n&apos;est plus valable).</div>
                        <button onClick={() => router.push(`/pro/documents?retour=${encodeURIComponent(`/mission/${transactionId}/chat`)}`)}
                          style={{ marginTop: 8, border: 'none', background: '#0C8F7E', color: '#fff', borderRadius: 999, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                          Déposer mon attestation
                        </button>
                      </div>
                    ) : (
                      <button onClick={transmitInsurance} disabled={insuranceBusy}
                        style={{ border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', borderRadius: 999, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: insuranceBusy ? .6 : 1 }}>
                        {insuranceBusy ? 'Transmission…' : 'Transmettre mon attestation'}
                      </button>
                    )}
                    {insuranceErr && <div style={{ color: '#C0503A', fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>{insuranceErr}</div>}
                    <div style={{ fontSize: 10.5, color: '#6E8592', marginTop: 4 }}>Lien de {INSURANCE_LINK_DAYS} jours, visible du seul client de cette mission.</div>
                  </div>
                )}
              </Fragment>
            )
          }
          const mine = m.sender_id === userId
          return (
            <Fragment key={m.id}>
              {datePill}
              <div className={mine ? 'msg me' : 'msg them'}>
                {m.body}
              </div>
              {/* Prix écrit dans un message sans tarif validé : rappel discret, jamais bloquant. */}
              {m.id === priceHintId && (
                <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', background: 'rgba(242,169,59,.1)', border: '1px solid rgba(242,169,59,.35)', borderRadius: 12, padding: '8px 12px', marginTop: -4 }}>
                  <div style={{ fontSize: 11.5, color: '#6b4f17', lineHeight: 1.45 }}>
                    Pour que le prix compte, utilisez Proposer un tarif : seul un tarif validé des deux côtés est facturé (et protégé en cas de litige).
                  </div>
                  <button onClick={openOfferForm}
                    style={{ marginTop: 6, border: 'none', background: 'none', padding: 0, color: '#0C8F7E', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                    Proposer un tarif
                  </button>
                </div>
              )}
            </Fragment>
          )
        })}
        {myReview && (
          <div style={{ alignSelf: 'center', maxWidth: '90%', width: '100%', background: '#fff', border: '1.5px solid #F2A93B', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8a6520', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Votre avis</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, color: '#F2A93B', letterSpacing: 1 }}>{'★'.repeat(myReview.stars)}<span style={{ color: '#DCE5E3' }}>{'★'.repeat(5 - myReview.stars)}</span></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#123644' }}>{myReview.stars}/5</span>
            </div>
            {myReview.comment && <p style={{ fontSize: 13, color: '#3d5560', lineHeight: 1.5, margin: '8px 0 0' }}>{myReview.comment}</p>}
          </div>
        )}
        {myClientReview && (
          <div style={{ alignSelf: 'center', maxWidth: '90%', width: '100%', background: '#fff', border: '1.5px solid #DCE5E3', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Mon avis sur le client · {myClientReview.is_public ? 'commentaire publié' : 'non publié'}
            </div>
            <span style={{ fontSize: 18, color: '#F2A93B', letterSpacing: 1 }}>{'★'.repeat(myClientReview.stars)}<span style={{ color: '#DCE5E3' }}>{'★'.repeat(5 - myClientReview.stars)}</span></span>
            {myClientReview.tags?.length > 0 && <div style={{ fontSize: 12, color: '#4E6470', marginTop: 6 }}>{myClientReview.tags.map(k => CLIENT_TAGS.find(t => t.key === k)?.label || k).join(' · ')}</div>}
            {myClientReview.comment && <p style={{ fontSize: 13, color: '#3d5560', lineHeight: 1.5, margin: '6px 0 0' }}>{myClientReview.comment}</p>}
            {myClientReview.private_note && <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.5, margin: '6px 0 0' }}>Note personnelle (jamais publiée) : {myClientReview.private_note}</p>}
          </div>
        )}
        {tx && userId === tx.seller_id && !myClientReview && ['completed', 'released'].includes(tx.status) && tx.buyer_id !== tx.seller_id && (
          <button onClick={() => { try { localStorage.removeItem(`ping_client_review_later_${tx.id}`) } catch { } setAskClientReview(true) }}
            style={{ alignSelf: 'center', border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Je note et commente mon client
          </button>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Warning */}
      {warning && (
        <div style={{ margin: '0 16px 8px', padding: '9px 14px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, textAlign: 'center', background: '#FEE2E2', color: '#C0503A' }}>
          {warning}
        </div>
      )}

      {/* Règle suprême du tarif : seulement tant que le prix n'est pas fixé (devis accepté OU
          réservation directe par mission/new, qui n'a aucun message d'offre). */}
      {tx && userId === tx.seller_id && tx.status === 'pending' && !tx.price_confirmed && !msgs.some(m => m.kind === 'offer' && (m.offer_status === 'pending' || m.offer_status === 'accepted')) && (
        <div style={{ padding: '0 16px 10px' }}>
          <button onClick={openOfferForm}
            style={{ width: '100%', padding: 12, borderRadius: 999, border: '1.5px solid #12B39C', background: 'rgba(18,179,156,.06)', color: '#0C8F7E', fontFamily: 'Quicksand, sans-serif', fontSize: 13.5, fontWeight: 700 }}>
            + Proposer un tarif
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 5, padding: '12px 16px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #E7EDEB' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 999, fontSize: 13.5, border: '1px solid #DCE5E3', outline: 'none', background: '#F3F6F5' }}
 />
        <button onClick={send}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#0C8F7E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
