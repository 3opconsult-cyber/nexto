"use client"
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { searchCompany, guessLegalStatus, CompanyMatch } from '@/lib/legalLookup'
import { geocodeAddress } from '@/lib/geocode'
import OnboardingStep from '@/components/OnboardingStep'
import { TRADE_LIST as SERVICES, TRADES } from '@/lib/trades'
import PricingEditor from '@/components/PricingEditor'
import { type PricingDraft, draftFromColumns, emptyDraft, toColumns, validateDraft } from '@/lib/servicePricing'

type Status = 'particulier' | 'professionnel' | null

export default function ProOnboarding() {
  const router = useRouter()

  const [services, setServices] = useState<string[]>([])
  // Un tarif par service (ménage, repassage, nettoyage) : chacun son mode et ses prix.
  const [pricing, setPricing] = useState<Record<string, PricingDraft>>({})
  const [showPricingErrors, setShowPricingErrors] = useState(false)
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
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Profil déjà existant (« Modifier ») : on garde la visibilité, le statut et l'entreprise déjà
  // renseignés, et on ne recrée pas les services déjà présents.
  const [existing, setExisting] = useState<{ isActive: boolean; legalStatus: string | null; hasCompany: boolean; serviceIds: Record<string, string> } | null>(null)

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
        const { data: extra } = await supabase.from('services')
          .select('id, name, pricing_type, base_price_cents, included_hours, hourly_rate_cents, price_cents')
          .eq('provider_id', user.id)
        // Seuls les services du catalogue (ménage, repassage…) reviennent dans la liste des métiers ;
        // les prestations du catalogue « Mes tarifs » restent gérées sur leur propre page.
        const tradeKey = (n: string) => SERVICES.find(t => t.key === n.toLowerCase() || t.label.toLowerCase() === n.toLowerCase())?.key
        const serviceIds: Record<string, string> = {}
        const drafts: Record<string, PricingDraft> = {}
        for (const row of (extra ?? []) as any[]) {
          const k = tradeKey(String(row.name || ''))
          if (!k || k === pp.trade || serviceIds[k]) continue
          serviceIds[k] = row.id
          drafts[k] = draftFromColumns(row)
        }
        if (pp.trade) {
          setServices(Array.from(new Set([pp.trade, ...Object.keys(serviceIds)])))
          // « Sur devis » n'est plus proposé pour un service principal : le prestataire choisit un des 3 modes.
          drafts[pp.trade] = pp.pricing_type === 'devis' ? emptyDraft() : draftFromColumns(pp)
        }
        setPricing(drafts)
        setExisting({ isActive: pp.is_active !== false, legalStatus: pp.legal_status ?? null, hasCompany: !!(pp.company_name || pp.siret), serviceIds })
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
    if (!navigator.geolocation) { setGeocodeError('Géolocalisation indisponible sur cet appareil — saisissez votre adresse ci-dessous.'); return }
    setLocating(true)
    setGeocodeError('')
    navigator.geolocation.getCurrentPosition(
      p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false) },
      () => { setLocating(false); setGeocodeError('Position refusée ou indisponible — saisissez votre adresse ci-dessous, on la retrouve pour vous.') },
      { timeout: 8000 }
    )
  }

  // Repli quand la geolocalisation echoue/est refusee (poste fixe, permission
  // bloquee) : sans ca, cette etape n'avait aucune issue de secours et
  // bloquait la simulation pour un testeur qui refuse l'autorisation navigateur.
  async function searchAddress() {
    if (!address.trim()) return
    setGeocoding(true)
    setGeocodeError('')
    const result = await geocodeAddress(address)
    setGeocoding(false)
    if (result) setCoords(result)
    else setGeocodeError("Adresse introuvable — précisez-la (numéro, rue, ville) ou réessayez. Vous pouvez aussi continuer sans position exacte : vous pourrez la corriger plus tard.")
  }

  function next() { setError(''); setStepIndex(i => Math.min(i + 1, visibleSteps.length - 1)) }
  function back() { setError(''); setStepIndex(i => Math.max(i - 1, 0)) }

  async function finish() {
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signup?role=pro'); return }

    const primaryCols = toColumns(pricing[services[0]] ?? emptyDraft())
    const legalStatus = status === 'particulier'
      ? 'particulier'
      : (selectedCompany ? guessLegalStatus(selectedCompany.natureJuridique)
        : (existing?.legalStatus && existing.legalStatus !== 'particulier' ? existing.legalStatus : 'auto_entrepreneur'))

    // Adresse saisie sans position : on la géolocalise ici, sinon le profil n'apparaît pas sur la carte.
    let position = coords
    if (!position && address.trim()) {
      position = await geocodeAddress(address)
      if (position) setCoords(position)
    }

    const { error: profileErr } = await supabase.from('profiles').update({
      phone_enc: phone || null,
      address: address || null,
      is_pro: true,
    }).eq('id', user.id)
    if (profileErr) { setError("L'enregistrement de vos coordonnées a échoué. Vérifiez votre connexion et réessayez."); setLoading(false); return }

    const { error: dbError } = await supabase.from('provider_profiles').upsert({
      id: user.id,
      trade: services[0],
      pricing_type: primaryCols.pricing_type,
      base_price_cents: primaryCols.base_price_cents,
      hourly_rate_cents: primaryCols.hourly_rate_cents,
      included_hours: primaryCols.included_hours,
      bio,
      // Première inscription : visible tout de suite. Modification : on garde le choix du prestataire.
      is_active: existing ? existing.isActive : true,
      legal_status: legalStatus,
      siret: status === 'professionnel' ? (siret || null) : null,
      sap_number: status === 'professionnel' ? (sapNumber.trim() || null) : null,
      company_name: status === 'professionnel' ? (selectedCompany?.name || companyQuery || null) : null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      location: position ? `SRID=4326;POINT(${position.lng} ${position.lat})` : null,
    })
    if (dbError) { setError("L'enregistrement de votre profil a échoué. Vérifiez votre connexion et réessayez."); setLoading(false); return }

    // Services supplémentaires : chacun son propre tarif, une ligne par service dans « Mes tarifs ».
    // Mise à jour si la ligne existe déjà (retour sur « Modifier »), création sinon — jamais de doublon.
    const ids = existing?.serviceIds ?? {}
    for (const k of services.slice(1)) {
      const cols = toColumns(pricing[k] ?? emptyDraft())
      const { error: svcErr } = ids[k]
        ? await supabase.from('services').update(cols).eq('id', ids[k])
        : await supabase.from('services').insert({ provider_id: user.id, name: TRADES[k] || k, ...cols })
      if (svcErr) { setError(`Votre profil est enregistré, mais le tarif « ${TRADES[k] || k} » n'a pas pu l'être. Corrigez-le dans « Mes tarifs ».`); setLoading(false); return }
    }

    trackEvent('pro_onboarding_completed', { services, pricing: services.map(k => pricing[k]?.mode), status })
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
    const draftFor = (k: string) => pricing[k] ?? emptyDraft()
    const allValid = services.every(k => !validateDraft(draftFor(k)))
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title={services.length > 1 ? 'Vos tarifs' : 'Votre tarif'}
        subtitle={services.length > 1 ? 'Un prix pour chaque service : forfait, à l’heure, ou forfait avec heures supplémentaires.' : 'Forfait, à l’heure, ou forfait avec heures supplémentaires.'}
        onBack={back}
        onCta={() => { if (allValid) { setShowPricingErrors(false); next() } else setShowPricingErrors(true) }}>
        {services.map(k => (
          <div key={k} style={{ border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, marginBottom: 12, background: '#fff' }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 10 }}>{TRADES[k] || k}</div>
            <PricingEditor value={draftFor(k)} showError={showPricingErrors}
              onChange={d => setPricing(p => ({ ...p, [k]: d }))} />
          </div>
        ))}
        {showPricingErrors && !allValid && (
          <p style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600 }}>Complétez le tarif de chaque service pour continuer.</p>
        )}
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
        onBack={back} onCta={next} ctaDisabled={!manualEntry && !selectedCompany && !existing?.hasCompany}>
        <input
          value={companyQuery}
          onChange={e => { setCompanyQuery(e.target.value); setSelectedCompany(null) }}
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
          <input value={siret} onChange={e => setSiret(e.target.value)}
            style={{ ...inputStyle, marginTop: 10 }} />
        )}
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Numéro de déclaration SAP (facultatif)</span>
          <input value={sapNumber} onChange={e => setSapNumber(e.target.value)}
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
        onBack={back} onCta={next} ctaDisabled={!coords && !address.trim()}>
        <button onClick={useMyLocation} disabled={locating}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: coords ? 'rgba(18,179,156,.1)' : '#123644', color: coords ? '#0C8F7E' : '#fff', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          {locating ? 'Localisation…' : coords ? '✓ Position enregistrée' : 'Utiliser ma position actuelle'}
        </button>
        <label>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Adresse {coords ? '(affichée sur votre profil)' : '— sert aussi à vous localiser si la géolocalisation ne fonctionne pas'}</span>
          <input value={address} onChange={e => setAddress(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
        </label>
        {!coords && (
          <button onClick={searchAddress} disabled={!address.trim() || geocoding}
            style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', fontWeight: 700, fontSize: 13.5, opacity: (!address.trim() || geocoding) ? .5 : 1 }}>
            {geocoding ? 'Recherche…' : 'Retrouver cette adresse sur la carte'}
          </button>
        )}
        {geocodeError && <p style={{ fontSize: 12, color: '#c0503a', marginTop: 10, lineHeight: 1.5 }}>{geocodeError}</p>}
      </OnboardingStep>
    )
  }

  if (stepKey === 'telephone') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length}
        title="Votre numéro de téléphone"
        subtitle="Visible uniquement par PING, jamais publié."
        onBack={back} onCta={next} ctaDisabled={phone.trim().length < 6}>
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inputStyle} />
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
      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
        style={{ ...inputStyle, resize: 'vertical' }} />
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 1.4 }}>
        Ce texte est public. Pour votre sécurité, n'y indiquez ni numéro de téléphone ni nom d'enseigne —
        les échanges et paiements passent par PING.
      </p>
      {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </OnboardingStep>
  )
}
