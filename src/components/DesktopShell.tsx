"use client"
import { usePathname, useRouter } from 'next/navigation'

// Routes "app" qui reçoivent la navigation laterale desktop (sidebar).
// Auth, presentation, hub, demo, admin : pas de sidebar.
const APP_PREFIXES = ['/map', '/messages', '/agenda', '/documents', '/litiges', '/support', '/client', '/pro', '/mission']

const CLIENT_NAV: [string, string][] = [
  ['Carte', '/map'],
  ['Mes demandes', '/agenda'],
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

export default function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const isApp = APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isApp) return <div className="phone-col">{children}</div>

  const onPro = /^\/pro\/(carte|dashboard|documents|onboarding|attente)(\/|$)/.test(pathname)
  const accent = onPro ? '#F2A93B' : '#12B39C'
  const nav = onPro ? PRO_NAV : CLIENT_NAV
  const nav2 = onPro ? PRO_NAV2 : CLIENT_NAV2
  const go = (p: string) => router.push(p)
  const item = ([label, path]: [string, string]) => {
    const on = pathname === path || (path !== '/map' && path !== '/pro/carte' && pathname.startsWith(path))
    return (
      <div key={label + path} className={`dnav-item ${on ? 'on' : ''}`} onClick={() => go(path)}>{label}</div>
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
        <div className="dnav-item" style={{ background: 'var(--ink)', color: '#fff' }} onClick={() => go(onPro ? '/map' : '/pro/carte')}>
          {onPro ? 'Revenir en mode particulier' : 'Passer en mode pro'}
        </div>
      </aside>
      <div className="shell-main">{children}</div>
    </div>
  )
}
