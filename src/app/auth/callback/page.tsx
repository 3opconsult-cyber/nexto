"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import { rememberThisTabOnly } from '@/lib/auth-session'
import { flushReferral } from '@/lib/referral'
import { safeNext, homeFor, isAdminPath, logLogin } from '@/lib/authRedirect'

// Arrivée depuis le lien de connexion reçu par e-mail (« Recevoir un lien de connexion », /auth/login).
// Le client Supabase du navigateur (flux PKCE) échange lui-même le ?code= contre une session ; on attend
// cette session, puis on renvoie vers ?next= (chemin interne vérifié) ou l'espace du profil.
// Le lien ne marche que dans le navigateur où il a été demandé (vérificateur PKCE) et une seule fois.
export default function AuthCallbackPage() {
  const router = useRouter()
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let done = false
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const errCode = url.searchParams.get('error_code') || hash.get('error_code')
    const errDesc = url.searchParams.get('error_description') || hash.get('error_description')
    if (errCode || errDesc) {
      setFailed(errCode === 'otp_expired' || /expired|invalid/i.test(errDesc || '')
        ? 'Ce lien de connexion a expiré ou a déjà servi.'
        : 'Ce lien de connexion n’est pas valable.')
      return
    }
    const next = safeNext(url.searchParams.get('next'))

    async function finish(userId: string) {
      if (done) return
      done = true
      rememberThisTabOnly(true)
      await logLogin(supabase, userId)
      await flushReferral()
      const dest = next || await homeFor(supabase, userId)
      if (isAdminPath(dest)) window.location.replace(dest)
      else router.replace(dest)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) finish(session.user.id)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session?.user) finish(data.session.user.id)
      else if (error) setFailed('Ce lien de connexion a expiré, a déjà servi ou a été ouvert dans un autre navigateur que celui où il a été demandé.')
    })
    const t = setTimeout(() => {
      if (!done) setFailed('Ce lien de connexion a expiré, a déjà servi ou a été ouvert dans un autre navigateur que celui où il a été demandé.')
    }, 8000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '28px 26px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        <div style={{ marginBottom: 14 }}><Sign /></div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644', margin: '0 0 8px' }}>Connexion</h1>
        {failed ? (
          <>
            <p role="alert" style={{ color: '#4E6470', fontSize: 14, lineHeight: 1.55, margin: '0 0 16px' }}>
              {failed} Demandez un nouveau lien depuis la page de connexion, ou connectez-vous avec votre mot de passe.
            </p>
            <Link href="/auth/login" style={{ display: 'block', textAlign: 'center', background: '#0C8F7E', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 999, textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </>
        ) : (
          <p role="status" style={{ color: '#4E6470', fontSize: 14, margin: 0 }}>Vérification du lien…</p>
        )}
      </div>
    </div>
  )
}
