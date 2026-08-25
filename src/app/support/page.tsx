"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Msg {
  id: string
  sender_is_admin: boolean
  body: string
  created_at: string
}

export default function SupportPage() {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: conv } = await supabase.from('admin_conversations').select('id').eq('user_id', user.id).maybeSingle()
      if (!conv) { setMsgs([]); return }
      setConversationId(conv.id)

      const { data } = await supabase.from('admin_messages').select('*').eq('conversation_id', conv.id).order('created_at')
      setMsgs((data ?? []) as Msg[])
      await supabase.from('admin_messages').update({ read_by_user: true }).eq('conversation_id', conv.id).eq('sender_is_admin', true)

      channel = supabase.channel(`support:${conv.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'admin_messages', filter: `conversation_id=eq.${conv.id}` },
          payload => setMsgs(m => [...m, payload.new as Msg]))
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [router])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim() || !userId) return
    const supabase = createClient()
    let convId = conversationId
    if (!convId) {
      const { data } = await supabase.from('admin_conversations').insert({ user_id: userId }).select().single()
      if (!data) return
      convId = data.id
      setConversationId(convId)
    }
    const body = input.trim()
    setInput('')
    const { data: inserted } = await supabase.from('admin_messages')
      .insert({ conversation_id: convId, sender_is_admin: false, body }).select().single()
    if (inserted) setMsgs(m => [...m, inserted as Msg])
    await supabase.from('admin_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convId)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #E7EDEB' }}>
        <button onClick={() => router.back()} style={{ color: '#123644', background: 'none', border: 'none', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>Support PING</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>
            Une question, un souci ? Écrivez-nous, l'équipe PING vous répond directement ici.
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_is_admin ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 13.5, fontWeight: 500,
              ...(m.sender_is_admin
                ? { background: '#fff', color: '#123644', borderBottomLeftRadius: 4, border: '1px solid #E7EDEB' }
                : { background: '#12B39C', color: '#fff', borderBottomRightRadius: 4 }),
            }}>
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 16px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #E7EDEB' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 999, fontSize: 13.5, border: '1px solid #DCE5E3', outline: 'none', background: '#F3F6F5' }}
          placeholder="Écrire à l'équipe PING…" />
        <button onClick={send}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#12B39C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
