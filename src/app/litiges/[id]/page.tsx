"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { filterMessage } from '@/lib/chatFilter'
import { categoryLabel } from '@/lib/dispute'
import AmicableSettlement from '@/components/AmicableSettlement'
import { notifyOther, alertAdminNow } from '@/lib/notify'

/**
 * Dossier d'un litige, comme le centre de résolution d'Airbnb (Romain 31/10) : un fil de discussion
 * dédié à CE litige, séparé de la conversation de la mission, entre le client, le prestataire et PING
 * (médiation). Tout est rangé par litige (table `dispute_messages`), jamais perdu dans le chat.
 * PING (admin) peut répondre en médiateur et clore le litige (résolu / non retenu) avec sa décision.
 */
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: 'En cours', bg: '#FFF7ED', fg: '#8a6520' },
  resolved: { label: 'Résolu', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' },
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
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  // Décision PING (054) : montant rendu au client, motif, confirmation en 2 appuis.
  const [decRefund, setDecRefund] = useState('')
  const [decConfirm, setDecConfirm] = useState(false)
  const [decBusy, setDecBusy] = useState(false)
  const [medBusy, setMedBusy] = useState(false)
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
        // « * » : les colonnes de l'arrangement à l'amiable (migration 040) arrivent seules une fois appliquée.
        .select('*, transactions(id, buyer_id, seller_id, subtotal_cents, buyer_fee_cents, total_charged_cents, payout_cents, payment_status, payment_provider, scheduled_at, completed_at, requests(title, category))')
        .eq('id', id).maybeSingle()
      if (!data) { setMissing(true); return }
      setD(data)
      // Photos jointes : bucket privé, lues par URL signée (l'autre partie et PING y ont accès par règle de stockage).
      const paths: string[] = data.photo_paths ?? []
      if (paths.length) {
        const urls = await Promise.all(paths.map(async (pa: string) => (await supabase.storage.from('dispute-photos').createSignedUrl(pa, 3600)).data?.signedUrl ?? ''))
        setPhotoUrls(urls.filter(Boolean))
      }
      const { data: names } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: [data.transaction_id] })
      if (names?.[0]?.full_name) setOther(names[0].full_name)
      await loadMsgs()
      const { data: p } = await supabase.from('payments').select('kind, amount_cents, status, created_at').eq('transaction_id', data.transaction_id).order('created_at')
      setPays(p ?? [])
    })()
  }, [id, router, loadMsgs])

  // Après une proposition / réponse d'arrangement : relit le litige (statut, montant) et le fil.
  async function reloadDispute() {
    const { data } = await createClient().from('disputes').select('*').eq('id', id).maybeSingle()
    if (data) setD((prev: any) => ({ ...prev, ...data }))
    loadMsgs()
    return data
  }

  // Fin du litige (arrangement accepté, décision PING) : le serveur exécute la répartition de l'argent chez le
  // prestataire de paiement (séquestre) et prévient les deux parties par e-mail. Le cron reprend en cas d'échec.
  async function applyMoney() {
    try {
      const r = await fetch('/api/disputes/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disputeId: id }) })
      return await r.json().catch(() => ({}))
    } catch { return {} }
  }

  // « Demander l'intervention de PING » (client ou prestataire) : PING prend le relais dans ce fil.
  async function requestMediation() {
    setMedBusy(true); setErr('')
    const { error } = await createClient().rpc('request_ping_mediation', { p_dispute: id })
    setMedBusy(false)
    if (error) { setErr(error.message || 'Demande non envoyée. Réessayez.'); return }
    if (d?.transaction_id) { notifyOther(d.transaction_id, 'dispute_mediation', id); alertAdminNow(d.transaction_id, 'dispute_mediation') }
    reloadDispute()
  }

  // Décision PING : la base clôt le litige, émet l'avoir et ajuste le virement ; le serveur répartit le séquestre.
  async function applyDecision() {
    const ceiling = d?.transactions?.subtotal_cents ?? 0
    const cents = decRefund.trim() === '' ? NaN : Math.round(Number(decRefund.replace(',', '.').replace(/\s/g, '')) * 100)
    if (!Number.isFinite(cents) || cents < 0) { setErr('Indiquez le montant rendu au client (0 € si rien).'); setDecConfirm(false); return }
    if (cents > ceiling) { setErr(`Au plus ${EUR(ceiling)}, le prix de la prestation.`); setDecConfirm(false); return }
    if (!decision.trim()) { setErr('Écrivez le motif de la décision.'); setDecConfirm(false); return }
    setDecBusy(true); setErr('')
    const { error } = await createClient().rpc('ping_decide_dispute', { p_dispute: id, p_refund_cents: cents, p_reason: decision.trim() })
    if (error) { setDecBusy(false); setDecConfirm(false); setErr(error.message || 'Décision non appliquée.'); return }
    const r = await applyMoney()
    setDecBusy(false); setDecConfirm(false); setDecision(''); setDecRefund('')
    const etat = r?.argent?.etat
    setMoneyMsg(etat === 'reparti' ? 'Décision appliquée : remboursement et versement effectués chez le prestataire de paiement.'
      : etat === 'virement_avoir' ? 'Décision appliquée : avoir émis sur la facture, virement de la prestation ajusté.'
      : etat === 'erreur' ? `Décision enregistrée, mais la répartition du paiement a échoué (${r.argent.erreur}). Elle sera retentée automatiquement.`
      : 'Décision appliquée. Les deux parties sont prévenues.')
    reloadDispute()
  }

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
        <a href="/litiges" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: '#0B8374', fontWeight: 700, fontSize: 13 }}>Mes litiges</a>
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
        <button onClick={() => router.push('/litiges')} aria-label="Retour" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
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
            {(d.category || d.claimed_cents != null) && (
              <div style={{ fontSize: 13, color: '#123644', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                {d.category && <span><b>Catégorie :</b> {categoryLabel(d.category) ?? d.category}</span>}
                {d.claimed_cents != null && <span><b>Montant réclamé :</b> {EUR(d.claimed_cents)}</span>}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#123644', marginTop: 8 }}><b>Motif :</b> {d.reason}</div>
            {open && d.deadline_at && <Countdown to={d.deadline_at} />}
            {photoUrls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {photoUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la photo ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`Photo ${i + 1} jointe au litige`} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid #E7EDEB', display: 'block' }} />
                  </a>
                ))}
              </div>
            )}
            {d.resolution && <div style={{ fontSize: 13, color: '#0B8374', marginTop: 6, fontWeight: 600 }}>Décision : {d.resolution}</div>}
            {tx && uid && <AmicableSettlement dispute={d} buyerId={tx.buyer_id} sellerId={tx.seller_id} userId={uid}
              ceilingCents={tx.subtotal_cents} onChange={reloadDispute} />}
            {/* Intervention de PING (054) : visible des deux parties tant que le litige est ouvert. */}
            {tx && uid && open && 'mediation_requested_at' in d && (uid === tx.buyer_id || uid === tx.seller_id) && (
              d.mediation_requested_at ? (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(18,179,156,.08)', border: '1px solid rgba(18,179,156,.3)', fontSize: 12.5, color: '#123644', lineHeight: 1.5 }}>
                  <b>Intervention de PING demandée</b> le {new Date(d.mediation_requested_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  {d.mediation_requested_by === uid ? ' (par vous)' : d.mediation_requested_by === tx.buyer_id ? ' par le client' : ' par le prestataire'}.
                  {' '}PING prend le relais dans ce fil et rendra sa décision : montant rendu au client, reste versé au prestataire.
                </div>
              ) : (
                <button type="button" onClick={requestMediation} disabled={medBusy}
                  style={{ ...linkBtn, width: '100%', marginTop: 10, border: '1.5px solid #123644', color: '#123644', cursor: medBusy ? 'default' : 'pointer', opacity: medBusy ? .6 : 1, fontFamily: 'inherit' }}>
                  Demander la médiation de PING
                </button>
              )
            )}
            {/* Liens en boutons de 44 px (audit ergonomie 19/11, correction 20). */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <a href={`/mission/${d.transaction_id}/chat`} style={linkBtn}>Voir la mission</a>
              <a href={`/mission/${d.transaction_id}/facture`} style={linkBtn}>Factures</a>
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
              <div style={{ fontSize: 10.5, fontWeight: 700, color: med ? '#0B8374' : '#4E6470', margin: '0 4px 3px', textAlign: mine ? 'right' : 'left' }}>
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
            onRefund={refundClient} onRetenue={retenue} msg={moneyMsg} dispute={d} />
        </div>
      )}

      {admin && open && d && 'decided_at' in d && (
        <DecisionPanel ceiling={tx?.subtotal_cents ?? 0} requested={d.mediation_requested_at} refund={decRefund} setRefund={v => { setDecRefund(v); setDecConfirm(false) }}
          reason={decision} setReason={v => { setDecision(v); setDecConfirm(false) }} confirm={decConfirm} setConfirm={setDecConfirm}
          busy={decBusy} onApply={applyDecision} />
      )}

      {admin && open && d && !('decided_at' in d) && (
        <div style={{ padding: '0 16px 10px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', border: '1px dashed #12B39C', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0B8374', marginBottom: 6 }}>Médiation PING (visible par vous seul)</div>
            <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={2} aria-label="Décision de PING"
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #DCE5E3', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => close('resolved')} style={{ flex: 1, minHeight: 44, padding: 10, borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Clore : résolu</button>
              <button onClick={() => close('rejected')} style={{ flex: 1, minHeight: 44, padding: 10, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, cursor: 'pointer' }}>Clore : non retenu</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 5, background: '#fff', borderTop: '1px solid #E7EDEB', padding: '10px 16px' }}>
        {err && <div style={{ color: '#c0503a', fontSize: 12, marginBottom: 6 }}>{err}</div>}
        {open || admin ? (
          <div style={{ display: 'flex', gap: 8, maxWidth: 640, margin: '0 auto' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(admin ? 'mediation' : 'text') }}
              aria-label={admin ? 'Message de PING aux deux parties' : 'Votre message sur ce litige'}
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '12px 14px', borderRadius: 999, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', background: '#F3F6F5' }} />
            <button onClick={() => send(admin ? 'mediation' : 'text')} disabled={sending || !input.trim()}
              style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: sending || !input.trim() ? .5 : 1 }}>Envoyer</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#4E6470' }}>Litige clos : le fil reste consultable.</div>
        )}
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 14px', borderRadius: 999,
  border: '1.5px solid #DCE5E3', background: '#fff', color: '#0B8374', fontSize: 13, fontWeight: 700, textDecoration: 'none',
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

function MoneyPanel({ tx, pays, admin, open, refundEur, setRefundEur, onRefund, onRetenue, msg, dispute }: {
  tx: any; pays: any[]; admin: boolean; open: boolean; refundEur: string; setRefundEur: (v: string) => void
  onRefund: () => void; onRetenue: () => void; msg: string; dispute: any
}) {
  if (!tx) return null
  const ps = tx.payment_status || 'none'
  // 054 collée : la « Décision PING » fait la répartition ; les outils manuels restent pour les litiges clos.
  const withDecision = !!dispute && 'decided_at' in dispute
  const showManual = !withDecision || !open
  const online = ps !== 'none'
  const result = dispute?.money_result as { etat?: string; rembourseCents?: number; retenueCents?: number } | null | undefined
  const sum = (k: string) => pays.filter(p => p.kind === k && p.status === 'succeeded').reduce((a, p) => a + p.amount_cents, 0)
  const held = ps === 'held' || ps === 'complement_due'
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Argent de la mission</div>
      <div style={{ fontSize: 13, color: '#123644', lineHeight: 1.55 }}>{PAY[ps] || ps}</div>
      {open && ps !== 'released' && (
        <div style={{ fontSize: 12.5, color: '#0B8374', fontWeight: 700, marginTop: 6, lineHeight: 1.5 }}>
          Le paiement est bloqué jusqu’à la résolution du litige{online ? ' : rien n’est versé au prestataire.' : ' : le virement de la prestation est suspendu, sans relance de retard.'}
        </div>
      )}
      {/* Les 3 fins possibles, dites clairement (demande Romain 20/11). */}
      {open && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#4E6470', lineHeight: 1.55 }}>
          <li><b>Arrangement à l’amiable</b> accepté par les deux : le montant convenu est rendu au client{online ? '' : ' (avoir sur la facture)'}, le reste va au prestataire.</li>
          <li><b>Intervention de PING</b>, demandée par l’un ou l’autre : PING décide du montant rendu au client, le reste va au prestataire.</li>
          <li>Sans réclamation retenue : la prestation est réglée normalement au prestataire.</li>
        </ul>
      )}
      {!open && dispute?.decided_at && (
        <div style={{ fontSize: 12.5, color: '#123644', marginTop: 6, lineHeight: 1.5 }}>
          Décision de PING : <b>{EUR(dispute.decision_refund_cents || 0)}</b> rendus au client, <b>{EUR(dispute.decision_payout_cents || 0)}</b> pour le prestataire (sur le prix de la prestation).
        </div>
      )}
      {!open && result?.etat && (
        <div style={{ fontSize: 12, color: '#4E6470', marginTop: 4 }}>
          {result.etat === 'reparti' ? `Répartition faite : ${EUR(result.rembourseCents || 0)} remboursés au client, le reste versé au prestataire.`
            : result.etat === 'virement_avoir' ? 'Répartition par avoir sur la facture : le virement de la prestation est ajusté.'
            : result.etat === 'deja_verse' ? `Prestation déjà versée : ${EUR(result.retenueCents || 0)} retenus sur les prochains versements du prestataire.`
            : result.etat === 'versement_en_attente' ? 'Remboursement fait ; versement au prestataire en attente (reprise automatique).' : null}
        </div>
      )}
      {!open && dispute?.money_error && admin && <div style={{ fontSize: 12, color: '#C0503A', marginTop: 4 }}>Répartition à reprendre : {dispute.money_error}</div>}
      {admin && showManual && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 12.5, color: '#4E6470', marginTop: 10 }}>
            <span>Total payé par le client</span><b style={{ color: '#123644' }}>{EUR(tx.total_charged_cents || 0)}</b>
            <span>Encaissé (séquestre)</span><b style={{ color: '#123644' }}>{EUR(sum('charge'))}</b>
            <span>Versé au prestataire</span><b style={{ color: sum('transfer') + sum('payout') ? '#C0503A' : '#123644' }}>{EUR(sum('transfer') + sum('payout'))}</b>
            <span>Déjà remboursé</span><b style={{ color: '#123644' }}>{EUR(sum('refund'))}</b>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input value={refundEur} onChange={e => setRefundEur(e.target.value)} inputMode="decimal" aria-label="Montant en euros"
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

/** Compte à rebours de la date cible de réponse (48 h après l'ouverture). */
function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const ms = new Date(to).getTime() - now
  const h = Math.floor(Math.abs(ms) / 3600000)
  const m = Math.floor((Math.abs(ms) % 3600000) / 60000)
  const late = ms <= 0
  return (
    <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: late ? '#C0503A' : '#8a6520' }}>
      {late ? `Réponse attendue depuis ${h} h ${String(m).padStart(2, '0')}` : `Réponse attendue sous ${h} h ${String(m).padStart(2, '0')}`}
    </div>
  )
}

/** Décision PING (admin, 054) : montant rendu au client (0 à prix de la prestation), reste au prestataire, motif. */
function DecisionPanel({ ceiling, requested, refund, setRefund, reason, setReason, confirm, setConfirm, busy, onApply }: {
  ceiling: number; requested?: string | null; refund: string; setRefund: (v: string) => void
  reason: string; setReason: (v: string) => void; confirm: boolean; setConfirm: (v: boolean) => void
  busy: boolean; onApply: () => void
}) {
  const cents = refund.trim() === '' ? null : Math.round(Number(refund.replace(',', '.').replace(/\s/g, '')) * 100)
  const valid = cents != null && Number.isFinite(cents) && cents >= 0 && cents <= ceiling
  const payout = valid ? ceiling - (cents as number) : null
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 10, border: '1px solid #DCE5E3', fontFamily: 'inherit', fontSize: 14 }
  const quick = (c: number) => setRefund((c / 100).toString().replace('.', ','))
  return (
    <div style={{ padding: '0 16px 10px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', border: '1.5px solid #12B39C', borderRadius: 14, padding: 14 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Décision PING</div>
        <div style={{ fontSize: 12, color: '#4E6470', marginTop: 3, lineHeight: 1.5 }}>
          {requested ? `Intervention demandée le ${new Date(requested).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. ` : ''}
          Prix de la prestation : <b>{EUR(ceiling)}</b>. Frais de service et commission PING inchangés.
        </div>
        <label htmlFor="dec-refund" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#123644', margin: '12px 0 6px' }}>Montant rendu au client (€)</label>
        <input id="dec-refund" value={refund} onChange={e => setRefund(e.target.value)} inputMode="decimal" autoComplete="off" style={field} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {[0, 0.25, 0.5, 1].map(f => (
            <button key={f} type="button" onClick={() => quick(Math.round(ceiling * f))}
              style={{ minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {f === 0 ? 'Rien' : f === 1 ? 'Tout' : `${f * 100} %`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#123644', marginTop: 8 }}>
          Versé au prestataire : <b>{payout != null ? EUR(payout) : '—'}</b>{cents != null && !valid ? <span style={{ color: '#C0503A' }}> · entre 0 et {EUR(ceiling)}</span> : null}
        </div>
        <label htmlFor="dec-reason" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#123644', margin: '12px 0 6px' }}>Motif (lu par les deux parties)</label>
        <textarea id="dec-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={1000} style={{ ...field, minHeight: 72 }} />
        {confirm ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" disabled={busy} onClick={onApply}
              style={{ flex: 1, minHeight: 44, borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1, fontFamily: 'inherit' }}>
              {busy ? 'Application…' : `Confirmer : ${valid ? EUR(cents as number) : '—'} au client, ${payout != null ? EUR(payout) : '—'} au prestataire`}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirm(false)}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Retour</button>
          </div>
        ) : (
          <button type="button" disabled={!valid || !reason.trim()} onClick={() => setConfirm(true)}
            style={{ width: '100%', marginTop: 10, minHeight: 44, borderRadius: 999, border: 'none', background: valid && reason.trim() ? '#0B8374' : '#DCE5E3', color: '#fff', fontWeight: 700, cursor: valid && reason.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            Appliquer la décision
          </button>
        )}
        <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 8, lineHeight: 1.5 }}>
          Le litige est clos, un avoir est émis sur la facture si un montant est rendu, le virement est ajusté (ou, paiement en ligne : remboursement puis versement du reste) et les deux parties sont prévenues.
        </div>
      </div>
    </div>
  )
}
