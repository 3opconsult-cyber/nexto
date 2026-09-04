"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const UPCOMING = ['pending', 'matched', 'en_route', 'arrived']
const DONE = ['completed', 'released']
const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function txDate(t: any): Date {
  return new Date(DONE.includes(t.status) ? (t.completed_at || t.created_at) : t.created_at)
}
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(2).replace('.', ',')} €` : '' }

export default function AgendaPage() {
  const router = useRouter()
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('transactions')
        .select('*, requests(address, description)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      setTxs(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const upcoming = txs.filter(t => UPCOMING.includes(t.status))
  const done = txs.filter(t => DONE.includes(t.status))

  const y = month.getFullYear(), m = month.getMonth()
  const today = new Date()
  const eventsByDay = useMemo(() => {
    const map: Record<number, number> = {}
    txs.forEach(t => { const d = txDate(t); if (d.getFullYear() === y && d.getMonth() === m) map[d.getDate()] = (map[d.getDate()] || 0) + 1 })
    return map
  }, [txs, y, m])

  const startWd = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(startWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const card = (t: any) => (
    <div key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{t.requests?.address || 'Mission'}</div>
        <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.requests?.description || '—'}</div>
        <div style={{ fontSize: 11, color: '#9aa6a3', marginTop: 3 }}>{txDate(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{t.subtotal_cents ? ` · ${eur(t.subtotal_cents)}` : ''}</div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0, background: DONE.includes(t.status) ? 'rgba(18,179,156,.12)' : '#FFF7ED', color: DONE.includes(t.status) ? '#0C8F7E' : '#8a6520' }}>
        {DONE.includes(t.status) ? 'Effectuée' : t.status === 'arrived' ? 'En cours' : 'À venir'}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Agenda</span>
      </div>

      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        {/* Calendrier */}
        <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 18, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', flex: 1, textTransform: 'capitalize' }}>
              {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </b>
            <div onClick={() => setMonth(new Date(y, m - 1, 1))} style={{ cursor: 'pointer', padding: '4px 10px', color: '#6E8592', fontSize: 18 }}>‹</div>
            <div onClick={() => setMonth(new Date(y, m + 1, 1))} style={{ cursor: 'pointer', padding: '4px 10px', color: '#6E8592', fontSize: 18 }}>›</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
            {WD.map((d, i) => <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#9aa6a3', padding: '4px 0' }}>{d}</div>)}
            {cells.map((d, i) => {
              const isToday = d && y === today.getFullYear() && m === today.getMonth() && d === today.getDate()
              const has = d ? eventsByDay[d] : 0
              return (
                <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10, fontSize: 13, fontWeight: 600, color: d ? '#123644' : 'transparent', background: isToday ? 'rgba(18,179,156,.12)' : 'transparent', border: isToday ? '1.5px solid #12B39C' : '1px solid transparent' }}>
                  <span>{d || ''}</span>
                  {has ? <span style={{ width: 5, height: 5, borderRadius: 999, background: '#F2A93B' }} /> : <span style={{ height: 5 }} />}
                </div>
              )
            })}
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>À venir</div>
            {upcoming.length ? upcoming.map(card) : <p style={{ fontSize: 12.5, color: '#9aa6a3', marginBottom: 20 }}>Rien de prévu pour l&apos;instant.</p>}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '22px 0 10px' }}>Effectuées</div>
            {done.length ? done.map(card) : <p style={{ fontSize: 12.5, color: '#9aa6a3' }}>Aucune prestation terminée pour l&apos;instant.</p>}
          </>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
