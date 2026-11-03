"use client"
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Décision Romain (03/11/2026) : l'application n'est pas visitable sans compte. L'objectif est l'inscription ;
// la présentation se fait sur la plaquette (/bienvenue). Un visiteur sans session qui ouvre une page de
// l'application est renvoyé vers l'inscription, avec retour à la page demandée ensuite (?next=).
const PROTECTED = ['/map', '/messages', '/agenda', '/client', '/pro', '/mission', '/documents', '/litiges', '/aide', '/scan']
const OPEN = ['/pro/onboarding'] // gère déjà lui-même l'absence de compte

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
      if (off || data.session) return
      setAnon(true)
      router.replace(`/auth/signup?next=${encodeURIComponent(path)}`)
    })
    return () => { off = true }
  }, [guarded, path, router])

  if (!anon || !guarded) return null
  return <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#F3F6F5' }} />
}
