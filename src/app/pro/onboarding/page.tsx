"use client"
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { searchCompany, guessLegalStatus, CompanyMatch } from '@/lib/legalLookup'
import OnboardingStep from '@/components/OnboardingStep'

const SERVICES = [
  { key: 'menage', label: 'Ménage' },
  { key: 'repassage', label: 'Repassage' },
  { key: 'nettoyage', label: 'Nettoyage' },
]

type Status = 'particulier' | 'professionnel' | null

export default function ProOnboarding() {
  const router = useRouter()

  const [services, setServices] = useState<string[]>([])
  const [pricingType, setPricingType] = useState<'forfait' | 'horaire'>('forfait')
  const [rate, setRate] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyResults, setCompanyResults] = useState<CompanyMatch[]>([])
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(null)
  const [manualEntry, setManualEntry] = useState(false)
  const [siret, setSiret] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleSteps = useMemo(
    () => status === 'professionnel'
      ? ['service', 'tarif', 'statut', 'entreprise', 'adresse', 'telephone', 'bio']
      : ['service', 'tarif', 'statut', 'adresse', 'telephone', 'bio'],
    [status]
  )
  const [stepIndex, setStepIndex] = useState(0)
  const stepKey = visibleSteps[stepIndex]

  useEffect(() => {
    if (companyQuery.trim().length < 2 || selectedCompany) { setCompanyResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const results = await searchCompany(companyQuery)
      setCompanyResults(results)
    }, 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [companyQuery, selectedCompany])

  function pickCompany(c: CompanyMatch) {
    setSelectedCompany(c)
    setCompanyQuery(c.name)
    setCompanyResults([])
    setSiret(c.siret)
    if (c.address) setAddress([c.address, c.postalCode, c.city].filter(Boolean).join(', '))
    if (c.lat != null && c.lng != null) setCoords({ lat: c.lat, lng: c.lng })
  }

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false) },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function next() { setError(''); setStepIndex(i => Math.min(i + 1, visibleSteps.length - 1)) }
  function back() { setError(''); setStepIndex(i => Math.max(i - 1, 0)) }

  async function finish() {
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signup?role=pro'); return }

    const cents = Math.round(Number(rate || 0) * 100)
    const legalStatus = status === 'particulier'
      ? 'particulier'
      : (selectedCompany ? guessLegalStatus(selectedCompany.natureJuridique) : 'auto_entrepreneur')

    const { error: profileErr } = await supabase.from('profiles').update({
      phone_enc: phone || null,
      address: address || null,
    }).eq('id', user.id)
    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    const { error: dbError } = await supabase.from('provider_profiles').upsert({
      id: user.id,
      trade: services[0],
      pricing_type: pricingType,
      base_price_cents: cents,
      hourly_rate_cents: pricingType === 'horaire' ? cents : null,
      bio,
      is_active: true,
      legal_status: legalStatus,
      siret: status === 'professionnel' ? (siret || null) : null,
      company_name: status === 'professionnel' ? (selectedCompany?.name || companyQuery || null) : null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      location: coords ? `SRID=4326;POINT(${coords.lng} ${coords.lat})` : null,
    })
    if (dbError) { setError(dbError.message); setLoading(false); return }

    if (services.length > 1) {
      await supabase.from('services').insert(
        services.slice(1).map(s => ({ provider_id: user.id, name: s, price_cents: cents }))
      )
    }

    trackEvent('pro_onboarding_completed', { services, pricingType, status })
    router.push('/pro/onboarding/documents')
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', border: '1px solid #DCE5E3', borderRadius: 12,
    padding: '13px 14px', fontSize: 15, fontFamily: 'inherit', color: '#123644',
  }
  const bigChoiceStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '16px 16px', borderRadius: 14, marginBottom: 10,
    border: active ? '2px solid #12B39C' : '2px solid #E7EDEB',
    background: active ? 'rgba(18,179,156,.06)' : '#fff',
    fontSize: 15, fontWeight: 700, color: '#123644',
  })

  if (stepKey === 'service') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Quel service proposez-vous ?"
        subtitle="Vous pourrez en ajouter d'autres plus tard."
        onCta={next} ctaDisabled={services.length === 0}>
        {SERVICES.map(s => (
          <button key={s.key} onClick={() => setServices(x => x.includes(s.key) ? x.filter(v => v !== s.key) : [...x, s.key])}
            style={bigChoiceStyle(services.includes(s.key))}>
            {s.label}
          </button>
        ))}
      </OnboardingStep>
    )
  }

  if (stepKey === 'tarif') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Votre tarif"
        subtitle="Au forfait pour une prestation fixe, à l'heure sinon."
        onBack={back} onCta={next} ctaDisabled={!rate || Number(rate) <= 0}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['forfait', 'horaire'] as const).map(t => (
            <button key={t} onClick={() => setPricingType(t)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: pricingType === t ? '2px solid #12B39C' : '2px solid #E7EDEB', background: pricingType === t ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 14, color: '#123644' }}>
              {t === 'forfait' ? 'Forfait' : 'À l\u2019heure'}
            </button>
          ))}
        </div>
        <label>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Montant en euros {pricingType === 'horaire' ? '/ heure' : ''}</span>
          <input type="number" min="0" step="0.5" value={rate} onChange={e => setRate(e.target.value)} placeholder="25" style={{ ...inputStyle, marginTop: 6 }} />
        </label>
      </OnboardingStep>
    )
  }

  if (stepKey === 'statut') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Vous êtes…"
        onBack={back} onCta={next} ctaDisabled={!status}>
        <button onClick={() => setStatus('particulier')} style={bigChoiceStyle(status === 'particulier')}>
          Un particulier
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6E8592', marginTop: 3 }}>Voisin, étudiant… pas de structure déclarée</div>
        </button>
        <button onClick={() => setStatus('professionnel')} style={bigChoiceStyle(status === 'professionnel')}>
          Un professionnel
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6E8592', marginTop: 3 }}>Auto-entrepreneur, société…</div>
        </button>
      </OnboardingStep>
    )
  }

  if (stepKey === 'entreprise') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Votre entreprise"
        subtitle="Tapez son nom, on retrouve le SIRET et l'adresse pour vous."
        onBack={back} onCta={next} ctaDisabled={!manualEntry && !selectedCompany}>
        <input
          value={companyQuery}
          onChange={e => { setCompanyQuery(e.target.value); setSelectedCompany(null) }}
          placeholder="Ex. Sofia Services"
          style={inputStyle}
        />
        {companyResults.length > 0 && (
          <div style={{ marginTop: 8, border: '1px solid #E7EDEB', borderRadius: 12, overflow: 'hidden' }}>
            {companyResults.map(c => (
              <button key={c.siret || c.siren} onClick={() => pickCompany(c)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid #F3F6F5', background: '#fff' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{[c.address, c.postalCode, c.city].filter(Boolean).join(', ') || 'Adresse non communiquée'}</div>
              </button>
            ))}
          </div>
        )}
        {selectedCompany && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(18,179,156,.08)', fontSize: 12.5, color: '#0C8F7E', fontWeight: 600 }}>
            SIRET {selectedCompany.siret || '—'} · pré-rempli, à valider aux étapes suivantes
          </div>
        )}
        <button onClick={() => { setManualEntry(m => !m); setSelectedCompany(null) }} style={{ marginTop: 14, background: 'none', border: 'none', color: '#6E8592', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' }}>
          {manualEntry ? 'Revenir à la recherche' : "Je ne trouve pas mon entreprise, saisir le SIRET à la main"}
        </button>
        {manualEntry && (
          <input value={siret} onChange={e => setSiret(e.target.value)} placeholder="Numéro SIRET (14 chiffres)"
            style={{ ...inputStyle, marginTop: 10 }} />
        )}
      </OnboardingStep>
    )
  }

  if (stepKey === 'adresse') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Où intervenez-vous ?"
        subtitle="Pour apparaître au bon endroit sur la carte."
        onBack={back} onCta={next} ctaDisabled={!coords}>
        <button onClick={useMyLocation} disabled={locating}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: coords ? 'rgba(18,179,156,.1)' : '#123644', color: coords ? '#0C8F7E' : '#fff', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          {locating ? 'Localisation…' : coords ? '✓ Position enregistrée' : 'Utiliser ma position actuelle'}
        </button>
        <label>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Adresse (facultatif, affichée sur votre profil)</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="12 avenue de Provence, Grasse" style={{ ...inputStyle, marginTop: 6 }} />
        </label>
      </OnboardingStep>
    )
  }

  if (stepKey === 'telephone') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Votre numéro de téléphone"
        subtitle="Visible uniquement par PING, jamais publié."
        onBack={back} onCta={next} ctaDisabled={phone.trim().length < 6}>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" type="tel" style={inputStyle} />
      </OnboardingStep>
    )
  }

  // bio — dernière étape
  return (
    <OnboardingStep step={stepIndex} total={visibleSteps.length}
      title="Un mot pour vous présenter"
      subtitle="Une phrase suffit. Vous pourrez la modifier plus tard."
      onBack={back} onSkip={finish} skipLabel="Passer et terminer"
      onCta={finish} ctaLabel="Terminer" ctaLoading={loading}>
      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Ex. Ménage soigné, ponctuel, 5 ans d'expérience."
        style={{ ...inputStyle, resize: 'vertical' }} />
      {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </OnboardingStep>
  )
}
