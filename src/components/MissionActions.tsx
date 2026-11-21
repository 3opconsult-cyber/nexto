"use client"
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { C, btn, card, p, Row, patchOf } from '@/components/missionUi'
import {
  fetchCancellationState, cancellationAvailable, declareProviderNoShow, acceptReschedule, declineReschedule, closeOnProof,
  eur, whenLabel, TIER_LABEL, REASON_LABEL, type CancellationState,
} from '@/lib/cancellation'

// Fenêtres d'annulation et de report : chargées à la demande (A-034), montées seulement à l'ouverture.
// Le bouton, lui, reste dans la page ; le fichier des fenêtres est préchargé au repos, après l'affichage.
const CancelSheet = dynamic(() => import('@/components/MissionSheets').then(m => m.CancelSheet), { ssr: false })
const RescheduleSheet = dynamic(() => import('@/components/MissionSheets').then(m => m.RescheduleSheet), { ssr: false })
export function preloadMissionSheets() {
  if (typeof window === 'undefined') return
  const go = () => { import('@/components/MissionSheets').catch(() => {}) }
  const ric = (window as any).requestIdleCallback
  if (ric) ric(go, { timeout: 4000 }); else setTimeout(go, 2000)
}

/**
 * Annuler, reporter, déclarer l'absence du prestataire, clôturer sur preuve (décisions Romain 20/11/2026, migration 056).
 * Les règles sont tenues par la base : l'écran ne fait qu'expliquer le palier et appeler la bonne fonction.
 * Ergonomie : cibles de 44 px, deux appuis au plus (ouvrir, confirmer) hors confirmation de frais, aucun confirm() natif.
 * Avant la migration, l'état n'existe pas : seul « Annuler » reste, à l'ancienne (une confirmation simple).
 */

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

/**
 * Bandeaux et boutons d'une mission : report en attente, absence du prestataire, clôture sur preuve, « Reporter » et
 * « Annuler ». `compact` : seulement les deux boutons (agenda). Rien n'est rendu avant la migration, sauf « Annuler ».
 */
export default function MissionActions({ tx, userId, onChange, compact = false, hideCancel = false, style, cancelRequest = false, onCancelClose }: {
  tx: any; userId: string; onChange?: (patch: Record<string, unknown>) => void
  compact?: boolean; hideCancel?: boolean; style?: React.CSSProperties
  /** Ouverture de la fenêtre d'annulation depuis l'extérieur (menu « … » du chat) : une seule fenêtre, état déjà lu. */
  cancelRequest?: boolean; onCancelClose?: () => void
}) {
  const router = useRouter()
  const live = !!tx && !!userId && !['cancelled', 'completed', 'released'].includes(tx.status)
  const { st, reload } = useCancellationState(tx?.id, !!tx && !!userId && !compact)
  const [cancelOpen, setCancelOpen] = useState(false)
  useEffect(() => { preloadMissionSheets() }, [])
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
        {reschedOpen && <RescheduleSheet tx={tx} st={compactSt} open onClose={() => setReschedOpen(false)} onDone={() => { fetchCancellationState(createClient(), tx.id).then(s => { if (s) onChange?.(patchOf(s)) }) }} />}
        {cancelOpen && <CancelSheet tx={tx} userId={userId} open onClose={() => setCancelOpen(false)} onDone={patch => onChange?.(patch)} />}
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

      {reschedOpen && <RescheduleSheet tx={tx} st={st} open onClose={() => setReschedOpen(false)} onDone={refresh} />}
      {(cancelOpen || cancelRequest) && <CancelSheet tx={tx} userId={userId} open initial={st} onClose={() => { setCancelOpen(false); onCancelClose?.() }} onDone={patch => { onChange?.(patch); refresh() }} />}
    </div>
  )
}
