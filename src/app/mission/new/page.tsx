"use client"
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { BUYER_RATE, SELLER_RATE } from '@/lib/pricing'

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const [pro, setPro] = useState<any>(null)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('2')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!proId) return
    createClient().from('provider_profiles').select('*').eq('id', proId).single()
      .then(({ data }) => setPro(data))
  }, [proId])

  const subtotalCents = pro
    ? (pro.pricing_type === 'horaire'
        ? pro.base_price_cents + Math.round((pro.hourly_rate_cents || 0) * Number(estimatedHours || 0))
        : pro.base_price_cents)
    : 0
  const buyerFee = Math.round(subtotalCents * BUYER_RATE)
  const totalTtc = subtotalCents + buyerFee

  async function submit() {
    if (!address.trim()) { setError('Indique une adresse.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const sellerFee = Math.round(subtotalCents * SELLER_RATE)

    const { data: reqRow, error: reqError } = await supabase.from('requests').insert({
      requester_id: user.id,
      category: pro?.trade || 'menage',
      description: description || '(aucune description fournie)',
      address: address.trim(),
      budget_cents: subtotalCents,
      status: 'matched',
    }).select().single()

    if (reqError || !reqRow) { setError(reqError?.message || 'Erreur de création.'); setLoading(false); return }

    const { data: tx, error: dbError } = await supabase.from('transactions').insert({
      kind: 'service',
      buyer_id: user.id,
      seller_id: proId,
      request_id: reqRow.id,
      subtotal_cents: subtotalCents,
      buyer_fee_cents: buyerFee,
      seller_fee_cents: sellerFee,
      total_charged_cents: totalTtc,
      payout_cents: subtotalCents - sellerFee,
      hourly_rate_cents: pro?.pricing_type === 'horaire' ? pro.hourly_rate_cents : null,
      status: 'pending',
    }).select().single()

    if (dbError || !tx) { setError(dbError?.message || 'Erreur de création.'); setLoading(false); return }

    trackEvent('mission_created', { pro_id: proId, subtotal_cents: subtotalCents })
    router.push(`/mission/${tx.id}/qrcodes`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644' }}>
      <div style={{ padding: '28px 20px 16px' }}>
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>← Retour</button>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 22, color: '#fff' }}>Réserver</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
          {pro ? `${pro.trade} — ${pro.pricing_type === 'horaire' ? (pro.hourly_rate_cents/100).toFixed(2)+' €/h' : (pro.base_price_cents/100).toFixed(2)+' € forfait'}` : 'Chargement…'}
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px', minHeight: 'calc(100vh - 110px)' }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Adresse</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="12 avenue de Provence, Grasse"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Ex. 110 m², remise en état"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit' }} />
        </label>

        {pro?.pricing_type === 'horaire' && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Durée estimée (heures) — ajustée au réel après le scan de sortie</span>
            <input type="number" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} min="0.5" step="0.5"
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
          </label>
        )}

        <div style={{ background: '#F3F6F5', borderRadius: 14, padding: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#6E8592' }}>Sous-total</span><span>{(subtotalCents/100).toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
            <span style={{ color: '#6E8592' }}>Frais de service (5 %)</span><span>{(buyerFee/100).toFixed(2)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, borderTop: '1px solid #DCE5E3', paddingTop: 10 }}>
            <span>Total</span><span>{(totalTtc/100).toFixed(2)} €</span>
          </div>
        </div>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={loading || !pro} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999 }}>
          {loading ? 'Création…' : 'Confirmer la réservation'}
        </button>
      </div>
    </div>
  )
}

export default function MissionNew() {
  return <Suspense fallback={null}><MissionForm /></Suspense>
}
