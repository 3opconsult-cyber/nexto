"use client"
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { label: 'Carte', path: '/map', icon: (c: string) => <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke={c} strokeWidth="2" fill="none" /> },
  { label: 'Recherche', path: '/map', icon: (c: string) => <><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2" fill="none" /><path d="M21 21l-4.3-4.3" stroke={c} strokeWidth="2" /></> },
  { label: 'Messages', path: '/messages', icon: (c: string) => <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" stroke={c} strokeWidth="2" fill="none" /> },
  { label: 'Agenda', path: '/agenda', icon: (c: string) => <><rect x="3" y="5" width="18" height="16" rx="2" stroke={c} strokeWidth="2" fill="none" /><path d="M3 9h18M8 3v4M16 3v4" stroke={c} strokeWidth="2" /></> },
  { label: 'Profil', path: '/client/profil', icon: (c: string) => <><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2" fill="none" /><path d="M4 21a8 8 0 0 1 16 0" stroke={c} strokeWidth="2" fill="none" /></> },
]

export default function BottomTabBar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #E7EDEB', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {TABS.map(t => {
          const on = pathname === t.path && (t.label !== 'Recherche' || false) // Carte et Recherche partagent /map : Carte reste seule active dessus
          return (
            <button key={t.label} onClick={() => router.push(t.path)}
              style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? '#12B39C' : '#9CA3AF', cursor: 'pointer' }}>
              <svg width="21" height="21" viewBox="0 0 24 24">{t.icon(on ? '#12B39C' : '#9CA3AF')}</svg>
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
