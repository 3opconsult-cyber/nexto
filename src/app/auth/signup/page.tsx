"use client"
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { captureAttribution, readAttribution } from '@/lib/attribution'
import { Sign } from '@/components/Brand'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 13px', border: '1.5px solid #E7EDEB', borderRadius: 13,
  fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644',
  outline: 'none', background: '#fff',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase',
  letterSpacing: '.04em', marginBottom: 5,
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {off
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
    </svg>
  )
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

  useEffect(() => { captureAttribution() }, [])

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const attr = readAttribution()
      const { data, error: signupError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            phone: form.phone,
            birthdate: form.birthdate,
            address: form.address,
            role,
            // D'où vient cette inscription. Repris par le trigger
            // handle_new_user_attribution : le client ne peut pas l'écrire
            // lui-même, il n'a pas encore de session à cet instant.
            ...(attr || {}),
          }
        }
      })
      if (signupError) { setError(signupError.message); setLoading(false); return }

      const refCode = params.get('ref')
      if (refCode && data.user) {
        const { data: referrer } = await supabase.from('profiles').select('id').eq('referral_code', refCode.toUpperCase()).maybeSingle()
        if (referrer && referrer.id !== data.user.id) {
          await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: data.user.id })
        }
      }

      if (role === 'pro') router.push('/pro/onboarding')
      else router.push('/map')
    } catch {
      setError("Une erreur est survenue, réessaie dans un instant.")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px' }}>
        <Link href="/" style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><Sign size={40} /></Link>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, marginBottom: 20, background: 'rgba(255,255,255,.1)' }}>
          {(['client', 'pro'] as const).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              style={{
                padding: '9px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13,
                background: role === r ? '#12B39C' : 'transparent', color: role === r ? '#fff' : 'rgba(255,255,255,.6)',
                transition: 'background .2s',
              }}>
              {r === 'client' ? 'Particulier' : 'Professionnel'}
            </button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '26px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= step ? '#12B39C' : '#E7EDEB', transition: 'background .2s' }} />
            ))}
          </div>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', marginBottom: 2 }}>
            {step === 1 ? 'Vos informations' : 'Finaliser'}
          </h1>
          <p style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 700, marginBottom: 18 }}>Étape {step} sur 2</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {step === 1 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Prénom</label>
                    <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)}
                      style={inputStyle} placeholder="Sophie" required />
                  </div>
                  <div>
                    <label style={labelStyle}>Nom</label>
                    <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)}
                      style={inputStyle} placeholder="Laurent" required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Date de naissance</label>
                  <input type="date" value={form.birthdate} onChange={e => update('birthdate', e.target.value)}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                    style={inputStyle} placeholder="+33 6 00 00 00 00" required />
                </div>
                <div>
                  <label style={labelStyle}>Adresse</label>
                  <input type="text" value={form.address} onChange={e => update('address', e.target.value)}
                    style={inputStyle} placeholder="12 rue des Lilas, Grasse" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    style={inputStyle} placeholder="vous@email.com" required />
                </div>
                <div>
                  <label style={labelStyle}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)}
                      style={{ ...inputStyle, paddingRight: 42 }} placeholder="8 caractères minimum" minLength={8} required />
                    <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <EyeIcon off={showPassword} />
                    </button>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 13, background: 'rgba(18,179,156,.08)', cursor: 'pointer' }}>
                  <input type="checkbox" required style={{ marginTop: 2, width: 16, height: 16, accentColor: '#12B39C', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0C8F7E', lineHeight: 1.4 }}>
                    J&apos;accepte les <Link href="/cgu" style={{ textDecoration: 'underline' }}>Conditions Générales</Link> et la{' '}
                    <Link href="/privacy" style={{ textDecoration: 'underline' }}>Politique de confidentialité</Link> de PING
                  </span>
                </label>
              </>
            )}
            {error && <p style={{ color: '#C0503A', fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, cursor: 'pointer', opacity: loading ? .6 : 1, boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
              {loading ? 'Création…' : step === 1 ? 'Continuer →' : 'Créer mon compte'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6E8592', fontWeight: 600, marginTop: 16 }}>
            Déjà un compte ?{' '}
            <Link href="/auth/login" style={{ color: '#0C8F7E', fontWeight: 700 }}>Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
