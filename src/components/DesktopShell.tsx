"use client"
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Routes "app" qui reçoivent la navigation laterale desktop (sidebar).
// Auth, presentation, hub, demo, admin : pas de sidebar.
const APP_PREFIXES = ['/map', '/messages', '/agenda', '/documents', '/litiges', '/support', '/client', '/pro', '/mission']

const CLIENT_NAV: [string, string][] = [
  ['Carte', '/map'],
  ['Mes demandes', '/client/demandes'],
  ['Messages', '/messages'],
  ['Agenda', '/agenda'],
  ['Mes réclamations', '/litiges'],
  ['Profil', '/client/profil'],
]
const CLIENT_NAV2: [string, string][] = [
  ['Mon parrainage', '/client/parrainage'],
  ['Mes favoris', '/client/favoris'],
  ['Mes documents', '/documents'],
  ['Support PING', '/support'],
]
const PRO_NAV: [string, string][] = [
  ['Carte', '/pro/carte'],
  ['Demandes autour de moi', '/pro/carte'],
  ['Messages', '/messages'],
  ['Agenda', '/agenda'],
  ['Litiges', '/litiges'],
  ['Mon entreprise', '/pro/dashboard'],
]
const PRO_NAV2: [string, string][] = [
  ['Tableau de bord', '/pro/dashboard'],
  ['Factures & documents', '/pro/documents'],
  ['Mes pièces', '/pro/documents'],
  ['Mon parrainage', '/client/parrainage'],
  ['Mes documents', '/documents'],
  ['Support PING', '/support'],
]

function navIcon(label: string) {
  const l = label.toLowerCase()
  const p = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d.split('|').map((x, i) => <path key={i} d={x} />)}</svg>
  if (l.includes('carte')) return p('M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4')
  if (l.includes('demande')) return p('M4 5h16v14H4z|M8 9h8M8 13h5')
  if (l.includes('message')) return p('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')
  if (l.includes('agenda')) return p('M3 5h18v16H3z|M3 9h18M8 3v4M16 3v4')
  if (l.includes('réclam') || l.includes('litige')) return p('M12 2 2 21h20z|M12 9v5M12 18h.01')
  if (l.includes('entreprise')) return p('M3 21V9l9-6 9 6v12|M9 21v-6h6v6')
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

  const isProRoute = /^\/pro\/(carte|dashboard|documents|onboarding|attente)(\/|$)/.test(pathname)
  const isClientRoute = pathname.startsWith('/client/')

  React.useEffect(() => {
    if (isProRoute) { try { localStorage.setItem('ping_mode', 'pro') } catch { }; setModeState('pro') }
    else if (isClientRoute) { try { localStorage.setItem('ping_mode', 'particulier') } catch { }; setModeState('particulier') }
    else { try { const m = localStorage.getItem('ping_mode'); if (m === 'pro' || m === 'particulier') setModeState(m) } catch { } }
  }, [pathname, isProRoute, isClientRoute])

  const onPro = isProRoute || (!isClientRoute && mode === 'pro')
  const accent = onPro ? '#F2A93B' : '#12B39C'
  const nav = onPro ? PRO_NAV : CLIENT_NAV
  const nav2 = onPro ? PRO_NAV2 : CLIENT_NAV2
  function switchMode() {
    const target = onPro ? 'particulier' : 'pro'
    try { localStorage.setItem('ping_mode', target) } catch { }
    setModeState(target)
    router.push(onPro ? '/map' : '/pro/carte')
  }
  const isApp = APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isApp) return <div className="phone-col">{children}</div>

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
          {onPro ? 'Revenir en mode particulier' : 'Passer en mode pro'}
        </div>
      </aside>
      <div className="shell-main">{children}</div>
    </div>
  )
}
