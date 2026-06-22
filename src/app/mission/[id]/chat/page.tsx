"use client"
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { filterMessage } from '@/lib/chatFilter'

interface Msg {
  id: string
  sender_id: string
  content: string
  type: string
  created_at: string
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState('')
  const [warning, setWarning] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase.from('messages')
        .select('*').eq('mission_id', missionId).order('created_at')
      setMsgs((data ?? []) as Msg[])
    }
    init()

    const channel = supabase.channel(`chat:${missionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `mission_id=eq.${missionId}` },
        payload => setMsgs(m => [...m, payload.new as Msg]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [missionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim()) return
    const result = filterMessage(input)
    if (result.blocked) {
      setWarning(`Message filtré : ${result.reasons.join(', ')} interdits hors plateforme.`)
      setTimeout(() => setWarning(''), 4000)
    }
    const supabase = createClient()
    await supabase.from('messages').insert({
      mission_id: missionId,
      sender_id: userId,
      content: result.clean,
      type: 'text',
    })
    setInput('')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10" style={{ background: 'var(--navy)' }}>
        <button onClick={() => router.back()} className="text-white font-black">←</button>
        <div className="flex-1">
          <div className="font-fredoka text-white">Conversation sécurisée</div>
          <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>🔒 Protégée par Nexto</div>
        </div>
      </div>

      {/* Bannière sécurité */}
      <div className="px-4 py-2 text-xs font-bold text-center" style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>
        🛡️ Pour votre protection, les échanges de coordonnées et paiements hors plateforme sont bloqués.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <div className="text-3xl mb-2">💬</div>
            <div className="font-bold text-sm text-gray-400">Démarrez la conversation</div>
          </div>
        )}
        {msgs.map(m => {
          const mine = m.sender_id === userId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-bold"
                style={mine
                  ? { background: 'var(--accent)', color: 'white', borderBottomRightRadius: 4 }
                  : { background: 'white', color: 'var(--navy)', borderBottomLeftRadius: 4 }}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Warning */}
      {warning && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-xl text-xs font-black text-center"
          style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {warning}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white flex gap-2 items-center border-t border-gray-100">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          className="flex-1 px-4 py-3 rounded-full text-sm font-bold outline-none"
          style={{ background: 'var(--cream)' }}
          placeholder="Votre message..." />
        <button onClick={send}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black"
          style={{ background: 'var(--accent)' }}>↑</button>
      </div>
    </div>
  )
}
