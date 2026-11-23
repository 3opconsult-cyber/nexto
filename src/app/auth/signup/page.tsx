"use client"
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { captureAttribution, readAttribution } from '@/lib/attribution'
import { Sign } from '@/components/Brand'
import DateWheelPicker from '@/components/DateWheelPicker'
import WelcomeCarousel, { welcomeSeen } from '@/components/WelcomeCarousel'
import { rememberReferral, flushReferral } from '@/lib/referral'
import '../../aere.css'

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 56, padding: '14px 16px', border: '1.5px solid #CFDAD7', borderRadius: 14,
  fontSize: 17, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644',
  outline: 'none', background: '#fff',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 16, fontWeight: 600, color: '#123644',
  marginBottom: 8,
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {off
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
    </svg>
  )
}

const DRAFT_KEY = 'ping_signup_draft'
const TEXT_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'birthdate', 'address'] as const
function pickText(o: Record<string, unknown>) {
  const out: Record<string, string> = {}
  for (const k of TEXT_FIELDS) if (typeof o[k] === 'string') out[k] = o[k] as string
  return out
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'client' | 'pro') || 'client'
  const [role, setRole] = useState<'client' | 'pro'>(defaultRole)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '',
    phone: '', birthdate: '', address: '',
  })
  // Inscription réussie mais email à confirmer (pas de session) : écran dédié plutôt qu'une
  // arrivée déconnectée sur la carte.
  const [checkMail, setCheckMail] = useState(false)
  // Accueil en 3 écrans, une seule fois, pour un particulier dont le compte est actif tout de suite.
  const [welcome, setWelcome] = useState(false)
  // Case CGU tenue dans l'état : elle ne se décoche plus quand on revient à l'étape 1 puis à la 2.
  const [cguOk, setCguOk] = useState(false)

  useEffect(() => { captureAttribution(); rememberReferral(params.get('ref')) }, [params])

  // Saisie gardée le temps de l'onglet (sessionStorage, jamais le mot de passe) : un aller-retour vers une
  // autre page, un rechargement ou la bascule Particulier / Professionnel ne vident plus le formulaire.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d && typeof d === 'object') {
          if (d.form && typeof d.form === 'object') setForm(f => ({ ...f, ...pickText(d.form), password: '' }))
          if (!params.get('role') && (d.role === 'client' || d.role === 'pro')) setRole(d.role)
          if (d.step === 1 || d.step === 2) setStep(d.step)
        }
      }
    } catch { }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!hydrated) return
    try {
      const { password: _pw, ...rest } = form
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: rest, role, step }))
    } catch { }
  }, [form, role, step, hydrated])

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  // Les champs obligatoires de l'étape 1 doivent être remplis avant de passer à la 2,
  // au bouton comme au glissement du doigt.
  function step1Ok() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setError('Renseignez votre prénom, votre nom et votre téléphone pour continuer.')
      return false
    }
    const num = form.phone.replace(/[\s.\-()]/g, '')
    if (!/^(0\d{9}|\+33\d{9}|0033\d{9}|\+\d{8,15})$/.test(num)) {
      setError('Ce numéro de téléphone n’est pas valide. Exemple : 06 12 34 56 78 ou +33 6 12 34 56 78.')
      return false
    }
    setError('')
    return true
  }

  // Contrôles de l'étape 2 en français (le formulaire est en noValidate : les bulles du navigateur
  // dépendent de sa langue et ne disent pas ce qu'il faut faire).
  function step2Ok() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Indiquez une adresse e-mail valide, par exemple prenom.nom@exemple.fr.'); return false }
    if (form.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return false }
    if (!cguOk) { setError('Pour créer votre compte, acceptez les Conditions Générales et la Politique de confidentialité.'); return false }
    setError('')
    return true
  }

  function frenchError(msg: string) {
    const m = msg.toLowerCase()
    if (m.includes('already registered') || m.includes('already exists')) return 'Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.'
    if (m.includes('password') && (m.includes('weak') || m.includes('least') || m.includes('short') || m.includes('should'))) return 'Mot de passe trop faible : au moins 8 caractères, en mélangeant lettres et chiffres.'
    if (m.includes('invalid') && m.includes('email')) return 'Cette adresse email n’est pas valide.'
    if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives en peu de temps. Patientez quelques minutes puis réessayez.'
    if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion impossible : vérifiez votre réseau puis réessayez.'
    return 'L’inscription n’a pas abouti. Vérifiez vos informations et réessayez.'
  }

  function nextPath(): string | null {
    const n = params.get('next')
    return n && n.startsWith('/') && !n.startsWith('//') ? n : null
  }

  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0 && step === 1) { if (step1Ok()) setStep(2) }
    else if (dx > 0 && step === 2) setStep(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { if (step1Ok()) setStep(2); return }
    if (!step2Ok()) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const attr = readAttribution()
      const { data, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim(), password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            phone: form.phone,
            birthdate: form.birthdate || null,
            address: form.address,
            role,
            // D'où vient cette inscription. Repris par le trigger
            // handle_new_user_attribution : le client ne peut pas l'écrire
            // lui-même, il n'a pas encore de session à cet instant.
            ...(attr || {}),
          }
        }
      })
      if (signupError) { setError(frenchError(signupError.message)); setLoading(false); return }

      // Parrainage : le code est déjà gardé dans le navigateur (rememberReferral). Avec une session
      // (e-mail non confirmé exigé = pas de session), on l'enregistre tout de suite ; sinon il reste
      // en attente et sera enregistré à la première connexion ou première visite de /map.
      rememberReferral(params.get('ref'))
      if (data.session) await flushReferral()
      if (data.session && data.user) {
        try { await supabase.from('login_log').insert({ user_id: data.user.id, kind: 'signup', mode: role === 'pro' ? 'pro' : 'particulier', user_agent: navigator.userAgent.slice(0, 200) }) } catch { }
      }

      if (!data.session) { setCheckMail(true); setLoading(false); return }
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { }
      if (role === 'pro') { router.push('/pro/onboarding'); return }
      if (!welcomeSeen()) { setWelcome(true); setLoading(false); return }
      router.push(nextPath() || '/map')
    } catch {
      setError("Une erreur est survenue, réessayez dans un instant.")
      setLoading(false)
    }
  }

  if (welcome) return <WelcomeCarousel onDone={() => router.push(nextPath() || '/map')} />

  // Après confirmation de l'e-mail, un prestataire revient à son assistant (brouillon gardé).
  const afterLogin = nextPath() || (role === 'pro' ? '/pro/onboarding' : null)

  if (checkMail) return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380, marginBottom: 12 }}>
        {/* Rouvre le formulaire tel qu'il était rempli, sur l'étape de l'e-mail. */}
        <button type="button" onClick={() => { setCheckMail(false); setStep(2); setError('') }}
          style={{ border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 999, padding: '10px 16px', minHeight: 44, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ← Changer d&apos;e-mail
        </button>
      </div>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.35)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(18,179,156,.12)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', margin: '0 0 8px' }}>Vérifiez votre boîte mail</h1>
        <p style={{ fontSize: 13.5, color: '#4E6470', lineHeight: 1.55, margin: 0 }}>
          Un lien de confirmation vient d&apos;être envoyé à <b style={{ color: '#123644' }}>{form.email}</b>. Cliquez dessus pour activer
          votre compte, puis connectez-vous. Pensez à regarder dans les spams.
        </p>
        <Link href={afterLogin ? `/auth/login?next=${encodeURIComponent(afterLogin)}` : '/auth/login'}
          style={{ display: 'block', marginTop: 20, background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 999, textDecoration: 'none' }}>
          Aller à la connexion
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 40px' }}>
        <Link href="/" aria-label="ping" style={{ marginBottom: 24, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 48, minHeight: 48 }}><Sign size={40} /></Link>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, marginBottom: 24, background: 'rgba(255,255,255,.1)' }}>
          {(['client', 'pro'] as const).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              style={{
                padding: '0 22px', minHeight: 48, borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16,
                background: role === r ? '#12B39C' : 'transparent', color: role === r ? '#fff' : 'rgba(255,255,255,.85)',
                transition: 'background .2s',
              }}>
              {r === 'client' ? 'Particulier' : 'Professionnel'}
            </button>
          ))}
        </div>

        <div className="aere" style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflowX: 'hidden' }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button type="button" onClick={() => setStep(1)} disabled={step === 1} aria-label="Étape précédente"
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: step === 2 ? '#F3F6F5' : 'transparent', color: '#123644', fontSize: 18, fontWeight: 700, flexShrink: 0, visibility: step === 2 ? 'visible' : 'hidden' }}>←</button>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {[1, 2].map(s => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= step ? '#12B39C' : '#E7EDEB', transition: 'background .2s' }} />
              ))}
            </div>
          </div>
          <div key={step} className={step === 2 ? 'ob-slide-r' : 'ob-slide-l'}>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, lineHeight: 1.4, color: '#123644', marginBottom: 4 }}>
            {step === 1 ? 'Vos informations' : 'Finaliser'}
          </h1>
          <p style={{ fontSize: 16, color: '#4E6470', fontWeight: 600, marginBottom: 24 }}>Étape {step} sur 2</p>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {step === 1 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  <div>
                    <label style={labelStyle}>Prénom</label>
                    <input type="text" autoComplete="given-name" value={form.firstName} onChange={e => update('firstName', e.target.value)}
                      style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Nom</label>
                    <input type="text" autoComplete="family-name" value={form.lastName} onChange={e => update('lastName', e.target.value)}
                      style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Date de naissance</label>
                  <DateWheelPicker value={form.birthdate} onChange={v => update('birthdate', v)} />
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: form.birthdate ? '#0B6F63' : '#4E6470', fontWeight: 600, margin: '8px 0 0' }}>
                    {form.birthdate ? 'Date enregistrée.' : 'Facultatif : faites défiler pour l’indiquer (utile pour le crédit d’impôt).'}
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Adresse</label>
                  <input type="text" autoComplete="street-address" value={form.address} onChange={e => update('address', e.target.value)}
                    style={inputStyle} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={e => update('password', e.target.value)}
                      style={{ ...inputStyle, paddingRight: 56 }} minLength={8} required />
                    <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <EyeIcon off={showPassword} />
                    </button>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 14, background: 'rgba(18,179,156,.08)', cursor: 'pointer' }}>
                  <input type="checkbox" required checked={cguOk} onChange={e => setCguOk(e.target.checked)} style={{ marginTop: 0, width: 24, height: 24, accentColor: '#12B39C', flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#0B6F63', lineHeight: 1.55 }}>
                    J&apos;accepte les <a href="/cgu" target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>Conditions Générales</a> et la{' '}
                    <a href="/confidentialite" target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>Politique de confidentialité</a> de PING
                  </span>
                </label>
              </>
            )}
            {error && <p role="alert" style={{ color: '#B2432E', fontSize: 16, lineHeight: 1.55, fontWeight: 600, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, minHeight: 56, padding: 15, borderRadius: 16, cursor: 'pointer', opacity: loading ? .6 : 1 }}>
              {loading ? 'Création…' : step === 1 ? 'Continuer →' : 'Créer mon compte'}
            </button>
          </form>
          </div>
          <p style={{ textAlign: 'center', fontSize: 16, color: '#4E6470', fontWeight: 600, marginTop: 28 }}>
            Déjà un compte ?{' '}
            <Link href={nextPath() ? `/auth/login?next=${encodeURIComponent(nextPath()!)}` : '/auth/login'} style={{ color: '#0B8374', fontWeight: 700, display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
