"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

// Repères type messagerie (WhatsApp) plutôt qu'une date brute sur chaque ligne :
// plus lisible dès qu'il y a beaucoup de conversations (demande de Romain, 26/10).
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function daysAgo(d: Date) { return Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000) }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function sectionLabel(d: Date) {
  const n = daysAgo(d)
  if (n <= 0) return "Aujourd'hui"
  if (n === 1) return 'Hier'
  if (n < 7) return 'Cette semaine'
  const now = new Date()
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Ce mois-ci'
  return cap(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
}

function rowTime(d: Date) {
  const n = daysAgo(d)
  if (n <= 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (n === 1) return 'Hier'
  if (n < 7) return cap(d.toLocaleDateString('fr-FR', { weekday: 'short' }))
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function MessagesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: txs } = await supabase.from('transactions')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      // profiles n'est lisible qu'en libre-service (RLS auth.uid() = id) : le nom
      // de l'interlocuteur passe par une fonction dediee, pas par un embed.
      const { data: names } = txs?.length
        ? await supabase.rpc('transaction_counterparts', { p_transaction_ids: txs.map((t: any) => t.id) })
        : { data: [] }
      const nameById: Record<string, string> = {}
      ;(names ?? []).forEach((n: any) => { if (n.full_name) nameById[n.transaction_id] = n.full_name })

      const withLast = await Promise.all((txs ?? []).map(async (t: any) => {
        const { data: last } = await supabase.from('messages')
          .select('body, created_at, sender_id')
          .eq('transaction_id', t.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        const isSeller = t.seller_id === user.id
        return { ...t, lastMessage: last, isSeller, kind: 'mission' as const, counterpart: nameById[t.id] || (isSeller ? 'Client' : 'Prestataire') }
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

      {!loading && rows.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une conversation…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 12, border: '1px solid #E7EDEB', background: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#123644', outline: 'none' }} />
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucune conversation pour l'instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Elles apparaissent ici dès qu'une mission est réservée.</div>
          </div>
        )}
        {!loading && rows.length > 0 && (() => {
          const q = query.trim().toLowerCase()
          const filtered = q ? rows.filter(t => {
            const name = t.kind === 'support' ? 'Support PING' : t.counterpart
            return (name || '').toLowerCase().includes(q) || (t.lastMessage?.body || '').toLowerCase().includes(q)
          }) : rows

          if (filtered.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun résultat pour « {query} »</div>
              </div>
            )
          }

          // Sections type messagerie (Aujourd'hui / Hier / Cette semaine / …) :
          // regroupe les lignes déjà triées par activité, sans casser l'ordre.
          const sections: { label: string; items: any[] }[] = []
          filtered.forEach(t => {
            const d = new Date(t.lastMessage?.created_at || t.created_at)
            const label = sectionLabel(d)
            const current = sections[sections.length - 1]
            if (current && current.label === label) current.items.push(t)
            else sections.push({ label, items: [t] })
          })

          return sections.map(section => (
            <div key={section.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 2px' }}>
                {section.label}
              </div>
              {section.items.map(t => {
                const name = t.kind === 'support' ? 'Support PING' : t.counterpart
                return (
                  <button key={t.id} onClick={() => router.push(t.kind === 'support' ? '/support' : `/mission/${t.id}/chat`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: '#fff', border: t.kind === 'support' ? '1px solid #12B39C' : '1px solid #E7EDEB', borderRadius: 14, padding: 12, marginBottom: 10, cursor: 'pointer' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#fff',
                      background: t.kind === 'support' ? 'linear-gradient(160deg,#12B39C,#0C8F7E)' : (t.isSeller ? 'linear-gradient(160deg,#F2A93B,#d98a1f)' : 'linear-gradient(160deg,#6E8592,#4c6472)'),
                    }}>{(name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{name}</span>
                        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>
                          {rowTime(new Date(t.lastMessage?.created_at || t.created_at))}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6E8592', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.lastMessage?.body || 'Aucun message — ouvrir la conversation'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))
        })()}
      </div>
      <BottomTabBar />
    </div>
  )
}
