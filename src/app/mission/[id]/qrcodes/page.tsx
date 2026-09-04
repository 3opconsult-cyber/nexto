"use client"
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QrCode from '@/components/QrCode'

export default function MissionQrCodes() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [tx, setTx] = useState<any>(null)
  const timer = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()
    function load() {
      supabase.from('transactions').select('*').eq('id', params.id).single()
        .then(({ data }) => setTx(data))
    }
    load()
    timer.current = setInterval(load, 4000)
    return () => clearInterval(timer.current)
  }, [params.id])

  if (!tx) return (
    <div className="ping-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6E8592', fontFamily: 'var(--fh)', fontSize: 15 }}>Chargement…</div>
    </div>
  )

  const base = 'https://nexto-eta.vercel.app'
  const arrivalUrl = `${base}/mission/${tx.id}/scan/arrival?token=${tx.qr_arrival_token}`
  const completeUrl = `${base}/mission/${tx.id}/scan/complete?token=${tx.qr_complete_token}`
  const step = tx.completed_at ? 3 : tx.arrived_at ? 2 : 1
  const fmt = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="ping-screen">
      <div className="ping-appbar">
        <div className="ic" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer' }} onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <b>{step === 3 ? 'Prestation terminée' : step === 2 ? 'Valider le départ' : "Valider l'arrivée"}</b>
      </div>

      <div className="ping-body pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {step < 3 && (
          <>
            <div className="ping-h1" style={{ textAlign: 'center', marginTop: 8 }}>
              {step === 1 ? "Montrez ce QR au prestataire" : "QR de fin de prestation"}
            </div>
            <p className="ping-sub" style={{ textAlign: 'center', maxWidth: '30ch' }}>
              Étape {step} sur 2 — {step === 1 ? "enregistre l'heure d'arrivée. Le paiement reste sous séquestre." : "libère le paiement une fois la prestation faite."}
            </p>

            <div className="ping-qr">
              <QrCode data={step === 1 ? arrivalUrl : completeUrl} size={150} />
            </div>

            <div className="ping-card" style={{ width: '100%', marginTop: 14 }}>
              <div className="ping-lrow">
                <span className="s">Arrivée</span>
                <span className="v" style={{ color: tx.arrived_at ? 'var(--tealD)' : 'var(--slate)' }}>
                  {tx.arrived_at ? `validée · ${fmt(tx.arrived_at)}` : 'en attente de scan'}
                </span>
              </div>
              <div className="ping-lrow">
                <span className="s">Départ</span>
                <span className="v" style={{ color: tx.completed_at ? 'var(--tealD)' : 'var(--slate)' }}>
                  {tx.completed_at ? `validé · ${fmt(tx.completed_at)}` : (step === 2 ? 'en attente de scan' : '—')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', animation: 'pingPulse 1.4s ease-in-out infinite' }} />
              En attente du scan…
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ping-success" style={{ marginTop: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div className="ping-h1" style={{ textAlign: 'center' }}>Prestation terminée</div>
            <p className="ping-sub" style={{ textAlign: 'center' }}>
              Arrivée {fmt(tx.arrived_at)} · départ {fmt(tx.completed_at)}
            </p>
            <button className="ping-btn" style={{ marginTop: 20 }} onClick={() => router.push(`/mission/${tx.id}/chat`)}>Retour à la conversation</button>
          </>
        )}
      </div>
    </div>
  )
}
