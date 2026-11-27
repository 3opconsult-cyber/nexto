"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QrCode from '@/components/QrCode'

// Feuille A4 à imprimer : QR unique d'arrivée du prestataire (voie « client absent »). Aucune adresse ni nom
// n'y figure. Seul le client de la mission peut obtenir le jeton (RPC create_onsite_token).
export default function ImprimerQrSurPlace() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    createClient().rpc('create_onsite_token', { p_transaction: params.id, p_renew: false })
      .then(({ data, error }) => { if (error || !data) setErr(error?.message || 'QR indisponible.'); else setToken(data as string) })
  }, [params.id])

  return (
    <div className="print-root" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
      <style>{`
        @page { size: A4; margin: 18mm; }
        @media print {
          body * { visibility: hidden !important; }
          .print-sheet, .print-sheet * { visibility: visible !important; }
          .print-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 10, padding: 16, justifyContent: 'center' }}>
        <button onClick={() => router.back()} style={{ border: '1.5px solid #DCE5E3', background: '#fff', borderRadius: 999, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Retour</button>
        <button onClick={() => window.print()} disabled={!token} style={{ border: 'none', background: '#123644', color: '#fff', borderRadius: 999, padding: '10px 22px', fontWeight: 700, cursor: token ? 'pointer' : 'default' }}>Imprimer</button>
      </div>
      {err && <p role="alert" style={{ textAlign: 'center', color: '#B3402F' }}>{err}</p>}
      {token && (
        <div className="print-sheet" style={{ maxWidth: 560, margin: '0 auto', padding: '10mm 0', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 28 }}>PING</div>
          <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 26, margin: '18px 0 6px' }}>Arrivée du prestataire</h1>
          <p style={{ fontSize: 16, margin: '0 0 22px' }}>Le client n&apos;est pas présent.</p>
          <div style={{ display: 'inline-block', padding: 14, border: '3px solid #123644', borderRadius: 16 }}>
            <QrCode data={`https://nexto-eta.vercel.app/mission/${params.id}/scan/onsite?token=${token}`} size={320} />
          </div>
          <ol style={{ textAlign: 'left', fontSize: 16, lineHeight: 1.7, maxWidth: 420, margin: '26px auto 0', paddingLeft: 22 }}>
            <li>Ouvrez votre compte prestataire PING.</li>
            <li>Scannez ce QR avec l&apos;appareil photo de votre téléphone.</li>
            <li>Votre arrivée est enregistrée, vous pouvez commencer.</li>
          </ol>
          <p style={{ fontSize: 12.5, color: '#4E6470', marginTop: 24 }}>
            Ce QR est propre à cette mission et à un seul usage. Il ne fonctionne qu&apos;avec le compte du prestataire assigné.
          </p>
        </div>
      )}
    </div>
  )
}
