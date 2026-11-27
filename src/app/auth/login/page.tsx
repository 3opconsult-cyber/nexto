"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import { rememberThisTabOnly } from '@/lib/auth-session'
import { flushReferral } from '@/lib/referral'
import { safeNext, homeFor, isAdminPath, logLogin } from '@/lib/authRedirect'
import '../../aere.css'

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 56, padding: '14px 52px 14px 16px', border: '1.5px solid #CFDAD7', borderRadius: 14,
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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')
  const [next, setNext] = useState<string | null>(null)
  useEffect(() => { setNext(nextPath()) }, [])

  // ?next=/chemin : retour à la page d'origine après connexion (chemins internes uniquement).
  function nextPath(): string | null {
    if (typeof window === 'undefined') return null
    return safeNext(new URLSearchParams(window.location.search).get('next'))
  }

  const [resetBusy, setResetBusy] = useState(false)
  async function resetPassword() {
    setError(''); setInfo('')
    const addr = email.trim()
    if (!addr) { setError('Indiquez votre email ci-dessus, puis cliquez à nouveau sur « Mot de passe oublié ? ».'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError('Cette adresse email n’est pas valide. Vérifiez-la, puis cliquez à nouveau sur « Mot de passe oublié ? ».'); return }
    setResetBusy(true)
    const { error } = await createClient().auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/auth/reset` })
    setResetBusy(false)
    if (error) {
      const msg = (error.message || '').toLowerCase()
      const code = (error as { code?: string }).code || ''
      if (error.status === 429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('security purposes')) {
        const wait = msg.match(/after (\d+) second/)
        setError(wait ? `Un lien vient déjà d’être demandé. Patientez ${wait[1]} secondes avant d’en redemander un.` : 'Trop de demandes en peu de temps. Réessayez dans quelques minutes.')
      } else setError('L’envoi du lien a échoué. Réessayez dans un instant.')
    } else setInfo('Si un compte existe pour cet email, un lien de réinitialisation vient d’y être envoyé (pensez aux spams).')
  }

  // /admin est servi par un rewrite hors App Router : navigation complète (voir isAdminPath).
  function go(path: string) {
    if (isAdminPath(path)) window.location.assign(path)
    else router.push(path)
  }

  // Lien magique : un lien de connexion à usage unique envoyé par e-mail (le mot de passe reste possible).
  // shouldCreateUser: false — aucun compte n'est créé ainsi, l'inscription reste /auth/signup.
  // Réponse identique que le compte existe ou non (on ne révèle pas quels e-mails sont inscrits).
  const [magicBusy, setMagicBusy] = useState(false)
  async function sendMagicLink() {
    setError(''); setInfo('')
    const addr = email.trim()
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('Indiquez votre email ci-dessus, puis cliquez à nouveau sur « Recevoir un lien de connexion par e-mail ».')
      return
    }
    setMagicBusy(true)
    const target = nextPath()
    const emailRedirectTo = `${window.location.origin}/auth/callback${target ? `?next=${encodeURIComponent(target)}` : ''}`
    const { error } = await createClient().auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false, emailRedirectTo } })
    setMagicBusy(false)
    const sent = 'Si un compte existe pour cet email, un lien de connexion vient d’y être envoyé (pensez aux spams). Ouvrez-le sur cet appareil, dans ce navigateur : il n’est valable qu’une fois.'
    if (!error) { setInfo(sent); return }
    const msg = (error.message || '').toLowerCase()
    const code = (error as { code?: string }).code || ''
    if (error.status === 429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('security purposes')) {
      const wait = msg.match(/after (\d+) second/)
      setError(wait
        ? `Un lien vient déjà d’être demandé. Patientez ${wait[1]} secondes avant d’en redemander un, ou connectez-vous avec votre mot de passe.`
        : 'Trop de liens de connexion envoyés en peu de temps. Réessayez dans quelques minutes, ou connectez-vous avec votre mot de passe.')
      return
    }
    // Compte inexistant (création refusée par shouldCreateUser: false) : même réponse qu'en cas de succès.
    if (code === 'otp_disabled' || msg.includes('signups not allowed') || msg.includes('user not found')) { setInfo(sent); return }
    setError('L’envoi du lien a échoué. Réessayez dans un instant, ou connectez-vous avec votre mot de passe.')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email.trim() || !password) { setError('Indiquez votre email et votre mot de passe.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: signed, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setError('Email pas encore confirmé — vérifiez votre boîte mail (et les spams) pour le lien de confirmation.')
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
      // Liste de la carte d'arrivée (et Messages, Agenda, Mes demandes) lue dès maintenant, en parallèle du
      // reste (audit ergonomie 19/11 ter, corrections 2 et 3) : la carte s'affiche à l'arrivée depuis le cache.
      const signedId = signed?.user?.id
      const warm = signedId
        ? import('@/lib/loginWarm').then(m => m.warmAfterLogin(supabase, signedId)).catch(() => { })
        : null
      // Journal de connexion : date et heure de chaque connexion (table login_log).
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) await logLogin(supabase, u.id)
      await flushReferral() // parrainage laissé en attente à l'inscription (e-mail à confirmer)
      // ?next= d'abord (chemin interne vérifié), sinon l'espace qui correspond au profil.
      const next = nextPath()
      if (next) { go(next); return }
      const home = await homeFor(supabase, u?.id ?? null)
      // Arrivée sur une carte : on laisse à sa liste un instant (1,5 s au plus) pour être déjà là.
      if (warm && (home === '/pro/carte' || home === '/map')) await Promise.race([warm, new Promise(r => setTimeout(r, 1500))])
      go(home)
    } catch {
      setError("Une erreur est survenue, réessayez dans un instant.")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 40px' }}>
        <Link href="/bienvenue" style={{ alignSelf: 'flex-start', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 16, minHeight: 48, textDecoration: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg> Retour
        </Link>
        <Link href="/" aria-label="ping" style={{ margin: '24px 0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Sign size={48} dot="#12B39C" />
          <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 28, color: '#fff', lineHeight: 1 }}>ping</span>
        </Link>

        <div className="aere" style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: '32px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', margin: '0 0 24px' }}>Connexion</h1>
          <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" name="email" id="email" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} name="password" id="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
                <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 52, flexWrap: 'wrap' }}>
              <button type="button" role="switch" aria-checked={rememberMe} aria-label="Rester connecté" onClick={() => setRememberMe(v => !v)}
                style={{ width: 44, height: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <span style={{ position: 'relative', width: 40, height: 24, borderRadius: 99, background: rememberMe ? '#0B8374' : '#C9D5D2', transition: 'background .2s', display: 'block' }}>
                  <span style={{ position: 'absolute', top: 3, left: rememberMe ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </span>
              </button>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#4E6470', whiteSpace: 'nowrap' }}>Rester connecté</span>
              <button type="button" onClick={resetPassword}
                style={{ minHeight: 48, border: 'none', background: 'none', padding: 0, marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap', color: '#0B8374', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {resetBusy ? 'Envoi du lien…' : 'Mot de passe oublié ?'}
              </button>
            </div>
            {error && <p role="alert" style={{ color: '#B3402F', fontSize: 16, lineHeight: 1.55, fontWeight: 600, margin: 0 }}>{error}</p>}
            {info && <p role="status" style={{ color: '#0B6F63', fontSize: 16, lineHeight: 1.55, fontWeight: 600, margin: 0 }}>{info}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, minHeight: 56, padding: 15, borderRadius: 16, cursor: 'pointer', opacity: loading ? .6 : 1 }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#4E6470', fontSize: 16, fontWeight: 600, margin: '4px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#E3EAE8' }} />ou<span style={{ flex: 1, height: 1, background: '#E3EAE8' }} />
            </div>
            <button type="button" onClick={sendMagicLink} disabled={magicBusy}
              style={{ width: '100%', minHeight: 56, border: 'none', background: 'none', color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, padding: 13, borderRadius: 16, cursor: 'pointer', boxShadow: 'inset 0 0 0 1.5px #0B8374', opacity: magicBusy ? .6 : 1 }}>
              {magicBusy ? 'Envoi du lien…' : 'Recevoir un lien de connexion par e-mail'}
            </button>
            <p style={{ fontSize: 15, color: '#4E6470', margin: '-6px 0 0', lineHeight: 1.55, textAlign: 'center' }}>Sans mot de passe : saisissez votre email, puis ouvrez le lien reçu.</p>
          </form>
          <p style={{ textAlign: 'center', fontSize: 16, color: '#4E6470', fontWeight: 600, marginTop: 28 }}>
            Pas encore de compte ?{' '}
            <Link href={next ? `/auth/signup?next=${encodeURIComponent(next)}` : '/auth/signup'} style={{ color: '#0B8374', fontWeight: 700, display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
