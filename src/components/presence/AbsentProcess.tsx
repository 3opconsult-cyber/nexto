"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notifyOther } from '@/lib/notify'
import { EUR } from '@/lib/invoice-pdf'
import {
  billedLabel, durLabel, requestEndCode, validatePresence,
  type Amounts, type Phase, type RemoteRequest,
} from '@/lib/presence'
import { geoMessage, isGeoFail, readPositionOnce } from '@/lib/position'
import { compressPhoto, deleteProof, getProof, saveProof, type StoredProof } from '@/lib/proofStore'
import { KEPT_TEXT, PROOF_FAILED_EVENT, PROOF_SENT_EVENT, sendProof } from '@/lib/proofSend'
import { OFFLINE_TEXT, friendlyError } from '@/lib/netError'

const hhmm = (d?: string | null) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''

type StepState = 'ok' | 'now' | 'off'

function Step({ n, state, title, children }: { n: number; state: StepState; title: string; children?: React.ReactNode }) {
  const c = state === 'ok' ? '#12B39C' : state === 'now' ? '#123644' : '#C5D3CF'
  return (
    <li aria-current={state === 'now' ? 'step' : undefined} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: n > 1 ? '1px solid #EEF2F1' : 'none' }}>
      <span aria-hidden style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13,
        background: state === 'ok' ? '#12B39C' : '#fff', color: state === 'ok' ? '#fff' : c, border: `2px solid ${c}`,
      }}>
        {state === 'ok' ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg> : n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: state === 'off' ? '#6E8592' : '#123644', marginTop: 4 }}>
          {title}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{state === 'ok' ? ' (fait)' : state === 'now' ? ' (étape en cours)' : ''}</span>
        </div>
        {children}
      </div>
    </li>
  )
}

const primary: React.CSSProperties = {
  width: '100%', minHeight: 48, border: 'none', borderRadius: 999, padding: '0 16px', background: '#0C8F7E', color: '#fff',
  fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8,
}
const ghost: React.CSSProperties = { ...primary, background: '#fff', color: '#0C8F7E', border: '1.5px solid #0C8F7E' }
const p: React.CSSProperties = { fontSize: 12.5, color: '#4E6470', lineHeight: 1.5, margin: '3px 0 0' }
// Bouton d'action principal collant en bas de l'écran, au-dessus de la barre d'onglets (audit ergonomie 19/11,
// correction 13) : « Envoyer la photo », « Clôturer avec le code de fin »… visibles sans défiler.
// `above` : champ posé dans la zone collante, juste au-dessus du bouton (correction 8 du 19/11 bis : le champ du
// code de fin passait sous la barre du bas quand on rouvrait l'écran après réception du code).
function StickyCta({ children, onClick, disabled, above }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; above?: React.ReactNode }) {
  return (
    <>
      <div aria-hidden style={{ height: above ? 96 : 8 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'var(--tabbar-h, 0px)', zIndex: 30, maxWidth: 480, margin: '0 auto',
        background: '#fff', borderTop: '1px solid #DCE5E3', boxShadow: '0 -6px 16px rgba(18,54,68,.06)',
        padding: '8px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
      }}>
        {above}
        <button type="button" style={{ ...primary, marginTop: 0, opacity: disabled ? .6 : 1 }} disabled={disabled} onClick={onClick}>{children}</button>
      </div>
    </>
  )
}
const link: React.CSSProperties = { display: 'block', margin: '8px auto 0', minHeight: 44, border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }

/**
 * Prestataire, client absent (migration 048), démarche numérotée de la maquette du 18/11.
 * Arrivée : 1 Arrivez sur place · 2 Géolocalisez-vous (accord, seul cas de position) · 3 Prenez une photo
 * (obligatoire, appareil photo) · 4 Envoyez-la dans la messagerie (photo, distance à l'adresse, heure) ·
 * 5 Le client confirme d'un appui, ou envoie un code que vous saisissez.
 * Fin : durée et montant · demandez le code de fin · saisissez le code envoyé par le client.
 * Jamais de validation par le prestataire seul.
 */
export default function AbsentProcess({ txId, uid, phase, clientName, remote, preview, forfait = false, onDone }: {
  txId: string; uid: string; phase: Phase; clientName?: string; remote?: RemoteRequest; preview?: Amounts | null
  /** Forfait avec heures incluses : les heures facturées de l'aperçu sont celles au-delà du forfait. */
  forfait?: boolean; onDone: () => void
}) {
  const router = useRouter()
  const cl = clientName || 'Le client'
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracyM: number; approx: boolean } | null>(null)
  const [posFail, setPosFail] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  // Heure de prise de vue sur le téléphone : affichage seulement, jamais envoyée au serveur (qui garde son heure).
  const [takenAt, setTakenAt] = useState<number | null>(null)
  const [queued, setQueued] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'' | 'pos' | 'send' | 'code'>('')
  const [info, setInfo] = useState<{ err: boolean; text: string } | null>(null)
  const [code, setCode] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const pending = remote?.etat === 'en_attente'
  const refused = remote?.etat === 'refusee'
  const codeSent = pending && !!remote?.code_sent_at
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Preuve gardée sur le téléphone (photo, position, heure de prise) : reprise après un rechargement ou une coupure.
  useEffect(() => {
    if (phase !== 'arrivee') return
    if (pending) { deleteProof(txId); return }
    let off = false
    getProof(txId).then(e => {
      if (off || !e || e.uid !== uid) return
      setPos({ lat: e.lat, lng: e.lng, accuracyM: e.accuracyM, approx: e.approx })
      setPhoto(new File([e.photo], 'photo.jpg', { type: e.photo.type || 'image/jpeg' }))
      setPhotoUrl(URL.createObjectURL(e.photo)); setTakenAt(e.takenAt)
      if (e.queued) { setQueued(true); setInfo({ err: false, text: KEPT_TEXT }) }
      else setInfo({ err: false, text: `Votre preuve est gardée sur ce téléphone (photo prise à ${hhmm(new Date(e.takenAt).toISOString())}). Touchez « Envoyer » quand vous voulez.` })
    })
    return () => { off = true }
  }, [txId, uid, phase, pending])

  // Photo et position réunies : on les garde sur le téléphone (compressées) avant tout envoi.
  useEffect(() => {
    if (phase !== 'arrivee' || pending || !pos || !photo || takenAt == null) return
    let off = false
    ;(async () => {
      const ex = await getProof(txId)
      if (off || (ex && ex.takenAt === takenAt && ex.lat === pos.lat && ex.lng === pos.lng)) return
      const blob = await compressPhoto(photo)
      if (off) return
      await saveProof({ txId, uid, photo: blob, lat: pos.lat, lng: pos.lng, accuracyM: pos.accuracyM, approx: pos.approx, takenAt, savedAt: Date.now() })
    })()
    return () => { off = true }
  }, [phase, pending, pos, photo, takenAt, txId, uid])

  // Envoi réussi (ici ou renvoi automatique au retour du réseau) ou refusé par le serveur.
  useEffect(() => {
    const sent = (e: Event) => {
      if ((e as CustomEvent).detail?.txId !== txId) return
      setQueued(false); setInfo({ err: false, text: `Photo envoyée à ${cl.replace(/\.$/, '')}.` }); onDoneRef.current()
    }
    const failed = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.txId !== txId) return
      setQueued(false); setInfo({ err: true, text: d.message || 'Envoi refusé.' })
    }
    window.addEventListener(PROOF_SENT_EVENT, sent); window.addEventListener(PROOF_FAILED_EVENT, failed)
    return () => { window.removeEventListener(PROOF_SENT_EVENT, sent); window.removeEventListener(PROOF_FAILED_EVENT, failed) }
  }, [txId, cl])

  async function locate() {
    setBusy('pos'); setInfo(null); setPosFail(false)
    const r = await readPositionOnce()
    setBusy('')
    if (isGeoFail(r)) { setPosFail(true); setInfo({ err: true, text: geoMessage(r.reason) }); return }
    setPos({ lat: r.lat, lng: r.lng, accuracyM: r.accuracyM, approx: r.approx })
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/^image\//.test(f.type)) { setInfo({ err: true, text: 'Choisissez une photo.' }); return }
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhoto(f); setPhotoUrl(URL.createObjectURL(f)); setTakenAt(Date.now()); setInfo(null)
  }

  async function sendPhoto() {
    if (!pos || !photo || takenAt == null) return
    setBusy('send'); setInfo(null)
    // Ordre : contrôle de distance par le serveur, PUIS téléversement de la photo, PUIS envoi (src/lib/proofSend.ts).
    let entry = await getProof(txId)
    if (!entry || entry.takenAt !== takenAt || entry.lat !== pos.lat || entry.lng !== pos.lng) {
      entry = { txId, uid, photo: await compressPhoto(photo), lat: pos.lat, lng: pos.lng, accuracyM: pos.accuracyM, approx: pos.approx, takenAt, savedAt: Date.now() }
      await saveProof(entry)
    }
    const out = await sendProof(createClient(), entry)
    setBusy('')
    if (out.kind === 'sent') return // l'événement PROOF_SENT_EVENT affiche le message et rafraîchit l'écran
    if (out.kind === 'network') {
      entry.queued = true
      const kept = await saveProof(entry)
      setQueued(kept)
      setInfo({ err: !kept, text: kept ? KEPT_TEXT : `${OFFLINE_TEXT} Restez sur cette page : votre photo et votre position y sont conservées.` })
      return
    }
    setInfo({ err: true, text: friendlyError(out.message, 'Photo non envoyée.') })
    if (out.code === 'too_far') { setPos(null); await deleteProof(txId) }
  }

  async function askEndCode() {
    setBusy('send'); setInfo(null)
    const r = await requestEndCode(createClient(), txId)
    setBusy('')
    if (!r.ok) { setInfo({ err: true, text: r.message || 'Demande non envoyée, réessayez.' }); return }
    notifyOther(txId, 'presence_fin')
    onDone()
  }

  async function submitCode() {
    const c = code.replace(/\D/g, '')
    if (c.length !== 6) { setInfo({ err: true, text: 'Le code comporte 6 chiffres.' }); return }
    setBusy('code'); setInfo(null)
    const r = await validatePresence(createClient(), txId, phase, c)
    setBusy('')
    if (!r.ok) { setInfo({ err: true, text: r.message || 'Code refusé.' }); return }
    setCode('')
    onDone()
  }

  // Champ du code : dans la zone collante au-dessus du bouton de validation quand celui-ci est affiché d'office
  // (fin, ou code d'arrivée reçu), sinon dans l'étape. Jamais sous la barre du bas.
  const codeInput = (label: string, compact = false) => (
    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#4E6470', marginTop: compact ? 0 : 6, marginBottom: compact ? 6 : 0 }}>
      {label}
      <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: compact ? 3 : 5, minHeight: 48, borderRadius: 12, border: '1.5px solid #DCE5E3', padding: '0 12px', fontSize: 20, letterSpacing: 6, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
    </label>
  )
  const codeBox = (label: string, inSticky: boolean) => (
    <>
      {codeSent && <p role="status" style={{ ...p, background: '#FFF7ED', color: '#8a6520', borderRadius: 10, padding: '8px 10px', fontWeight: 600 }}>{cl} vous a envoyé son code dans la messagerie : {inSticky ? 'saisissez-le en bas de l’écran.' : 'saisissez-le.'}</p>}
      {!inSticky && codeInput(label)}
      <button type="button" style={link} onClick={() => router.push(`/mission/${txId}/chat`)}>Voir la conversation</button>
    </>
  )

  const msg = info && <p role={info.err ? 'alert' : 'status'} style={{ ...p, color: info.err ? '#B3402F' : '#0C8F7E', fontWeight: 600, whiteSpace: 'pre-line' }}>{info.text}</p>

  if (phase === 'arrivee') {
    const sentAt = pending ? remote?.requested_at : null
    const s2: StepState = pending || pos ? 'ok' : 'now'
    const s3: StepState = pending || photo ? 'ok' : pos ? 'now' : 'off'
    const s4: StepState = pending ? 'ok' : pos && photo ? 'now' : 'off'
    return (
      <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '12px 14px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Client absent : votre arrivée en 5 étapes</div>
        <p style={p}>Votre arrivée est validée par {cl}, jamais par vous seul.</p>
        <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          <Step n={1} state={pending || pos ? 'ok' : 'now'} title="Arrivez sur place">
            <p style={p}>{pending ? `Arrivée signalée à ${hhmm(sentAt)}.` : `À l’adresse de ${cl}, devant la porte.`}</p>
          </Step>
          <Step n={2} state={s2} title="Géolocalisez-vous">
            {pending
              ? <p style={p}>{remote?.distance_m != null ? `Position relevée une fois : à ${remote.distance_m} m de l’adresse.` : 'Position relevée une fois.'}</p>
              : pos
                ? <p style={p}>{pos.approx ? 'Position approximative' : 'Position relevée'} (précision ± {Math.round(pos.accuracyM)} m). Elle est comparée à l’adresse avant l’envoi de la photo.</p>
                : <>
                  <p style={p}>Seul cas où PING relève votre position : une fois, avec votre accord, comparée à l’adresse. Pas de suivi.</p>
                </>}
          </Step>
          <Step n={3} state={s3} title="Prenez une photo">
            {pending
              ? <p style={p}>Photo envoyée à {hhmm(sentAt)}.</p>
              : <>
                <p style={p}>Devant la porte, ou sur place. Obligatoire.</p>
                {photoUrl && <img src={photoUrl} alt="Votre photo d’arrivée" style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginTop: 8 }} />}
                {photoUrl && takenAt != null && <p style={p}>Prise à {hhmm(new Date(takenAt).toISOString())} (heure de votre téléphone). L’heure retenue par PING est celle de l’envoi.</p>}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
                {pos && photo && (
                  <button type="button" style={ghost} disabled={!!busy} onClick={() => fileRef.current?.click()}>Reprendre la photo</button>
                )}
              </>}
          </Step>
          <Step n={4} state={s4} title="Envoyez la photo dans la messagerie">
            {pending
              ? <p style={p}>Envoyée à {hhmm(sentAt)} (heure de PING) avec votre position. {cl} est prévenu.</p>
              : <>
                <p style={p}>Elle part à {cl} avec votre position et l’heure ; une notification le prévient.</p>
              </>}
          </Step>
          <Step n={5} state={pending ? 'now' : 'off'} title={pending ? `En attente de ${cl}` : `${cl} confirme votre arrivée`}>
            {pending
              ? <>
                {codeBox(`Code de validation envoyé par ${cl}`, codeSent)}
                {!codeSent && <p style={p}>{`${cl} confirme d’un appui : la mission démarre d’elle-même. Ou ${cl} vous envoie un code de validation.`}</p>}
              </>
              : <p style={p}>{cl} confirme d’un appui, ou vous envoie un code que vous saisissez.</p>}
            {refused && <p style={{ ...p, color: '#B3402F', fontWeight: 600 }}>{cl} a indiqué que ce n’était pas normal. Échangez dans la conversation.</p>}
          </Step>
        </ol>
        {msg}
        {!pending && !pos && <StickyCta disabled={!!busy} onClick={locate}>{busy === 'pos' ? 'Localisation…' : posFail ? 'Réessayer' : 'J’accepte : partager ma position'}</StickyCta>}
        {!pending && pos && !photo && <StickyCta disabled={!!busy} onClick={() => fileRef.current?.click()}>Prendre la photo</StickyCta>}
        {!pending && pos && photo && <StickyCta disabled={!!busy} onClick={sendPhoto}>{busy === 'send' ? 'Envoi…' : queued ? 'Réessayer maintenant' : `Envoyer la photo à ${cl}`}</StickyCta>}
        {pending && (codeSent || code.length > 0) && <StickyCta disabled={!!busy || code.length !== 6} onClick={submitCode}
          above={codeSent ? codeInput(`Code de validation envoyé par ${cl}`, true) : undefined}>{busy === 'code' ? 'Vérification…' : 'Valider avec le code'}</StickyCta>}
      </div>
    )
  }

  // Fin, client absent.
  const fp = pending ? remote?.preview : preview
  const amount = fp ? `${durLabel(fp.duration_minutes)} sur place${billedLabel(fp, forfait)}${fp.subtotal_cents != null ? `, ${EUR(fp.subtotal_cents)}` : ''}` : null
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Fin de mission, client absent</div>
      <p style={p}>La fin se valide avec le code de fin de {cl} : {cl} l’envoie, vous le saisissez. Jamais par vous seul.</p>
      <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        <Step n={1} state="ok" title="Durée sur place">
          <p style={p}>{amount || 'Calculée à l’envoi de la demande.'}{fp && !fp.recalcule && !forfait ? ' Forfait : prix inchangé.' : ''}</p>
        </Step>
        <Step n={2} state={pending ? 'ok' : 'now'} title={`Demandez son code de fin à ${cl}`}>
          {pending
            ? <p style={p}>Demande envoyée à {hhmm(remote?.requested_at)} : notification et message dans la conversation.</p>
            : <>
              <p style={p}>{cl} reçoit la durée et le montant. Aucune position n’est relevée.</p>
            </>}
        </Step>
        <Step n={3} state={pending ? 'now' : 'off'} title="Saisissez son code de fin">
          {pending
            ? <>
              {codeBox(`Code de fin envoyé par ${cl}`, true)}
              <p style={p}>{codeSent ? '' : `${cl} l’envoie depuis son application ; il apparaît aussi dans la messagerie.`} Le code saisi clôture la mission ; la facture suit.</p>
            </>
            : <p style={p}>Le code saisi clôture la mission ; la facture suit.</p>}
          {refused && <p style={{ ...p, color: '#B3402F', fontWeight: 600 }}>{cl} a contesté la fin annoncée. Échangez dans la conversation.</p>}
        </Step>
      </ol>
      <p style={{ ...p, fontSize: 11.5, color: '#6E8592', marginTop: 8 }}>Sans réponse sous 24 h, la fin reste non confirmée et PING décide.</p>
      {msg}
      {!pending
        ? <StickyCta disabled={!!busy} onClick={askEndCode}>{busy === 'send' ? 'Envoi…' : `Demander le code de fin à ${cl}`}</StickyCta>
        : <StickyCta disabled={!!busy || code.length !== 6} onClick={submitCode}
          above={codeInput(`Code de fin envoyé par ${cl}`, true)}>{busy === 'code' ? 'Vérification…' : 'Clôturer avec le code de fin'}</StickyCta>}
    </div>
  )
}
