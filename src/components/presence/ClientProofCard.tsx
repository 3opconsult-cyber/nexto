"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QrCode from '@/components/QrCode'
import { getMissionProof, type MissionProof, type Phase } from '@/lib/presence'

/**
 * Preuve du client présent : le QR à faire scanner au prestataire, et dessous le code à 6 chiffres à lui
 * dicter si son scanner ne marche pas. Migration 038 : jeton et code à usage unique, 10 min, renouvelés tout
 * seuls (seul le client peut les lire). Sans 038 : ancien QR de la mission (`legacyToken`).
 */
export default function ClientProofCard({ txId, phase, v2, legacyToken }: {
  txId: string; phase: Phase; v2: boolean; legacyToken?: string | null
}) {
  const [proof, setProof] = useState<MissionProof | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!v2) return
    let alive = true
    const supabase = createClient()
    const load = () => getMissionProof(supabase, txId, phase).then(r => {
      if (!alive) return
      if (r.error) setErr(r.error); else { setErr(''); setProof(r.proof) }
    })
    load()
    const iv = setInterval(load, 15000)
    return () => { alive = false; clearInterval(iv) }
  }, [txId, phase, v2])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nexto-eta.vercel.app'
  const path = `${origin}/mission/${txId}/scan/${phase === 'arrivee' ? 'arrival' : 'complete'}?token=`
  const token = v2 ? proof?.token : legacyToken
  const code = v2 ? proof?.code : null

  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>
        {phase === 'arrivee' ? 'Votre QR d’arrivée' : 'Votre QR de fin'}
      </div>
      <p style={{ fontSize: 12, color: '#4E6470', margin: '4px 0 0', lineHeight: 1.5 }}>
        {phase === 'arrivee'
          ? 'Le prestataire le scanne en arrivant : c’est ce qui démarre la mission.'
          : 'Le prestataire le scanne en partant : la durée réelle et la facture en découlent.'}
      </p>
      {token ? (
        <div style={{ width: 196, margin: '12px auto 0', padding: 12, borderRadius: 16, border: '1px solid #DCE5E3', background: '#fff' }}>
          <QrCode data={path + token} size={170} />
        </div>
      ) : (
        <div style={{ padding: '30px 0', fontSize: 12.5, color: '#4E6470' }}>{err || 'Préparation du QR…'}</div>
      )}
      {code && (
        <>
          <div style={{ fontSize: 11, color: '#4E6470', marginTop: 12, fontWeight: 600 }}>Le scan ne passe pas ? Dictez-lui ce code</div>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: 6, color: '#123644', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{code}</div>
        </>
      )}
      {v2 && proof?.expires_at && (
        <div style={{ fontSize: 10.5, color: '#4E6470', marginTop: 6 }}>Usage unique, renouvelé automatiquement. Ne l&apos;envoyez pas à l&apos;avance.</div>
      )}
    </div>
  )
}
