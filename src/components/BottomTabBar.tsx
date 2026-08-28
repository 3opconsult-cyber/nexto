"use client"
import { useRouter, usePathname } from 'next/navigation'
import { Sign } from '@/components/Brand'
import { useState } from 'react'

export default function BottomTabBar({ onPing }: { onPing?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pulsing, setPulsing] = useState(false)

  function handlePing() {
    if (pathname !== '/map') {
      router.push('/map')
      return
    }
    setPulsing(true)
    onPing?.()
    setTimeout(() => setPulsing(false), 1200)
  }

  const onMap = pathname === '/map'

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #E7EDEB', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <button onClick={() => router.push('/map')}
        style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: onMap ? '#12B39C' : '#9CA3AF', cursor: 'pointer' }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>Carte</span>
      </button>
      <button onClick={handlePing}
        style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#123644', cursor: 'pointer' }}>
        {/* Le bouton central EST le signe : mêmes anneaux, même point que l'icône
            de l'app. Il portait jusqu'ici un dessin différent (cible + arcs). */}
        <span style={pulsing ? { animation: 'pingPulse .6s ease-in-out 2', display: 'block' } : { display: 'block' }}>
          <Sign size={21} />
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>PING</span>
      </button>
      </div>
      <style>{`@keyframes pingPulse{0%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}100%{opacity:.4;transform:scale(.85)}}`}</style>
    </div>
  )
}
