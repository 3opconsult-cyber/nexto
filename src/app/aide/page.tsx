"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { useMode } from '@/lib/mode'
import { AIDE_ICONS, AIDE_RUBRIQUES } from '@/lib/aide'

export default function AidePage() {
  const router = useRouter()
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [mode] = useMode(isPro)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsPro(false); return }
      const { data } = await supabase.from('profiles').select('is_pro').eq('id', user.id).single()
      setIsPro(!!data?.is_pro)
    }).catch(() => setIsPro(false))
  }, [])

  // Toutes les rubriques restent accessibles ; celles du mode courant passent en premier.
  const m = mode ?? 'particulier'
  const rank = (s: string) => (s === m ? 0 : s === 'tous' ? 1 : 2)
  const list = [...AIDE_RUBRIQUES].sort((a, b) => rank(a.space) - rank(b.space))

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Comment ça marche</span>
      </div>
      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4E6470' }}>Une courte animation par rubrique : choisissez celle qui vous intéresse.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(r => (
            <button key={r.slug} onClick={() => router.push(`/aide/${r.slug}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, cursor: 'pointer', font: 'inherit', width: '100%' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={AIDE_ICONS[r.icon]} /></svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#123644' }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#4E6470', marginTop: 2 }}>{r.sub}</span>
              </span>
              <span aria-hidden="true" style={{ color: '#6E8592' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
