"use client"
import { useEffect, useState } from 'react'
import { AVANCE_IMMEDIATE_ACTIVE } from '@/lib/creditImpot'

const LABEL: Record<string, string> = {
  transmise: 'Transmise à l’Urssaf, en attente de validation du client',
  EN_ATTENTE: 'En attente de validation du client',
  VALIDEE: 'Validée par le client',
  PAYEE: 'Payée par l’Urssaf',
  REFUSEE: 'Refusée',
}

// Avance immédiate sur la facture : le pro transmet, les deux parties suivent le statut.
// Invisible tant que le branchement Urssaf n'est pas activé (NEXT_PUBLIC_AVANCE_IMMEDIATE=1).
export default function AvanceImmediateCard({ transactionId, isSeller }: { transactionId: string; isSeller: boolean }) {
  const [demande, setDemande] = useState<{ statut: string; part_client_cents: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!AVANCE_IMMEDIATE_ACTIVE) return
    fetch(`/api/avance-immediate/demande?transactionId=${transactionId}`).then(r => r.json()).then(j => setDemande(j.demande)).catch(() => {})
  }, [transactionId])

  if (!AVANCE_IMMEDIATE_ACTIVE) return null

  async function send() {
    setBusy(true); setMsg('')
    const r = await fetch('/api/avance-immediate/demande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(j.error || "La transmission n'a pas abouti."); return }
    setDemande({ statut: j.statut, part_client_cents: 0 })
  }

  return (
    <div style={{ marginTop: 16, background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Crédit d&apos;impôt immédiat</div>
      {demande
        ? <p style={{ fontSize: 12.5, color: '#0C8F7E', margin: '6px 0 0', fontWeight: 600 }}>{LABEL[demande.statut] || demande.statut}</p>
        : isSeller
          ? <>
              <p style={{ fontSize: 12, color: '#6E8592', margin: '6px 0 10px', lineHeight: 1.5 }}>Transmettez cette facture à l&apos;Urssaf : votre client ne paiera que 50 %.</p>
              <button onClick={send} disabled={busy} style={{ border: 'none', borderRadius: 999, padding: '10px 18px', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                {busy ? 'Transmission…' : "Transmettre à l'Urssaf"}
              </button>
            </>
          : <p style={{ fontSize: 12, color: '#6E8592', margin: '6px 0 0' }}>Pas encore transmise par le prestataire.</p>}
      {msg && <p style={{ fontSize: 12, color: '#c0503a', margin: '8px 0 0' }}>{msg}</p>}
    </div>
  )
}
