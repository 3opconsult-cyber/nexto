"use client"
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'

export default function ScanQR() {
  const params = useParams<{ id: string; phase: string }>()
  const search = useSearchParams()
  const token = search.get('token') || ''
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [message, setMessage] = useState('Vérification du code…')
  const [duration, setDuration] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const supabase = createClient()
      const { data: tx } = await supabase.from('transactions').select('*').eq('id', params.id).single()

      if (!tx) { setStatus('error'); setMessage('Mission introuvable.'); return }

      const isArrival = params.phase === 'arrival'
      const expectedToken = isArrival ? tx.qr_arrival_token : tx.qr_complete_token

      if (token !== expectedToken) {
        setStatus('error'); setMessage('Code invalide ou déjà utilisé.'); return
      }

      if (isArrival) {
        if (tx.arrived_at) { setStatus('ok'); setMessage('Arrivée déjà enregistrée.'); return }
        await supabase.from('transactions').update({ arrived_at: new Date().toISOString(), status: 'arrived' }).eq('id', tx.id)
        setStatus('ok'); setMessage('Arrivée validée.')
        if (tx.hourly_rate_cents) setMessage(m => m + ' Le temps commence à courir.')
        trackEvent('qr_scan_arrival', { transaction_id: tx.id })
      } else {
        if (!tx.arrived_at) { setStatus('error'); setMessage("L'arrivée n'a pas encore été scannée — impossible de clôturer."); return }
        if (tx.completed_at) { setStatus('ok'); setMessage('Sortie déjà enregistrée.'); return }
        const now = new Date()
        await supabase.from('transactions').update({ completed_at: now.toISOString(), status: 'completed' }).eq('id', tx.id)

        const mins = Math.max(0, Math.round((now.getTime() - new Date(tx.arrived_at).getTime()) / 60000))
        const h = Math.floor(mins / 60), m = mins % 60
        setDuration(`${h > 0 ? h + ' h ' : ''}${m} min`)
        setStatus('ok'); setMessage('Sortie validée.')
        trackEvent('qr_scan_complete', { transaction_id: tx.id, duration_minutes: mins })
      }
    }
    run()
  }, [params.id, params.phase, token])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          background: status === 'ok' ? 'rgba(18,179,156,.12)' : status === 'error' ? 'rgba(255,122,102,.12)' : '#F3F6F5',
        }}>
          {status === 'ok' ? '✓' : status === 'error' ? '✕' : '…'}
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644' }}>{message}</h1>
        {duration && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#F3F6F5' }}>
            <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600 }}>Durée réelle de la prestation</div>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#123644', marginTop: 2 }}>{duration}</div>
            <div style={{ fontSize: 10.5, color: '#6E8592', marginTop: 4 }}>Ce relevé fait foi en cas de litige.</div>
          </div>
        )}
      </div>
    </div>
  )
}
