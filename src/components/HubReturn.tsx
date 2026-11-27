"use client"
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Bouton « Hub » : revenir à /hub depuis n'importe quel écran. Visible seulement sur un appareil où le Hub
// a été ouvert (réglage `ping_hub` dans localStorage, modifiable dans le Hub) : les vrais utilisateurs ne le voient jamais.
export const HUB_FLAG = 'ping_hub'

export default function HubReturn() {
  const path = usePathname() || ''
  const [on, setOn] = useState(false)
  useEffect(() => {
    try { setOn(localStorage.getItem(HUB_FLAG) === '1') } catch { setOn(false) }
  }, [path])
  if (!on || path === '/hub' || path.startsWith('/hub/')) return null
  return (
    <a href="/hub" aria-label="Retour au Hub"
      style={{ position: 'fixed', left: 12, bottom: 'calc(92px + env(safe-area-inset-bottom))', zIndex: 9000, width: 48, height: 48, borderRadius: 24, background: '#123644', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(18,54,68,.35)', textDecoration: 'none' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z" /></svg>
    </a>
  )
}
