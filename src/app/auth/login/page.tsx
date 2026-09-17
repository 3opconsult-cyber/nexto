"use client"
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import { rememberThisTabOnly } from '@/lib/auth-session'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 44px 13px 14px', border: '1.5px solid #E7EDEB', borderRadius: 14,
  fontSize: 14.5, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644',
  outline: 'none', background: '#fff',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase',
  letterSpacing: '.04em', marginBottom: 6,
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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setError('Email pas encore confirmé — vérifie ta boîte mail (et les spams) pour le lien de confirmation.')
        } else {
          setError('Email ou mot de passe incorrect')
        }
        setLoading(false)
        return
      }
      // "Rester connecté" décoché : la session ne doit pas survivre à cet onglet.
      // Voir lib/auth-session.ts pour le mécanisme (le SDK Supabase ne permet pas
      // de raccourcir la durée du cookie de session depuis le client).
      rememberThisTabOnly(rememberMe)
      // Redirection selon le profil reel (is_admin / is_pro, plus de colonne role)
      const { data: profile } = await supabase.from('profiles').select('is_admin, is_pro').single()
      if (profile?.is_admin) router.push('/admin')
      else if (profile?.is_pro) router.push('/pro/dashboard')
      else router.push('/map')
    } catch {
      setError("Une erreur est survenue, réessaie dans un instant.")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <Link href="/" style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}><Sign size={48} pulse /></Link>

        <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '28px 26px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644', marginBottom: 20 }}>Connexion</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="vous@email.com" required />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#12B39C' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6E8592' }}>Rester connecté</span>
            </label>
            {error && <p style={{ color: '#C0503A', fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, padding: 15, borderRadius: 999, cursor: 'pointer', opacity: loading ? .6 : 1, boxShadow: '0 8px 20px rgba(18,179,156,.3)' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6E8592', fontWeight: 600, marginTop: 18 }}>
            Pas encore de compte ?{' '}
            <Link href="/auth/signup" style={{ color: '#0C8F7E', fontWeight: 700 }}>S&apos;inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
