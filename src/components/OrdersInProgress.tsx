"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'
import { bookingPending, bookingEnded, bookingLapsed } from '@/lib/booking'
import { incidentOpen } from '@/lib/incident'

// « Commandes en cours » (Mon entreprise) / « Mes commandes en cours » (Mon profil) : une ligne par commande,
// son état en un mot, un appui ouvre la conversation (où la commande et la clôture se valident) ou le dossier
// du litige. Lecture seule, sous la RLS du compte ; le nom de l'interlocuteur vient de la RPC
// `transaction_counterparts` (jamais un embed sur profiles). Aucune adresse n'est lue ni affichée ici.

type Etat = 'litige' | 'accepter' | 'attente' | 'valider' | 'place' | 'route' | 'confirmee'
const LABEL: Record<Etat, string> = { litige: 'Litige ouvert', accepter: 'À accepter', attente: 'En attente', valider: 'À valider', place: 'Sur place', route: 'En route', confirmee: 'Confirmée' }
const TONE: Record<Etat, { bg: string; fg: string; dash?: boolean }> = {
  litige: { bg: '#FEE2E2', fg: '#A8432F' },
  accepter: { bg: '#FFF7ED', fg: '#7A5717', dash: true },
  attente: { bg: '#FFF7ED', fg: '#7A5717', dash: true },
  valider: { bg: '#FFF7ED', fg: '#7A5717' },
  place: { bg: 'rgba(18,179,156,.14)', fg: '#0B8374' },
  route: { bg: 'rgba(18,179,156,.14)', fg: '#0B8374' },
  confirmee: { bg: '#EEF2F1', fg: '#123644' },
}
const ORDRE: Etat[] = ['accepter', 'litige', 'attente', 'valider', 'place', 'route', 'confirmee']
const MAX = 3

export function orderState(t: any, role: 'pro' | 'particulier', disputed: boolean): Etat | null {
  if (!t || t.status === 'cancelled' || bookingEnded(t) || bookingLapsed(t)) return null
  if (disputed) return 'litige'
  if (bookingPending(t)) return role === 'pro' ? 'accepter' : 'attente'
  if (t.status === 'completed') return t.completed_at && incidentOpen(t) ? 'valider' : null
  if (t.status === 'arrived') return 'place'
  // Rendez-vous passé depuis plus de 24 h et jamais ouvert : traité dans l'Agenda (« passées sans clôture »), pas ici.
  if (t.status === 'pending' && t.price_confirmed && t.scheduled_at && !t.arrived_at && new Date(t.scheduled_at).getTime() < Date.now() - 24 * 3600e3) return null
  if (t.status === 'pending' && t.price_confirmed) return t.en_route_at ? 'route' : 'confirmee'
  return null // simple conversation, tarif pas encore validé : reste dans Messages
}

export default function OrdersInProgress({ role, title, transactions, topGap = 0 }: { role: 'pro' | 'particulier'; title?: string; transactions?: any[]; topGap?: number }) {
  const router = useRouter()
  const [rows, setRows] = useState<any[] | null>(transactions ?? null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [disputes, setDisputes] = useState<Record<string, string>>({})
  const [all, setAll] = useState(false)

  useEffect(() => {
    if (transactions) { setRows(transactions); return }
    let alive = true
    const supabase = createClient()
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) return
      const col = role === 'pro' ? 'seller_id' : 'buyer_id'
      const { data } = await supabase.from('transactions').select('*, requests(category)').eq(col, uid).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(60)
      if (alive) setRows((data ?? []).filter((t: any) => t.buyer_id !== t.seller_id))
    })()
    return () => { alive = false }
  }, [transactions, role])

  const cands = useMemo(() => (rows ?? []).filter(t => t.status !== 'cancelled' && t.buyer_id !== t.seller_id), [rows])
  const key = cands.map(t => t.id).join(',')
  useEffect(() => {
    if (!key) return
    let alive = true
    const supabase = createClient()
    const ids = key.split(',')
    supabase.from('disputes').select('id, transaction_id').eq('status', 'open').in('transaction_id', ids).then(({ data }) => {
      if (!alive) return
      const m: Record<string, string> = {}
      ;(data ?? []).forEach((d: any) => { m[d.transaction_id] = d.id })
      setDisputes(m)
    })
    supabase.rpc('transaction_counterparts', { p_transaction_ids: ids }).then(({ data }) => {
      if (!alive) return
      const m: Record<string, string> = {}
      ;((data ?? []) as any[]).forEach(r => { if (r.full_name) m[r.transaction_id] = r.full_name })
      setNames(m)
    })
    return () => { alive = false }
  }, [key])

  const list = cands
    .map(t => ({ t, e: orderState(t, role, !!disputes[t.id]) }))
    .filter((x): x is { t: any; e: Etat } => !!x.e)
    .sort((a, b) => ORDRE.indexOf(a.e) - ORDRE.indexOf(b.e) || new Date(a.t.scheduled_at || a.t.created_at).getTime() - new Date(b.t.scheduled_at || b.t.created_at).getTime())
  if (rows === null || list.length === 0) return null
  const shown = all ? list : list.slice(0, MAX)

  const go = (t: any, e: Etat) => router.push(e === 'litige' && disputes[t.id] ? `/litiges/${disputes[t.id]}` : `/mission/${t.id}/chat`)
  const when = (t: any) => {
    if (!t.scheduled_at) return 'Date à fixer'
    const d = new Date(t.scheduled_at)
    return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}`
  }

  return (
    <section data-commandes aria-label={`${title || 'Commandes en cours'} : touchez une commande pour la valider ou la clôturer dans la conversation`} style={{ marginTop: topGap }}>
      <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, lineHeight: 1.3, color: '#123644', margin: '0 0 6px' }}>{title || 'Commandes en cours'}</h2>
      <div>
        {shown.map(({ t, e }, i) => (
          <button key={t.id} type="button" onClick={() => go(t, e)} data-commande-etat={e}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 72, textAlign: 'left', border: 'none', borderTop: i ? '1px solid #EEF2F1' : 'none', background: 'none', padding: '14px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, lineHeight: 1.35, color: '#123644', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[t.id] || (role === 'pro' ? 'Client' : 'Prestataire')}</span>
              <span style={{ display: 'block', fontSize: 15, lineHeight: 1.5, color: '#4E6470', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(TRADES[t.requests?.category] || 'Prestation')} · {when(t)}
              </span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, padding: '6px 12px', borderRadius: 999, flexShrink: 0, background: TONE[e].bg, color: TONE[e].fg, border: 'none' }}>{LABEL[e]}</span>
          </button>
        ))}
      </div>
      {!all && list.length > MAX && (
        <button type="button" onClick={() => setAll(true)}
          style={{ width: '100%', minHeight: 52, marginTop: 8, borderRadius: 14, border: 'none', background: '#E8F6F3', color: '#0B8374', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
          Voir les {list.length - MAX} autres
        </button>
      )}
    </section>
  )
}
