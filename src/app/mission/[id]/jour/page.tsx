"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addressUsable } from '@/lib/address'
import { paymentsActive } from '@/lib/paymentsClient'
import { systemSender } from '@/lib/systemMessage'
import { readLastEta, saveLastEta, DEFAULT_ETA } from '@/lib/lastEta'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import {
  PRESENCE_WARNING, billedLabel, durLabel, getPresenceState, hasProcess, parseScanned, presenceAvailable, proofLabel, validatePresence,
  type ClientPresence, type Phase, type PresenceState,
} from '@/lib/presence'
import MissionTimeline, { stepIndex } from '@/components/presence/MissionTimeline'
import QrScanner from '@/components/presence/QrScanner'
import ClientProofCard from '@/components/presence/ClientProofCard'
import RemoteConfirmCard from '@/components/presence/RemoteConfirmCard'
import RemotePresence from '@/components/presence/RemotePresence'
import PresenceTag from '@/components/presence/PresenceTag'
import { isNetworkMessage } from '@/lib/netError'
import PresenceChoice from '@/components/presence/PresenceChoice'
import AbsentProcess from '@/components/presence/AbsentProcess'
import ClientAbsentAction from '@/components/presence/ClientAbsentAction'
import BookingCard from '@/components/BookingCard'
import MissionActions from '@/components/MissionActions'
import { bookingAccepted } from '@/lib/booking'

/**
 * Mission du jour : un seul écran, un seul bouton principal selon l'étape (audit arrivée / départ, 18/11).
 * Prestataire : Je pars → Scanner le QR du client → (en cours) Terminer la mission → récapitulatif.
 * Client : son QR (arrivée puis fin) et son code ; client absent : confirmation en un appui.
 * Avec la migration 038, chaque validation est vérifiée en base (preuve du client) ; sans elle, l'écran retombe
 * sur l'ancien fonctionnement (QR de la mission, scan direct).
 */
const ETAS = [5, 10, 15, 20, 30, 45]
const hhmm = (d?: string | null) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null
const rdvLabel = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function MissionDuJour() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const txId = params.id
  const [tx, setTx] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [uid, setUid] = useState('')
  const [name, setName] = useState('')
  const [v2, setV2] = useState<boolean | null>(null)
  const [st, setSt] = useState<PresenceState | null>(null)
  const [payOn, setPayOn] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [scan, setScan] = useState<Phase | null>(null)
  const [scanKey, setScanKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [eta, setEta] = useState(DEFAULT_ETA)
  const [askEta, setAskEta] = useState(false)
  const [legacyCode, setLegacyCode] = useState<{ code: string; expires_at: string } | null>(null)
  const autoOpened = useRef(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: t, error: loadError } = await supabase.from('transactions')
      .select('*, requests(address, category, title)').eq('id', txId).maybeSingle()
    // Coupure réseau : on garde l'écran et l'état local tels quels, la relecture suivante (5 s) réessaie.
    if (loadError) return
    if (!t) { setMissing(true); return }
    setMissing(false)
    setTx(t)
    const ok = await presenceAvailable(supabase)
    setV2(ok)
    if (ok) setSt(await getPresenceState(supabase, txId))
    else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.id === t.buyer_id) {
        const { data } = await supabase.rpc('get_arrival_code', { p_transaction: txId })
        setLegacyCode(Array.isArray(data) && data[0] ? data[0] : null)
      }
    }
  }, [txId])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace(`/auth/login?next=${encodeURIComponent(`/mission/${txId}/jour`)}`); return }
      setUid(user.id)
    })
    supabase.rpc('transaction_counterparts', { p_transaction_ids: [txId] }).then(({ data }) => {
      const r = (data ?? [])[0] as any
      if (r?.full_name) setName(r.full_name)
    })
    paymentsActive().then(setPayOn)
    load()
    const iv = setInterval(load, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(iv); clearInterval(tick) }
  }, [txId, load, router])

  const isSeller = !!tx && uid === tx.seller_id
  const isBuyer = !!tx && uid === tx.buyer_id

  // Raccourcis depuis le chat : ?scan ouvre le scanner, ?absent la voie « client absent ».
  const [wantAbsent, setWantAbsent] = useState(false)
  // Migration 048 : démarche « client absent » ouverte à la main (client finalement absent), QR de fin
  // affiché au client qui avait annoncé son absence, changement d'avis du client.
  const [absentOpen, setAbsentOpen] = useState(false)
  const [showQr, setShowQr] = useState(false)
  useEffect(() => {
    if (autoOpened.current || !tx || !uid || v2 === null) return
    autoOpened.current = true
    const q = new URLSearchParams(window.location.search)
    if (isSeller && q.has('scan') && !tx.completed_at && (tx.arrived_at || tx.en_route_at)) setScan(tx.arrived_at ? 'fin' : 'arrivee')
    if (isSeller && q.has('absent')) { setWantAbsent(true); setAbsentOpen(true) }
  }, [tx, uid, v2, isSeller])

  // Scan sans réseau : rien n'est enregistré ni gardé, l'heure retenue est celle de la validation (serveur). Phrase claire
  // plutôt que « Failed to fetch » ; le champ du scanner est rouvert pour un nouvel essai.
  const scanErr = (m: string | undefined, fallback: string) => isNetworkMessage(m)
    ? 'Pas de connexion : rien n’est validé. Scannez de nouveau dès que le réseau revient ; l’heure retenue est celle de la validation.'
    : (m || fallback)

  async function handleScan(raw: string) {
    if (!tx || !scan) return
    const phase = scan
    const supabase = createClient()
    const parsed = parseScanned(raw)
    if (parsed.txId && parsed.txId !== tx.id) {
      setMsg({ kind: 'err', text: 'Ce QR correspond à une autre mission.' }); setScanKey(k => k + 1); return
    }
    setBusy(true); setMsg(null)
    // QR laissé sur place par le client (arrivée seulement).
    if (parsed.phase === 'onsite') {
      const { data, error } = await supabase.rpc('arrive_with_onsite_token', { p_transaction: tx.id, p_token: parsed.token })
      setBusy(false)
      if (error) { setMsg({ kind: 'err', text: scanErr(error.message, 'QR invalide ou déjà utilisé.') }); setScanKey(k => k + 1); return }
      if (!v2) {
        await supabase.from('messages').insert({
          transaction_id: tx.id, ...(await systemSender(supabase)),
          body: `✓ Arrivée validée à ${hhmm(new Date().toISOString())} — QR laissé sur place par le client`,
        })
      }
      setScan(null); setMsg({ kind: 'ok', text: (data as any)?.already ? 'Arrivée déjà enregistrée.' : 'Arrivée validée.' }); load(); return
    }
    if (v2) {
      const r = await validatePresence(supabase, tx.id, phase, parsed.token)
      setBusy(false)
      if (!r.ok) { setMsg({ kind: 'err', text: scanErr(r.message, 'Preuve refusée.') }); setScanKey(k => k + 1); return }
      setScan(null)
      setMsg({ kind: 'ok', text: (phase === 'arrivee' ? 'Arrivée validée.' : 'Fin validée.') + (r.warning && PRESENCE_WARNING[r.warning] ? ' ' + PRESENCE_WARNING[r.warning] : '') })
      load(); return
    }
    // Migration 038 absente : l'ancien écran de scan fait la validation.
    setBusy(false)
    if (parsed.phase && parsed.token) { router.push(`/mission/${tx.id}/scan/${parsed.phase}?token=${encodeURIComponent(parsed.token)}`); return }
    if (/^\d{6}$/.test(parsed.token) && phase === 'arrivee') {
      const { data: r } = await supabase.rpc('arrive_with_code', { p_transaction: tx.id, p_code: parsed.token })
      if (r?.ok) { setScan(null); setMsg({ kind: 'ok', text: 'Arrivée validée.' }); load(); return }
    }
    setMsg({ kind: 'err', text: 'Scannez le QR affiché dans l’application du client.' }); setScanKey(k => k + 1)
  }

  async function declareDeparture() {
    if (!tx) return
    setBusy(true); setMsg(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('transactions')
      .update({ en_route_at: new Date().toISOString(), eta_minutes: eta }).eq('id', tx.id).select().maybeSingle()
    setBusy(false); setAskEta(false)
    if (error || !data) { setMsg({ kind: 'err', text: error?.message?.includes('jour même') ? error.message : 'Départ non enregistré — vérifiez votre connexion et réessayez.' }); return }
    saveLastEta(eta)
    await supabase.from('messages').insert({ transaction_id: tx.id, ...(await systemSender(supabase)), body: `→ En route — arrivée estimée dans ${eta} min` })
    load()
  }

  if (missing) return (
    <Shell onBack={() => router.push('/agenda')} title="Mission">
      <p style={{ color: '#4E6470', fontSize: 13.5 }}>Mission introuvable pour ce compte.</p>
    </Shell>
  )
  if (!tx || !uid || v2 === null) return <Shell onBack={() => router.back()} title="Mission du jour"><p style={{ color: '#4E6470', fontSize: 13 }}>Chargement…</p></Shell>
  if (!isSeller && !isBuyer) return <Shell onBack={() => router.back()} title="Mission"><p style={{ color: '#4E6470', fontSize: 13 }}>Cette mission ne vous concerne pas.</p></Shell>
  // Réservation pas encore acceptée (ou refusée / expirée), migration 052 : ni adresse, ni QR, ni « Je pars ».
  if (!bookingAccepted(tx)) return (
    <Shell onBack={() => router.push(`/mission/${tx.id}/chat`)} title="Mission">
      <BookingCard tx={tx} userId={uid} counterpart={name} onChange={patch => setTx((t: any) => ({ ...t, ...patch }))} />
      <button onClick={() => router.push(`/mission/${tx.id}/chat`)} style={{ width: '100%', minHeight: 48, marginTop: 12, borderRadius: 999, border: '1.5px solid #0B8374', background: '#fff', color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>Ouvrir la conversation</button>
    </Shell>
  )

  const step = stepIndex(tx)
  const address = isBuyer || ((!payOn || ['held', 'released'].includes(tx.payment_status)) && addressUsable(tx.address_status)) ? tx.requests?.address : null
  const trade = tx.requests?.category ? (TRADES[tx.requests.category] || tx.requests.category) : null
  const cancelled = tx.status === 'cancelled'
  const done = !!tx.completed_at || ['completed', 'released'].includes(tx.status)
  const onSiteMin = tx.arrived_at ? Math.max(0, Math.floor(((tx.completed_at ? new Date(tx.completed_at).getTime() : now) - new Date(tx.arrived_at).getTime()) / 60000)) : 0
  const remA = st?.remote?.arrivee, remF = st?.remote?.fin
  const winA = st?.window?.arrivee, winF = st?.window?.fin
  const preview = st?.preview_now
  const aProof = st?.arrival_proof ?? (tx.arrival_proof || tx.arrival_method)
  const fProof = st?.completion_proof ?? tx.completion_proof
  // Process de commande (048) : présence annoncée par le client, démarche client absent en étapes.
  const v48 = hasProcess(st)
  const presence = (st?.client_presence ?? null) as ClientPresence | null
  const absentArr = v48 && (presence === 'absent' || absentOpen || remA?.etat === 'en_attente' || remA?.etat === 'refusee')
  // Client absent à l'arrivée (photo, code à distance, QR laissé sur place) : la fin passe d'office par le code de
  // fin, sans le détour « Fin à distance » (audit ergonomie 19/11, correction 13).
  const absentAtArrival = ['distance_code', 'distance_confirmation', 'photo_gps', 'qr_sur_place', 'geoloc_code'].includes(String(aProof || ''))
  const absentFin = v48 && (presence === 'absent' || absentAtArrival || absentOpen || remF?.etat === 'en_attente' || remF?.etat === 'refusee')
  const pn = name || (isSeller ? 'Le client' : 'Votre prestataire')
  // Forfait avec heures incluses : l'aperçu compte les heures au-delà du forfait (billedLabel).
  const forfaitPlus = tx.base_forfait_cents != null && tx.included_hours != null
  const rateBuyer = tx.subtotal_cents ? (tx.buyer_fee_cents || 0) / tx.subtotal_cents : null

  const primary: React.CSSProperties = {
    width: '100%', border: 'none', borderRadius: 999, padding: '14px 0', background: '#0B8374', color: '#fff',
    fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, cursor: 'pointer',
  }
  // Liens texte à 44 px de haut (Itinéraire, Comment ça marche, Noter le client…), audit ergonomie 19/11.
  const link: React.CSSProperties = { border: 'none', background: 'none', color: '#0B8374', fontWeight: 700, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', minHeight: 44, padding: '0 6px' }
  const block: React.CSSProperties = { marginTop: 12 }

  return (
    <Shell onBack={() => router.push(`/mission/${tx.id}/chat`)} title="Mission du jour">
      {/* Billet */}
      <div style={{ background: '#123644', color: '#fff', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
          {isSeller ? 'Client' : 'Prestataire'}{trade ? ` · ${trade}` : ''}
        </div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, marginTop: 2 }}>{name || (isSeller ? 'Votre client' : 'Votre prestataire')}</div>
        <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(255,255,255,.85)' }}>
          {tx.scheduled_at ? `Rendez-vous ${rdvLabel(tx.scheduled_at)}` : 'Heure du rendez-vous non fixée'}
        </div>
        {address && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{address}</div>}
        {v48 && !done && !cancelled && tx.price_confirmed && (!tx.arrived_at || presence) && (
          <div style={{ marginTop: 8 }}><PresenceTag presence={presence} asSeller={isSeller} onDark /></div>
        )}
        {isSeller && address && !tx.arrived_at && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', marginTop: 8, borderRadius: 999, border: '1.5px solid rgba(127,227,211,.6)', color: '#7FE3D3', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Itinéraire</a>
        )}
        <div style={{ marginTop: 12, background: '#fff', borderRadius: 12, padding: '8px 4px 4px' }}>
          <MissionTimeline current={cancelled ? 0 : step}
            times={[hhmm(tx.scheduled_at), hhmm(tx.en_route_at), hhmm(tx.arrived_at), tx.arrived_at && !done ? durLabel(onSiteMin) : null, hhmm(tx.completed_at), null]} />
        </div>
      </div>

      {msg && (
        <div role="status" style={{ ...block, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: msg.kind === 'ok' ? 'rgba(18,179,156,.12)' : 'rgba(229,72,77,.1)', color: msg.kind === 'ok' ? '#0B8374' : '#B3402F' }}>{msg.text}</div>
      )}

      {/* Annuler, reporter, absence du prestataire, clôture sur preuve (056). */}
      {tx.price_confirmed && <MissionActions tx={tx} userId={uid} style={{ margin: '12px 0 0' }} onChange={patch => setTx((t: any) => ({ ...t, ...patch }))} />}
      {cancelled && !tx.cancel_tier && <p style={{ ...block, fontSize: 14, color: '#4E6470', fontWeight: 600 }}>Réservation annulée.</p>}
      {!cancelled && !tx.price_confirmed && (
        <div style={block}>
          <p style={{ fontSize: 13, color: '#4E6470' }}>Le tarif n&apos;est pas encore validé.</p>
          <button style={primary} onClick={() => router.push(`/mission/${tx.id}/chat`)}>Ouvrir la conversation</button>
        </div>
      )}

      {/* ---------------- PRESTATAIRE ---------------- */}
      {!cancelled && tx.price_confirmed && isSeller && (
        <>
          {!tx.en_route_at && !tx.arrived_at && (
            <div style={block}>
              {!askEta ? (
                <button style={primary} onClick={() => { setEta(readLastEta(ETAS)); setAskEta(true) }}>Je pars</button>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Dans combien de temps arrivez-vous ?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {ETAS.map(m => (
                      <button key={m} onClick={() => setEta(m)} aria-pressed={eta === m} style={{
                        flex: '1 0 28%', minHeight: 44, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                        background: eta === m ? '#12B39C' : '#F3F6F5', color: eta === m ? '#fff' : '#123644',
                      }}>{m} min</button>
                    ))}
                  </div>
                  <button style={{ ...primary, marginTop: 12 }} disabled={busy} onClick={declareDeparture}>{busy ? 'Envoi…' : `Prévenir le client — ${eta} min`}</button>
                  <button style={{ ...link, display: 'block', margin: '8px auto 0' }} onClick={() => setAskEta(false)}>Annuler</button>
                </div>
              )}
              <p style={{ fontSize: 11.5, color: '#6E8592', textAlign: 'center', marginTop: 8 }}>
                Le client voit votre heure d&apos;arrivée estimée.{' '}
                {!v48 || presence === 'sur_place' ? 'La mission démarre au scan de son QR.'
                  : presence === 'absent' ? `${pn} ne sera pas sur place : démarche client absent (photo, position, code du client).`
                    : `${pn} n’a pas encore indiqué s’il sera sur place.`}
              </p>
            </div>
          )}

          {tx.en_route_at && !tx.arrived_at && (
            <div style={block}>
              {winA && !winA.ok ? (
                <p style={{ fontSize: 13, color: '#B3402F', fontWeight: 600 }}>{winA.message}</p>
              ) : absentArr ? (
                <>
                  <AbsentProcess txId={tx.id} uid={uid} phase="arrivee" clientName={name || undefined} remote={remA} onDone={load} />
                  {remA?.etat !== 'en_attente' && (
                    <button style={{ ...link, display: 'block', margin: '10px auto 0', minHeight: 44 }} onClick={() => { setMsg(null); setScan('arrivee') }}>
                      {pn} est là ? Scanner son QR
                    </button>
                  )}
                </>
              ) : v48 ? (
                <>
                  <button style={primary} onClick={() => { setMsg(null); setScan('arrivee') }}>Scanner le QR du client</button>
                  {winA?.warning && PRESENCE_WARNING[winA.warning] && <p style={{ fontSize: 11.5, color: '#8a6520', textAlign: 'center', marginTop: 6 }}>{PRESENCE_WARNING[winA.warning]}</p>}
                  <p style={{ fontSize: 11.5, color: '#6E8592', textAlign: 'center', marginTop: 6 }}>Aucune position n&apos;est relevée.</p>
                  <button style={{ ...link, display: 'block', margin: '4px auto 0', minHeight: 44 }} onClick={() => setAbsentOpen(true)}>Le client n&apos;est pas là ? Démarche client absent</button>
                </>
              ) : (
                <>
                  <button style={primary} onClick={() => { setMsg(null); setScan('arrivee') }}>Scanner le QR du client</button>
                  {winA?.warning && PRESENCE_WARNING[winA.warning] && <p style={{ fontSize: 11.5, color: '#8a6520', textAlign: 'center', marginTop: 6 }}>{PRESENCE_WARNING[winA.warning]}</p>}
                  <div style={{ marginTop: 10 }}>
                    <RemotePresence key={wantAbsent ? 'a1' : 'a0'} initialOpen={wantAbsent} txId={tx.id} phase="arrivee" v2={!!v2} remote={remA} onDone={load} />
                  </div>
                </>
              )}
            </div>
          )}

          {tx.arrived_at && !done && (
            <div style={block}>
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: '#2FD06E' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Intervention en cours</div>
                  <div style={{ fontSize: 11.5, color: '#4E6470' }}>Arrivée à {hhmm(tx.arrived_at)}{proofLabel(aProof, 'arrivee') ? ` · ${proofLabel(aProof, 'arrivee')}` : ''}</div>
                  {preview?.subtotal_cents != null && <div style={{ fontSize: 11.5, color: '#4E6470' }}>Si vous terminez maintenant : prestation {EUR(preview.subtotal_cents)}{billedLabel(preview, forfaitPlus)}</div>}
                </div>
                <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 19, color: '#123644', fontVariantNumeric: 'tabular-nums' }}>{durLabel(onSiteMin)}</b>
              </div>
              {winF && !winF.ok ? (
                <p style={{ fontSize: 13, color: '#B3402F', fontWeight: 600, marginTop: 10 }}>{winF.message}</p>
              ) : absentFin ? (
                <div style={{ marginTop: 12 }}>
                  <AbsentProcess txId={tx.id} uid={uid} phase="fin" clientName={name || undefined} remote={remF} preview={preview} forfait={forfaitPlus} onDone={load} />
                  {remF?.etat !== 'en_attente' && (
                    <button style={{ ...link, display: 'block', margin: '10px auto 0', minHeight: 44 }} onClick={() => { setMsg(null); setScan('fin') }}>
                      {pn} est là ? Scanner son QR de fin
                    </button>
                  )}
                </div>
              ) : v48 ? (
                <>
                  <button style={{ ...primary, marginTop: 12 }} onClick={() => { setMsg(null); setScan('fin') }}>Terminer la mission</button>
                  <p style={{ fontSize: 11.5, color: '#6E8592', textAlign: 'center', marginTop: 6 }}>Scannez le QR de fin affiché chez le client.</p>
                  <button style={{ ...link, display: 'block', margin: '4px auto 0', minHeight: 44 }} onClick={() => setAbsentOpen(true)}>Le client n&apos;est pas là ? Fin à distance (code de fin)</button>
                </>
              ) : (
                <>
                  <button style={{ ...primary, marginTop: 12 }} onClick={() => { setMsg(null); setScan('fin') }}>Terminer la mission</button>
                  <p style={{ fontSize: 11.5, color: '#6E8592', textAlign: 'center', marginTop: 6 }}>Scannez le QR de fin affiché chez le client.</p>
                  {v2 && <div style={{ marginTop: 6 }}><RemotePresence txId={tx.id} phase="fin" v2 remote={remF} onDone={load} /></div>}
                </>
              )}
            </div>
          )}

          {done && (
            <div style={block}>
              <Recap tx={tx} seller aProof={aProof} fProof={fProof} />
              <button style={{ ...primary, marginTop: 12 }} onClick={() => router.push(`/mission/${tx.id}/facture`)}>Voir mes factures</button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 10 }}>
                <button style={link} onClick={() => router.push(`/mission/${tx.id}/chat`)}>Noter le client</button>
                <button style={link} onClick={() => router.push('/pro/paiements')}>Commission à virer à PING</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------------- CLIENT ---------------- */}
      {!cancelled && tx.price_confirmed && isBuyer && (
        <>
          {!tx.arrived_at && (
            <div style={block}>
              {/* Compte à rebours masqué dès que le prestataire indique être sur place (photo reçue) : sinon
                  « arrive dans 10 min » restait affiché au-dessus de « … indique être sur place » (e2e 19/11). */}
              {tx.en_route_at && remA?.etat !== 'en_attente' && (
                <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#123644' }}>
                  {(() => {
                    const left = Math.max(0, (tx.eta_minutes || 15) * 60000 - (now - new Date(tx.en_route_at).getTime()))
                    return left > 0 ? <>Votre prestataire arrive dans <b>{Math.ceil(left / 60000)} min</b></> : <>Votre prestataire devrait arriver d&apos;un instant à l&apos;autre.</>
                  })()}
                </div>
              )}
              {v48 ? (
                remA?.etat === 'en_attente' ? (
                  <ClientAbsentAction txId={tx.id} phase="arrivee" req={remA} proName={name || undefined} onDone={load} />
                ) : !presence ? (
                  <div style={{ background: '#fff', border: '1.5px solid #12B39C', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644', marginBottom: 4 }}>
                      Serez-vous sur place{tx.scheduled_at ? ` à ${hhmm(tx.scheduled_at)}` : ''} ?
                    </div>
                    <p style={{ fontSize: 12.5, color: '#4E6470', margin: '0 0 10px', lineHeight: 1.5 }}>Votre réponse prépare l&apos;arrivée de {pn.replace(/\.$/, '')}.</p>
                    <PresenceChoice txId={tx.id} presence={presence} proName={name || undefined} onChange={() => load()} />
                  </div>
                ) : presence === 'sur_place' ? (
                  <>
                    <ClientProofCard txId={tx.id} phase="arrivee" v2={!!v2} legacyToken={tx.qr_arrival_token} />
                    {/* « Changer ma réponse » en un appui (audit ergonomie 19/11, correction 12). */}
                    <div style={{ marginTop: 10 }}><PresenceChoice txId={tx.id} presence={presence} proName={name || undefined} toggle onChange={() => load()} /></div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Vous ne serez pas sur place : rien à faire pour l&apos;instant</div>
                      <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 0', lineHeight: 1.5 }}>
                        À son arrivée, vous recevrez la photo, la position et l&apos;heure de {pn} dans la messagerie, avec une notification. Vous confirmerez d&apos;un appui.
                      </p>
                    </div>
                    <div style={{ marginTop: 10 }}><PresenceChoice txId={tx.id} presence={presence} proName={name || undefined} toggle onChange={() => load()} /></div>
                  </>
                )
              ) : remA?.etat === 'en_attente' && <div style={{ marginBottom: 12 }}><RemoteConfirmCard txId={tx.id} phase="arrivee" req={remA} onDone={load} /></div>}
              {!v48 && !v2 && legacyCode && new Date(legacyCode.expires_at).getTime() > now && (
                <div role="alert" style={{ marginBottom: 12, background: '#FFF7ED', border: '1.5px solid #F2A93B', borderRadius: 14, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Le prestataire indique être sur place</div>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 30, letterSpacing: 6, color: '#123644', margin: '8px 0' }}>{legacyCode.code}</div>
                  <p style={{ fontSize: 11.5, color: '#6b4a10', margin: 0 }}>Valable jusqu&apos;à {hhmm(legacyCode.expires_at)}. Ne le communiquez que si le prestataire est bien là.</p>
                </div>
              )}
              {!v48 && (
                <>
                  <ClientProofCard txId={tx.id} phase="arrivee" v2={!!v2} legacyToken={tx.qr_arrival_token} />
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <button style={link} onClick={() => router.push(`/mission/${tx.id}/qrcodes`)}>Je ne serai pas sur place</button>
                  </div>
                </>
              )}
            </div>
          )}

          {tx.arrived_at && !done && (
            <div style={block}>
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: '#2FD06E' }} />
                <span style={{ flex: 1, fontSize: 13, color: '#123644' }}>Sur place depuis {hhmm(tx.arrived_at)}</span>
                <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644', fontVariantNumeric: 'tabular-nums' }}>{durLabel(onSiteMin)}</b>
              </div>
              {v48 ? (
                remF?.etat === 'en_attente' ? (
                  <ClientAbsentAction txId={tx.id} phase="fin" req={remF} proName={name || undefined} buyerFeeRate={rateBuyer} forfait={forfaitPlus} onDone={load} />
                ) : presence === 'absent' && !showQr ? (
                  <>
                    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Intervention en cours</div>
                      <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 0', lineHeight: 1.5 }}>
                        À la fin, {pn} vous demande votre code de fin : vous l&apos;envoyez d&apos;un appui, {pn} le saisit pour clôturer.
                      </p>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 6 }}>
                      <button style={{ ...link, minHeight: 44 }} onClick={() => setShowQr(true)}>Je suis là : afficher mon QR de fin</button>
                    </div>
                  </>
                ) : (
                  <ClientProofCard txId={tx.id} phase="fin" v2={!!v2} legacyToken={tx.qr_complete_token} />
                )
              ) : (
                <>
                  {remF?.etat === 'en_attente' && <div style={{ marginBottom: 12 }}><RemoteConfirmCard txId={tx.id} phase="fin" req={remF} onDone={load} /></div>}
                  <ClientProofCard txId={tx.id} phase="fin" v2={!!v2} legacyToken={tx.qr_complete_token} />
                </>
              )}
              <button onClick={() => router.push(`/mission/${tx.id}/chat?signaler`)} style={{
                marginTop: 12, width: '100%', border: '1.5px solid #F2A93B', background: '#FFF7ED', color: '#8a6520',
                borderRadius: 999, padding: '11px 0', minHeight: 44, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Un problème ? Signaler avant de valider</button>
            </div>
          )}

          {done && (
            <div style={block}>
              <Recap tx={tx} aProof={aProof} fProof={fProof} />
              <button style={{ ...primary, marginTop: 12 }} onClick={() => router.push(`/mission/${tx.id}/facture`)}>Voir la facture et régler</button>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button style={link} onClick={() => router.push(`/mission/${tx.id}/chat?avis`)}>Laisser un avis</button>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button style={{ ...link, color: '#4E6470', minHeight: 44 }} onClick={() => router.push(`/mission/${tx.id}/chat`)}>Conversation</button>
        <span style={{ color: '#C5D3CF', margin: '0 10px' }}>·</span>
        {!done && !cancelled && tx.price_confirmed && (
          <>
            <button style={{ ...link, color: '#4E6470', minHeight: 44 }} onClick={() => router.push(`/mission/${tx.id}/commande`)}>{isSeller ? 'Commande reçue' : 'Paiement'}</button>
            <span style={{ color: '#C5D3CF', margin: '0 10px' }}>·</span>
          </>
        )}
        <button style={{ ...link, color: '#4E6470', minHeight: 44 }} onClick={() => router.push('/aide/apres-commande')}>Comment ça marche</button>
      </div>

      {scan && (
        <QrScanner key={scanKey} busy={busy} onResult={handleScan} onCancel={() => setScan(null)}
          title={scan === 'arrivee' ? 'Scanner le QR d’arrivée du client' : 'Scanner le QR de fin du client'}
          hint={scan === 'arrivee' ? 'Le client l’affiche dans « Mission du jour ». Un QR laissé sur place fonctionne aussi.' : 'Le client l’affiche dans « Mission du jour ».'} />
      )}
    </Shell>
  )
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 110 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, height: 52, background: '#fff', borderBottom: '1px solid #DCE5E3', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
        <button onClick={onBack} aria-label="Retour" style={{ width: 44, height: 44, marginLeft: -6, borderRadius: 12, display: 'grid', placeItems: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <b style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>{title}</b>
      </div>
      <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Recap({ tx, seller, aProof, fProof }: { tx: any; seller?: boolean; aProof?: string | null; fProof?: string | null }) {
  const row = (l: string, v: React.ReactNode, strong?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, margin: '6px 0' }}>
      <span style={{ color: '#4E6470' }}>{l}</span><span style={{ fontWeight: strong ? 700 : 600, color: '#123644', textAlign: 'right' }}>{v}</span>
    </div>
  )
  const hourly = tx.hourly_rate_cents > 0
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 4 }}>Mission terminée</div>
      {row('Arrivée', `${hhmm(tx.arrived_at)}${proofLabel(aProof, 'arrivee') ? ` · ${proofLabel(aProof, 'arrivee')}` : ''}`)}
      {row('Fin', `${hhmm(tx.completed_at)}${proofLabel(fProof, 'fin') ? ` · ${proofLabel(fProof, 'fin')}` : ''}`)}
      {tx.duration_minutes != null && row('Durée sur place', durLabel(tx.duration_minutes))}
      {hourly && tx.base_forfait_cents != null && tx.included_hours != null && row('Tarif', `forfait ${EUR(tx.base_forfait_cents)} (${String(tx.included_hours).replace('.', ',')} h incluses), puis ${EUR(tx.hourly_rate_cents)}/h`)}
      {hourly && tx.base_forfait_cents == null && row('Tarif', `${EUR(tx.hourly_rate_cents)}/h, heure entamée due au-delà du seuil`)}
      {row('Prestation', EUR(tx.subtotal_cents))}
      {seller ? (
        <>
          {row('Commission PING', `− ${EUR(tx.seller_fee_cents)}`)}
          {row('Vous percevez', EUR(tx.payout_cents), true)}
        </>
      ) : (
        <>
          {row('Frais de service PING', EUR(tx.buyer_fee_cents))}
          {row('Total, frais compris', EUR(tx.total_charged_cents), true)}
        </>
      )}
    </div>
  )
}
