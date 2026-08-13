"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'

const SERVICES = [
  { key: 'menage', label: 'Ménage' },
  { key: 'repassage', label: 'Repassage' },
  { key: 'nettoyage', label: 'Nettoyage' },
]

export default function ProOnboarding() {
  const router = useRouter()
  const [services, setServices] = useState<string[]>([])
  const [pricingType, setPricingType] = useState<'forfait' | 'horaire'>('forfait')
  const [rate, setRate] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggle(key: string) {
    setServices(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])
  }

  async function submit() {
    if (services.length === 0) { setError('Choisis au moins un service.'); return }
    if (!rate || Number(rate) <= 0) { setError('Indique un tarif.'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signup?role=pro'); return }

    const cents = Math.round(Number(rate) * 100)
    const { error: dbError } = await supabase.from('provider_profiles').upsert({
      id: user.id,
      trade: services[0],
      pricing_type: pricingType,
      base_price_cents: cents,
      hourly_rate_cents: pricingType === 'horaire' ? cents : null,
      bio,
      is_active: true,
    })

    if (dbError) { setError(dbError.message); setLoading(false); return }

    if (services.length > 1) {
      await supabase.from('services').insert(
        services.slice(1).map(s => ({ provider_id: user.id, name: s, price_cents: cents }))
      )
    }

    trackEvent('pro_onboarding_completed', { services, pricingType })
    router.push('/pro/onboarding/documents')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', padding: '24px 20px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 21 }}>Votre activité sur PING</h1>
        <p style={{ color: '#6E8592', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
          Vous serez visible dès maintenant. Les documents se complètent ensuite, sans bloquer votre inscription.
        </p>

        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Quels services proposez-vous ?</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {SERVICES.map(s => (
            <button key={s.key} onClick={() => toggle(s.key)} style={{
              padding: '9px 16px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13,
              background: services.includes(s.key) ? '#123644' : '#fff',
              color: services.includes(s.key) ? '#fff' : '#123644',
              boxShadow: services.includes(s.key) ? 'none' : '0 0 0 1px #DCE5E3',
            }}>{s.label}</button>
          ))}
        </div>

        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Comment facturez-vous ?</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setPricingType('forfait')} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 13, background: pricingType === 'forfait' ? '#12B39C' : '#fff', color: pricingType === 'forfait' ? '#fff' : '#123644', boxShadow: pricingType === 'forfait' ? 'none' : '0 0 0 1px #DCE5E3' }}>Forfait fixe</button>
          <button onClick={() => setPricingType('horaire')} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 13, background: pricingType === 'horaire' ? '#12B39C' : '#fff', color: pricingType === 'horaire' ? '#fff' : '#123644', boxShadow: pricingType === 'horaire' ? 'none' : '0 0 0 1px #DCE5E3' }}>Taux horaire</button>
        </div>
        {pricingType === 'horaire' && (
          <p style={{ fontSize: 11.5, color: '#6E8592', marginBottom: 10, lineHeight: 1.5 }}>
            Le temps est compté automatiquement : il démarre au scan du QR à l'arrivée, s'arrête au scan de sortie. Ce relevé fait foi en cas de litige.
          </p>
        )}

        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>{pricingType === 'forfait' ? 'Tarif du forfait (€)' : 'Tarif horaire (€/h)'}</span>
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="Ex. 25"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14 }} />
        </label>

        <label style={{ display: 'block', marginBottom: 22 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Quelques mots sur vous (optionnel)</span>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Ex. Ménage soigné, disponible rapidement"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit' }} />
        </label>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={loading} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 999 }}>
          {loading ? 'Enregistrement…' : 'Être visible sur PING'}
        </button>
      </div>
    </div>
  )
}
