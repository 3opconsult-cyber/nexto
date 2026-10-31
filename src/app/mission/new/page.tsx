"use client"
import { useState, useEffect, Suspense } from 'react'
import DayTimePicker from '@/components/DayTimePicker'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { getRates, DEFAULT_BUYER_RATE, DEFAULT_SELLER_RATE } from '@/lib/pricing'
import PaymentPendingModal from '@/components/PaymentPendingModal'
import { geocodeAddress } from '@/lib/geocode'
import { startCheckout, usePaymentsActive } from '@/lib/paymentsClient'
import NavDrawer from '@/components/NavDrawer'
import { TRADES } from '@/lib/trades'
import { EUR } from '@/lib/invoice-pdf'
import { fetchSlots, dayLabel, hhmm, slotEnd, type Slot } from '@/lib/slots'
import Calendar, { type CalEvent } from '@/components/calendar/Calendar'
import { AVANCE_IMMEDIATE_ACTIVE, isEligible, partClientCents } from '@/lib/creditImpot'
import { systemSender } from '@/lib/systemMessage'

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const serviceId = params.get('service')
  const [pro, setPro] = useState<any>(null)
  const [article, setArticle] = useState<any>(null)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  // Sans créneaux publiés par le pro, le client indique lui-même la date et l'heure souhaitées.
  const [wantedAt, setWantedAt] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('2')
  const [mode, setMode] = useState<'forfait' | 'horaire' | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
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
    if (!serviceId) { setArticle(null); return }
    createClient().from('services')
      .select('id, name, pricing_type, base_price_cents, included_hours, hourly_rate_cents')
      .eq('id', serviceId).single()
      .then(({ data }) => setArticle(data))
  }, [serviceId])

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
  // Paiement en ligne actif : on saute la simulation et on envoie le client vers la vraie page de paiement.
  const paymentsOn = usePaymentsActive()

  async function submit() {
    if (!address.trim()) { setError('Indiquez une adresse.'); return }
    if (needsSlot && !chosen) { setError('Choisissez un créneau.'); return }
    if (!needsSlot && !wantedAt) { setError('Indiquez la date et l\u2019heure souhaitées.'); return }
    if (!needsSlot && new Date(wantedAt).getTime() < Date.now()) { setError('Choisissez une date à venir.'); return }
    if (!(subtotalCents > 0)) { setError('Indiquez une durée estimée.'); return }
    if (!pro || !mode) return
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
    const { data: req, error: reqErr } = await supabase.from('requests').insert({
      // description est NOT NULL en base : le champ est facultatif a l'ecran,
      // "|| null" faisait donc echouer la reservation des que le client ne
      // remplissait pas la description (jamais declenche par les tests, ou
      // elle etait toujours remplie a la main).
      requester_id: user.id, category: pro.trade,
      description: description.trim() || (article ? article.name : ''),
      address: address.trim(), budget_cents: totalTtc, status: 'matched',
      ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
    }).select().single()
    if (reqErr || !req) { setError("Impossible de créer la demande."); setCreating(false); return }

    // Relit les taux à l'instant T (pas le state React, qui peut dater de
    // l'affichage initial) : la source de vérité au moment de l'écriture.
    const liveRates = await getRates()
    const liveBuyerFee = Math.round(subtotalCents * liveRates.buyer)
    const sellerFee = Math.round(subtotalCents * liveRates.seller)
    const liveTotalTtc = subtotalCents + liveBuyerFee
    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      kind: 'service', buyer_id: user.id, seller_id: pro.id, request_id: req.id,
      subtotal_cents: subtotalCents, buyer_fee_cents: liveBuyerFee, seller_fee_cents: sellerFee,
      total_charged_cents: liveTotalTtc, payout_cents: subtotalCents - sellerFee,
      hourly_rate_cents: hasOvertime ? pricing.hourly_rate_cents : (mode === 'horaire' ? pricing.hourly_rate_cents : null),
      included_hours: hasOvertime ? pricing.included_hours : null,
      base_forfait_cents: hasOvertime ? pricing.base_price_cents : null,
      status: 'pending',
      price_confirmed: true,
      ...(!needsSlot && wantedAt ? { scheduled_at: new Date(wantedAt).toISOString() } : {}),
    }).select().single()
    if (txErr || !tx) { setError('Impossible de créer la réservation.'); setCreating(false); return }

    // Sans ça, le chat s'ouvrait totalement vide malgré un prix déjà validé
    // (règle suprême du tarif) — rien ne rappelait ce qui avait été réservé.
    const label = article ? article.name : (TRADES[pro.trade] || pro.trade)
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
      body: `✓ Réservation confirmée — ${label} · ${priceLabel}${when} · ${address.trim()}`,
    })

    trackEvent('mission_booked', { pro_id: proId, service_id: serviceId, subtotal_cents: subtotalCents })
    if (paymentsOn) {
      // Si le prestataire n'a pas encore de compte de paiement, la mission reste réservée et le
      // bouton « Payer » de l'écran suivant prendra le relais.
      const pay = await startCheckout(tx.id)
      if (pay.redirectUrl) { window.location.href = pay.redirectUrl; return }
    }
    router.push(`/mission/${tx.id}/qrcodes`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644' }}>
      <div style={{ padding: '28px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <NavDrawer />
          <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 22, color: '#fff' }}>Réserver</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>
          {pricing
            ? hasOvertime
              ? `${article?.name || TRADES[pro.trade] || pro.trade} — ${EUR(pricing.base_price_cents)} (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}), puis ${EUR(pricing.hourly_rate_cents)}/h au-delà`
              : `${article?.name || TRADES[pro.trade] || pro.trade} — ${[hasFlat ? EUR(pricing.base_price_cents)+' forfait' : null, hasHourly ? EUR(pricing.hourly_rate_cents)+'/h' : null].filter(Boolean).join(' · ')}`
            : 'Chargement…'}
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px', minHeight: 'calc(100vh - 110px)' }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Adresse</span>
          <input value={address} onChange={e => setAddress(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
        </label>

        {!needsSlot && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Date et heure souhaitées</span>
            <div style={{ marginTop: 6 }}><DayTimePicker value={wantedAt} onChange={setWantedAt} /></div>
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
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Durée estimée (heures) — ajustée au réel après le scan de sortie</span>
            <input type="number" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} min="0.5" step="0.5"
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
          </label>
        )}

        {needsSlot && (
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Choisir un créneau</span>
            <div style={{ marginTop: 8 }}>
              <Calendar events={slotEvents} views={['week', 'day']} defaultView="week"
                initialDate={slotEvents[0]?.start} />
            </div>
            <div style={{ fontSize: 11.5, color: chosen ? '#0C8F7E' : '#6E8592', fontWeight: chosen ? 700 : 400, marginTop: 8 }}>
              {chosen ? `Créneau choisi : ${dayLabel(chosen.starts_at)} à ${hhmm(chosen.starts_at)}` : 'Touchez un créneau disponible publié par le prestataire.'}
            </div>
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
          {AVANCE_IMMEDIATE_ACTIVE && pro?.sap_number && isEligible(pro?.trade) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2ECEA', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, color: '#0C8F7E', fontWeight: 600 }}>Avec le crédit d&apos;impôt immédiat</span>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#0C8F7E' }}>{EUR(partClientCents(totalTtc))}</span>
            </div>
          )}
        </div>

        {/* Argument de confiance discret, façon Airbnb : une ligne, pas un pavé —
            cf. critique "pas d'argumentaire visible" + décision de garder la
            sobriété plutôt que lister des badges. Politique honnête vu l'état
            actuel (rien n'est débité avant la prestation, Stripe non branché) :
            l'annulation est donc réellement gratuite jusqu'à l'arrivée, ce n'est
            pas une promesse en avance sur la fonctionnalité. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(18,179,156,.07)', marginBottom: 14 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
          <span style={{ fontSize: 12, color: '#123644', lineHeight: 1.5 }}>
            Annulation gratuite tant que le prestataire n'est pas en route — des frais s'appliquent au-delà, comme chez Uber. Pas satisfait ? Vous pouvez ouvrir une réclamation après la prestation.
          </span>
        </div>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={() => paymentsOn ? submit() : setConfirming(true)} disabled={!pro || !mode || creating || paymentsOn === null} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Confirmation…' : chosen ? `Confirmer · ${dayLabel(chosen.starts_at, { weekday: 'short', day: 'numeric' })} ${hhmm(chosen.starts_at)}` : 'Confirmer la réservation'}
        </button>
        <p style={{ fontSize: 11, color: '#6E8592', textAlign: 'center', marginTop: 10 }}>
          {paymentsOn ? 'Vous serez dirigé vers le paiement sécurisé par carte.' : 'Vous verrez le détail avant de confirmer.'}
        </p>

        {/* Le paiement en ligne n'existe pas encore : on le dit AVANT que le
            client valide, pas apres. */}
        <PaymentPendingModal
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); submit() }}
          totalCents={totalTtc}
          proName={pro?.company_name || 'le prestataire'}
          busy={creating}
        />
      </div>
    </div>
  )
}

export default function MissionNew() {
  return <Suspense fallback={null}><MissionForm /></Suspense>
}
