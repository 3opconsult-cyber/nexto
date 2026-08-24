"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const STATUS_LABELS: Record<string, string> = {
  open: 'En cours', investigating: 'En cours d\u2019examen', resolved: 'Résolu', closed: 'Clôturé',
}

export default function LitigesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('disputes')
        .select('*, transactions(id, requests(address))')
        .order('created_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Litiges</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun litige pour l'instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Un signalement peut s'ouvrir depuis la conversation d'une mission.</div>
          </div>
        )}
        {rows.map(d => (
          <div key={d.id} style={{ background: '#FFFBF2', border: '1px solid #F5D9A6', borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
                {d.transactions?.requests?.address || 'Mission'}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#FFF7ED', color: '#8a6520', flexShrink: 0 }}>
                {STATUS_LABELS[d.status] || d.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6E8592', marginTop: 4 }}>{d.reason}</div>
            {d.resolution && <div style={{ fontSize: 11.5, color: '#0C8F7E', marginTop: 6, fontWeight: 600 }}>Résolution : {d.resolution}</div>}
          </div>
        ))}
      </div>
      <BottomTabBar />
    </div>
  )
}
