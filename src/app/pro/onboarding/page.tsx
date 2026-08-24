"use client"
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { searchCompany, guessLegalStatus, CompanyMatch } from '@/lib/legalLookup'
import OnboardingStep from '@/components/OnboardingStep'
import { TRADE_LIST as SERVICES } from '@/lib/trades'

type Status = 'particulier' | 'professionnel' | null

export default function ProOnboarding() {
  const router = useRouter()

  const [services, setServices] = useState<string[]>([])
  const [flatRate, setFlatRate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyResults, setCompanyResults] = useState<CompanyMatch[]>([])
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(null)
  const [manualEntry, setManualEntry] = useState(false)
  const [siret, setSiret] = useState('')
  const [sapNumber, setSapNumber] = useState('')
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

  // Pré-remplissage si un profil existe déjà : "Modifier mes informations" doit
  // éditer les vraies valeurs, pas repartir d'un formulaire vide qui écraserait
  // ce qui a déjà été renseigné (SIRET, tarif, bio...) au moment de valider.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: pp } = await supabase.from('provider_profiles').select('*').eq('id', user.id).single()
      if (pp) {
        const { data: extra } = await supabase.from('services').select('name').eq('provider_id', user.id)
        const extraNames = (extra ?? []).map((s: any) => s.name).filter((n: string) => n && n !== pp.trade)
        if (pp.trade) setServices([pp.trade, ...extraNames])
        setFlatRate(pp.base_price_cents > 0 ? String(pp.base_price_cents / 100) : '')
        setHourlyRate(pp.hourly_rate_cents != null ? String(pp.hourly_rate_cents / 100) : '')
        setStatus(pp.legal_status === 'particulier' ? 'particulier' : 'professionnel')
        setSiret(pp.siret || '')
        setSapNumber(pp.sap_number || '')
        if (pp.company_name) setCompanyQuery(pp.company_name)
        if (pp.lat != null && pp.lng != null) setCoords({ lat: pp.lat, lng: pp.lng })
        setBio(pp.bio || '')
      }
      const { data: prof } = await supabase.from('profiles').select('address, phone_enc').eq('id', user.id).single()
      if (prof) {
        if (prof.address) setAddress(prof.address)
        if (prof.phone_enc) setPhone(prof.phone_enc)
      }
    })
  }, [])

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

    const flatCents = Math.round(Number(flatRate || 0) * 100)
    const hourlyCents = hourlyRate ? Math.round(Number(hourlyRate) * 100) : null
    const legalStatus = status === 'particulier'
      ? 'particulier'
      : (selectedCompany ? guessLegalStatus(selectedCompany.natureJuridique) : 'auto_entrepreneur')

    const { error: profileErr } = await supabase.from('profiles').update({
      phone_enc: phone || null,
      address: address || null,
      is_pro: true,
    }).eq('id', user.id)
    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    const { error: dbError } = await supabase.from('provider_profiles').upsert({
      id: user.id,
      trade: services[0],
      pricing_type: flatCents > 0 ? 'forfait' : 'horaire',
      base_price_cents: flatCents,
      hourly_rate_cents: hourlyCents,
      bio,
      is_active: true,
      legal_status: legalStatus,
      siret: status === 'professionnel' ? (siret || null) : null,
      sap_number: status === 'professionnel' ? (sapNumber.trim() || null) : null,
      company_name: status === 'professionnel' ? (selectedCompany?.name || companyQuery || null) : null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      location: coords ? `SRID=4326;POINT(${coords.lng} ${coords.lat})` : null,
    })
    if (dbError) { setError(dbError.message); setLoading(false); return }

    if (services.length > 1) {
      await supabase.from('services').insert(
        services.slice(1).map(s => ({ provider_id: user.id, name: s, price_cents: flatCents || hourlyCents || 0 }))
      )
    }

    trackEvent('pro_onboarding_completed', { services, flatCents, hourlyCents, status })
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
        subtitle="Un forfait, un taux horaire, ou les deux — à vous de fixer le prix."
        onBack={back} onCta={next} ctaDisabled={!flatRate && !hourlyRate}>
        <label>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Forfait (€)</span>
          <input type="number" min="0" step="0.5" value={flatRate} onChange={e => setFlatRate(e.target.value)} placeholder="25" style={{ ...inputStyle, marginTop: 6, marginBottom: 16 }} />
        </label>
        <label>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Taux horaire (€/h)</span>
          <input type="number" min="0" step="0.5" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="18" style={{ ...inputStyle, marginTop: 6 }} />
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
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Numéro de déclaration SAP (facultatif)</span>
          <input value={sapNumber} onChange={e => setSapNumber(e.target.value)} placeholder="Ex. SAP812345678"
            style={{ ...inputStyle, marginTop: 6 }} />
          <span style={{ display: 'block', fontSize: 11.5, color: '#9CA3AF', marginTop: 5 }}>Si vous l'avez, vos clients peuvent bénéficier du crédit d'impôt de 50 %. Pas de déclaration ? Vous pouvez continuer sans, et la renseigner plus tard.</span>
        </label>
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
