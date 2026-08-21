"use client"
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { BUYER_RATE } from '@/lib/pricing'

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const [pro, setPro] = useState<any>(null)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('2')
  const [mode, setMode] = useState<'forfait' | 'horaire' | null>(null)
  const [paymentPending, setPaymentPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!proId) return
    createClient().from('provider_profiles').select('*').eq('id', proId).single()
      .then(({ data }) => {
        setPro(data)
        if (data) {
          const hasFlat = data.base_price_cents > 0
          const hasHourly = data.hourly_rate_cents != null && data.hourly_rate_cents > 0
          setMode(hasFlat ? 'forfait' : hasHourly ? 'horaire' : null)
        }
      })
  }, [proId])

  const hasFlat = !!pro && pro.base_price_cents > 0
  const hasHourly = !!pro && pro.hourly_rate_cents != null && pro.hourly_rate_cents > 0
  const subtotalCents = pro
    ? (mode === 'horaire'
        ? Math.round((pro.hourly_rate_cents || 0) * Number(estimatedHours || 0))
        : pro.base_price_cents)
    : 0
  const buyerFee = Math.round(subtotalCents * BUYER_RATE)
  const totalTtc = subtotalCents + buyerFee

  function submit() {
    if (!address.trim()) { setError('Indique une adresse.'); return }
    setError('')
    trackEvent('mission_payment_pending_stripe', { pro_id: proId, subtotal_cents: subtotalCents })
    setPaymentPending(true)
  }

  if (paymentPending) {
    return (
      <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 340, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(242,169,59,.14)' }}>…</div>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644', marginBottom: 8 }}>Paiement en ligne — bientôt disponible</h1>
          <p style={{ fontSize: 13, color: '#6E8592', lineHeight: 1.5, marginBottom: 20 }}>
            La connexion Stripe est en cours d'intégration. Cette réservation n'a pas été enregistrée, aucun montant n'a été débité.
          </p>
          <button onClick={() => router.push('/map')} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 999 }}>
            Retour à la carte
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644' }}>
      <div style={{ padding: '28px 20px 16px' }}>
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>← Retour</button>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 22, color: '#fff' }}>Réserver</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
          {pro ? `${pro.trade} — ${[hasFlat ? (pro.base_price_cents/100).toFixed(2)+' € forfait' : null, hasHourly ? (pro.hourly_rate_cents/100).toFixed(2)+' €/h' : null].filter(Boolean).join(' · ')}` : 'Chargement…'}
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

        {hasFlat && hasHourly && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['forfait', 'horaire'] as const).map(t => (
              <button key={t} onClick={() => setMode(t)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: mode === t ? '2px solid #12B39C' : '2px solid #E7EDEB', background: mode === t ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                {t === 'forfait' ? `Forfait — ${(pro.base_price_cents/100).toFixed(2)} €` : `À l'heure — ${(pro.hourly_rate_cents/100).toFixed(2)} €/h`}
              </button>
            ))}
          </div>
        )}

        {mode === 'horaire' && (
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

        <button onClick={submit} disabled={!pro || !mode} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999 }}>
          Confirmer la réservation
        </button>
      </div>
    </div>
  )
}

export default function MissionNew() {
  return <Suspense fallback={null}><MissionForm /></Suspense>
}
