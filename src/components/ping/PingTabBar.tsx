"use client"
import { useRouter, usePathname } from 'next/navigation'

// Barre d'onglets basse, reprise a l'identique de /demo : Carte + PING.
// PING recentre la carte (via onPing) quand on est deja sur /map, sinon y mene.
export default function PingTabBar({ onPing }: { onPing?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const onMap = pathname === '/map'

  return (
    <div className="ping-tabbar">
      <div className="inner">
        <button className={`ping-tab ${onMap ? 'on' : ''}`} onClick={() => router.push('/map')}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
          <span>Carte</span>
        </button>
        <button className="ping-tab" onClick={() => { if (onMap && onPing) onPing(); else router.push('/map') }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M5.6 5.6a9 9 0 0 0 0 12.7M18.4 5.6a9 9 0 0 1 0 12.7M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" /></svg>
          <span>PING</span>
        </button>
      </div>
    </div>
  )
}
