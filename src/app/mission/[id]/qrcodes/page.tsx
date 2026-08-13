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
    <div style={{ minHeight: '100vh', background: '#F3F6F5', padding: '28px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644', textAlign: 'center' }}>Réservation confirmée</h1>
        <p style={{ color: '#6E8592', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 26 }}>
          Deux codes, générés automatiquement pour cette réservation — à scanner à l'arrivée et à la sortie.
        </p>

        <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 18, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', marginBottom: 10 }}>Code d'arrivée</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><QrCode data={arrivalUrl} size={180} /></div>
          <p style={{ fontSize: 11, color: '#6E8592', marginTop: 10 }}>À scanner en arrivant sur place{tx.hourly_rate_cents ? ' — démarre le compteur horaire' : ''}.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 18, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', marginBottom: 10 }}>Code de sortie</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><QrCode data={completeUrl} size={180} /></div>
          <p style={{ fontSize: 11, color: '#6E8592', marginTop: 10 }}>À scanner en partant{tx.hourly_rate_cents ? ' — arrête le compteur, calcule le temps réel' : ''}.</p>
        </div>
      </div>
    </div>
  )
}
