"use client"
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { enforceForgottenSession } from '@/lib/auth-session'
import BottomTabBar from '@/components/BottomTabBar'

// Routes "app" qui reçoivent la navigation laterale desktop (sidebar).
// Auth, presentation, hub, demo, admin : pas de sidebar.
const APP_PREFIXES = ['/map', '/messages', '/agenda', '/documents', '/litiges', '/support', '/client', '/pro', '/mission']

// Barre d'onglets mobile : sur toutes les pages principales (demande Romain 30/10 : « sur toutes les
// pages ou pas du tout »), jamais dans un parcours qui a son propre bouton en bas (conversation,
// réservation, scan, inscription, fiche publique d'un prestataire).
const NO_TABBAR = /^\/(mission\/|pro\/onboarding|pro\/attente|auth\/)|^\/pro\/[0-9a-f-]{36}$/
// Pages plein écran (carte) : la barre se pose sur la carte, sans marge en bas.
const FULLSCREEN = /^\/(map|pro\/carte)$/

// Même structure dans les deux espaces (comme Airbnb voyageur / hôte) : 4 entrées, le reste est rangé
// dans « Mon profil » / « Mon entreprise » (rubriques Hub).
const CLIENT_NAV: [string, string][] = [
  ['Carte', '/map'],
  ['Messages', '/messages'],
  ['Agenda', '/agenda'],
  ['Mon profil', '/client/profil'],
]
const CLIENT_NAV2: [string, string][] = [
  ['Support PING', '/support'],
]
const PRO_NAV: [string, string][] = [
  ['Demandes autour de moi', '/pro/carte'],
  ['Messages', '/messages'],
  ['Agenda', '/agenda'],
  ['Mon entreprise', '/pro/dashboard'],
]
const PRO_NAV2: [string, string][] = [
  ['Support PING', '/support'],
]

function navIcon(label: string) {
  const l = label.toLowerCase()
  const p = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d.split('|').map((x, i) => <path key={i} d={x} />)}</svg>
  if (l.includes('carte')) return p('M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4')
  if (l.includes('demande')) return p('M4 5h16v14H4z|M8 9h8M8 13h5')
  if (l.includes('message')) return p('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')
  if (l.includes('disponib')) return p('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18|M12 7v5l3.5 2')
  if (l.includes('agenda')) return p('M3 5h18v16H3z|M3 9h18M8 3v4M16 3v4')
  if (l.includes('réclam') || l.includes('litige')) return p('M12 2 2 21h20z|M12 9v5M12 18h.01')
  if (l.includes('entreprise')) return p('M3 21V9l9-6 9 6v12|M9 21v-6h6v6')
  if (l.includes('tarif')) return p('M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z|M7.5 7.5h.01')
  if (l.includes('revenu')) return p('M3 3v18h18|M7 15l4-4 3 3 5-6')
  if (l.includes('tableau')) return p('M4 4h7v7H4z|M13 4h7v4h-7z|M13 12h7v8h-7z|M4 15h7v5H4z')
  if (l.includes('facture') || l.includes('document') || l.includes('pièce')) return p('M6 2h9l5 5v15H6z|M14 2v6h6M9 13h6M9 17h6')
  if (l.includes('profil')) return p('M20 21a8 8 0 0 0-16 0|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8')
  if (l.includes('parrain')) return p('M20 12v9H4v-9|M2 7h20v5H2z|M12 22V7|M12 7S9 2 6.5 3.5 7 7 12 7c5 0 5.5-2 4.5-3.5S12 7 12 7')
  if (l.includes('favori')) return p('M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z')
  if (l.includes('support')) return p('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20|M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3|M12 17h.01')
  return p('M4 6h16M4 12h16M4 18h16')
}

export default function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [mode, setModeState] = React.useState<'particulier' | 'pro'>('particulier')
  // Le compte a-t-il un profil prestataire ? Sinon « Passer en mode pro » mène à l'inscription pro.
  const [hasPro, setHasPro] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setHasPro(false); return }
      const { data } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setHasPro(!!data)
    })
  }, [])

  const isProRoute = /^\/pro\/(carte|dashboard|documents|onboarding|attente)(\/|$)/.test(pathname)
  const isClientRoute = pathname.startsWith('/client/profil')

  // Une seule fois par onglet : ferme une session dont l'utilisateur avait
  // décoché "Rester connecté" ailleurs (cf. lib/auth-session.ts).
  React.useEffect(() => {
    enforceForgottenSession(() => { createClient().auth.signOut() })
  }, [])

  React.useEffect(() => {
    if (isProRoute) { try { localStorage.setItem('ping_mode', 'pro') } catch { }; setModeState('pro') }
    else if (isClientRoute) { try { localStorage.setItem('ping_mode', 'particulier') } catch { }; setModeState('particulier') }
    else { try { const m = localStorage.getItem('ping_mode'); if (m === 'pro' || m === 'particulier') setModeState(m) } catch { } }
  }, [pathname, isProRoute, isClientRoute])

  // Bascule de mode faite ailleurs (bandeau ModeHint, menu mobile) : on se resynchronise.
  React.useEffect(() => {
    const sync = () => { try { const m = localStorage.getItem('ping_mode'); if (m === 'pro' || m === 'particulier') setModeState(m) } catch { } }
    window.addEventListener('ping-mode', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('ping-mode', sync); window.removeEventListener('storage', sync) }
  }, [])

  const onPro = isProRoute || (!isClientRoute && mode === 'pro')
  const accent = onPro ? '#F2A93B' : '#12B39C'
  const nav = onPro ? PRO_NAV : CLIENT_NAV
  const nav2 = onPro ? PRO_NAV2 : CLIENT_NAV2
  function switchMode() {
    const target = onPro ? 'particulier' : 'pro'
    try { localStorage.setItem('ping_mode', target) } catch { }
    setModeState(target)
    window.dispatchEvent(new Event('ping-mode'))
    router.push(onPro ? '/map' : (hasPro === false ? '/pro/onboarding' : '/pro/carte'))
  }
  const isApp = APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isApp) return <div className="phone-col">{children}</div>
  const tabbar = !NO_TABBAR.test(pathname)
  const mainClass = `shell-main${tabbar && !FULLSCREEN.test(pathname) ? ' with-tabbar' : ''}`

  const go = (p: string) => router.push(p)
  const item = ([label, path]: [string, string]) => {
    const on = pathname === path || (path !== '/map' && path !== '/pro/carte' && pathname.startsWith(path))
    return (
      <div key={label + path} className={`dnav-item ${on ? 'on' : ''}`} onClick={() => go(path)}>{navIcon(label)}<span>{label}</span></div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="desk-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 16px' }}>
          <svg viewBox="0 0 26 26" width="26" height="26"><circle cx="13" cy="13" r="11.2" fill="none" stroke={accent} strokeWidth={1.3} opacity=".38" /><circle cx="13" cy="13" r="7" fill="none" stroke={accent} strokeWidth={1.3} opacity=".6" /></svg>
          <span style={{ fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>ping</span>
        </div>
        {nav.map(item)}
        <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
        {nav2.map(item)}
        <div style={{ flex: 1 }} />
        <div className="dnav-item" style={{ background: 'var(--ink)', color: '#fff' }} onClick={switchMode}>
          {onPro ? 'Revenir en mode particulier' : (hasPro === false ? 'Devenir prestataire' : 'Passer en mode pro')}
        </div>
      </aside>
      <div className={mainClass}>{children}</div>
      {tabbar && <BottomTabBar />}
    </div>
  )
}
