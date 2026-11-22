"use client"
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { paymentsActive } from '@/lib/paymentsClient'
import { getHourThreshold, DEFAULT_HOUR_THRESHOLD_MINUTES } from '@/lib/pricing'
import { TRADES } from '@/lib/trades'
import { isTodayMission } from '@/lib/todayMission'
import { rowHasPresence, type ClientPresence } from '@/lib/presence'
import PaymentCard from '@/components/PaymentCard'
import OrderSummary from '@/components/presence/OrderSummary'
import PresenceChoice from '@/components/presence/PresenceChoice'
import PresenceTag from '@/components/presence/PresenceTag'
import { MissionSuivi } from '@/components/presence/MissionTimeline'
import BookingCard from '@/components/BookingCard'
import MissionActions from '@/components/MissionActions'
import { bookingAccepted, bookingPending, bookingEnded, expireBookings, deadlineAt, deadlineLeft } from '@/lib/booking'
import { addressUsable, maskAddress } from '@/lib/address'
import { systemSender } from '@/lib/systemMessage'
import { cancellationAvailable } from '@/lib/cancellation'

// Fenêtres chargées à la demande (comme dans MissionActions).
const CancelSheet = dynamic(() => import('@/components/MissionSheets').then(m => m.CancelSheet), { ssr: false })
const AddressEditSheet = dynamic(() => import('@/components/AddressEditSheet'), { ssr: false })

/**
 * Bon de commande (demande de Romain 22/11/2026) : « Commande validée » (client) / « Commande reçue » (prestataire),
 * ouvert en un appui depuis la carte de commande du chat. Il montre la prestation, le prix figé, les frais ou la part
 * perçue (selon le rôle), l'adresse (masquée selon les règles), la date, la présence du client, le statut, puis les
 * actions possibles. JAMAIS de modification du prix ici : seul un litige le rouvre.
 * Chaque action qui demande l'accord de l'autre partie dit ce qui se passe ensuite.
 * Sans la migration 056 (annulation) ou 048 (présence), l'écran garde l'ancien fonctionnement.
 */
const rdvLabel = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function Commande() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tx, setTx] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [uid, setUid] = useState('')
  const [name, setName] = useState('')
  const [payOn, setPayOn] = useState(false)
  const [thr, setThr] = useState(DEFAULT_HOUR_THRESHOLD_MINUTES)
  const [justSet, setJustSet] = useState(false)
  const [invoices, setInvoices] = useState(0)
  const [cancelAvail, setCancelAvail] = useState<boolean | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [addrOpen, setAddrOpen] = useState(false)
  const [addrBusy, setAddrBusy] = useState(false)
  const [addrErr, setAddrErr] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    await expireBookings(supabase)
    const { data: t } = await supabase.from('transactions').select('*, requests(address, category, title)').eq('id', id).maybeSingle()
    if (!t) { setMissing(true); return }
    setTx(t)
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('transaction_id', id).then(({ count }) => setInvoices(count ?? 0))
  }, [id])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace(`/auth/login?next=${encodeURIComponent(`/mission/${id}/commande`)}`); return }
      setUid(user.id)
    })
    supabase.rpc('transaction_counterparts', { p_transaction_ids: [id] }).then(({ data }) => {
      const r = (data ?? [])[0] as any
      if (r?.full_name) setName(r.full_name)
    })
    paymentsActive().then(setPayOn)
    cancellationAvailable(supabase).then(setCancelAvail)
    getHourThreshold().then(setThr).catch(() => { })
    load()
  }, [id, load, router])

  const back = () => router.push(`/mission/${id}/chat`)
  if (missing) return <Shell title="Commande" onBack={() => router.push('/agenda')}><p style={muted}>Mission introuvable pour ce compte.</p></Shell>
  if (!tx || !uid) return <Shell title="Commande" onBack={back}><p style={muted}>Chargement…</p></Shell>
  const isSeller = uid === tx.seller_id
  const isBuyer = uid === tx.buyer_id
  if (!isSeller && !isBuyer) return <Shell title="Commande" onBack={back}><p style={muted}>Cette mission ne vous concerne pas.</p></Shell>

  const title = isSeller ? 'Commande reçue' : 'Commande validée'
  if (!tx.price_confirmed) return (
    <Shell title={title} onBack={back}>
      <p style={muted}>Le tarif n&apos;est pas encore validé : il se fixe dans la conversation.</p>
      <button style={primary} onClick={back}>Ouvrir la conversation</button>
    </Shell>
  )

  const patch = (p: Record<string, unknown>) => setTx((t: any) => ({ ...t, ...p }))
  const accepted = bookingAccepted(tx)
  const pend = bookingPending(tx)
  const ended = bookingEnded(tx)
  const cancelled = tx.status === 'cancelled'
  const done = !!tx.completed_at || ['completed', 'released'].includes(tx.status)
  const live = !cancelled && !ended && !done
  const v48 = rowHasPresence(tx)
  const presence = (tx.client_presence ?? null) as ClientPresence | null
  const started = !!tx.arrived_at || tx.status !== 'pending'
  const trade = tx.requests?.category ? (TRADES[tx.requests.category] || tx.requests.category) : null
  const today = isTodayMission(tx)
  const pn = name || (isSeller ? 'Le client' : 'Le prestataire')
  const setPresence = (p: ClientPresence) => { setTx((t: any) => ({ ...t, client_presence: p })); setJustSet(true) }

  // Adresse : le client voit la sienne ; le prestataire seulement si la réservation est acceptée, payée (ou paiement en ligne
  // éteint) et l'adresse est celle du profil ou acceptée (règles 9 et 023). Jamais avant l'acceptation.
  const addr: string = tx.requests?.address || ''
  const addrFull = isBuyer || (accepted && (!payOn || ['held', 'released'].includes(tx.payment_status)) && addressUsable(tx.address_status))
  const aStatus = tx.address_status as string | null | undefined
  let addrLine = ''
  let addrNote = ''
  if (isBuyer) {
    addrLine = addr || 'À fixer dans la conversation'
    addrNote = aStatus === 'a_valider' ? 'En attente de validation par le prestataire : il la voit sans le numéro. Vous n’avez rien à faire, vous serez prévenu dans la conversation.'
      : aStatus === 'refusee' ? 'Refusée par le prestataire : choisissez une autre adresse avec « Modifier l’adresse ».'
        : aStatus === 'acceptee' ? 'Acceptée par le prestataire.'
          : addr ? 'Adresse de votre profil.' : ''
  } else if (addrFull) {
    addrLine = addr || 'À fixer par le client'
  } else if (!accepted) {
    addrLine = 'Transmise après votre acceptation'
  } else if (aStatus === 'a_valider') {
    addrLine = maskAddress(addr) || 'Autre adresse proposée'
    addrNote = 'Autre adresse que celle du profil, vue sans le numéro. Le numéro vous est transmis si vous l’acceptez.'
  } else if (aStatus === 'refusee') {
    addrLine = 'Refusée par vous'
    addrNote = 'En attente d’une autre adresse du client.'
  } else {
    addrLine = 'Transmise une fois la mission payée'
  }

  const statusLabel = cancelled ? 'Annulée' : tx.booking_status === 'refusee' ? 'Réservation refusée' : tx.booking_status === 'expiree' ? 'Réservation expirée'
    : pend ? (isSeller ? 'À accepter par vous' : 'En attente d’acceptation')
      : done ? 'Terminée' : tx.arrived_at ? 'Sur place' : 'Acceptée'
  const statusTone = cancelled || ended ? '#C0503A' : pend ? '#B54708' : '#0A6F62'

  async function answerAddress(ok: boolean) {
    setAddrBusy(true); setAddrErr('')
    const supabase = createClient()
    const { data: upd, error } = await supabase.from('transactions').update({ address_status: ok ? 'acceptee' : 'refusee' }).eq('id', tx.id).select().maybeSingle()
    setAddrBusy(false)
    if (error || !upd) { setAddrErr('Réponse non enregistrée, réessayez.'); return }
    patch({ address_status: upd.address_status })
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: ok ? '✓ Adresse d’intervention acceptée par le prestataire' : '✕ Adresse d’intervention refusée par le prestataire : le client en propose une autre',
    })
  }

  const go = (path: string) => router.push(`/mission/${tx.id}/${path}`)
  const ghost: React.CSSProperties = { ...primary, marginTop: 8, background: '#fff', color: '#0C8F7E', border: '1.5px solid #0C8F7E' }
  const row = (label: string, value: React.ReactNode, note?: React.ReactNode) => (
    <div style={{ padding: '9px 0', minHeight: 44, borderTop: '1px solid #EEF2F1' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#123644', marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.5, marginTop: 3 }}>{note}</div>}
    </div>
  )
  const presenceText = !v48 ? 'Le prestataire scanne le QR du client à son arrivée, puis à la fin.'
    : presence === 'sur_place' ? 'Le client sera sur place.' : presence === 'absent' ? 'Le client ne sera pas sur place.' : 'Pas encore indiquée par le client.'

  return (
    <Shell title={title} onBack={back}>
      {/* En-tête du bon de commande : statut, prestation, prix figé. */}
      <div style={{ background: 'rgba(18,179,156,.1)', border: '1px solid rgba(18,179,156,.4)', borderRadius: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: statusTone, background: '#fff', border: `1px solid ${statusTone}`, borderRadius: 999, padding: '3px 9px' }}>{statusLabel}</span>
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#0A6F62', background: '#DDF5F0', borderRadius: 999, padding: '3px 9px' }}>Tarif validé · prix figé</span>
        </div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644', marginTop: 8 }}>{[trade, pn].filter(Boolean).join(' · ')}</div>
        <div style={{ fontSize: 12.5, color: '#3d5560', marginTop: 4, lineHeight: 1.5 }}>
          Le prix ne se modifie pas ici : il est figé, seul un litige peut le rouvrir.
        </div>
      </div>

      {/* Réservation en attente : qui doit répondre, dans quel délai, et la suite. */}
      {pend && (
        <div role="status" style={{ marginTop: 12, background: '#FFF7ED', border: '1.5px solid #F2A93B', borderRadius: 14, padding: '12px 14px' }}>
          <div style={h3}>{isSeller ? 'À vous de répondre' : 'En attente de la réponse du prestataire (24 h)'}</div>
          <p style={{ ...muted, margin: '4px 0 0' }}>
            {tx.accept_deadline ? `Réponse attendue ${deadlineAt(tx.accept_deadline)} : il reste ${deadlineLeft(tx.accept_deadline)}. ` : ''}
            {isSeller
              ? 'Si vous acceptez, l’adresse, les codes QR et « Je pars » s’ouvrent. Si vous refusez ou ne répondez pas à temps, la réservation s’arrête.'
              : 'Vous n’avez rien à faire. S’il accepte, l’adresse, les codes QR et « Je pars » s’ouvrent. S’il refuse ou ne répond pas à temps, vous pouvez choisir un autre prestataire.'}
          </p>
        </div>
      )}
      {(pend || ended) && <div style={{ marginTop: 12 }}><BookingCard tx={tx} userId={uid} counterpart={name} onChange={patch} /></div>}

      {/* Détails de la commande. */}
      <div style={{ marginTop: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '6px 14px' }}>
        {row('Prestation', trade || 'Prestation')}
        {row('Date et heure', tx.scheduled_at ? rdvLabel(tx.scheduled_at) : 'À fixer dans la conversation')}
        {row('Adresse', addrLine, addrNote)}
        {row('Présence du client', presenceText)}
      </div>

      {isSeller && live && accepted && aStatus === 'a_valider' && addr && (
        <div style={{ marginTop: 12, background: '#fff', border: '1.5px solid #F2A93B', borderRadius: 14, padding: 14 }}>
          <div style={h3}>Adresse à valider</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button disabled={addrBusy} onClick={() => answerAddress(true)} style={{ flex: 1, minHeight: 44, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Accepter</button>
            <button disabled={addrBusy} onClick={() => answerAddress(false)} style={{ flex: 1, minHeight: 44, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, cursor: 'pointer' }}>Refuser</button>
          </div>
          {addrErr && <p role="alert" style={{ ...muted, color: '#C0503A', fontWeight: 600, marginTop: 8 }}>{addrErr}</p>}
        </div>
      )}

      <div style={{ marginTop: 12 }}><OrderSummary tx={tx} asSeller={isSeller} counterpart={name || undefined} payOn={payOn} threshold={thr} /></div>
      {isBuyer && payOn && accepted && !cancelled && <div style={{ marginTop: 12 }}><PaymentCard transactionId={tx.id} /></div>}

      {/* Suivi de la mission. */}
      {accepted && !cancelled && <div style={{ marginTop: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 14px' }}><MissionSuivi tx={tx} invoiced={invoices > 0} /></div>}

      {/* Présence du client (048) : modifiable tant que la mission n'a pas commencé. */}
      {isBuyer && live && accepted && v48 && (
        <div style={{ marginTop: 12, background: '#fff', border: `1.5px solid ${!presence ? '#12B39C' : '#E7EDEB'}`, borderRadius: 16, padding: '12px 14px' }}>
          {!started && tx.scheduled_at ? (
            <>
              <div style={h3}>{presence ? 'Changer ma réponse de présence' : 'Serez-vous sur place ?'}</div>
              <p style={{ ...muted, margin: '2px 0 10px' }}>Vous pouvez changer d&apos;avis jusqu&apos;à l&apos;arrivée du prestataire. Il le voit tout de suite sur son billet de mission : aucune validation à attendre.</p>
              <PresenceChoice txId={tx.id} presence={presence} proName={name || undefined} onChange={setPresence} />
              {presence && <p role="status" style={{ background: 'rgba(18,179,156,.12)', color: '#0A6F62', borderRadius: 12, padding: '9px 11px', fontSize: 12.5, fontWeight: 600, margin: 0 }}>Noté : {pn} le voit sur son billet de mission.</p>}
            </>
          ) : started ? (
            <><div style={h3}>La mission a commencé</div><p style={muted}>Votre réponse de présence ne se modifie plus.</p></>
          ) : (
            <><div style={h3}>Rendez-vous à fixer</div><p style={muted}>Fixez d&apos;abord la date et l&apos;adresse dans la conversation.</p></>
          )}
        </div>
      )}
      {isSeller && live && accepted && (
        <div style={{ marginTop: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '12px 14px' }}>
          <div style={h3}>Le jour du rendez-vous</div>
          {v48 && <div style={{ margin: '6px 0' }}><PresenceTag presence={presence} asSeller /></div>}
          <p style={muted}>
            {!v48 ? 'Vous scannez le QR du client à l’arrivée, puis à la fin.'
              : presence === 'sur_place' ? `${pn} sera sur place : vous scannez son QR à l’arrivée, puis à la fin.`
                : presence === 'absent' ? `${pn} ne sera pas sur place : photo, position et heure dans la messagerie, puis sa validation ou son code ; à la fin, vous saisissez son code de fin.`
                  : `${pn} n’a pas encore indiqué s’il sera sur place : vous le verrez ici, sur le billet et dans la mission du jour.`}
          </p>
        </div>
      )}

      {/* Actions : reporter (l'autre partie accepte), annuler (3 paliers), absence, clôture sur preuve : composants existants. */}
      {!ended && (
        <>
          <MissionActions tx={tx} userId={uid} onChange={patch} style={{ margin: '12px 0 0' }} />
          {cancelAvail === false && live && (
            <button type="button" style={{ ...ghost, color: '#C0503A', borderColor: '#DCE5E3' }} onClick={() => setCancelOpen(true)}>Annuler</button>
          )}
          {cancelOpen && <CancelSheet tx={tx} userId={uid} open onClose={() => setCancelOpen(false)} onDone={p => patch(p)} />}
        </>
      )}
      {isBuyer && live && !started && (
        <>
          <button type="button" style={ghost} onClick={() => setAddrOpen(true)}>Modifier l&apos;adresse</button>
          {addrOpen && <AddressEditSheet tx={tx} userId={uid} currentAddress={addr || null} onClose={() => setAddrOpen(false)}
            onDone={p => setTx((t: any) => ({ ...t, address_status: p.address_status, requests: { ...(t.requests || {}), address: p.address, ...(p.lat != null ? { lat: p.lat, lng: p.lng } : {}) } }))} />}
        </>
      )}

      {/* Accès rapides. */}
      {accepted && live && (
        <button style={{ ...primary, marginTop: 14 }} onClick={() => go(today || isSeller ? 'jour' : 'qrcodes')}>
          {today ? 'Mission du jour' : isBuyer ? 'Mes codes QR (arrivée et fin)' : 'Voir la mission'}
        </button>
      )}
      {invoices > 0 && <button style={ghost} onClick={() => go('facture')}>Voir la facture</button>}
      <button style={ghost} onClick={back}>{justSet ? 'Revenir à la conversation' : 'Ouvrir la conversation'}</button>
    </Shell>
  )
}

const muted: React.CSSProperties = { fontSize: 13, color: '#4E6470', lineHeight: 1.5, margin: 0 }
const h3: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }
const primary: React.CSSProperties = {
  width: '100%', minHeight: 50, border: 'none', borderRadius: 999, background: '#0C8F7E', color: '#fff',
  fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', marginTop: 12,
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, height: 52, background: '#fff', borderBottom: '1px solid #DCE5E3', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
        <button onClick={onBack} aria-label="Retour" style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <b style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>{title}</b>
      </div>
      <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>{children}</div>
    </div>
  )
}
