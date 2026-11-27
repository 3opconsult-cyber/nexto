"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { countProNearby } from '@/lib/proNearby'
import { EUR } from '@/lib/invoice-pdf'

// « Mon activité du mois » (écran p_dash de la démo) : chiffres du mois, prochains rendez-vous,
// demandes près de vous, alerte litige. Rien d'inventé : « — » ou un état calme quand il n'y a pas de donnée.
// Lecture seule (transactions / messages ne sont jamais écrits depuis ici).

const DONE = ['completed', 'released']
const UPCOMING = ['pending', 'held', 'arrived']

type Props = {
  pro: { id: string; rating?: number | null; reviews_count?: number | null; lat?: number | null; lng?: number | null; trade?: string | null; service_radius_km?: number | null }
  transactions: any[] // missions vendues par ce pro (déjà chargées par la page)
  /** L'alerte litige est alors affichée plus haut par <ProDisputeAlert /> (ordre de la maquette). */
  hideDispute?: boolean
}

/** Alerte litige ouvert (même texte et même lien que dans le bloc du mois), placée sous la fiche comme la maquette. */
export function ProDisputeAlert({ transactions, compact = false }: { transactions: any[]; compact?: boolean }) {
  const router = useRouter()
  const [dispute, setDispute] = useState<{ id: string; count: number } | null>(null)
  const allKey = transactions.map(t => t.id).join(',')
  useEffect(() => {
    if (!allKey) return
    let alive = true
    createClient().from('disputes').select('id, transaction_id').eq('status', 'open').in('transaction_id', allKey.split(',')).then(({ data }) => {
      if (alive) setDispute(data && data.length ? { id: data[0].id, count: data.length } : null)
    })
    return () => { alive = false }
  }, [allKey])
  if (!dispute) return null
  return (
    <div onClick={() => router.push(`/litiges/${dispute.id}`)} role="button"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', minHeight: 44, borderRadius: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', cursor: 'pointer' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B3402F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 2 2 21h20z" /><path d="M12 9v5M12 18h.01" /></svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#B3402F' }}>
          {dispute.count > 1 ? `${dispute.count} litiges ouverts` : 'Un litige est ouvert'}{compact ? ' : répondre' : ' sur vos missions'}
        </div>
        {!compact && <div style={{ fontSize: 11.5, color: '#B3402F', marginTop: 2 }}>Répondez dans le dossier pour que PING puisse trancher.</div>}
      </div>
      <span style={{ color: '#B3402F' }}>›</span>
    </div>
  )
}

function when(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${day} · ${hm}`
}

export default function ProMonthBlock({ pro, transactions, hideDispute }: Props) {
  const router = useRouter()
  const [names, setNames] = useState<Record<string, string>>({})
  const [nearby, setNearby] = useState<number | null>(null) // null = inconnu / pas de position
  const [dispute, setDispute] = useState<{ id: string; count: number } | null>(null)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const doneThisMonth = transactions.filter(t => {
    if (!DONE.includes(t.status)) return false
    const ts = new Date(t.completed_at || t.created_at).getTime()
    return ts >= monthStart && ts < monthEnd
  })
  const revenueCents = doneThisMonth.reduce((s, t) => s + (t.payout_cents || 0), 0)
  const next = transactions
    .filter(t => UPCOMING.includes(t.status) && t.price_confirmed && t.scheduled_at && new Date(t.scheduled_at).getTime() >= Date.now() - 2 * 3600e3)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 3)
  const nextKey = next.map(t => t.id).join(',')
  const allKey = transactions.map(t => t.id).join(',')

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    if (nextKey) {
      supabase.rpc('transaction_counterparts', { p_transaction_ids: nextKey.split(',') }).then(({ data }) => {
        if (!alive) return
        const m: Record<string, string> = {}
        ;(data ?? []).forEach((r: any) => { if (r.full_name) m[r.transaction_id] = r.full_name })
        setNames(m)
      })
    }
    if (allKey && !hideDispute) {
      supabase.from('disputes').select('id, transaction_id').eq('status', 'open').in('transaction_id', allKey.split(',')).then(({ data }) => {
        if (!alive) return
        setDispute(data && data.length ? { id: data[0].id, count: data.length } : null)
      })
    }
    return () => { alive = false }
  }, [nextKey, allKey, hideDispute])

  useEffect(() => {
    let alive = true
    // Même centre, même rayon et mêmes métiers que la carte « Demandes autour de moi ».
    countProNearby(pro).then(n => { if (alive) setNearby(n) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pro.id, pro.lat, pro.lng, pro.trade, pro.service_radius_km])

  const reviews = pro.reviews_count || 0
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '10px 12px' }
  const big: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, color: '#123644', fontSize: 18 }
  const lab: React.CSSProperties = { fontSize: 11, color: '#4E6470', marginTop: 2 }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px 2px' }}>Mon activité du mois</div>

      {dispute && !hideDispute && (
        <div onClick={() => router.push(`/litiges/${dispute.id}`)} role="button"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', cursor: 'pointer', marginBottom: 9 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B3402F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 2 2 21h20z" /><path d="M12 9v5M12 18h.01" /></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#B3402F' }}>
              {dispute.count > 1 ? `${dispute.count} litiges ouverts` : 'Un litige est ouvert'} sur vos missions
            </div>
            <div style={{ fontSize: 11.5, color: '#B3402F', marginTop: 2 }}>Répondez dans le dossier pour que PING puisse trancher.</div>
          </div>
          <span style={{ color: '#B3402F' }}>›</span>
        </div>
      )}

      {/* Une seule carte : quatre chiffres (2 x 2) et le prochain rendez-vous. L'accès aux demandes est le premier onglet de la barre
          du bas, la liste des rendez-vous et chaque mission sont dans l'onglet Agenda. */}
      <div style={{ ...card, padding: '10px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
          <div>
            <div style={big}>{doneThisMonth.length ? EUR(revenueCents) : '—'}</div>
            <div style={lab}>Chiffre d&apos;affaires (net)</div>
          </div>
          <div>
            <div style={big}>{doneThisMonth.length || '—'}</div>
            <div style={lab}>Intervention{doneThisMonth.length > 1 ? 's' : ''}</div>
          </div>
          <div>
            <div style={big}>{reviews && pro.rating ? `${Number(pro.rating).toFixed(1).replace('.', ',')} ★` : '—'}</div>
            <div style={lab}>{reviews ? `${reviews} avis` : 'Pas encore d’avis'}</div>
          </div>
          <div>
            <div style={big}>{nearby != null ? nearby : '—'}</div>
            <div style={lab}>{nearby === 0 ? 'Aucune demande proche' : `Demande${nearby != null && nearby > 1 ? 's' : ''} proche${nearby != null && nearby > 1 ? 's' : ''}`}</div>
          </div>
        </div>
        {next.length === 0
          ? <div style={{ borderTop: '1px solid #EEF2F1', marginTop: 10, paddingTop: 8, fontSize: 12.5, color: '#4E6470' }}>Aucun rendez-vous confirmé pour le moment.</div>
          : <button type="button" onClick={() => router.push('/agenda')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, border: 'none', borderTop: '1px solid #EEF2F1', marginTop: 10, background: 'none', padding: '8px 0 0', fontSize: 12.5, color: '#4E6470', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ flex: 1 }}><b style={{ color: '#123644' }}>Prochain</b> : {names[next[0].id] || 'Client'} · {when(next[0].scheduled_at)}{next.length > 1 ? ` (+${next.length - 1})` : ''}</span>
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M9 6l6 6-6 6" /></svg>
            </button>}
      </div>
    </div>
  )
}
