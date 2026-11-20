"use client"
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DayTimePicker, { firstFreeTime } from '@/components/DayTimePicker'
import {
  fetchCancellationState, cancellationAvailable, cancelMission, declareProviderNoShow, proposeReschedule, acceptReschedule, declineReschedule, closeOnProof,
  CLIENT_GRAVE_REASONS, CLIENT_FREE_REASONS, PRO_REASONS, eur, whenLabel, TIER_LABEL, REASON_LABEL,
  type CancellationState, type CancelResult,
} from '@/lib/cancellation'

/**
 * Annuler, reporter, déclarer l'absence du prestataire, clôturer sur preuve (décisions Romain 20/11/2026, migration 056).
 * Les règles sont tenues par la base : l'écran ne fait qu'expliquer le palier et appeler la bonne fonction.
 * Ergonomie : cibles de 44 px, deux appuis au plus (ouvrir, confirmer) hors confirmation de frais, aucun confirm() natif.
 * Avant la migration, l'état n'existe pas : seul « Annuler » reste, à l'ancienne (une confirmation simple).
 */

const C = { navy: '#123644', teal: '#0C8F7E', danger: '#C0503A', slate: '#4E6470', line: '#DCE5E3', amber: '#B54708', amberBg: '#FFF7ED', amberLine: '#F2A93B' }
const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  minHeight: 44, padding: '0 16px', borderRadius: 999, border: border ? `1.5px solid ${border}` : 'none', background: bg, color: fg,
  fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '12px 14px' }
const p: React.CSSProperties = { fontSize: 13, color: C.navy, lineHeight: 1.5, margin: '0 0 10px' }

const patchOf = (st: CancellationState): Record<string, unknown> => ({
  status: st.status, scheduled_at: st.scheduled_at,
  ...(st.cancelled ? { cancel_tier: st.cancelled.tier, cancel_reason_kind: st.cancelled.reason_kind, cancel_reason_text: st.cancelled.reason_text, cancel_fee_cents: st.cancelled.fee_cents, cancelled_at: st.cancelled.at } : {}),
})

/** État de la mission (null avant la migration), relu toutes les minutes et au retour sur l'onglet. */
export function useCancellationState(txId?: string, enabled = true) {
  const [st, setSt] = useState<CancellationState | null>(null)
  const reload = useCallback(async () => {
    if (!txId) return null
    const s = await fetchCancellationState(createClient(), txId)
    setSt(s)
    return s
  }, [txId])
  useEffect(() => {
    if (!txId || !enabled) return
    let alive = true
    const run = () => { fetchCancellationState(createClient(), txId).then(s => { if (alive) setSt(s) }) }
    run()
    const iv = setInterval(run, 60000)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [txId, enabled])
  return { st, reload }
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,54,68,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '18px 18px 0 0', padding: '16px 16px calc(18px + env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

/** Fenêtre d'annulation : un texte et un bouton par palier, jamais de confirm() natif. */
export function CancelSheet({ tx, userId, open, onClose, onDone }: {
  tx: any; userId: string; open: boolean; onClose: () => void; onDone?: (patch: Record<string, unknown>, r: CancelResult) => void
}) {
  const [st, setSt] = useState<CancellationState | null | undefined>(undefined)
  const [step, setStep] = useState<'main' | 'fees2' | 'text'>('main')
  const [kind, setKind] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setSt(undefined); setStep('main'); setKind(null); setText(''); setErr(''); setBusy(false)
    fetchCancellationState(createClient(), tx.id).then(s => { if (alive) setSt(s) })
    return () => { alive = false }
  }, [open, tx.id])

  if (!open) return null
  const isBuyer = userId === tx.buyer_id
  const confirmed = !!tx.price_confirmed
  const legacy = st === null
  const tier = st?.tier

  async function go(opts: { kind?: string | null; text?: string; confirmFees?: boolean }) {
    setBusy(true); setErr('')
    const r = await cancelMission(createClient(), tx, userId, opts)
    setBusy(false)
    if (r.ok) {
      const fresh = await fetchCancellationState(createClient(), tx.id)
      onDone?.(fresh ? patchOf(fresh) : { status: 'cancelled' }, r)
      onClose()
      return
    }
    setErr(r.message || 'Annulation impossible.')
    if (r.reason === 'confirmation_frais') setStep('fees2')
    else if (r.reason) { const s = await fetchCancellationState(createClient(), tx.id); if (s) setSt(s) }
  }

  const stop = () => { onClose() }
  let body: React.ReactNode

  if (st === undefined) body = <p style={p}>Chargement…</p>
  else if (legacy) {
    body = (
      <>
        <p style={p}>Annuler {confirmed ? 'cette réservation' : 'cette demande'} ? Cette action est définitive.</p>
        <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={stop}>Garder</button>
          <button type="button" disabled={busy} style={btn(C.danger, '#fff')} onClick={() => go({})}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button></Row>
      </>
    )
  } else if (!st!.can_cancel) {
    body = (
      <>
        <p style={p}>{st!.tier === 'commencee' ? 'Mission commencée : une annulation n’est plus possible. Si le service pose problème, ouvrez un litige depuis la conversation.' : 'Cette mission ne peut plus être annulée.'}</p>
        <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={stop}>Fermer</button></Row>
      </>
    )
  } else if (isBuyer && tier === 'frais_totaux') {
    const fee = eur(st!.fee_cents)
    body = step === 'fees2' ? (
      <>
        <div style={{ ...p, background: C.amberBg, border: `1.5px solid ${C.amberLine}`, borderRadius: 12, padding: '10px 12px', fontWeight: 600 }}>
          Dernière confirmation : vous serez facturé la totalité, {fee} (100 % de la prestation et frais de service). L&apos;annulation est définitive.
          Les documents de facturation sont émis et le virement est à régler. Vous pourrez ouvrir un litige dans les 24 h.
        </div>
        {err && <p style={{ ...p, color: C.danger, fontWeight: 600 }}>{err}</p>}
        <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={stop}>Garder la réservation</button>
          <button type="button" disabled={busy} style={btn(C.danger, '#fff')} onClick={() => go({ confirmFees: true })}>{busy ? 'Annulation…' : `Confirmer et être facturé ${fee}`}</button></Row>
      </>
    ) : (
      <>
        <div style={{ ...p, background: C.amberBg, border: `1.5px solid ${C.amberLine}`, borderRadius: 12, padding: '10px 12px', fontWeight: 600 }}>
          {st!.arrival_pending
            ? 'Le prestataire est arrivé à votre adresse.'
            : (st!.minutes_to_rdv != null && st!.minutes_to_rdv <= 0 ? 'L’heure du rendez-vous est atteinte.' : `Il reste moins de ${st!.free_minutes} minutes avant le rendez-vous et le prestataire est en route.`)}
          {' '}Si vous annulez maintenant, vous serez facturé la totalité : {fee}. C&apos;est traité comme un abus : PING en est informé (contrôle antifraude).
        </div>
        <Row><button type="button" style={btn(C.teal, '#fff')} onClick={stop}>Garder la réservation</button>
          <button type="button" style={btn('#fff', C.danger, C.danger)} onClick={() => setStep('fees2')}>Annuler quand même</button></Row>
      </>
    )
  } else if (isBuyer && tier === 'motif_grave') {
    const needsText = step === 'text'
    body = (
      <>
        <p style={p}>Le prestataire est déjà en route. Vous ne pouvez annuler que pour un <b>motif réel et sérieux</b>, sans frais. Il est transmis au prestataire et visible de PING. Touchez un motif pour annuler.</p>
        {needsText ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.slate }} htmlFor="cx-text">Décrivez ce motif grave</label>
            <textarea id="cx-text" value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={3} autoFocus
              style={{ width: '100%', boxSizing: 'border-box', margin: '6px 0 10px', padding: 10, borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
            {err && <p style={{ ...p, color: C.danger, fontWeight: 600 }}>{err}</p>}
            <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={() => setStep('main')}>Retour</button>
              <button type="button" disabled={busy || text.trim().length < 5} style={{ ...btn(C.danger, '#fff'), opacity: text.trim().length < 5 ? .5 : 1 }}
                onClick={() => go({ kind: 'autre_grave', text })}>{busy ? 'Annulation…' : 'Annuler la réservation'}</button></Row>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {CLIENT_GRAVE_REASONS.map(r => (
                <button key={r.kind} type="button" disabled={busy} style={{ ...btn('#fff', C.navy, C.line), textAlign: 'left' }}
                  onClick={() => r.needsText ? setStep('text') : go({ kind: r.kind })}>{r.label}</button>
              ))}
            </div>
            {err && <p style={{ ...p, color: C.danger, fontWeight: 600, marginTop: 10 }}>{err}</p>}
            <Row><button type="button" style={btn(C.teal, '#fff')} onClick={stop}>Garder la réservation</button></Row>
          </>
        )}
      </>
    )
  } else if (isBuyer) {
    // Gratuite : motif facultatif, deux appuis (ouvrir, confirmer).
    body = (
      <>
        <p style={p}>Annuler {confirmed ? 'cette réservation' : 'cette demande'} ? C&apos;est <b>gratuit</b> tant que le prestataire n&apos;est pas parti. Le paiement en ligne éventuel est remboursé à 100 %.</p>
        {confirmed && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }} role="group" aria-label="Motif facultatif">
            {CLIENT_FREE_REASONS.map(r => (
              <button key={r.kind} type="button" aria-pressed={kind === r.kind} onClick={() => setKind(k => k === r.kind ? null : r.kind)}
                style={{ ...btn(kind === r.kind ? '#E3F5F1' : '#fff', C.navy, kind === r.kind ? C.teal : C.line), fontWeight: 600, fontSize: 13 }}>{r.label}</button>
            ))}
          </div>
        )}
        {err && <p style={{ ...p, color: C.danger, fontWeight: 600 }}>{err}</p>}
        <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={stop}>Garder</button>
          <button type="button" disabled={busy} style={btn(C.danger, '#fff')} onClick={() => go({ kind })}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button></Row>
      </>
    )
  } else if (!confirmed) {
    body = (
      <>
        <p style={p}>Annuler cette demande ? Aucun frais, le client est prévenu.</p>
        {err && <p style={{ ...p, color: C.danger, fontWeight: 600 }}>{err}</p>}
        <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={stop}>Garder</button>
          <button type="button" disabled={busy} style={btn(C.danger, '#fff')} onClick={() => go({})}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button></Row>
      </>
    )
  } else {
    // Prestataire : motif obligatoire, jamais de frais pour le client.
    const needsText = step === 'text'
    body = (
      <>
        <p style={p}>Vous pouvez annuler à tout moment avant votre arrivée, avec un <b>motif obligatoire</b>. Le client n&apos;est jamais facturé et un paiement en ligne lui est remboursé à 100 %. Vos annulations sont suivies par PING. Touchez un motif pour annuler.</p>
        {needsText ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.slate }} htmlFor="cx-text-pro">Décrivez le motif</label>
            <textarea id="cx-text-pro" value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={3} autoFocus
              style={{ width: '100%', boxSizing: 'border-box', margin: '6px 0 10px', padding: 10, borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
            {err && <p style={{ ...p, color: C.danger, fontWeight: 600 }}>{err}</p>}
            <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={() => setStep('main')}>Retour</button>
              <button type="button" disabled={busy || text.trim().length < 5} style={{ ...btn(C.danger, '#fff'), opacity: text.trim().length < 5 ? .5 : 1 }}
                onClick={() => go({ kind: 'autre', text })}>{busy ? 'Annulation…' : 'Annuler la réservation'}</button></Row>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {PRO_REASONS.map(r => (
                <button key={r.kind} type="button" disabled={busy} style={{ ...btn('#fff', C.navy, C.line), textAlign: 'left' }}
                  onClick={() => r.needsText ? setStep('text') : go({ kind: r.kind })}>{r.label}</button>
              ))}
            </div>
            {err && <p style={{ ...p, color: C.danger, fontWeight: 600, marginTop: 10 }}>{err}</p>}
            <Row><button type="button" style={btn(C.teal, '#fff')} onClick={stop}>Garder la réservation</button></Row>
          </>
        )}
      </>
    )
  }
  return <Sheet title={isBuyer && tier === 'frais_totaux' ? 'Annulation tardive' : (confirmed ? 'Annuler la réservation' : 'Annuler la demande')} onClose={onClose}>{body}</Sheet>
}

const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>{children}</div>

/** Fenêtre de report : un créneau, l'autre partie accepte ou refuse. */
export function RescheduleSheet({ tx, st, open, onClose, onDone }: {
  tx: any; st: CancellationState | null; open: boolean; onClose: () => void; onDone: () => void
}) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setValue(firstFreeTime()); setNote(''); setErr(''); setBusy(false) } }, [open])
  if (!open) return null
  const free = !!st?.reschedule.free
  async function send() {
    const d = new Date(value)
    if (!value || isNaN(d.getTime())) { setErr('Choisissez le jour et l’heure.'); return }
    setBusy(true); setErr('')
    const r = await proposeReschedule(createClient(), tx.id, d, note)
    setBusy(false)
    if (!r.ok) { setErr(r.message || 'Report impossible.'); return }
    onDone(); onClose()
  }
  return (
    <Sheet title="Reporter le rendez-vous" onClose={onClose}>
      <p style={p}>
        {free
          ? 'Plus de 24 h avant le rendez-vous : le report est gratuit. L’autre partie accepte ou refuse dans la conversation.'
          : 'Moins de 24 h avant le rendez-vous : l’accord de l’autre partie est nécessaire. Sans accord, le rendez-vous reste fixé et seule l’annulation, avec ses règles, est possible.'}
        {' '}Le prix ne change pas.
      </p>
      {st?.scheduled_at && <p style={{ ...p, color: C.slate, fontSize: 12.5 }}>Rendez-vous actuel : {whenLabel(st.scheduled_at)}</p>}
      <DayTimePicker value={value} onChange={setValue} />
      <label htmlFor="cx-note" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.slate, margin: '12px 0 4px' }}>Un mot pour l&apos;autre partie (facultatif)</label>
      <input id="cx-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
      {err && <p style={{ ...p, color: C.danger, fontWeight: 600, marginTop: 10 }}>{err}</p>}
      <Row><button type="button" style={btn('#fff', C.navy, C.line)} onClick={onClose}>Fermer</button>
        <button type="button" disabled={busy} style={btn(C.teal, '#fff')} onClick={send}>{busy ? 'Envoi…' : 'Proposer ce créneau'}</button></Row>
    </Sheet>
  )
}

/**
 * Bandeaux et boutons d'une mission : report en attente, absence du prestataire, clôture sur preuve, « Reporter » et
 * « Annuler ». `compact` : seulement les deux boutons (agenda). Rien n'est rendu avant la migration, sauf « Annuler ».
 */
export default function MissionActions({ tx, userId, onChange, compact = false, hideCancel = false, style }: {
  tx: any; userId: string; onChange?: (patch: Record<string, unknown>) => void
  compact?: boolean; hideCancel?: boolean; style?: React.CSSProperties
}) {
  const router = useRouter()
  const live = !!tx && !!userId && !['cancelled', 'completed', 'released'].includes(tx.status)
  const { st, reload } = useCancellationState(tx?.id, !!tx && !!userId && !compact)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reschedOpen, setReschedOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<'' | 'absence' | 'proof'>('')
  const [compactSt, setCompactSt] = useState<CancellationState | null>(null)
  const [avail, setAvail] = useState(false)
  useEffect(() => { if (compact) cancellationAvailable(createClient()).then(setAvail) }, [compact])

  const refresh = useCallback(async () => {
    const s = await reload()
    if (s) onChange?.(patchOf(s))
  }, [reload, onChange])

  if (!tx || !userId) return null
  const isBuyer = userId === tx.buyer_id
  const isSeller = userId === tx.seller_id
  if (!isBuyer && !isSeller) return null
  const confirmed = !!tx.price_confirmed
  const accepted = !tx.booking_status || tx.booking_status === 'acceptee'

  async function noShow() {
    setBusy('absence'); setMsg('')
    const r = await declareProviderNoShow(createClient(), tx)
    setBusy(''); setAsk('')
    if (!r.ok) { setMsg(r.message || 'Action impossible.'); return }
    await refresh()
  }
  async function proof() {
    setBusy('proof'); setMsg('')
    const r = await closeOnProof(createClient(), tx.id, st?.silence.phase)
    setBusy(''); setAsk('')
    if (!r.ok) { setMsg(r.message || 'Action impossible.'); return }
    await refresh()
    router.refresh()
  }
  async function answer(accept: boolean, id: string) {
    setBusy('resch'); setMsg('')
    const r = accept ? await acceptReschedule(createClient(), tx.id, id) : await declineReschedule(createClient(), tx.id, id)
    setBusy('')
    if (!r.ok) setMsg(r.message || 'Action impossible.')
    await refresh()
  }

  // Agenda : deux boutons, l'état est lu à l'ouverture de la fenêtre (une seule fenêtre, pas de lecture par carte).
  if (compact) {
    if (!live || !confirmed || !accepted || tx.status !== 'pending') return null
    return (
      <div style={{ display: 'flex', gap: 8, ...style }} onClick={e => e.stopPropagation()}>
        {isBuyer || isSeller ? (
          <>
            {avail && <button type="button" style={{ ...btn('#fff', C.navy, C.line), flex: 1 }} onClick={async e => { e.stopPropagation(); setCompactSt(await fetchCancellationState(createClient(), tx.id)); setReschedOpen(true) }}>Reporter</button>}
            <button type="button" style={{ ...btn('#fff', C.danger, C.line), flex: 1 }} onClick={e => { e.stopPropagation(); setCancelOpen(true) }}>Annuler</button>
          </>
        ) : null}
        <RescheduleSheet tx={tx} st={compactSt} open={reschedOpen} onClose={() => setReschedOpen(false)} onDone={() => { fetchCancellationState(createClient(), tx.id).then(s => { if (s) onChange?.(patchOf(s)) }) }} />
        <CancelSheet tx={tx} userId={userId} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={patch => onChange?.(patch)} />
      </div>
    )
  }

  // Mission annulée : rappel du palier et des suites possibles.
  if (tx.status === 'cancelled') {
    const c = st?.cancelled
    if (!c?.tier) return null
    const reason = c.reason_kind ? REASON_LABEL[c.reason_kind] || c.reason_kind : ''
    return (
      <div style={{ ...card, margin: '10px 16px 0', ...style }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: c.tier === 'frais_totaux' ? C.amber : C.navy }}>{TIER_LABEL[c.tier] || 'Annulée'}</div>
        <p style={{ ...p, margin: '4px 0 0', fontSize: 12.5, color: C.slate }}>
          {c.tier === 'frais_totaux' && `Frais d’annulation : ${eur(c.fee_cents)} (100 % de la prestation et frais de service). Les documents de facturation sont émis ; un litige peut être ouvert dans les 24 h.`}
          {c.tier === 'motif_grave' && `Annulée pour motif grave${reason ? ` (${reason})` : ''}${c.reason_text ? ` : « ${c.reason_text} »` : ''}. Aucun frais.`}
          {c.tier === 'prestataire' && `Annulée par le prestataire${reason ? ` (${reason})` : ''}${c.reason_text ? ` : « ${c.reason_text} »` : ''}. Aucun frais pour le client.`}
          {c.tier === 'absence_prestataire' && 'Le prestataire n’est pas arrivé : annulée sans frais, remboursement à 100 % si le paiement a été fait en ligne. Le prestataire peut contester dans les 24 h.'}
          {c.tier === 'gratuite' && 'Annulée sans frais.'}
        </p>
        {c.tier === 'absence_prestataire' && isBuyer && (
          <button type="button" style={{ ...btn(C.teal, '#fff'), marginTop: 10 }} onClick={() => router.push(`/mission/${tx.id}/chat?avis`)}>Laisser un avis</button>
        )}
        {c.tier === 'frais_totaux' && (
          <button type="button" style={{ ...btn('#fff', C.navy, C.line), marginTop: 10 }} onClick={() => router.push(`/mission/${tx.id}/facture`)}>Voir les documents</button>
        )}
      </div>
    )
  }
  if (!live) return null

  const pend = st?.reschedule.pending
  const canResched = !!st?.reschedule.can_propose
  const showCancel = !hideCancel && (st ? st.can_cancel : false) && confirmed
  const noShowOk = !!st?.no_show.eligible && isBuyer
  const silence = st?.silence
  return (
    <div style={{ margin: '10px 16px 0', display: 'grid', gap: 10, ...style }}>
      {/* Absence du prestataire */}
      {noShowOk && (
        <div role="alert" style={{ ...card, background: C.amberBg, border: `1.5px solid ${C.amberLine}` }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: C.navy }}>Le prestataire n&apos;est pas arrivé</div>
          <p style={{ ...p, margin: '4px 0 10px', fontSize: 12.5, color: C.slate }}>Plus de {st!.no_show.minutes} minutes après l&apos;heure du rendez-vous. Vous n&apos;avez aucun frais : annulation, remboursement à 100 % si vous avez payé en ligne, PING est prévenu.</p>
          {ask === 'absence' ? (
            <Row>
              <button type="button" style={btn('#fff', C.navy, C.line)} onClick={() => setAsk('')}>Retour</button>
              <button type="button" disabled={busy === 'absence'} style={btn(C.danger, '#fff')} onClick={noShow}>{busy === 'absence' ? 'Envoi…' : 'Confirmer l’absence'}</button>
            </Row>
          ) : (
            <button type="button" style={btn(C.danger, '#fff')} onClick={() => setAsk('absence')}>Déclarer l&apos;absence du prestataire</button>
          )}
        </div>
      )}

      {/* Client sans réponse : clôture sur preuve */}
      {isSeller && silence?.waiting && (
        <div style={{ ...card, border: `1.5px solid ${silence.eligible ? C.amberLine : '#E7EDEB'}`, background: silence.eligible ? C.amberBg : '#fff' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: C.navy }}>
            {silence.eligible ? 'Le client ne répond pas' : 'En attente de la réponse du client'}
          </div>
          <p style={{ ...p, margin: '4px 0 10px', fontSize: 12.5, color: C.slate }}>
            {silence.eligible
              ? `Sans réponse depuis plus de ${String(silence.hours).replace('.', ',')} h. Vous pouvez ${silence.phase === 'fin' ? 'clôturer la mission' : 'valider votre arrivée'} sur preuve : photo horodatée et position déjà enregistrées. La mission est facturée normalement ; le client est prévenu et peut ouvrir un litige dans les 24 h.`
              : `Le client a ${String(silence.hours).replace('.', ',')} h pour répondre${silence.at ? ` (jusqu’à ${new Date(silence.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''}. Ensuite vous pourrez clôturer sur preuve.`}
          </p>
          {silence.eligible && (ask === 'proof' ? (
            <Row>
              <button type="button" style={btn('#fff', C.navy, C.line)} onClick={() => setAsk('')}>Retour</button>
              <button type="button" disabled={busy === 'proof'} style={btn(C.teal, '#fff')} onClick={proof}>{busy === 'proof' ? 'Enregistrement…' : 'Confirmer'}</button>
            </Row>
          ) : (
            <button type="button" style={btn(C.teal, '#fff')} onClick={() => setAsk('proof')}>{silence.phase === 'fin' ? 'Clôturer sur preuve' : 'Valider l’arrivée sur preuve'}</button>
          ))}
        </div>
      )}

      {/* Report en attente */}
      {pend && (
        <div style={{ ...card, border: `1.5px solid ${C.teal}` }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: C.navy }}>
            {pend.mine ? 'Report proposé, en attente de réponse' : (isBuyer ? 'Le prestataire propose un autre créneau' : 'Le client propose un autre créneau')}
          </div>
          <p style={{ ...p, margin: '4px 0 10px', fontSize: 12.5, color: C.slate }}>
            Nouveau créneau : <b style={{ color: C.navy }}>{whenLabel(pend.new_at)}</b> (au lieu de {whenLabel(pend.old_at)}). Le prix ne change pas.
            {pend.late && ' Moins de 24 h avant le rendez-vous : sans accord, le rendez-vous reste et seule l’annulation, avec ses règles, est possible.'}
            {pend.note ? ` « ${pend.note} »` : ''}
          </p>
          {pend.mine ? (
            <button type="button" disabled={busy === 'resch'} style={btn('#fff', C.navy, C.line)} onClick={() => answer(false, pend.id)}>Retirer ma proposition</button>
          ) : (
            <Row>
              <button type="button" disabled={busy === 'resch'} style={btn('#fff', C.navy, C.line)} onClick={() => answer(false, pend.id)}>Refuser</button>
              <button type="button" disabled={busy === 'resch'} style={btn(C.teal, '#fff')} onClick={() => answer(true, pend.id)}>Accepter</button>
            </Row>
          )}
        </div>
      )}

      {msg && <p role="alert" style={{ ...p, color: C.danger, fontWeight: 600, margin: 0 }}>{msg}</p>}

      {(canResched || showCancel) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canResched && <button type="button" style={{ ...btn('#fff', C.navy, C.line), flex: 1 }} onClick={() => setReschedOpen(true)}>Reporter</button>}
          {showCancel && <button type="button" style={{ ...btn('#fff', C.danger, C.line), flex: 1 }} onClick={() => setCancelOpen(true)}>Annuler</button>}
        </div>
      )}

      <RescheduleSheet tx={tx} st={st} open={reschedOpen} onClose={() => setReschedOpen(false)} onDone={refresh} />
      <CancelSheet tx={tx} userId={userId} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={patch => { onChange?.(patch); refresh() }} />
    </div>
  )
}
