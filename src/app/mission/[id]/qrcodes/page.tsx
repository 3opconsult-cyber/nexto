"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QrCode from '@/components/QrCode'

export default function MissionQrCodes() {
  const params = useParams<{ id: string }>()
  const [tx, setTx] = useState<any>(null)

  useEffect(() => {
    createClient().from('transactions').select('*').eq('id', params.id).single()
      .then(({ data }) => setTx(data))
  }, [params.id])

  if (!tx) return <div style={{ padding: 40, textAlign: 'center', color: '#6E8592' }}>Chargement…</div>

  const base = 'https://nexto-eta.vercel.app'
  const arrivalUrl = `${base}/mission/${tx.id}/scan/arrival?token=${tx.qr_arrival_token}`
  const completeUrl = `${base}/mission/${tx.id}/scan/complete?token=${tx.qr_complete_token}`

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', padding: '32px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(18,179,156,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', textAlign: 'center' }}>Réservation confirmée</h1>
        <p style={{ color: '#6E8592', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 28, lineHeight: 1.5 }}>
          Deux codes, générés automatiquement pour cette réservation — à scanner à l'arrivée et à la sortie.
        </p>

        <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 22, marginBottom: 14, textAlign: 'center', boxShadow: '0 2px 10px rgba(18,54,68,.05)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F3F6F5', padding: '4px 11px', borderRadius: 999, marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12B39C' }} />
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5, color: '#123644' }}>Code d'arrivée</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#F3F6F5', borderRadius: 14 }}><QrCode data={arrivalUrl} size={180} /></div>
          <p style={{ fontSize: 11.5, color: '#6E8592', marginTop: 12, lineHeight: 1.4 }}>À scanner en arrivant sur place{tx.hourly_rate_cents ? ' — démarre le compteur horaire' : ''}.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 22, textAlign: 'center', boxShadow: '0 2px 10px rgba(18,54,68,.05)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F3F6F5', padding: '4px 11px', borderRadius: 999, marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#123644' }} />
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5, color: '#123644' }}>Code de sortie</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#F3F6F5', borderRadius: 14 }}><QrCode data={completeUrl} size={180} /></div>
          <p style={{ fontSize: 11.5, color: '#6E8592', marginTop: 12, lineHeight: 1.4 }}>À scanner en partant{tx.hourly_rate_cents ? ' — arrête le compteur, calcule le temps réel' : ''}.</p>
        </div>
      </div>
    </div>
  )
}
