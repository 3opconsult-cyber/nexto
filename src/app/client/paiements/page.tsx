"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BackHeader from '@/components/BackHeader'
import { EUR } from '@/lib/invoice-pdf'
import '../../aere.css'
import { TRANSFER_STATUS, transferDue, transferState, type Transfer } from '@/lib/transfers'

// Écran « Paiements » du particulier (maquette : Comment vous payez / À régler / Réglé / Pourboires annoncés).
// Alimenté par les virements existants (transfer_payments, payer_role = client) : aucun calcul ni règle de
// paiement nouveau. Séquestre éteint : le client vire la prestation au prestataire et ses frais à PING.
const dShort = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export default function ClientPaiements() {
  const router = useRouter()
  const [rows, setRows] = useState<Transfer[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [showAllDue, setShowAllDue] = useState(false)
  const [tips, setTips] = useState<Array<{ transaction_id: string; tip_cents: number }>>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('transfer_payments').select('*').eq('payer_id', user.id).eq('payer_role', 'client').order('due_at')
      const list = (data ?? []) as Transfer[]
      setRows(list)
      const { data: rv } = await supabase.from('reviews').select('transaction_id, tip_cents').eq('rater_id', user.id).gt('tip_cents', 0)
      const tp = (rv ?? []) as Array<{ transaction_id: string; tip_cents: number }>
      setTips(tp)
      const ids = Array.from(new Set([...list.map(t => t.transaction_id), ...tp.map(t => t.transaction_id)]))
      if (ids.length) {
        const { data: nrows } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: ids })
        const map: Record<string, string> = {}
        ;(nrows ?? []).forEach((r: any) => { if (r.full_name) map[r.transaction_id] = r.full_name })
        setNames(map)
      }
    }
    load()
  }, [router])

  const due = (rows ?? []).filter(t => t.status !== 'recu')
  const done = (rows ?? []).filter(t => t.status === 'recu')
  const who = (t: Transfer) => t.payee === 'ping' ? 'PING' : names[t.transaction_id] || 'Prestataire'
  const go = (t: Transfer) => router.push(`/mission/${t.transaction_id}/facture`)

  const LIMIT = 5
  const shownDue = showAllDue ? due : due.slice(0, LIMIT)
  const line = (t: Transfer, i: number, isDue: boolean) => {
    const s = transferState(t)
    const late = s === 'en_retard'
    const open = s === 'a_payer' || late
    const st = isDue ? TRANSFER_STATUS[s] : TRANSFER_STATUS.recu
    return (
      <div key={t.id} className="a-row" onClick={() => go(t)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') go(t) }} style={{ alignItems: 'flex-start', padding: '20px 0' }}>
        <span className="a-tx">
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <b className="a-t" style={{ overflowWrap: 'anywhere' }}>{t.reference}</b>
            <b className="a-money" style={{ fontSize: 18 }}>{EUR(transferDue(t))}</b>
          </span>
          <span className="a-s">{who(t)}{isDue ? ` · ${t.payee === 'ping' ? 'frais de service, à PING' : 'prestation, au prestataire'} · ${t.suspended_at ? 'suspendu : litige ouvert' : `avant le ${dShort(t.due_at)}`}` : ''}</span>
          {isDue && open && !t.suspended_at
            ? <span className="a-pill" style={{ marginTop: 10, background: late ? 'rgba(178,67,46,.12)' : 'rgba(11,131,116,.12)', color: late ? '#9A3722' : '#0B6F63' }}>{late ? 'En retard · régler' : 'Régler'}</span>
            : <span className="a-pill" style={{ marginTop: 10, background: st.bg, color: st.fg }}>{st.t}</span>}
        </span>
      </div>
    )
  }

  return (
    <div className="aere" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      <BackHeader title="Paiements" fallback="/client/profil" />
      <div className="a-page">
        {/* Bloc 1 : la question du jour : qu'ai-je à régler ? */}
        <div className="a-block">
          <h2 className="a-title">À régler</h2>
          <p className="a-info">
            {rows === null ? 'Chargement…' : due.length === 0 ? 'Rien à régler.' : `${due.length} virement${due.length > 1 ? 's' : ''} à faire, le plus ancien d’abord.`}
          </p>
        </div>

        {/* Bloc 2 : la liste, aérée, sans cadre. */}
        {due.length > 0 && (
          <div className="a-block">
            <div className="a-list">{shownDue.map((t, i) => line(t, i, true))}</div>
            {!showAllDue && due.length > LIMIT && <button type="button" className="a-btn sec" onClick={() => setShowAllDue(true)}>Voir les {due.length - LIMIT} autres</button>}
          </div>
        )}

        {tips.length > 0 && (
          <div className="a-block">
            <h2 className="a-h2">Pourboires annoncés</h2>
            <div className="a-list">
              {tips.map((t, i) => (
                <div key={t.transaction_id + i} className="a-row" style={{ cursor: 'default', alignItems: 'flex-start', padding: '20px 0' }}>
                  <span className="a-tx">
                    <b className="a-t">{EUR(t.tip_cents)} pour {names[t.transaction_id] || 'le prestataire'}</b>
                    <span className="a-s">intention, non prélevée : le paiement en ligne n&apos;est pas encore ouvert, remettez-le directement</span>
                    <span className="a-pill" style={{ marginTop: 10, background: '#EEF2F1', color: '#4E6470' }}>Annoncé</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Le secondaire reste derrière « Voir plus » : explication du mode de paiement, puis ce qui est déjà réglé. */}
        <details className="a-more a-block">
          <summary>Comment vous payez</summary>
          <p className="a-info" style={{ marginTop: 8 }}>Vous virez la prestation directement au prestataire, avec la référence de la facture. Vos frais de service sont virés à PING. Le paiement en ligne n&apos;est pas encore branché.</p>
        </details>

        <details className="a-more a-block">
          <summary>Réglé{rows !== null && done.length > 0 ? ` (${done.length})` : ''}</summary>
          {rows !== null && done.length === 0 && <p className="a-info" style={{ marginTop: 8 }}>Aucun règlement pour l&apos;instant.</p>}
          <div className="a-list">{done.map((t, i) => line(t, i, false))}</div>
        </details>
      </div>
    </div>
  )
}
