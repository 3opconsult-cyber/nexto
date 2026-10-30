"use client"
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { readMode, type Mode } from '@/lib/mode'

// Barre d'onglets mobile. Suit le mode courant (particulier / prestataire, cf. lib/mode.ts) :
// en mode pro, « Carte » mène aux demandes autour de soi (/pro/carte), jamais à la carte client.
const PRO_ROUTE = /^\/pro\/(carte|dashboard|documents|onboarding|attente|tarifs|revenus|paiements|disponibilites)(\/|$)/

const ICONS: Record<string, JSX.Element> = {
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  msg: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  ag: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  prof: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  ent: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></>,
}

export default function BottomTabBar() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [mode, setMode] = useState<Mode>('particulier')

  useEffect(() => {
    const sync = () => setMode(PRO_ROUTE.test(pathname) ? 'pro' : pathname.startsWith('/client/profil') ? 'particulier' : readMode())
    sync()
    window.addEventListener('ping-mode', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('ping-mode', sync); window.removeEventListener('storage', sync) }
  }, [pathname])

  const isPro = mode === 'pro'
  const accent = isPro ? '#F2A93B' : '#12B39C'
  const tabs = [
    { label: isPro ? 'Demandes' : 'Carte', path: isPro ? '/pro/carte' : '/map', icon: 'map' },
    { label: 'Messages', path: '/messages', icon: 'msg' },
    { label: 'Agenda', path: '/agenda', icon: 'ag' },
    isPro
      ? { label: 'Entreprise', path: '/pro/dashboard', icon: 'ent' }
      : { label: 'Profil', path: '/client/profil', icon: 'prof' },
  ]

  return (
    <div className="app-bottom-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #DCE5E3', boxShadow: '0 -4px 16px rgba(18,54,68,.06)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map(t => {
          const on = pathname === t.path || pathname.startsWith(t.path + '/')
          return (
            <button key={t.path} onClick={() => router.push(t.path)}
              style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? accent : '#4E6470', cursor: 'pointer' }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ICONS[t.icon]}</svg>
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
