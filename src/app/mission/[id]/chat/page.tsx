"use client"
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReviewModal from '@/components/ReviewModal'
import DepartureBar from '@/components/DepartureBar'
import { filterMessage } from '@/lib/chatFilter'
import { BUYER_RATE, SELLER_RATE } from '@/lib/pricing'

interface Msg {
  id: string
  sender_id: string | null
  body: string
  created_at: string
  kind: 'text' | 'offer'
  offer_cents: number | null
  offer_status: 'pending' | 'accepted' | 'declined' | null
  photo_path: string | null
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
  const [counterpart, setCounterpart] = useState<string>('Conversation')
  const [editingPrice, setEditingPrice] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newAmountReason, setNewAmountReason] = useState('')
  const [newAmountPhoto, setNewAmountPhoto] = useState<File | null>(null)
  const [sendingOffer, setSendingOffer] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [askReview, setAskReview] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase.from('messages')
        .select('*').eq('transaction_id', transactionId).order('created_at')
      const loaded = (data ?? []) as Msg[]
      setMsgs(loaded)
      resolvePhotoUrls(loaded)
      const { data: t } = await supabase.from('transactions').select('*').eq('id', transactionId).single()
      setTx(t)
      if (t && user) {
        const otherId = user.id === t.buyer_id ? t.seller_id : t.buyer_id
        const { data: p } = await supabase.from('profiles').select('first_name, last_name').eq('id', otherId).single()
        if (p) setCounterpart(`${p.first_name || ''} ${p.last_name ? p.last_name.charAt(0) + '.' : ''}`.trim() || 'Conversation')

        // Mission terminee et pas encore notee par ce client : on demande son
        // avis ici, c'est l'ecran ou il atterrit apres le scan de sortie.
        if (user.id === t.buyer_id && ['completed', 'released'].includes(t.status)) {
          const { count } = await supabase.from('reviews')
            .select('transaction_id', { count: 'exact', head: true })
            .eq('transaction_id', t.id).eq('rater_id', user.id)
          if (!count) setAskReview(true)
        }
      }
    }
    init()

    async function resolvePhotoUrls(list: Msg[]) {
      const withPhoto = list.filter(m => m.photo_path)
      for (const m of withPhoto) {
        const { data } = await supabase.storage.from('offer-photos').createSignedUrl(m.photo_path as string, 3600)
        if (data?.signedUrl) setPhotoUrls(prev => ({ ...prev, [m.id]: data.signedUrl }))
      }
    }

    const channel = supabase.channel(`chat:${transactionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transactionId}` },
        payload => {
          const m = payload.new as Msg
          setMsgs(prev => [...prev, m])
          if (m.photo_path) resolvePhotoUrls([m])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transactionId}` },
        payload => setMsgs(prev => prev.map(m => m.id === payload.new.id ? payload.new as Msg : m)))
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

  async function proposeOffer() {
    const cents = Math.round(Number(newAmount || 0) * 100)
    if (!cents || cents <= 0 || !userId) return
    setSendingOffer(true)
    const supabase = createClient()

    let photoPath: string | null = null
    if (newAmountPhoto) {
      const ext = newAmountPhoto.name.split('.').pop()
      const path = `${transactionId}/${userId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('offer-photos').upload(path, newAmountPhoto)
      if (!upErr) photoPath = path
    }

    await supabase.from('messages').insert({
      transaction_id: transactionId,
      sender_id: userId,
      kind: 'offer',
      offer_cents: cents,
      offer_status: 'pending',
      photo_path: photoPath,
      body: newAmountReason.trim() || `Nouveau tarif proposé (au lieu de ${(tx.subtotal_cents / 100).toFixed(2)} €)`,
    })

    setEditingPrice(false)
    setNewAmount('')
    setNewAmountReason('')
    setNewAmountPhoto(null)
    setSendingOffer(false)
  }

  async function acceptOffer(m: Msg) {
    if (!m.offer_cents) return
    const cents = m.offer_cents
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
      await supabase.from('messages').update({ offer_status: 'accepted' }).eq('id', m.id)
      setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, offer_status: 'accepted' } : x))
    }
  }

  async function declineOffer(m: Msg) {
    const supabase = createClient()
    await supabase.from('messages').update({ offer_status: 'declined' }).eq('id', m.id)
    setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, offer_status: 'declined' } : x))
  }

  async function counterOffer(m: Msg) {
    await declineOffer(m)
    setNewAmount(m.offer_cents ? String(m.offer_cents / 100) : '')
    setNewAmountReason('')
    setNewAmountPhoto(null)
    setEditingPrice(true)
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
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #E7EDEB' }}>
        <button onClick={() => router.back()} style={{ color: '#123644', background: 'none', border: 'none', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>{counterpart}</span>
          <span style={{ fontSize: 11, color: '#12B39C', fontWeight: 600 }}>● en ligne · identité masquée</span>
        </div>
        {tx && (
          <span style={{ padding: '6px 11px', borderRadius: 999, background: '#F3F6F5', color: '#6E8592', fontSize: 11.5, fontWeight: 700 }}>
            {(tx.subtotal_cents / 100).toFixed(2)} €
          </span>
        )}
        <button onClick={() => setReporting(true)} title="Signaler cet échange" style={{ border: 'none', background: 'none', padding: 4, display: 'flex', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M5 3v18" /><path d="M5 4h11l-1.5 4L16 12H5" /></svg>
        </button>
      </div>

      {/* Le prestataire annonce son depart ; le client suit l'approche. */}
      {tx && userId && (
        <DepartureBar tx={tx} userId={userId} onChange={setTx} />
      )}

      {tx && userId && (
        <ReviewModal
          open={askReview}
          onClose={() => setAskReview(false)}
          transactionId={tx.id}
          raterId={userId}
          rateeId={tx.seller_id}
          proName={counterpart}
        />
      )}

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
            <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', marginBottom: 4 }}>Proposer un nouveau tarif</h3>
            <p style={{ fontSize: 12.5, color: '#6E8592', marginBottom: 14 }}>Ce n'est pas appliqué tout de suite — l'autre partie doit valider dans la conversation, avec la photo si elle justifie le changement.</p>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0" step="0.5" placeholder="Nouveau montant en €"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 15, marginBottom: 10 }} />
            <textarea value={newAmountReason} onChange={e => setNewAmountReason(e.target.value)} rows={2} placeholder="Motif (facultatif)"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, marginBottom: 10, fontFamily: 'inherit' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, border: '1px dashed #DCE5E3', marginBottom: 14, cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
              <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>{newAmountPhoto ? newAmountPhoto.name : 'Ajouter une photo à l\u2019appui (facultatif)'}</span>
              <input type="file" accept="image/*" onChange={e => setNewAmountPhoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </label>
            <button onClick={proposeOffer} disabled={sendingOffer} style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
              {sendingOffer ? 'Envoi…' : 'Envoyer la proposition'}
            </button>
          </div>
        </div>
      )}

      {/* Bannière sécurité */}
      <div style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 600, textAlign: 'center', background: 'rgba(18,179,156,.1)', color: '#0C8F7E' }}>
        Coordonnées protégées jusqu'au QR de fin
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Démarrez la conversation</div>
        )}
        {msgs.map(m => {
          if (m.kind === 'offer') {
            const mine = m.sender_id === userId
            return (
              <div key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', width: '100%', background: '#fff', border: '2px solid #12B39C', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#12B39C', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Devis</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: m.body ? 6 : 0 }}>
                  <span style={{ fontSize: 12, color: '#6E8592', maxWidth: '65%' }}>{m.body}</span>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#123644' }}>{((m.offer_cents || 0) / 100).toFixed(2)} €</span>
                </div>
                {m.photo_path && (
                  photoUrls[m.id]
                    ? <img src={photoUrls[m.id]} alt="Photo à l'appui" style={{ width: '100%', borderRadius: 10, marginTop: 8, display: 'block' }} />
                    : <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Photo jointe…</div>
                )}
                {m.offer_status === 'pending' && !mine && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => counterOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#6E8592', fontWeight: 700, fontSize: 12.5 }}>Refaire une proposition</button>
                    <button onClick={() => acceptOffer(m)} style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 12.5 }}>Accepter</button>
                  </div>
                )}
                {m.offer_status === 'pending' && mine && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#8a6520' }}>En attente de validation</div>
                )}
                {m.offer_status === 'accepted' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#0C8F7E' }}>✓ Accepté — appliqué à la mission</div>
                )}
                {m.offer_status === 'declined' && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#9CA3AF' }}>Refusé</div>
                )}
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

      {tx && !msgs.some(m => m.kind === 'offer' && m.offer_status === 'pending') && (
        <div style={{ padding: '0 16px 8px', textAlign: 'center' }}>
          <button onClick={() => { setNewAmount(String(tx.subtotal_cents / 100)); setNewAmountReason(''); setNewAmountPhoto(null); setEditingPrice(true) }}
            style={{ background: 'none', border: 'none', color: '#0C8F7E', fontSize: 12, fontWeight: 700 }}>
            + Proposer un tarif
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #E7EDEB' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 999, fontSize: 13.5, border: '1px solid #DCE5E3', outline: 'none', background: '#F3F6F5' }}
          placeholder="Écrire un message…" />
        <button onClick={send}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#12B39C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
