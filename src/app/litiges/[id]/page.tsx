"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { filterMessage } from '@/lib/chatFilter'

/**
 * Dossier d'un litige, comme le centre de résolution d'Airbnb (Romain 31/10) : un fil de discussion
 * dédié à CE litige, séparé de la conversation de la mission, entre le client, le prestataire et PING
 * (médiation). Tout est rangé par litige (table `dispute_messages`), jamais perdu dans le chat.
 * PING (admin) peut répondre en médiateur et clore le litige (résolu / non retenu) avec sa décision.
 */
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: 'En cours', bg: '#FFF7ED', fg: '#8a6520' },
  resolved: { label: 'Résolu', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' },
  rejected: { label: 'Non retenu', bg: '#EEF2F1', fg: '#4E6470' },
}
const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }

type Msg = { id: string; sender_id: string | null; body: string; kind: string; created_at: string }

export default function LitigePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [admin, setAdmin] = useState(false)
  const [d, setD] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [other, setOther] = useState('')
  const [input, setInput] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const [decision, setDecision] = useState('')
  const [pays, setPays] = useState<any[]>([])
  const [refundEur, setRefundEur] = useState('')
  const [moneyMsg, setMoneyMsg] = useState('')
  const end = useRef<HTMLDivElement>(null)

  const loadMsgs = useCallback(async () => {
    const { data } = await createClient().from('dispute_messages').select('id, sender_id, body, kind, created_at').eq('dispute_id', id).order('created_at')
    setMsgs((data as Msg[]) ?? [])
  }, [id])

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/auth/login?next=/litiges/${id}`); return }
      setUid(user.id)
      const { data: isAdm } = await supabase.rpc('is_admin')
      setAdmin(!!isAdm)
      const { data } = await supabase.from('disputes')
        .select('id, reason, status, resolution, created_at, opener_id, transaction_id, transactions(id, buyer_id, seller_id, subtotal_cents, buyer_fee_cents, total_charged_cents, payout_cents, payment_status, payment_provider, scheduled_at, completed_at, requests(title, category))')
        .eq('id', id).maybeSingle()
      if (!data) { setMissing(true); return }
      setD(data)
      const { data: names } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: [data.transaction_id] })
      if (names?.[0]?.full_name) setOther(names[0].full_name)
      await loadMsgs()
      const { data: p } = await supabase.from('payments').select('kind, amount_cents, status, created_at').eq('transaction_id', data.transaction_id).order('created_at')
      setPays(p ?? [])
    })()
  }, [id, router, loadMsgs])

  // Le fil se met à jour tout seul tant que la page est ouverte.
  useEffect(() => { const t = setInterval(loadMsgs, 10000); return () => clearInterval(t) }, [loadMsgs])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  async function send(kind: 'text' | 'mediation' = 'text') {
    const body = input.trim()
    if (!body) return
    const f = filterMessage(body)
    if (f.blocked && kind === 'text') { setErr(`Retirez le ${f.reasons[0]} : les échanges restent dans PING.`); return }
    setSending(true); setErr('')
    const { error } = await createClient().from('dispute_messages').insert({ dispute_id: id, sender_id: uid, body, kind })
    setSending(false)
    if (error) { setErr('Message non envoyé. Réessayez.'); return }
    setInput(''); loadMsgs()
  }

  async function close(status: 'resolved' | 'rejected') {
    if (!decision.trim()) { setErr('Écrivez la décision avant de clore le litige.'); return }
    const supabase = createClient()
    const { error } = await supabase.from('disputes').update({ status, resolution: decision.trim() }).eq('id', id)
    if (error) { setErr('Le litige n’a pas pu être clos.'); return }
    await supabase.from('dispute_messages').insert({ dispute_id: id, sender_id: uid, kind: 'mediation', body: `PING : ${status === 'resolved' ? 'litige résolu' : 'réclamation non retenue'}. ${decision.trim()}` })
    if (d?.transaction_id) await supabase.from('messages').insert({ transaction_id: d.transaction_id, sender_id: uid, kind: 'system', body: `${status === 'resolved' ? '✓ Litige résolu' : '✕ Réclamation non retenue'} : ${decision.trim()}` })
    setD({ ...d, status, resolution: decision.trim() }); setDecision(''); loadMsgs()
  }

  // Remboursement depuis le séquestre (admin) : même route que le reste du module de paiement,
  // qui refuse tout ce qui a déjà été versé au prestataire.
  async function refundClient() {
    const cents = Math.round(Number(String(refundEur).replace(',', '.')) * 100)
    if (!cents || cents <= 0) { setMoneyMsg('Indiquez le montant à rembourser.'); return }
    setMoneyMsg('Remboursement en cours…')
    const r = await fetch('/api/payments/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: d.transaction_id, montantCents: cents, motif: `Litige : ${d.reason}` }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMoneyMsg(j.error || 'Remboursement refusé.'); return }
    setMoneyMsg(j.rembourseCents ? `${EUR(j.rembourseCents)} remboursés au client.` : 'Rien à rembourser : aucun paiement encaissé pour cette mission.')
    await createClient().from('dispute_messages').insert({ dispute_id: id, sender_id: uid, kind: 'mediation', body: `PING : remboursement de ${EUR(cents)} au client décidé.` })
    loadMsgs()
  }
  // Déjà versé : PING retient la somme sur les prochains versements du prestataire (pare-feu).
  async function retenue() {
    const cents = Math.round(Number(String(refundEur).replace(',', '.')) * 100)
    if (!cents || cents <= 0) { setMoneyMsg('Indiquez le montant à retenir.'); return }
    const { error } = await createClient().from('commission_debts').insert({ provider_id: d.transactions.seller_id, transaction_id: d.transaction_id, amount_cents: cents, reason: `Litige : ${d.reason}`.slice(0, 200) })
    setMoneyMsg(error ? 'Retenue non enregistrée.' : `${EUR(cents)} seront retenus sur les prochains versements du prestataire.`)
  }

  if (missing) return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 22, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16, color: '#123644', margin: 0 }}>Litige introuvable</h2>
        <p style={{ fontSize: 13, color: '#4E6470' }}>Ce litige n’existe plus ou ne vous concerne pas.</p>
        <a href="/litiges" style={{ color: '#0C8F7E', fontWeight: 700, fontSize: 13 }}>Mes litiges</a>
      </div>
    </div>
  )

  const tx = d?.transactions
  const st = STATUS[d?.status] ?? STATUS.open
  const open = d?.status === 'open'
  const who = (m: Msg) => m.kind === 'mediation' ? 'PING' : m.sender_id === uid ? 'Vous' : m.sender_id === tx?.buyer_id ? `${other || 'Client'} (client)` : m.sender_id === tx?.seller_id ? `${other || 'Prestataire'} (prestataire)` : 'PING'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#123644', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/litiges')} aria-label="Retour" style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16 }}>Litige{other ? ` · ${other}` : ''}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.8)' }}>Dossier suivi par PING · les deux parties et PING voient ce fil</div>
        </div>
      </div>

      {d && (
        <div style={{ padding: '14px 16px 0', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{tx?.requests?.title || TRAD[tx?.requests?.category] || 'Mission'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.fg, flexShrink: 0 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#4E6470', marginTop: 6, lineHeight: 1.6 }}>
              Ouvert le {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} par {d.opener_id === uid ? 'vous' : d.opener_id === tx?.buyer_id ? 'le client' : 'le prestataire'}
              {tx?.subtotal_cents ? <> · prestation {EUR(tx.subtotal_cents)}</> : null}
            </div>
            <div style={{ fontSize: 13, color: '#123644', marginTop: 8 }}><b>Motif :</b> {d.reason}</div>
            {d.resolution && <div style={{ fontSize: 13, color: '#0C8F7E', marginTop: 6, fontWeight: 600 }}>Décision : {d.resolution}</div>}
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <a href={`/mission/${d.transaction_id}/chat`} style={{ fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>Voir la mission</a>
              <a href={`/mission/${d.transaction_id}/facture`} style={{ fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>Factures</a>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: 16, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map(m => {
          const mine = m.sender_id === uid && m.kind !== 'mediation'
          const med = m.kind === 'mediation'
          return (
            <div key={m.id} style={{ alignSelf: med ? 'stretch' : mine ? 'flex-end' : 'flex-start', maxWidth: med ? '100%' : '82%' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: med ? '#0C8F7E' : '#4E6470', margin: '0 4px 3px', textAlign: mine ? 'right' : 'left' }}>
                {who(m)} · {new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{
                padding: '10px 13px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                background: med ? 'rgba(18,179,156,.1)' : mine ? '#123644' : '#fff', color: mine && !med ? '#fff' : '#123644',
                border: med ? '1px solid rgba(18,179,156,.35)' : mine ? 'none' : '1px solid #E7EDEB',
              }}>{m.body}</div>
            </div>
          )
        })}
        {!msgs.length && d && <div style={{ textAlign: 'center', color: '#4E6470', fontSize: 13, padding: 20 }}>Expliquez ce qui s’est passé : l’autre partie et PING vous répondent ici.</div>}
        <div ref={end} />
      </div>

      {d && (
        <div style={{ padding: '0 16px 10px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <MoneyPanel tx={tx} pays={pays} admin={admin} open={open} refundEur={refundEur} setRefundEur={setRefundEur}
            onRefund={refundClient} onRetenue={retenue} msg={moneyMsg} />
        </div>
      )}

      {admin && open && (
        <div style={{ padding: '0 16px 10px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', border: '1px dashed #12B39C', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0C8F7E', marginBottom: 6 }}>Médiation PING (visible par vous seul)</div>
            <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={2} placeholder="Décision (ex. : geste commercial de 10 €)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #DCE5E3', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => close('resolved')} style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Clore : résolu</button>
              <button onClick={() => close('rejected')} style={{ flex: 1, padding: 10, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, cursor: 'pointer' }}>Clore : non retenu</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 5, background: '#fff', borderTop: '1px solid #E7EDEB', padding: '10px 16px' }}>
        {err && <div style={{ color: '#c0503a', fontSize: 12, marginBottom: 6 }}>{err}</div>}
        {open || admin ? (
          <div style={{ display: 'flex', gap: 8, maxWidth: 640, margin: '0 auto' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(admin ? 'mediation' : 'text') }}
              placeholder={admin ? 'Message de PING aux deux parties…' : 'Votre message sur ce litige…'}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 999, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', background: '#F3F6F5' }} />
            <button onClick={() => send(admin ? 'mediation' : 'text')} disabled={sending || !input.trim()}
              style={{ padding: '0 18px', borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: sending || !input.trim() ? .5 : 1 }}>Envoyer</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#4E6470' }}>Litige clos : le fil reste consultable.</div>
        )}
      </div>
    </div>
  )
}

const PAY: Record<string, string> = {
  none: 'Paiement en ligne non activé : aucun argent n’a transité par PING pour cette mission.',
  awaiting: 'Paiement demandé au client, pas encore encaissé.',
  held: 'Sous séquestre chez le prestataire de paiement : rien n’a été versé au prestataire.',
  complement_due: 'Sous séquestre, complément à payer par le client : rien n’a été versé.',
  released: 'Déjà versé au prestataire.',
  refunded: 'Remboursé au client.',
  failed: 'Encaissement en échec.',
}

function MoneyPanel({ tx, pays, admin, open, refundEur, setRefundEur, onRefund, onRetenue, msg }: {
  tx: any; pays: any[]; admin: boolean; open: boolean; refundEur: string; setRefundEur: (v: string) => void
  onRefund: () => void; onRetenue: () => void; msg: string
}) {
  if (!tx) return null
  const ps = tx.payment_status || 'none'
  const sum = (k: string) => pays.filter(p => p.kind === k && p.status === 'succeeded').reduce((a, p) => a + p.amount_cents, 0)
  const held = ps === 'held' || ps === 'complement_due'
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Argent de la mission</div>
      <div style={{ fontSize: 13, color: '#123644', lineHeight: 1.55 }}>{PAY[ps] || ps}</div>
      {open && ps !== 'released' && <div style={{ fontSize: 12.5, color: '#0C8F7E', fontWeight: 700, marginTop: 6 }}>Versement au prestataire bloqué tant que le litige est ouvert.</div>}
      {admin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 12.5, color: '#4E6470', marginTop: 10 }}>
            <span>Total payé par le client</span><b style={{ color: '#123644' }}>{EUR(tx.total_charged_cents || 0)}</b>
            <span>Encaissé (séquestre)</span><b style={{ color: '#123644' }}>{EUR(sum('charge'))}</b>
            <span>Versé au prestataire</span><b style={{ color: sum('transfer') + sum('payout') ? '#B42318' : '#123644' }}>{EUR(sum('transfer') + sum('payout'))}</b>
            <span>Déjà remboursé</span><b style={{ color: '#123644' }}>{EUR(sum('refund'))}</b>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input value={refundEur} onChange={e => setRefundEur(e.target.value)} inputMode="decimal" placeholder="Montant €"
              style={{ width: 110, padding: '9px 11px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 13 }} />
            {ps !== 'released'
              ? <button onClick={onRefund} disabled={!held} title={held ? '' : 'Aucun paiement sous séquestre'}
                  style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: held ? '#FF7A66' : '#DCE5E3', color: '#fff', fontWeight: 700, cursor: held ? 'pointer' : 'default' }}>Rembourser le client (séquestre)</button>
              : <button onClick={onRetenue}
                  style={{ flex: 1, padding: 10, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Retenir sur ses prochains versements</button>}
          </div>
          {!held && ps !== 'released' && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 6 }}>Remboursement possible seulement quand un paiement est sous séquestre.</div>}
          {msg && <div style={{ fontSize: 12.5, color: '#123644', marginTop: 8, fontWeight: 600 }}>{msg}</div>}
        </>
      )}
    </div>
  )
}
