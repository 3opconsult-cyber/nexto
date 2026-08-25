"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'
import { TRADES } from '@/lib/trades'

export default function FavorisPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('favorites')
        .select('created_at, provider_profiles(id, trade, base_price_cents, hourly_rate_cents, rating, reviews_count, profiles!provider_profiles_id_fkey(full_name, avatar_hue))')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Mes favoris</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun favori pour l'instant</div>
            <button onClick={() => router.push('/map')} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#0C8F7E', background: 'none', border: 'none' }}>Parcourir la carte →</button>
          </div>
        )}
        {rows.map((r: any) => {
          const p = r.provider_profiles
          if (!p) return null
          const name = p.profiles?.full_name?.trim() || TRADES[p.trade] || p.trade
          const initial = name.charAt(0).toUpperCase()
          const bg = p.profiles?.avatar_hue != null ? `hsl(${p.profiles.avatar_hue}, 55%, 45%)` : '#12B39C'
          const price = p.base_price_cents > 0 ? `${(p.base_price_cents / 100).toFixed(0)} €` : p.hourly_rate_cents ? `${(p.hourly_rate_cents / 100).toFixed(0)} €/h` : '—'
          return (
            <div key={p.id} onClick={() => router.push(`/pro/${p.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 12, marginBottom: 10, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}>{initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>{name}</div>
                <div style={{ color: '#6E8592', fontSize: 11.5 }}>{TRADES[p.trade] || p.trade} · {p.rating > 0 ? `${p.rating.toFixed(1)} ★` : 'Nouveau'}</div>
              </div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>{price}</div>
            </div>
          )
        })}
      </div>
      <BottomTabBar />
    </div>
  )
}
