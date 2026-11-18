"use client"
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { searchCompany, guessLegalStatus, CompanyMatch } from '@/lib/legalLookup'
import { geocodeAddress } from '@/lib/geocode'
import OnboardingStep from '@/components/OnboardingStep'
import { TRADE_LIST as SERVICES, TRADES, cesuEligible } from '@/lib/trades'
import { LEGAL_FORMS, type LegalForm, type VatStatus, VAT_FRANCHISE_MENTION, guessLegalForm, legalStatusFor, cleanVat, vatNumberValid, isMissingColumnError, PRO_STATUS_COLUMNS } from '@/lib/proStatus'
import PricingEditor from '@/components/PricingEditor'
import { CGV_VERSION } from '@/lib/cgv'
import { type PricingDraft, draftFromColumns, emptyDraft, toColumns, validateDraft } from '@/lib/servicePricing'
import { writeMode } from '@/lib/mode'

type Status = 'particulier' | 'professionnel' | null

// Numéro français : 10 chiffres commençant par 0, ou +33 / 0033 suivi de 9 chiffres (espaces, points, tirets tolérés).
function cleanPhone(v: string) { return v.replace(/[\s.\-()]/g, '') }
function phoneValid(v: string) { return /^(0\d{9}|\+33\d{9}|0033\d{9})$/.test(cleanPhone(v)) }

// Brouillon de l'assistant (lot 5, 18/11/2026) : seulement à la création d'une activité (jamais quand un
// prestataire modifie un profil existant, qui se recharge depuis la base). Lié au compte (uid), repris à la
// même étape ; « Plus tard » ou un retour par « Espace prestataire » ne perdent rien. Effacé à « Terminer ».
const DRAFT_KEY = 'ping_pro_draft'
type ProDraft = {
  v: 1; uid: string | null; stepKey: string
  services: string[]; pricing: Record<string, PricingDraft>; status: Status
  companyQuery: string; selectedCompany: CompanyMatch | null; manualEntry: boolean
  siret: string; sapNumber: string; address: string; coords: { lat: number; lng: number } | null
  phone: string; confirmedInfo: boolean; bio: string; website: string
  // Ajoutés le 18/11/2026 (facultatifs : un brouillon plus ancien se relit sans eux).
  legalForm?: LegalForm | null; vatStatus?: VatStatus | null; vatNumber?: string; acceptsCesu?: boolean
}
function readDraft(): ProDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    return d && d.v === 1 && Array.isArray(d.services) ? d as ProDraft : null
  } catch { return null }
}
function stepsFor(status: Status) {
  return status === 'professionnel'
    ? ['service', 'tarif', 'statut', 'entreprise', 'forme', 'adresse', 'bio']
    : ['service', 'tarif', 'statut', 'adresse', 'bio']
}

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
  // Statut juridique et fiscal (18/11/2026, migration 039) : forme juridique, TVA, CESU préfinancé.
  const [legalForm, setLegalForm] = useState<LegalForm | null>(null)
  const [vatStatus, setVatStatus] = useState<VatStatus | null>(null)
  const [vatNumber, setVatNumber] = useState('')
  const [vatTouched, setVatTouched] = useState(false)
  const [acceptsCesu, setAcceptsCesu] = useState(false)
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [prefilled, setPrefilled] = useState(false)   // infos reprises du compte : a confirmer
  const [confirmedInfo, setConfirmedInfo] = useState(false)
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  // CGV prestataires + contrat de commission : case obligatoire à la dernière étape (déjà cochée si la
  // version en vigueur a été acceptée, la date d'origine est alors conservée).
  const [cgvOk, setCgvOk] = useState(false)
  const [cgvAlready, setCgvAlready] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Profil déjà existant (« Modifier ») : on garde la visibilité, le statut et l'entreprise déjà
  // renseignés, et on ne recrée pas les services déjà présents.
  const [existing, setExisting] = useState<{ isActive: boolean; legalStatus: string | null; hasCompany: boolean; serviceIds: Record<string, string> } | null>(null)

  // Brouillon actif (création d'activité, compte connu) : sauvegarde à chaque saisie.
  const [draftOn, setDraftOn] = useState(false)
  const uidRef = useRef<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleSteps = useMemo(() => stepsFor(status), [status])
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
        // Colonnes de la migration 039 : absentes (undefined) tant qu'elle n'est pas appliquée.
        if (pp.legal_form) setLegalForm(pp.legal_form)
        else if (pp.legal_status === 'auto_entrepreneur') setLegalForm('micro')
        else if (['eurl', 'sasu', 'sarl'].includes(pp.legal_status)) setLegalForm(pp.legal_status)
        if (pp.vat_status) setVatStatus(pp.vat_status)
        if (pp.vat_number) setVatNumber(pp.vat_number)
        if (pp.accepts_cesu_prefinance) setAcceptsCesu(true)
        if (pp.company_name) setCompanyQuery(pp.company_name)
        if (pp.lat != null && pp.lng != null) setCoords({ lat: pp.lat, lng: pp.lng })
        setBio(pp.bio || '')
        setWebsite(pp.website || '')
        if (pp.cgv_version === CGV_VERSION) { setCgvOk(true); setCgvAlready(true) }
      }
      const { data: prof } = await supabase.from('profiles').select('address, phone_enc').eq('id', user.id).single()
      if (prof) {
        if (prof.address) setAddress(prof.address)
        if (prof.phone_enc) setPhone(prof.phone_enc)
        if (prof.address || prof.phone_enc) setPrefilled(true)
      }
      if (pp) return
      // Création : reprise du brouillon de ce compte (ou d'une saisie faite juste avant l'inscription).
      const d = readDraft()
      if (d && (d.uid === null || d.uid === user.id)) {
        setServices(d.services)
        setPricing(d.pricing || {})
        setStatus(d.status ?? null)
        setCompanyQuery(d.companyQuery || '')
        setSelectedCompany(d.selectedCompany ?? null)
        setManualEntry(!!d.manualEntry)
        setSiret(d.siret || '')
        setSapNumber(d.sapNumber || '')
        setLegalForm(d.legalForm ?? null)
        setVatStatus(d.vatStatus ?? null)
        setVatNumber(d.vatNumber || '')
        setAcceptsCesu(!!d.acceptsCesu)
        if (d.address) setAddress(d.address)
        if (d.coords) setCoords(d.coords)
        if (d.phone) setPhone(d.phone)
        setConfirmedInfo(!!d.confirmedInfo)
        setBio(d.bio || '')
        setWebsite(d.website || '')
        const i = stepsFor(d.status ?? null).indexOf(d.stepKey)
        // Une étape n'est reprise que si les précédentes sont remplies (au moins un service choisi).
        if (i > 0 && d.services.length > 0) setStepIndex(i)
      }
      uidRef.current = user.id
      setDraftOn(true)
    })
  }, [])

  useEffect(() => {
    if (!draftOn) return
    const d: ProDraft = {
      v: 1, uid: uidRef.current, stepKey, services, pricing, status, companyQuery, selectedCompany, manualEntry,
      siret, sapNumber, address, coords, phone, confirmedInfo, bio, website,
      legalForm, vatStatus, vatNumber, acceptsCesu,
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { }
  }, [draftOn, stepKey, services, pricing, status, companyQuery, selectedCompany, manualEntry, siret, sapNumber, address, coords, phone, confirmedInfo, bio, website, legalForm, vatStatus, vatNumber, acceptsCesu])

  // « Plus tard » : retour à l'espace particulier, le brouillon reste (repris par « Devenir prestataire »).
  function later() {
    writeMode('particulier')
    router.push('/map')
  }
  const laterProps = draftOn ? { onLater: later, laterNote: 'Brouillon enregistré' } : {}

  function pickCompany(c: CompanyMatch) {
    setSelectedCompany(c)
    setCompanyQuery(c.name)
    setCompanyResults([])
    setSiret(c.siret)
    if (c.address) setAddress([c.address, c.postalCode, c.city].filter(Boolean).join(', '))
    if (c.lat != null && c.lng != null) setCoords({ lat: c.lat, lng: c.lng })
    const g = guessLegalForm(c.natureJuridique)
    if (g) setLegalForm(g)
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
    if (!cgvOk) { setError('Cochez l’acceptation des CGV prestataires et du contrat de commission pour terminer.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Session perdue en cours de route : la saisie reste dans le brouillon, reprise après l'inscription
      // ou la connexion (lien « Se connecter » de l'inscription, qui garde ?next=).
      if (draftOn) {
        const d = readDraft()
        if (d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, uid: null })) } catch { } }
      }
      router.push(`/auth/signup?role=pro&next=${encodeURIComponent('/pro/onboarding')}`)
      return
    }

    const primaryCols = toColumns(pricing[services[0]] ?? emptyDraft())
    const legalStatus = status === 'particulier'
      ? 'particulier'
      : legalStatusFor(legalForm, selectedCompany ? guessLegalStatus(selectedCompany.natureJuridique)
        : (existing?.legalStatus && existing.legalStatus !== 'particulier' ? existing.legalStatus : 'auto_entrepreneur'))
    const isPro = status === 'professionnel'
    const offersCesu = services.some(cesuEligible)
    // Champs de la migration 039 : envoyés, puis retirés si la base ne les connaît pas encore.
    const statusCols: Record<string, any> = {
      legal_form: isPro ? legalForm : null,
      vat_status: isPro ? vatStatus : null,
      vat_number: isPro && vatStatus === 'assujetti' && vatNumber.trim() ? cleanVat(vatNumber) : null,
      accepts_cesu_prefinance: isPro && offersCesu && acceptsCesu,
    }

    // Adresse saisie sans position : on la géolocalise ici, sinon le profil n'apparaît pas sur la carte.
    let position = coords
    if (!position && address.trim()) {
      position = await geocodeAddress(address)
      if (position) setCoords(position)
    }

    const { error: profileErr } = await supabase.from('profiles').update({
      phone_enc: phone.trim() ? cleanPhone(phone) : null,
      address: address || null,
      is_pro: true,
    }).eq('id', user.id)
    if (profileErr) { setError("L'enregistrement de vos coordonnées a échoué. Vérifiez votre connexion et réessayez."); setLoading(false); return }

    const baseRow = {
      id: user.id,
      trade: services[0],
      pricing_type: primaryCols.pricing_type,
      base_price_cents: primaryCols.base_price_cents,
      hourly_rate_cents: primaryCols.hourly_rate_cents,
      included_hours: primaryCols.included_hours,
      bio,
      website: website.trim() || null,
      ...(cgvAlready ? {} : { cgv_accepted_at: new Date().toISOString(), cgv_version: CGV_VERSION }),
      // Première inscription : visible tout de suite. Modification : on garde le choix du prestataire.
      is_active: existing ? existing.isActive : true,
      legal_status: legalStatus,
      siret: status === 'professionnel' ? (siret || null) : null,
      sap_number: status === 'professionnel' ? (sapNumber.trim() || null) : null,
      company_name: status === 'professionnel' ? (selectedCompany?.name || companyQuery || null) : null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      location: position ? `SRID=4326;POINT(${position.lng} ${position.lat})` : null,
    }
    let { error: dbError } = await supabase.from('provider_profiles').upsert({ ...baseRow, ...statusCols })
    if (dbError && isMissingColumnError(dbError)) {
      // Migration 039 pas encore appliquée : on enregistre le profil sans le statut détaillé.
      const row: Record<string, any> = { ...baseRow, ...statusCols }
      for (const c of PRO_STATUS_COLUMNS) delete row[c]
      ;({ error: dbError } = await supabase.from('provider_profiles').upsert(row))
    }
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

    try { localStorage.removeItem(DRAFT_KEY) } catch { }
    setDraftOn(false)
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
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
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
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
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
        {SERVICES.some(t => !services.includes(t.key)) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#4E6470', marginBottom: 8 }}>Ajouter une prestation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SERVICES.filter(t => !services.includes(t.key)).map(t => (
                <button key={t.key} type="button" onClick={() => setServices(sv => sv.includes(t.key) ? sv : [...sv, t.key])}
                  style={{ border: '1.5px dashed #12B39C', background: '#fff', color: '#0C8F7E', borderRadius: 999, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  + {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {services.length > 1 && (
          <button type="button" onClick={() => setServices(sv => sv.slice(0, -1))}
            style={{ background: 'none', border: 'none', color: '#4E6470', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', marginBottom: 10 }}>
            Retirer la dernière prestation
          </button>
        )}
        {showPricingErrors && !allValid && (
          <p style={{ color: 'var(--danger, #C0503A)', fontSize: 12.5, fontWeight: 600 }}>Complétez le tarif de chaque service pour continuer.</p>
        )}
      </OnboardingStep>
    )
  }

  if (stepKey === 'statut') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
        title="Vous êtes…"
        onBack={back} onCta={next} ctaDisabled={!status}>
        <button onClick={() => setStatus('particulier')} style={bigChoiceStyle(status === 'particulier')}>
          Un particulier
          <div style={{ fontSize: 12, fontWeight: 500, color: '#4E6470', marginTop: 3 }}>Voisin, étudiant… pas de structure déclarée</div>
        </button>
        <button onClick={() => setStatus('professionnel')} style={bigChoiceStyle(status === 'professionnel')}>
          Un professionnel
          <div style={{ fontSize: 12, fontWeight: 500, color: '#4E6470', marginTop: 3 }}>Auto-entrepreneur, société…</div>
        </button>
      </OnboardingStep>
    )
  }

  if (stepKey === 'entreprise') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
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
                <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{[c.address, c.postalCode, c.city].filter(Boolean).join(', ') || 'Adresse non communiquée'}</div>
              </button>
            ))}
          </div>
        )}
        {selectedCompany && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(18,179,156,.08)', fontSize: 12.5, color: '#0C8F7E', fontWeight: 600 }}>
            SIRET {selectedCompany.siret || '—'} · pré-rempli, à valider aux étapes suivantes
          </div>
        )}
        <button onClick={() => { setManualEntry(m => !m); setSelectedCompany(null) }} style={{ marginTop: 14, background: 'none', border: 'none', color: '#4E6470', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' }}>
          {manualEntry ? 'Revenir à la recherche' : "Je ne trouve pas mon entreprise, saisir le SIRET à la main"}
        </button>
        {manualEntry && (
          <input value={siret} onChange={e => setSiret(e.target.value)}
            style={{ ...inputStyle, marginTop: 10 }} />
        )}
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Numéro de déclaration SAP (facultatif)</span>
          <input value={sapNumber} onChange={e => setSapNumber(e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }} />
          <span style={{ display: 'block', fontSize: 11.5, color: '#6E8592', marginTop: 5 }}>Si vous l'avez, vos clients peuvent bénéficier du crédit d'impôt de 50 %. Pas de déclaration ? Vous pouvez continuer sans, et la renseigner plus tard.</span>
        </label>
        {services.some(cesuEligible) && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 12, borderRadius: 12, border: acceptsCesu ? '1.5px solid #12B39C' : '1.5px solid #DCE5E3', background: acceptsCesu ? 'rgba(18,179,156,.06)' : '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={acceptsCesu} onChange={e => setAcceptsCesu(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#12B39C', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#123644', lineHeight: 1.5 }}>
              <b>J&apos;accepte le CESU préfinancé</b>
              <span style={{ display: 'block', fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>Titres remis au client par son employeur ou son comité d&apos;entreprise. Il faut être déclaré services à la personne et affilié au CRCESU. Affiché « Accepte le CESU préfinancé » sur votre profil.</span>
            </span>
          </label>
        )}
      </OnboardingStep>
    )
  }

  if (stepKey === 'forme') {
    const vatOk = vatStatus === 'franchise' || (vatStatus === 'assujetti' && vatNumberValid(vatNumber))
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
        title="Forme juridique et TVA"
        subtitle="Pour que vos factures portent les bonnes mentions."
        onBack={back}
        onCta={() => { setVatTouched(true); if (legalForm && vatOk) next() }}
        ctaDisabled={!legalForm || !vatStatus || (vatTouched && !vatOk)}>
        <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Forme juridique</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 18px' }}>
          {LEGAL_FORMS.map(f => (
            <button key={f.key} type="button" onClick={() => setLegalForm(f.key)}
              style={{ border: legalForm === f.key ? '2px solid #12B39C' : '2px solid #E7EDEB', background: legalForm === f.key ? 'rgba(18,179,156,.06)' : '#fff', color: '#123644', borderRadius: 999, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>TVA</span>
        <button type="button" onClick={() => setVatStatus('franchise')} style={{ ...bigChoiceStyle(vatStatus === 'franchise'), marginTop: 8 }}>
          Je ne facture pas la TVA
          <div style={{ fontSize: 12, fontWeight: 500, color: '#4E6470', marginTop: 3 }}>Franchise en base : « {VAT_FRANCHISE_MENTION} » sur vos factures</div>
        </button>
        <button type="button" onClick={() => setVatStatus('assujetti')} style={bigChoiceStyle(vatStatus === 'assujetti')}>
          Je suis assujetti à la TVA
          <div style={{ fontSize: 12, fontWeight: 500, color: '#4E6470', marginTop: 3 }}>Votre numéro de TVA intracommunautaire figure sur vos factures</div>
        </button>
        {vatStatus === 'assujetti' && (
          <label style={{ display: 'block', marginTop: 4 }}>
            <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>N° de TVA intracommunautaire</span>
            <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} onBlur={() => vatNumber.trim() && setVatTouched(true)}
              autoCapitalize="characters" aria-invalid={vatTouched && !vatNumberValid(vatNumber)}
              style={{ ...inputStyle, marginTop: 6, borderColor: vatTouched && !vatNumberValid(vatNumber) ? '#c0503a' : '#DCE5E3' }} />
            {vatTouched && !vatNumberValid(vatNumber) && (
              <span style={{ display: 'block', fontSize: 11.5, color: '#c0503a', marginTop: 5, fontWeight: 600 }}>Numéro invalide : FR suivi de 11 caractères (ex. FR 12 345678901).</span>
            )}
          </label>
        )}
      </OnboardingStep>
    )
  }

  if (stepKey === 'adresse') {
    return (
      <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
        title="Où intervenez-vous ?"
        subtitle="Pour apparaître au bon endroit sur la carte."
        onBack={back} onCta={() => { setPhoneTouched(true); if (phoneValid(phone) && (!prefilled || confirmedInfo)) next() }}
        ctaDisabled={(!coords && !address.trim()) || (phoneTouched && !phoneValid(phone)) || (prefilled && !confirmedInfo)}>
        <button onClick={useMyLocation} disabled={locating}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: coords ? 'rgba(18,179,156,.1)' : '#123644', color: coords ? '#0C8F7E' : '#fff', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          {locating ? 'Localisation…' : coords ? '✓ Position enregistrée' : 'Utiliser ma position actuelle'}
        </button>
        <label>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Adresse {coords ? '(affichée sur votre profil)' : '— sert aussi à vous localiser si la géolocalisation ne fonctionne pas'}</span>
          <input value={address} onChange={e => setAddress(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
        </label>
        {!coords && (
          <button onClick={searchAddress} disabled={!address.trim() || geocoding}
            style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', fontWeight: 700, fontSize: 13.5, opacity: (!address.trim() || geocoding) ? .5 : 1 }}>
            {geocoding ? 'Recherche…' : 'Retrouver cette adresse sur la carte'}
          </button>
        )}
        {geocodeError && <p style={{ fontSize: 12, color: '#c0503a', marginTop: 10, lineHeight: 1.5 }}>{geocodeError}</p>}
        {prefilled && (
          <p style={{ fontSize: 12.5, color: '#8A5A00', background: '#FFF4DD', borderRadius: 12, padding: 10, marginTop: 14, lineHeight: 1.5 }}>
            Ces informations viennent de votre compte. Relisez-les, corrigez-les si besoin, puis confirmez-les pour votre profil prestataire.
          </p>
        )}
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Téléphone</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => phone.trim() && setPhoneTouched(true)}
            type="tel" inputMode="tel" autoComplete="tel" aria-invalid={phoneTouched && !phoneValid(phone)}
            style={{ ...inputStyle, marginTop: 6, borderColor: phoneTouched && !phoneValid(phone) ? '#c0503a' : '#DCE5E3' }} />
          {phoneTouched && !phoneValid(phone)
            ? <span style={{ display: 'block', fontSize: 11.5, color: '#c0503a', marginTop: 5, fontWeight: 600 }}>Numéro invalide : saisissez 10 chiffres commençant par 0, ou un numéro en +33.</span>
            : <span style={{ display: 'block', fontSize: 11.5, color: '#6E8592', marginTop: 5 }}>Obligatoire. Visible uniquement par PING, jamais publié.</span>}
        </label>
        {prefilled && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 13.5, color: '#123644', fontWeight: 600 }}>
            <input type="checkbox" checked={confirmedInfo} onChange={e => setConfirmedInfo(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1 }} />
            <span>Je confirme que mon adresse et mon téléphone sont exacts.</span>
          </label>
        )}
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Site internet (facultatif)</span>
          <input value={website} onChange={e => setWebsite(e.target.value)} inputMode="url" style={{ ...inputStyle, marginTop: 6 }} />
        </label>
      </OnboardingStep>
    )
  }

  // bio — dernière étape
  return (
    <OnboardingStep step={stepIndex} total={visibleSteps.length} {...laterProps}
      title="Un mot pour vous présenter"
      subtitle="Une phrase suffit. Vous pourrez la modifier plus tard."
      onBack={back} onSkip={finish} skipLabel="Passer et terminer"
      onCta={finish} ctaLabel="Terminer" ctaLoading={loading} ctaDisabled={!cgvOk}>
      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
        style={{ ...inputStyle, resize: 'vertical' }} />
      <p style={{ fontSize: 11, color: '#6E8592', marginTop: 8, lineHeight: 1.4 }}>
        Ce texte est public. Pour votre sécurité, n'y indiquez ni numéro de téléphone ni nom d'enseigne —
        les échanges et paiements passent par PING.
      </p>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 12, borderRadius: 12, border: cgvOk ? '1.5px solid #12B39C' : '1.5px solid #DCE5E3', background: cgvOk ? 'rgba(18,179,156,.06)' : '#fff', cursor: 'pointer' }}>
        <input type="checkbox" checked={cgvOk} onChange={e => { setCgvOk(e.target.checked); setError('') }} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#12B39C', flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#123644', lineHeight: 1.5 }}>
          J&apos;accepte les <a href="/cgu#prestataires" target="_blank" rel="noreferrer" style={{ color: '#0C8F7E', fontWeight: 700 }}>CGV prestataires et le contrat de commission</a> :
          commission PING retenue sur mes versements, prélèvement SEPA des commissions non retenues, suspension en cas d&apos;impayé.
        </span>
      </label>
      {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </OnboardingStep>
  )
}
