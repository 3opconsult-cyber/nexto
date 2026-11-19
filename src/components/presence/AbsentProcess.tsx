"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notifyOther } from '@/lib/notify'
import { EUR } from '@/lib/invoice-pdf'
import {
  durLabel, getPositionOnce, requestEndCode, requestRemotePresence, uploadPresencePhoto, validatePresence,
  type Amounts, type Phase, type RemoteRequest,
} from '@/lib/presence'

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
const link: React.CSSProperties = { display: 'block', margin: '8px auto 0', minHeight: 44, border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }

/**
 * Prestataire, client absent (migration 048), démarche numérotée de la maquette du 18/11.
 * Arrivée : 1 Arrivez sur place · 2 Géolocalisez-vous (accord, seul cas de position) · 3 Prenez une photo
 * (obligatoire, appareil photo) · 4 Envoyez-la dans la messagerie (photo, distance à l'adresse, heure) ·
 * 5 Le client confirme d'un appui, ou envoie un code que vous saisissez.
 * Fin : durée et montant · demandez le code de fin · saisissez le code envoyé par le client.
 * Jamais de validation par le prestataire seul.
 */
export default function AbsentProcess({ txId, uid, phase, clientName, remote, preview, onDone }: {
  txId: string; uid: string; phase: Phase; clientName?: string; remote?: RemoteRequest; preview?: Amounts | null; onDone: () => void
}) {
  const router = useRouter()
  const cl = clientName || 'Le client'
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'' | 'pos' | 'send' | 'code'>('')
  const [info, setInfo] = useState<{ err: boolean; text: string } | null>(null)
  const [code, setCode] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const pending = remote?.etat === 'en_attente'
  const refused = remote?.etat === 'refusee'
  const codeSent = pending && !!remote?.code_sent_at

  async function locate() {
    setBusy('pos'); setInfo(null)
    const r = await getPositionOnce()
    setBusy('')
    if (!r) { setInfo({ err: true, text: 'Position indisponible : autorisez la localisation pour PING, puis réessayez.' }); return }
    setPos(r)
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/^image\//.test(f.type)) { setInfo({ err: true, text: 'Choisissez une photo.' }); return }
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhoto(f); setPhotoUrl(URL.createObjectURL(f)); setInfo(null)
  }

  async function sendPhoto() {
    if (!pos || !photo) return
    setBusy('send'); setInfo(null)
    const supabase = createClient()
    const up = await uploadPresencePhoto(supabase, uid, txId, photo)
    if (!up.path) { setBusy(''); setInfo({ err: true, text: up.error || 'Photo non envoyée.' }); return }
    const r = await requestRemotePresence(txId, 'arrivee', pos, up.path)
    setBusy('')
    if (r.ok !== true) {
      const f = r as Extract<typeof r, { ok: false }>
      setInfo({ err: true, text: f.message })
      if (f.error === 'too_far') setPos(null)
      return
    }
    notifyOther(txId, 'presence_arrivee')
    setInfo({ err: false, text: `Photo envoyée à ${cl}.` })
    onDone()
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

  const codeBox = (label: string, cta: string) => (
    <>
      {codeSent && <p role="status" style={{ ...p, background: '#FFF7ED', color: '#8a6520', borderRadius: 10, padding: '8px 10px', fontWeight: 600 }}>{cl} vous a envoyé son code dans la messagerie : saisissez-le.</p>}
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#4E6470', marginTop: 10 }}>
        {label}
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, minHeight: 48, borderRadius: 12, border: '1.5px solid #DCE5E3', padding: '0 12px', fontSize: 20, letterSpacing: 6, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
      </label>
      <button type="button" style={{ ...primary, opacity: code.length === 6 && !busy ? 1 : .6 }} disabled={!!busy || code.length !== 6} onClick={submitCode}>
        {busy === 'code' ? 'Vérification…' : cta}
      </button>
      <button type="button" style={link} onClick={() => router.push(`/mission/${txId}/chat`)}>Voir la conversation</button>
    </>
  )

  const msg = info && <p role={info.err ? 'alert' : 'status'} style={{ ...p, color: info.err ? '#B3402F' : '#0C8F7E', fontWeight: 600 }}>{info.text}</p>

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
            <p style={p}>{pending ? `Sur place à ${hhmm(sentAt)}.` : `À l’adresse de ${cl}, devant la porte.`}</p>
          </Step>
          <Step n={2} state={s2} title="Géolocalisez-vous">
            {pending
              ? <p style={p}>{remote?.distance_m != null ? `Position relevée une fois : à ${remote.distance_m} m de l’adresse.` : 'Position relevée une fois.'}</p>
              : pos
                ? <p style={p}>Position relevée (précision ± {Math.round(pos.accuracyM)} m). Elle est comparée à l’adresse à l’envoi.</p>
                : <>
                  <p style={p}>Seul cas où PING relève votre position : une fois, avec votre accord, comparée à l’adresse. Pas de suivi.</p>
                  <button type="button" style={primary} disabled={!!busy} onClick={locate}>{busy === 'pos' ? 'Localisation…' : 'J’accepte : partager ma position'}</button>
                </>}
          </Step>
          <Step n={3} state={s3} title="Prenez une photo">
            {pending
              ? <p style={p}>Photo prise à {hhmm(sentAt)}.</p>
              : <>
                <p style={p}>Devant la porte, ou sur place. Obligatoire.</p>
                {photoUrl && <img src={photoUrl} alt="Votre photo d’arrivée" style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginTop: 8 }} />}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
                {pos && (
                  <button type="button" style={photo ? ghost : primary} disabled={!!busy} onClick={() => fileRef.current?.click()}>
                    {photo ? 'Reprendre la photo' : 'Prendre la photo'}
                  </button>
                )}
              </>}
          </Step>
          <Step n={4} state={s4} title="Envoyez la photo dans la messagerie">
            {pending
              ? <p style={p}>Envoyée à {hhmm(sentAt)} avec votre position et l’heure. {cl} est prévenu.</p>
              : <>
                <p style={p}>Elle part à {cl} avec votre position et l’heure ; une notification le prévient.</p>
                {pos && photo && <button type="button" style={primary} disabled={!!busy} onClick={sendPhoto}>{busy === 'send' ? 'Envoi…' : `Envoyer la photo à ${cl}`}</button>}
              </>}
          </Step>
          <Step n={5} state={pending ? 'now' : 'off'} title={pending ? `En attente de ${cl}` : `${cl} confirme votre arrivée`}>
            {pending
              ? <>
                <p style={p}>{codeSent ? '' : `${cl} confirme d’un appui : la mission démarre d’elle-même. Ou ${cl} vous envoie un code de validation.`}</p>
                {codeBox(`Code de validation envoyé par ${cl}`, 'Valider avec le code')}
              </>
              : <p style={p}>{cl} confirme d’un appui, ou vous envoie un code que vous saisissez.</p>}
            {refused && <p style={{ ...p, color: '#B3402F', fontWeight: 600 }}>{cl} a indiqué que ce n’était pas normal. Échangez dans la conversation.</p>}
          </Step>
        </ol>
        {msg}
      </div>
    )
  }

  // Fin, client absent.
  const fp = pending ? remote?.preview : preview
  const amount = fp ? `${durLabel(fp.duration_minutes)} sur place${fp.recalcule && fp.billed_hours != null ? ` → ${String(fp.billed_hours).replace('.', ',')} h facturée${Number(fp.billed_hours) > 1 ? 's' : ''}` : ''}${fp.subtotal_cents != null ? `, ${EUR(fp.subtotal_cents)}` : ''}` : null
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Fin de mission, client absent</div>
      <p style={p}>La fin se valide avec le code de fin de {cl} : {cl} l’envoie, vous le saisissez. Jamais par vous seul.</p>
      <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        <Step n={1} state="ok" title="Durée sur place">
          <p style={p}>{amount || 'Calculée à l’envoi de la demande.'}{fp && !fp.recalcule ? ' Forfait : prix inchangé.' : ''}</p>
        </Step>
        <Step n={2} state={pending ? 'ok' : 'now'} title={`Demandez son code de fin à ${cl}`}>
          {pending
            ? <p style={p}>Demande envoyée à {hhmm(remote?.requested_at)} : notification et message dans la conversation.</p>
            : <>
              <p style={p}>{cl} reçoit la durée et le montant. Aucune position n’est relevée.</p>
              <button type="button" style={primary} disabled={!!busy} onClick={askEndCode}>{busy === 'send' ? 'Envoi…' : `Demander le code de fin à ${cl}`}</button>
            </>}
        </Step>
        <Step n={3} state={pending ? 'now' : 'off'} title="Saisissez son code de fin">
          {pending
            ? <>
              <p style={p}>{codeSent ? '' : `${cl} l’envoie depuis son application ; il apparaît aussi dans la messagerie.`} Le code saisi clôture la mission ; la facture suit.</p>
              {codeBox(`Code de fin envoyé par ${cl}`, 'Clôturer avec le code de fin')}
            </>
            : <p style={p}>Le code saisi clôture la mission ; la facture suit.</p>}
          {refused && <p style={{ ...p, color: '#B3402F', fontWeight: 600 }}>{cl} a contesté la fin annoncée. Échangez dans la conversation.</p>}
        </Step>
      </ol>
      <p style={{ ...p, fontSize: 11.5, color: '#6E8592', marginTop: 8 }}>Sans réponse sous 24 h, la fin reste non confirmée et PING décide.</p>
      {msg}
    </div>
  )
}
