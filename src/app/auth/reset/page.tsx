"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', border: '1.5px solid #E7EDEB', borderRadius: 14,
  fontSize: 14.5, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644', outline: 'none', background: '#fff',
}

// Arrivée depuis le lien reçu par e-mail : Supabase ouvre une session de récupération,
// on demande alors un nouveau mot de passe.
export default function ResetPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (session && (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    const t = setTimeout(() => setExpired(true), 4000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (pw !== pw2) { setError('Les deux mots de passe ne sont pas identiques.'); return }
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password: pw })
    setLoading(false)
    if (error) { setError('Impossible de changer le mot de passe. Le lien a peut-être expiré : refaites une demande depuis la page de connexion.'); return }
    setDone(true)
    setTimeout(() => router.push('/map'), 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: 26, boxShadow: '0 8px 30px rgba(18,54,68,.08)' }}>
        <div style={{ marginBottom: 14 }}><Sign /></div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 22, color: '#123644', margin: '0 0 6px' }}>Nouveau mot de passe</h1>
        {done ? (
          <p style={{ color: '#0E8F7D', fontWeight: 600 }}>Mot de passe modifié. Redirection en cours…</p>
        ) : !ready ? (
          <p style={{ color: '#4E6470', fontSize: 14 }}>
            {expired
              ? <>Ce lien n&apos;est plus valable. <Link href="/auth/login" style={{ color: '#0E8F7D', fontWeight: 700 }}>Retour à la connexion</Link>, puis « Mot de passe oublié ? » pour recevoir un nouveau lien.</>
              : 'Vérification du lien…'}
          </p>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: '#4E6470', fontSize: 14, margin: '0 0 14px' }}>Choisissez un nouveau mot de passe (8 caractères minimum).</p>
            <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={pw} onChange={e => setPw(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            <input type="password" autoComplete="new-password" placeholder="Confirmer le mot de passe" value={pw2} onChange={e => setPw2(e.target.value)} style={inputStyle} />
            {error && <p role="alert" style={{ color: '#B3261E', fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ marginTop: 16, width: '100%', padding: 14, border: 0, borderRadius: 14, background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
