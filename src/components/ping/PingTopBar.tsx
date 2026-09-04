"use client"
import { useRouter } from 'next/navigation'
import NavDrawer from '@/components/NavDrawer'

// Barre du haut reprise a l'identique de /demo (.topbar) : burger + logo ping
// a anneaux + cloche messages. Flottante par-dessus la carte par defaut,
// ou pleine (solid) sur les ecrans sans carte.
export default function PingTopBar({ solid = false }: { solid?: boolean }) {
  const router = useRouter()
  return (
    <div className={`ping-topbar ${solid ? 'solid' : ''}`}>
      <NavDrawer dark={false} />
      <div className="ping-logo">
        <span className="mark" style={{ display: 'inline-flex', width: 26, height: 26 }}>
          <svg viewBox="0 0 26 26" width="26" height="26">
            <circle cx="13" cy="13" r="11.2" fill="none" stroke="#12B39C" strokeWidth="1.3" opacity=".38" />
            <circle cx="13" cy="13" r="7" fill="none" stroke="#12B39C" strokeWidth="1.3" opacity=".6" />
            <circle cx="13" cy="13" r="3" fill="#12B39C" />
          </svg>
        </span>
        <span className="wd">ping</span>
      </div>
      <span className="ping-sp" />
      <button className="ping-tbell" onClick={() => router.push('/messages')} aria-label="Messages">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
        <span className="ping-bdg" />
      </button>
    </div>
  )
}
