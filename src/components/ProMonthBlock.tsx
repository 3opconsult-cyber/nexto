"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchRequestsNearby } from '@/lib/services'
import { EUR } from '@/lib/invoice-pdf'

// « Mon activité du mois » (écran p_dash de la démo) : chiffres du mois, prochains rendez-vous,
// demandes près de vous, alerte litige. Rien d'inventé : « — » ou un état calme quand il n'y a pas de donnée.
// Lecture seule (transactions / messages ne sont jamais écrits depuis ici).

const DONE = ['completed', 'released']
const UPCOMING = ['pending', 'held', 'arrived']

type Props = {
  pro: { id: string; rating?: number | null; reviews_count?: number | null; lat?: number | null; lng?: number | null }
  transactions: any[] // missions vendues par ce pro (déjà chargées par la page)
}

function when(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${day} · ${hm}`
}

export default function ProMonthBlock({ pro, transactions }: Props) {
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
    if (allKey) {
      supabase.from('disputes').select('id, transaction_id').eq('status', 'open').in('transaction_id', allKey.split(',')).then(({ data }) => {
        if (!alive) return
        setDispute(data && data.length ? { id: data[0].id, count: data.length } : null)
      })
    }
    return () => { alive = false }
  }, [nextKey, allKey])

  useEffect(() => {
    let alive = true
    if (pro.lat != null && pro.lng != null) {
      fetchRequestsNearby(pro.lat, pro.lng).then(r => { if (alive) setNearby(r.length) }).catch(() => {})
    }
    return () => { alive = false }
  }, [pro.lat, pro.lng])

  const reviews = pro.reviews_count || 0
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 13 }
  const big: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, color: '#123644', fontSize: 20 }
  const lab: React.CSSProperties = { fontSize: 11, color: '#4E6470', marginTop: 2 }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px 2px' }}>Mon activité du mois</div>

      {dispute && (
        <div onClick={() => router.push(`/litiges/${dispute.id}`)} role="button"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', cursor: 'pointer', marginBottom: 9 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0503A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 2 2 21h20z" /><path d="M12 9v5M12 18h.01" /></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#C0503A' }}>
              {dispute.count > 1 ? `${dispute.count} litiges ouverts` : 'Un litige est ouvert'} sur vos missions
            </div>
            <div style={{ fontSize: 11.5, color: '#C0503A', marginTop: 2 }}>Répondez dans le dossier pour que PING puisse trancher.</div>
          </div>
          <span style={{ color: '#C0503A' }}>›</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <div style={card}>
          <div style={big}>{doneThisMonth.length ? EUR(revenueCents) : '—'}</div>
          <div style={lab}>Chiffre d&apos;affaires du mois (net)</div>
        </div>
        <div style={card}>
          <div style={big}>{doneThisMonth.length || '—'}</div>
          <div style={lab}>Intervention{doneThisMonth.length > 1 ? 's' : ''} terminée{doneThisMonth.length > 1 ? 's' : ''} ce mois</div>
        </div>
        <div style={card}>
          <div style={big}>{reviews && pro.rating ? `${Number(pro.rating).toFixed(1).replace('.', ',')} ★` : '—'}</div>
          <div style={lab}>{reviews ? `Note moyenne · ${reviews} avis` : 'Pas encore d’avis'}</div>
        </div>
        <div onClick={() => router.push('/pro/carte')} role="button" style={{ ...card, cursor: 'pointer' }}>
          <div style={big}>{nearby != null ? nearby : '—'}</div>
          <div style={lab}>
            {nearby == null ? 'Demandes près de vous' : nearby === 0 ? 'Aucune demande près de vous' : `Demande${nearby > 1 ? 's' : ''} près de vous`}
            {nearby != null && nearby > 0 && <span style={{ color: '#0C8F7E', fontWeight: 700 }}> · voir ›</span>}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, overflow: 'hidden', marginTop: 9 }}>
        <div style={{ padding: '11px 14px', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Prochains rendez-vous</div>
        {next.length === 0 ? (
          <div style={{ padding: '2px 14px 14px', fontSize: 12.5, color: '#4E6470' }}>Aucun rendez-vous confirmé pour le moment.</div>
        ) : next.map(t => (
          <div key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)} role="button"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: '1px solid #EEF2F1', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#123644', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[t.id] || 'Client'}</div>
              <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{when(t.scheduled_at)}</div>
            </div>
            <span style={{ color: '#6E8592' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
