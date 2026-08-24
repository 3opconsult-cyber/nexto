"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: '#FFF7ED', fg: '#8a6520' },
  arrived: { label: 'En cours', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' },
}

export default function AgendaPage() {
  const router = useRouter()
  const [active, setActive] = useState<any[]>([])
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: txs } = await supabase.from('transactions')
        .select('*, requests(address, description)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in('status', ['pending', 'arrived'])
        .order('created_at', { ascending: true })
      setActive(txs ?? [])

      const { data: disp } = await supabase.from('disputes')
        .select('*, transactions(id, requests(address))')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
      setDisputes(disp ?? [])

      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Agenda</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && disputes.map(d => (
          <div key={d.id} onClick={() => router.push('/litiges')}
            style={{ background: '#FFFBF2', border: '1px solid #F5D9A6', borderRadius: 14, padding: 14, marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>Litige en cours</div>
            <div style={{ fontSize: 12, color: '#6E8592', marginTop: 3 }}>{d.transactions?.requests?.address || 'Mission'} · {d.reason?.slice(0, 60)}</div>
          </div>
        ))}

        {!loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Missions actives</div>
            {active.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Rien de prévu pour l'instant</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Les réservations en cours apparaîtront ici — PING fonctionne à la demande, pas encore sur créneaux planifiés à l'avance.</div>
              </div>
            )}
            {active.map(t => {
              const badge = STATUS_BADGE[t.status] || { label: t.status, bg: '#F3F6F5', fg: '#6E8592' }
              return (
                <div key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>{t.requests?.address || 'Mission'}</div>
                    <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{t.requests?.description?.slice(0, 50)}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: badge.bg, color: badge.fg, flexShrink: 0 }}>{badge.label}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
