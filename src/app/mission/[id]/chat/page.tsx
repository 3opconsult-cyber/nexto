"use client"
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { filterMessage } from '@/lib/chatFilter'
import { BUYER_RATE, SELLER_RATE } from '@/lib/pricing'

interface Msg {
  id: string
  sender_id: string | null
  body: string
  created_at: string
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = params.id as string
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState('')
  const [warning, setWarning] = useState('')
  const [tx, setTx] = useState<any>(null)
  const [editingPrice, setEditingPrice] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase.from('messages')
        .select('*').eq('transaction_id', transactionId).order('created_at')
      setMsgs((data ?? []) as Msg[])
      const { data: t } = await supabase.from('transactions').select('*').eq('id', transactionId).single()
      setTx(t)
    }
    init()

    const channel = supabase.channel(`chat:${transactionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transactionId}` },
        payload => setMsgs(m => [...m, payload.new as Msg]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [transactionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim() || !userId) return
    const result = filterMessage(input)
    if (result.blocked) {
      setWarning(`Message filtré : ${result.reasons.join(', ')} interdits hors plateforme.`)
      setTimeout(() => setWarning(''), 4000)
    }
    const supabase = createClient()
    await supabase.from('messages').insert({
      transaction_id: transactionId,
      sender_id: userId,
      body: result.clean,
    })
    setInput('')
  }

  async function applyNewPrice() {
    const cents = Math.round(Number(newAmount || 0) * 100)
    if (!cents || cents <= 0) return
    const buyerFee = Math.round(cents * BUYER_RATE)
    const sellerFee = Math.round(cents * SELLER_RATE)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('transactions').update({
      subtotal_cents: cents,
      buyer_fee_cents: buyerFee,
      seller_fee_cents: sellerFee,
      total_charged_cents: cents + buyerFee,
      payout_cents: cents - sellerFee,
    }).eq('id', transactionId).select().single()
    if (!error && updated) {
      setTx(updated)
      await supabase.from('messages').insert({
        transaction_id: transactionId,
        sender_id: null,
        body: `OFFER::${cents}::Tarif ajusté d'un commun accord (au lieu de ${(tx.subtotal_cents / 100).toFixed(2)} €)`,
      })
    }
    setEditingPrice(false)
    setNewAmount('')
  }

  async function submitReport() {
    if (!reportReason.trim() || !userId) return
    const supabase = createClient()
    await supabase.from('disputes').insert({
      transaction_id: transactionId, opener_id: userId, reason: reportReason.trim(),
    })
    await supabase.from('messages').insert({
      transaction_id: transactionId, sender_id: null,
      body: '⚠ Un litige a été ouvert sur cette mission.',
    })
    setReportSent(true)
    setReportReason('')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, background: '#123644' }}>
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontWeight: 700, fontSize: 15 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff' }}>Conversation</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>Protégée par PING</div>
        </div>
        {tx && (
          <button onClick={() => { setNewAmount(String(tx.subtotal_cents / 100)); setEditingPrice(true) }}
            style={{ padding: '7px 12px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
            {(tx.subtotal_cents / 100).toFixed(2)} € · Modifier
          </button>
        )}
        <button onClick={() => setReporting(true)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,122,102,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF7A66" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" /></svg>
        </button>
      </div>

      {reporting && (
        <div onClick={() => setReporting(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
            {reportSent ? (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 6 }}>Litige ouvert</h3>
                <p style={{ fontSize: 12.5, color: '#6E8592', marginBottom: 14 }}>C'est publié dans la conversation et visible dans "Litiges" pour les deux parties.</p>
                <button onClick={() => { setReporting(false); setReportSent(false) }} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>Fermer</button>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Signaler un problème</h3>
                <p style={{ fontSize: 12.5, color: '#6E8592', marginBottom: 14 }}>Décris ce qui ne va pas — c'est tracé et visible par les deux parties.</p>
                <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 14, fontFamily: 'inherit' }} />
                <button onClick={submitReport} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#FF7A66', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  Ouvrir le litige
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {editingPrice && (
        <div onClick={() => setEditingPrice(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
            <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Ajuster le tarif</h3>
            <p style={{ fontSize: 12.5, color: '#6E8592', marginBottom: 14 }}>À faire uniquement après accord avec l'autre partie dans la conversation. Le changement est publié dans le chat pour que ce soit tracé des deux côtés.</p>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0" step="0.5"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 15, marginBottom: 14 }} />
            <button onClick={applyNewPrice} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
              Valider le nouveau tarif
            </button>
          </div>
        </div>
      )}

      {/* Bannière sécurité */}
      <div style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 600, textAlign: 'center', background: 'rgba(18,179,156,.1)', color: '#0C8F7E' }}>
        Pour votre protection, les échanges de coordonnées et paiements hors plateforme sont bloqués.
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Démarrez la conversation</div>
        )}
        {msgs.map(m => {
          if (m.sender_id === null && m.body.startsWith('OFFER::')) {
            const [, centsStr, label] = m.body.split('::')
            return (
              <div key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', width: '100%', background: '#fff', border: '1px solid #DCE5E3', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Tarif</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: '#6E8592', maxWidth: '65%' }}>{label}</span>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#123644' }}>{(Number(centsStr) / 100).toFixed(2)} €</span>
                </div>
              </div>
            )
          }
          if (m.sender_id === null) {
            return (
              <div key={m.id} style={{ alignSelf: 'center', maxWidth: '85%', background: 'rgba(18,179,156,.1)', color: '#0C8F7E', fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textAlign: 'center' }}>
                {m.body}
              </div>
            )
          }
          const mine = m.sender_id === userId
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 13.5, fontWeight: 500,
                ...(mine
                  ? { background: '#12B39C', color: '#fff', borderBottomRightRadius: 4 }
                  : { background: '#fff', color: '#123644', borderBottomLeftRadius: 4, border: '1px solid #E7EDEB' }),
              }}>
                {m.body}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Warning */}
      {warning && (
        <div style={{ margin: '0 16px 8px', padding: '9px 14px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, textAlign: 'center', background: '#FEE2E2', color: '#B91C1C' }}>
          {warning}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #E7EDEB' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 999, fontSize: 13.5, border: '1px solid #DCE5E3', outline: 'none', background: '#F3F6F5' }}
          placeholder="Votre message…" />
        <button onClick={send}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  )
}
