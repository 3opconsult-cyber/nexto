"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

export default function MessagesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: txs } = await supabase.from('transactions')
        .select('*, requests(address)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      const withLast = await Promise.all((txs ?? []).map(async (t: any) => {
        const { data: last } = await supabase.from('messages')
          .select('body, created_at, sender_id')
          .eq('transaction_id', t.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        return { ...t, lastMessage: last, isSeller: t.seller_id === user.id, kind: 'mission' as const }
      }))

      const { data: conv } = await supabase.from('admin_conversations').select('id, last_message_at').eq('user_id', user.id).maybeSingle()
      let supportRow: any = null
      if (conv) {
        const { data: last } = await supabase.from('admin_messages')
          .select('body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        supportRow = { id: conv.id, kind: 'support' as const, lastMessage: last, created_at: conv.last_message_at }
      }

      setRows([...(supportRow ? [supportRow] : []), ...withLast].sort((a, b) => {
        const ta = a.lastMessage?.created_at || a.created_at
        const tb = b.lastMessage?.created_at || b.created_at
        return new Date(tb).getTime() - new Date(ta).getTime()
      }))
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Messages</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucune conversation pour l'instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Elles apparaissent ici dès qu'une mission est réservée.</div>
          </div>
        )}
        {rows.map(t => (
          <button key={t.id} onClick={() => router.push(t.kind === 'support' ? '/support' : `/mission/${t.id}/chat`)}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: '#fff', border: t.kind === 'support' ? '1px solid #12B39C' : '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
                {t.kind === 'support' ? 'Support PING' : (t.requests?.address || (t.isSeller ? 'Client' : 'Prestataire'))}
              </span>
              <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>
                {new Date(t.lastMessage?.created_at || t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6E8592', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.lastMessage?.body || 'Aucun message — ouvrir la conversation'}
            </div>
          </button>
        ))}
      </div>
      <BottomTabBar />
    </div>
  )
}
