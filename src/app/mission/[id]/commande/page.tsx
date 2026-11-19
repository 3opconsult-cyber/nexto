"use client"
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

/**
 * « Commande validée » (client) / « Commande reçue » (prestataire), maquette « Process, paiement et validation
 * commande » du 18/11 : après une réservation directe ou un devis accepté. Récapitulatif du paiement (virement
 * sur facture : rien n'est prélevé aujourd'hui), puis UNE question au client : sera-t-il sur place ?
 * Sans la migration 048, la question est remplacée par l'accès aux codes QR (fonctionnement actuel).
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

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: t } = await supabase.from('transactions').select('*, requests(address, category, title)').eq('id', id).maybeSingle()
    if (!t) { setMissing(true); return }
    setTx(t)
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
  if (tx.status === 'cancelled') return <Shell title={title} onBack={back}><p style={muted}>Réservation annulée.</p><button style={primary} onClick={back}>Revenir à la conversation</button></Shell>

  const v48 = rowHasPresence(tx)
  const presence = (tx.client_presence ?? null) as ClientPresence | null
  const started = !!tx.arrived_at || tx.status !== 'pending'
  const trade = tx.requests?.category ? (TRADES[tx.requests.category] || tx.requests.category) : null
  const today = isTodayMission(tx)
  const pn = name || (isSeller ? 'Le client' : 'Le prestataire')

  const setPresence = (p: ClientPresence) => { setTx((t: any) => ({ ...t, client_presence: p })); setJustSet(true) }

  return (
    <Shell title={title} onBack={back}>
      <div style={{ background: 'rgba(18,179,156,.1)', border: '1px solid rgba(18,179,156,.4)', borderRadius: 16, padding: '12px 14px' }}>
        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#0A6F62', background: '#DDF5F0', borderRadius: 999, padding: '3px 9px' }}>Tarif validé · prix figé</span>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#123644', marginTop: 6 }}>
          {[trade, pn].filter(Boolean).join(' · ')}
        </div>
        <div style={{ fontSize: 13, color: '#3d5560', marginTop: 2 }}>{tx.scheduled_at ? `Le ${rdvLabel(tx.scheduled_at)}` : 'Rendez-vous à fixer dans la conversation'}</div>
        <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>Seul un litige peut rouvrir le prix.</div>
      </div>

      <div style={{ marginTop: 12 }}><OrderSummary tx={tx} asSeller={isSeller} counterpart={name || undefined} payOn={payOn} threshold={thr} /></div>
      {isBuyer && payOn && <div style={{ marginTop: 12 }}><PaymentCard transactionId={tx.id} /></div>}

      {/* Le jour du rendez-vous : la question au client (048), ce qu'en voit le prestataire. */}
      <div style={{ marginTop: 12, background: '#fff', border: `1.5px solid ${isBuyer && v48 && !presence ? '#12B39C' : '#E7EDEB'}`, borderRadius: 16, padding: '12px 14px' }}>
        {isBuyer && v48 && !started && tx.scheduled_at && (
          <>
            <div style={h3}>{presence ? 'Le jour du rendez-vous' : 'Serez-vous sur place ?'}</div>
            <p style={{ ...muted, margin: '2px 0 10px' }}>Vous pouvez changer d&apos;avis jusqu&apos;à son arrivée.</p>
            <PresenceChoice txId={tx.id} presence={presence} proName={name || undefined} onChange={setPresence} />
            {presence && <p role="status" style={{ background: 'rgba(18,179,156,.12)', color: '#0A6F62', borderRadius: 12, padding: '9px 11px', fontSize: 12.5, fontWeight: 600, margin: 0 }}>Noté : {pn} le voit sur son billet de mission.</p>}
          </>
        )}
        {isBuyer && v48 && !started && !tx.scheduled_at && (
          <><div style={h3}>Rendez-vous à fixer</div><p style={muted}>Fixez d&apos;abord la date et l&apos;adresse dans la conversation.</p></>
        )}
        {isBuyer && v48 && started && (
          <><div style={h3}>La mission a commencé</div><p style={muted}>Votre réponse ne se modifie plus.</p></>
        )}
        {isBuyer && !v48 && (
          <><div style={h3}>Le jour du rendez-vous</div><p style={muted}>Le prestataire scanne votre QR à son arrivée, puis à la fin. Absent ? Laissez un QR sur place.</p></>
        )}
        {isSeller && (
          <>
            <div style={h3}>Le jour du rendez-vous</div>
            {v48 && <div style={{ margin: '6px 0' }}><PresenceTag presence={presence} asSeller /></div>}
            <p style={muted}>
              {!v48 ? 'Vous scannez le QR du client à l’arrivée, puis à la fin.'
                : presence === 'sur_place' ? `${pn} sera sur place : vous scannez son QR à l’arrivée, puis à la fin.`
                  : presence === 'absent' ? `${pn} ne sera pas sur place : photo, position et heure dans la messagerie, puis sa validation ou son code ; à la fin, vous saisissez son code de fin.`
                    : `${pn} n’a pas encore indiqué s’il sera sur place : vous le verrez ici, sur le billet et dans la mission du jour.`}
            </p>
          </>
        )}
      </div>

      {/* Une action principale : la question tant qu'elle n'a pas de réponse, sinon la suite. */}
      {(!isBuyer || !v48 || presence || started || !tx.scheduled_at) && (
        <button style={{ ...primary, marginTop: 14 }} onClick={() => router.push(today ? `/mission/${tx.id}/jour` : isBuyer && !v48 ? `/mission/${tx.id}/qrcodes` : `/mission/${tx.id}/chat`)}>
          {today ? 'Mission du jour' : isBuyer && !v48 ? 'Mes codes QR (arrivée et fin)' : justSet ? 'Revenir à la conversation' : 'Ouvrir la conversation'}
        </button>
      )}
      {isBuyer && !v48 && <button style={linkBtn} onClick={back}>Ouvrir la conversation</button>}
    </Shell>
  )
}

const muted: React.CSSProperties = { fontSize: 13, color: '#4E6470', lineHeight: 1.5, margin: 0 }
const h3: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }
const primary: React.CSSProperties = {
  width: '100%', minHeight: 50, border: 'none', borderRadius: 999, background: '#0C8F7E', color: '#fff',
  fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', marginTop: 12,
}
const linkBtn: React.CSSProperties = { display: 'block', margin: '6px auto 0', minHeight: 44, border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }

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
