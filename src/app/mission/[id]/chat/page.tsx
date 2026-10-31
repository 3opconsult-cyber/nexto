"use client"
import { useState, useEffect, useRef, Fragment } from 'react'
import DayTimePicker from '@/components/DayTimePicker'
import RequestDetails from '@/components/RequestDetails'
import AddressChoice, { resolveAddress, type AddressValue } from '@/components/AddressChoice'
import { maskAddress, addressUsable } from '@/lib/address'
import { useParams, useRouter } from 'next/navigation'
import { paymentsActive } from '@/lib/paymentsClient'
import { createClient } from '@/lib/supabase/client'
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
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [askReview, setAskReview] = useState(false)
  // Côté prestataire : son avis sur le client (table client_reviews, migration 016).
  const [askClientReview, setAskClientReview] = useState(false)
  const [myClientReview, setMyClientReview] = useState<{ stars: number; is_public: boolean; comment: string | null; tags: string[] } | null>(null)
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
  // Paiement en ligne actif : l'adresse du client n'est montrée au prestataire qu'une fois payé.
  const [payOn, setPayOn] = useState(false)
  useEffect(() => { paymentsActive().then(setPayOn) }, [])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Raccourcis depuis l'écran QR : ?signaler ouvre le signalement, ?avis l'avis (client, mission terminée).
  const shortcutDone = useRef(false)
  useEffect(() => {
    if (shortcutDone.current || !tx || !userId) return
    shortcutDone.current = true
    const q = new URLSearchParams(window.location.search)
    if (q.has('signaler')) setReporting(true)
    if (q.has('avis') && userId === tx.buyer_id && tx.completed_at) setAskReview(true)
  }, [tx, userId])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase.from('messages')
        .select('*').eq('transaction_id', transactionId).order('created_at')
      const loaded = (data ?? []) as Msg[]
      setMsgs(loaded)
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
    setInput('')
  }

  async function proposeOffer() {
    const cents = Math.round(Number(newAmount || 0) * 100)
    if (!cents || cents <= 0 || !userId) return
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

    setEditingPrice(false)
    setNewAmount('')
    setNewHourly('')
    setNewIncludedHours('')
    setNewAmountReason('')
    setNewAmountPhoto(null)
    setSendingOffer(false)
  }

  async function acceptOffer(m: Msg) {
    if (!m.offer_cents) return
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
    setNewAmount(m.offer_cents ? String(m.offer_cents / 100) : '')
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
    if (!reportReason.trim() || !userId) return
    const supabase = createClient()
    setReportError('')
    const { data: dsp, error } = await supabase.from('disputes').insert({
      transaction_id: transactionId, opener_id: userId, reason: reportReason.trim(),
    }).select('id').single()
    if (error || !dsp) { setReportError('Le litige n\u2019a pas pu être enregistré. Réessayez, ou écrivez à info@opconsult.co.'); return }
    // Le litige a son propre fil (comme Airbnb) : le motif en est le premier message.
    await supabase.from('dispute_messages').insert({ dispute_id: dsp.id, sender_id: userId, body: reportReason.trim(), kind: 'text' })
    await supabase.from('messages').insert({
      transaction_id: transactionId, ...(await systemSender(supabase)),
      body: 'Litige ouvert sur cette mission : la discussion continue dans le dossier du litige.',
    })
    setReportReason('')
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
        <button onClick={() => setReporting(true)} title="Signaler cet échange" style={{ border: 'none', background: 'none', padding: 4, display: 'flex', flexShrink: 0, cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2"><path d="M5 3v18" /><path d="M5 4h11l-1.5 4L16 12H5" /></svg>
        </button>
      </div>

      {tx && tx.buyer_id === tx.seller_id && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(229,72,77,.08)', color: '#B42318', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          Mission de test invalide : vous êtes à la fois le client et le prestataire. Elle ne correspond à aucun vrai parcours et sera supprimée.
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
            <button onClick={() => answerAddress(true)} disabled={addrBusy} style={{ flex: 1, padding: 11, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Accepter</button>
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
                <p style={{ fontSize: 12.5, color: '#B42318', fontWeight: 600, margin: '0 0 10px' }}>Le prestataire n&apos;intervient pas à l&apos;adresse proposée : choisissez-en une autre.</p>
              )}
              <div style={{ marginBottom: 12 }}><AddressChoice profileAddress={myProfileAddr} value={rdvChoice} onChange={setRdvChoice} /></div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5 }}>Date et heure</label>
              <div style={{ marginTop: 6 }}><DayTimePicker value={rdvAt} onChange={setRdvAt} /></div><div style={{ height: 10 }} />
              {rdvError && <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 8px' }}>{rdvError}</p>}
              <button onClick={saveRdv} disabled={rdvSaving} style={{ width: '100%', padding: 12, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: rdvSaving ? 0.7 : 1 }}>
                {rdvSaving ? 'Enregistrement…' : 'Confirmer le rendez-vous'}
              </button>
              <button onClick={() => router.push(`/mission/${tx.id}/qrcodes`)} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                Mes codes QR (arrivée et fin)
              </button>
            </div>
          ) : (
            <div style={{ margin: '10px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(242,169,59,.12)', color: '#8a6520', fontSize: 12.5, fontWeight: 600 }}>
              Tarif validé — en attente de l&apos;adresse et de l&apos;heure du rendez-vous par le client.
            </div>
          )
        ) : (
          <div style={{ margin: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#123644', fontWeight: 600 }}>Rendez-vous {rdvLabel(tx.scheduled_at)}</span>
            {userId === tx.buyer_id && !tx.completed_at && (
              <button onClick={() => router.push(`/mission/${tx.id}/qrcodes`)} style={{ border: 'none', background: '#12B39C', color: '#fff', borderRadius: 999, padding: '7px 13px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Mes codes QR
              </button>
            )}
          </div>
        )
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
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
            {reportSent ? (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 6 }}>Litige ouvert</h3>
                <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>C'est publié dans la conversation et visible dans "Litiges" pour les deux parties.</p>
                <button onClick={() => { setReporting(false); setReportSent(false) }} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>Fermer</button>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Signaler un problème</h3>
                <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14 }}>Décrivez ce qui ne va pas : c'est tracé et visible par les deux parties.</p>
                <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 14, fontFamily: 'inherit' }} />
                {reportError && <p style={{ color: '#c0503a', fontSize: 12, margin: '-6px 0 10px' }}>{reportError}</p>}
                <button onClick={submitReport} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#FF7A66', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  Ouvrir le litige
                </button>
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
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0" step="0.5"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 15, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Heures incluses</label>
                <input type="number" value={newIncludedHours} onChange={e => setNewIncludedHours(e.target.value)} min="0" step="0.5"
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 13.5 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 5px' }}>Tarif horaire (€/h)</label>
                <input type="number" value={newHourly} onChange={e => setNewHourly(e.target.value)} min="0" step="0.5"
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
            <button onClick={proposeOffer} disabled={sendingOffer || !(Number(newAmount) > 0)} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: (sendingOffer || !(Number(newAmount) > 0)) ? '#DCE5E3' : '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
              {sendingOffer ? 'Envoi…' : 'Envoyer la proposition'}
            </button>
          </div>
        </div>
      )}

      {/* Bannière sécurité */}
      <div style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 600, textAlign: 'center', background: 'rgba(18,179,156,.1)', color: '#0C8F7E' }}>
        Téléphone et e-mail restent masqués : échangez ici, l&apos;adresse s&apos;affiche une fois la mission validée et réglée
      </div>

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
                {m.offer_status === 'pending' && !mine && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => counterOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#4E6470', fontWeight: 700, fontSize: 12.5 }}>Refaire une proposition</button>
                    <button onClick={() => acceptOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 12.5 }}>Accepter</button>
                  </div>
                )}
                {m.offer_status === 'pending' && mine && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#8a6520', marginBottom: 8 }}>En attente de validation</div>
                    <button onClick={() => counterOffer(m)} style={{ width: '100%', padding: 9, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#0C8F7E', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Modifier ma proposition</button>
                  </div>
                )}
                {m.offer_status === 'accepted' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#0C8F7E' }}>✓ Accepté — appliqué à la mission</div>
                )}
                {m.offer_status === 'declined' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#6E8592' }}>Refusé</div>
                )}
                </div>
              </Fragment>
            )
          }
          if (isSystemMessage(m)) {
            return (
              <Fragment key={m.id}>
                {datePill}
                <div style={{ alignSelf: 'center', maxWidth: '85%', background: 'rgba(18,179,156,.1)', color: '#0C8F7E', fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textAlign: 'center' }}>
                  {m.body}
                </div>
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
              Votre avis sur le client · {myClientReview.is_public ? 'publié' : 'note privée'}
            </div>
            <span style={{ fontSize: 18, color: '#F2A93B', letterSpacing: 1 }}>{'★'.repeat(myClientReview.stars)}<span style={{ color: '#DCE5E3' }}>{'★'.repeat(5 - myClientReview.stars)}</span></span>
            {myClientReview.tags?.length > 0 && <div style={{ fontSize: 12, color: '#4E6470', marginTop: 6 }}>{myClientReview.tags.map(k => CLIENT_TAGS.find(t => t.key === k)?.label || k).join(' · ')}</div>}
            {myClientReview.comment && <p style={{ fontSize: 13, color: '#3d5560', lineHeight: 1.5, margin: '6px 0 0' }}>{myClientReview.comment}</p>}
          </div>
        )}
        {tx && userId === tx.seller_id && !myClientReview && ['completed', 'released'].includes(tx.status) && tx.buyer_id !== tx.seller_id && (
          <button onClick={() => { try { localStorage.removeItem(`ping_client_review_later_${tx.id}`) } catch { } setAskClientReview(true) }}
            style={{ alignSelf: 'center', border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Noter ce client
          </button>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Warning */}
      {warning && (
        <div style={{ margin: '0 16px 8px', padding: '9px 14px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, textAlign: 'center', background: '#FEE2E2', color: '#B91C1C' }}>
          {warning}
        </div>
      )}

      {tx && userId === tx.seller_id && tx.status === 'pending' && !msgs.some(m => m.kind === 'offer' && (m.offer_status === 'pending' || m.offer_status === 'accepted')) && (
        <div style={{ padding: '0 16px 10px' }}>
          <button onClick={() => { setNewAmount(tx.subtotal_cents > 0 ? String(tx.subtotal_cents / 100) : ''); setNewAmountReason(''); setNewAmountPhoto(null); setEditingPrice(true) }}
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
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#12B39C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
