"use client"
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DayTimePicker, { firstFreeTime } from '@/components/DayTimePicker'
import { C, btn, p, Row, patchOf } from '@/components/missionUi'
import {
  fetchCancellationState, cancelMission, proposeReschedule,
  CLIENT_GRAVE_REASONS, CLIENT_FREE_REASONS, PRO_REASONS, eur, whenLabel,
  type CancellationState, type CancelResult,
} from '@/lib/cancellation'

/** Fenêtres d'annulation et de report, chargées à la demande par MissionActions (A-034). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  // Le focus entre dans la fenêtre à l'ouverture (clavier, lecteur d'écran) et revient au bouton qui l'a ouverte.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    boxRef.current?.focus({ preventScroll: true })
    return () => { try { prev?.focus?.({ preventScroll: true }) } catch { /* élément disparu */ } }
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,54,68,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={boxRef} tabIndex={-1} style={{ outline: 'none', width: '100%', maxWidth: 520, background: '#fff', borderRadius: '18px 18px 0 0', padding: '16px 16px calc(18px + env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

/** Fenêtre d'annulation : un texte et un bouton par palier, jamais de confirm() natif. */
export function CancelSheet({ tx, userId, open, onClose, onDone, initial }: {
  tx: any; userId: string; open: boolean; onClose: () => void; onDone?: (patch: Record<string, unknown>, r: CancelResult) => void
  /** Dernier état connu de la mission (déjà lu par l'écran) : affiché tout de suite, relu en arrière-plan (audit 21/11 : plus de « Chargement… »). */
  initial?: CancellationState | null
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
    setSt(initial ?? undefined); setStep('main'); setKind(null); setText(''); setErr(''); setBusy(false)
    fetchCancellationState(createClient(), tx.id).then(s => { if (alive) setSt(s) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
