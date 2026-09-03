"use client"
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QrCode from '@/components/QrCode'

export default function MissionQrCodes() {
  const params = useParams<{ id: string }>()
  const [tx, setTx] = useState<any>(null)
  const timer = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()
    function load() {
      supabase.from('transactions').select('*').eq('id', params.id).single()
        .then(({ data }) => setTx(data))
    }
    load()
    // Sondage plutôt qu'un canal realtime : plus simple à garder correct, et
    // largement assez réactif pour un scan qui vient de se produire ailleurs
    // (le prestataire, sur son propre téléphone).
    timer.current = setInterval(load, 4000)
    return () => clearInterval(timer.current)
  }, [params.id])

  if (!tx) return <div style={{ padding: 40, textAlign: 'center', color: '#6E8592' }}>Chargement…</div>

  const base = 'https://nexto-eta.vercel.app'
  const arrivalUrl = `${base}/mission/${tx.id}/scan/arrival?token=${tx.qr_arrival_token}`
  const completeUrl = `${base}/mission/${tx.id}/scan/complete?token=${tx.qr_complete_token}`
  const step = tx.completed_at ? 3 : tx.arrived_at ? 2 : 1

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', padding: '32px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(18,179,156,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21, color: '#123644', textAlign: 'center' }}>Réservation confirmée</h1>
        <p style={{ color: '#6E8592', fontSize: 12.5, textAlign: 'center', marginTop: 4, marginBottom: 4, fontWeight: 700 }}>
          {step < 3 ? `Étape ${step} sur 2` : 'Terminé'}
        </p>
        <p style={{ color: '#6E8592', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 26, lineHeight: 1.5 }}>
          {step === 1 && "Montrez ce code au prestataire à son arrivée."}
          {step === 2 && "Arrivée confirmée. Montrez ce second code au départ."}
          {step === 3 && "Mission terminée — les deux codes ont été scannés."}
        </p>

        {/* Étape 1 : arrivée */}
        {step === 1 && (
          <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 22, textAlign: 'center', boxShadow: '0 2px 10px rgba(18,54,68,.05)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F3F6F5', padding: '4px 11px', borderRadius: 999, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F2A93B' }} />
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5, color: '#123644' }}>Code d'arrivée</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#F3F6F5', borderRadius: 14 }}><QrCode data={arrivalUrl} size={180} /></div>
            <p style={{ fontSize: 11.5, color: '#6E8592', marginTop: 12, lineHeight: 1.4 }}>À scanner en arrivant sur place{tx.hourly_rate_cents ? ' — démarre le compteur horaire' : ''}.</p>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12B39C', animation: 'pulseDot 1.4s ease-in-out infinite' }} />
              En attente du scan…
            </div>
          </div>
        )}

        {/* Étape 2 : arrivée déjà validée, départ à venir */}
        {step >= 2 && (
          <div style={{ background: '#fff', border: step === 2 ? '1px solid #DCE5E3' : '1px solid #DCE5E3', borderRadius: 20, padding: 22, textAlign: 'center', boxShadow: '0 2px 10px rgba(18,54,68,.05)', opacity: step === 3 ? 0.55 : 1 }}>
            {step >= 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14, fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                Arrivée confirmée à {new Date(tx.arrived_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {step === 2 && (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F3F6F5', padding: '4px 11px', borderRadius: 999, marginBottom: 14 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#123644' }} />
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5, color: '#123644' }}>Code de sortie</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 10, background: '#F3F6F5', borderRadius: 14 }}><QrCode data={completeUrl} size={180} /></div>
                <p style={{ fontSize: 11.5, color: '#6E8592', marginTop: 12, lineHeight: 1.4 }}>À scanner en partant{tx.hourly_rate_cents ? ' — arrête le compteur, calcule le temps réel' : ''}.</p>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12B39C', animation: 'pulseDot 1.4s ease-in-out infinite' }} />
                  En attente du scan…
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 24, textAlign: 'center', marginTop: 14 }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 4 }}>
              Sortie confirmée à {new Date(tx.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <a href={`/mission/${tx.id}/chat`} style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#0C8F7E', textDecoration: 'none' }}>Retour à la conversation →</a>
          </div>
        )}
      </div>
      <style>{`@keyframes pulseDot{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  )
}
