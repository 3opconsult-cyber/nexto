'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'

// Bandeau « Ouvrir la commande » sous l'en-tête du chat, des deux côtés (maquette v14, écran 4).
// Une ligne : service et rendez-vous ; un litige en cours la passe en ambre (écran 5). « Signaler » reste en haut.
// Lecture seule : ne touche ni missions, ni factures, ni litiges.
const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ChatOrderStrip({ tx, refreshKey }: { tx: any; refreshKey?: string }) {
  const router = useRouter()
  const [disputeOpen, setDisputeOpen] = useState(false)
  useEffect(() => {
    let alive = true
    createClient().from('disputes').select('id, status').eq('transaction_id', tx.id).eq('status', 'open').limit(1)
      .then(({ data, error }) => { if (alive && !error) setDisputeOpen((data ?? []).length > 0) })
    return () => { alive = false }
  }, [tx.id, tx.status, refreshKey])

  const trade = tx.requests?.category ? (TRADES[tx.requests.category] || tx.requests.category) : 'Commande'
  const label = disputeOpen ? 'Litige en cours' : [trade, tx.scheduled_at ? fmt(tx.scheduled_at) : null].filter(Boolean).join(' · ')
  return (
    <button type="button" data-order-strip onClick={() => router.push(`/mission/${tx.id}/commande`)}
      aria-label={`Ouvrir la commande : ${label}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 24px)', minHeight: 44, margin: '8px 12px 0', padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
        borderRadius: 14, border: `1px solid ${disputeOpen ? '#F3DDB5' : '#E3EAE8'}`, background: disputeOpen ? '#FFF7ED' : '#fff', color: disputeOpen ? '#8A6520' : '#123644',
        font: '600 12.5px Inter, sans-serif' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: 700, color: disputeOpen ? '#8A6520' : '#0B8374', whiteSpace: 'nowrap' }}>Ouvrir ›</span>
    </button>
  )
}
