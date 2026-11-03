"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Pages où la barre n'a pas de sens (présentation, inscription, documents, outils internes).
const HIDDEN = ['/auth', '/bienvenue', '/plaquettes', '/animation', '/admin', '/l/', '/presentation', '/demo', '/essai',
  '/cgu', '/confidentialite', '/parcours', '/plan-marketing', '/hub', '/aide', '/mission/', '/pro/onboarding', '/pro/attente']

// Barre fixe pour un visiteur non connecté qui découvre l'application : toujours un chemin vers
// l'inscription et un retour vers la présentation, pour ne jamais perdre le fil.
export default function VisitorBar() {
  const path = usePathname() || ''
  const [anon, setAnon] = useState(false)
  useEffect(() => {
    let off = false
    createClient().auth.getSession().then(({ data }) => { if (!off) setAnon(!data.session) })
    const { data: sub } = createClient().auth.onAuthStateChange((_e, s) => { if (!off) setAnon(!s) })
    return () => { off = true; sub.subscription.unsubscribe() }
  }, [])
  if (!anon || path === '/' || HIDDEN.some(p => path === p || path.startsWith(p))) return null
  return (
    <>
      <style>{`.ping-visitor{bottom:calc(76px + env(safe-area-inset-bottom,0px))}@media(min-width:1000px){.ping-visitor{bottom:14px}}`}</style>
      <div className="ping-visitor" role="region" aria-label="Découverte de PING"
        style={{ position: 'fixed', left: 0, right: 0, zIndex: 9000, display: 'flex', justifyContent: 'center', padding: '0 12px', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 440, background: '#123644', color: '#fff', borderRadius: 18, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 30px rgba(18,54,68,.3)', fontFamily: 'Inter, sans-serif' }}>
          <Link href="/bienvenue" aria-label="Retour à la présentation" style={{ color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.12)', whiteSpace: 'nowrap' }}>← Présentation</Link>
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.3, color: 'rgba(255,255,255,.82)' }}>Vous découvrez PING en avant-première.</span>
          <Link href="/l/ins" style={{ background: '#12B39C', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '9px 12px', borderRadius: 12, whiteSpace: 'nowrap' }}>Créer mon compte</Link>
        </div>
      </div>
    </>
  )
}
