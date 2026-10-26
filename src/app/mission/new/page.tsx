"use client"
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { getRates, DEFAULT_BUYER_RATE, DEFAULT_SELLER_RATE } from '@/lib/pricing'
import PaymentPendingModal from '@/components/PaymentPendingModal'
import NavDrawer from '@/components/NavDrawer'
import { TRADES } from '@/lib/trades'

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const serviceId = params.get('service')
  const [pro, setPro] = useState<any>(null)
  const [article, setArticle] = useState<any>(null)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('2')
  const [mode, setMode] = useState<'forfait' | 'horaire' | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
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
  }, [proId])

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

  async function submit() {
    if (!address.trim()) { setError('Indique une adresse.'); return }
    if (!pro || !mode) return
    setError('')
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: req, error: reqErr } = await supabase.from('requests').insert({
      // description est NOT NULL en base : le champ est facultatif a l'ecran,
      // "|| null" faisait donc echouer la reservation des que le client ne
      // remplissait pas la description (jamais declenche par les tests, ou
      // elle etait toujours remplie a la main).
      requester_id: user.id, category: pro.trade,
      description: description.trim() || (article ? article.name : ''),
      address: address.trim(), budget_cents: totalTtc, status: 'matched',
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
    }).select().single()
    if (txErr || !tx) { setError('Impossible de créer la réservation.'); setCreating(false); return }

    // Sans ça, le chat s'ouvrait totalement vide malgré un prix déjà validé
    // (règle suprême du tarif) — rien ne rappelait ce qui avait été réservé.
    const label = article ? article.name : (TRADES[pro.trade] || pro.trade)
    const priceLabel = hasOvertime
      ? `${(pricing.base_price_cents / 100).toFixed(0)} € (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}, puis ${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h au-delà)`
      : mode === 'horaire' ? `${(pricing.hourly_rate_cents / 100).toFixed(0)} €/h`
        : `${(pricing.base_price_cents / 100).toFixed(0)} €`
    await supabase.from('messages').insert({
      transaction_id: tx.id, sender_id: null,
      body: `✓ Réservation confirmée — ${label} · ${priceLabel} · ${address.trim()}`,
    })

    trackEvent('mission_booked', { pro_id: proId, service_id: serviceId, subtotal_cents: subtotalCents })
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
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
          {pricing
            ? hasOvertime
              ? `${article?.name || pro.trade} — ${(pricing.base_price_cents/100).toFixed(2)} € (${pricing.included_hours} h incluse${pricing.included_hours > 1 ? 's' : ''}), puis ${(pricing.hourly_rate_cents/100).toFixed(2)} €/h au-delà`
              : `${article?.name || pro.trade} — ${[hasFlat ? (pricing.base_price_cents/100).toFixed(2)+' € forfait' : null, hasHourly ? (pricing.hourly_rate_cents/100).toFixed(2)+' €/h' : null].filter(Boolean).join(' · ')}`
            : 'Chargement…'}
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px', minHeight: 'calc(100vh - 110px)' }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Adresse</span>
          <input value={address} onChange={e => setAddress(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit' }} />
        </label>

        {hasFlat && hasHourly && !hasOvertime && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['forfait', 'horaire'] as const).map(t => (
              <button key={t} onClick={() => setMode(t)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: mode === t ? '2px solid #12B39C' : '2px solid #E7EDEB', background: mode === t ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                {t === 'forfait' ? `Forfait — ${(pricing.base_price_cents/100).toFixed(2)} €` : `À l'heure — ${(pricing.hourly_rate_cents/100).toFixed(2)} €/h`}
              </button>
            ))}
          </div>
        )}

        {hasOvertime && (
          <div style={{ padding: 13, borderRadius: 12, background: 'rgba(242,169,59,.1)', fontSize: 12.5, color: '#8a6520', marginBottom: 16, lineHeight: 1.5 }}>
            Forfait de {(pricing.base_price_cents/100).toFixed(2)} € incluant {pricing.included_hours} h. Au-delà,
            {' '}{(pricing.hourly_rate_cents/100).toFixed(2)} €/h supplémentaire — ajusté automatiquement au scan de sortie selon la durée réelle.
          </div>
        )}

        {mode === 'horaire' && !hasOvertime && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Durée estimée (heures) — ajustée au réel après le scan de sortie</span>
            <input type="number" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} min="0.5" step="0.5"
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
          </label>
        )}

        {/* Prix tout compris, façon Airbnb/Booking : un seul montant à l'écran,
            pas une addition qui s'allonge sous les yeux du client — le détail
            reste disponible (facture, mission/[id]/facture) sans être imposé
            ici. Les montants envoyés en base ne changent pas (subtotal_cents,
            buyer_fee_cents...) : c'est la présentation qui change, pas le prix. */}
        <div style={{ background: '#F3F6F5', borderRadius: 14, padding: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Total</span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{(totalTtc / 100).toFixed(2)} €</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Frais de service PING inclus</div>
        </div>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={() => setConfirming(true)} disabled={!pro || !mode || creating} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Confirmation…' : 'Confirmer la réservation'}
        </button>
        <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 }}>
          Vous verrez le détail avant de confirmer.
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
