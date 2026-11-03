"use client"
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Décision Romain (03/11/2026) : l'application n'est pas visitable sans compte. L'objectif est l'inscription ;
// la présentation se fait sur la plaquette (/bienvenue). Un visiteur sans session qui ouvre une page de
// l'application est renvoyé vers l'inscription, avec retour à la page demandée ensuite (?next=).
const PROTECTED = ['/map', '/messages', '/agenda', '/client', '/pro', '/mission', '/documents', '/litiges', '/aide', '/scan']
const OPEN = ['/pro/onboarding'] // gère déjà lui-même l'absence de compte

// Espace prestataire : réservé aux comptes dont le profil prestataire est créé (fin de /pro/onboarding).
// Sinon retour au parcours d'inscription prestataire.
const PRO_ONLY = /^\/pro\/(carte|dashboard|documents|tarifs|revenus|disponibilites|paiements|annonce)(\/|$)/

export default function AuthGate() {
  const path = usePathname() || ''
  const router = useRouter()
  const [anon, setAnon] = useState(false)
  const guarded = PROTECTED.some(p => path === p || path.startsWith(p + '/')) && !OPEN.some(p => path === p || path.startsWith(p + '/'))

  useEffect(() => {
    if (!guarded) { setAnon(false); return }
    let off = false
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (off) return
      if (data.session) {
        if (!PRO_ONLY.test(path)) return
        const uid = data.session.user.id
        setAnon(true) // voile le temps de verifier
        supabase.from('provider_profiles').select('id').eq('id', uid).maybeSingle().then(({ data: pp }) => {
          if (off) return
          if (pp) { setAnon(false); return }
          try { localStorage.setItem('ping_mode', 'particulier') } catch { }
          router.replace('/pro/onboarding')
        })
        return
      }
      setAnon(true)
      router.replace(`/auth/signup?next=${encodeURIComponent(path)}`)
    })
    return () => { off = true }
  }, [guarded, path, router])

  if (!anon || !guarded) return null
  return <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#F3F6F5' }} />
}
