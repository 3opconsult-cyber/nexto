"use client"
import { useEffect, useState } from 'react'

// Séquestre — vue OpConsult. Règle antifraude : l'argent ne sort du séquestre que sur décision de PING
// (versement automatique par la règle des 24 h, ou bouton ci-dessous ; remboursement par un admin).
type Mission = {
  id: string; status: string; payment_status: string; payment_provider: string | null
  total_charged_cents: number | null; payout_cents: number | null; payeCents: number
  completed_at: string | null; en_route_at: string | null; arrived_at: string | null
  litige: boolean; alerte: string | null
}
type Data = {
  reglage: { choisi: string | null; actif: string | null; cleService: boolean; cron: boolean; prestataires: Array<{ nom: string; label: string; cles: boolean }> }
  auto?: boolean; delaiHeures?: number; missions: Mission[]; error?: string
}

const eur = (c: number | null) => ((c ?? 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const STATUT: Record<string, string> = { held: 'Bloqué (payé)', complement_due: 'Complément dû', awaiting: 'Paiement en attente', failed: 'Paiement refusé' }
const btn = (bg: string) => ({ border: 'none', borderRadius: 999, padding: '7px 14px', background: bg, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' })

export default function AdminPaiementsPage() {
  const [d, setD] = useState<Data | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const r = await fetch('/api/payments/admin')
    setD(await r.json().catch(() => null))
  }
  useEffect(() => { load() }, [])

  async function act(path: string, body: Record<string, unknown>, confirmText: string) {
    if (!confirm(confirmText)) return
    setBusy(String(body.transactionId)); setMsg('')
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? JSON.stringify(j) : (j.error || 'Échec'))
    setBusy('')
    load()
  }

  function refund(m: Mission) {
    const v = prompt(`Montant à rembourser au client (en €, payé : ${eur(m.payeCents)}). Laisser vide = tout.`, '')
    if (v === null) return
    const cents = v.trim() ? Math.round(Number(v.replace(',', '.')) * 100) : undefined
    if (cents !== undefined && !(cents > 0)) { setMsg('Montant invalide'); return }
    act('/api/payments/refund', { transactionId: m.id, montantCents: cents, motif: 'Décision PING' }, `Rembourser ${cents ? eur(cents) : 'la totalité'} au client ?`)
  }

  const box = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 16, marginBottom: 14 }
  if (!d) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#4E6470' }}>Chargement…</div>
  if (d.error) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#c0503a' }}>{d.error}</div>
  const r = d.reglage

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 24, margin: '0 0 4px' }}>Séquestre</h1>
        <p style={{ fontSize: 13, color: '#4E6470', margin: '0 0 18px' }}>
          L&apos;argent des clients reste chez le partenaire de paiement. Il n&apos;en sort que sur décision de PING :
          {d.auto === false ? ' versement manuel, mission par mission (mode « manuel »).' : ` versement automatique ${d.delaiHeures ?? 24} h après la fin sans litige, ou manuel ci-dessous.`}
        </p>

        <div style={box}>
          <b style={{ fontFamily: 'Quicksand, sans-serif' }}>Réglage {r.actif ? <span style={{ color: '#0C8F7E' }}>· actif ({r.actif})</span> : <span style={{ color: '#9A6712' }}>· éteint</span>}</b>
          <ul style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.8, margin: '8px 0 0', paddingLeft: 18 }}>
            <li>PAYMENT_PROVIDER : {r.choisi || 'non choisi'}</li>
            {r.prestataires.map(p => <li key={p.nom}>{p.label} : clés {p.cles ? 'renseignées' : 'absentes'}</li>)}
            <li>SUPABASE_SERVICE_ROLE_KEY : {r.cleService ? 'renseignée' : 'absente'}</li>
            <li>CRON_SECRET : {r.cron ? 'renseigné' : 'absent'}</li>
          </ul>
        </div>

        {msg && <div style={{ ...box, fontSize: 12, color: '#4E6470', wordBreak: 'break-all' }}>{msg}</div>}

        {r.actif && (d.missions.length === 0 ? (
          <div style={box}><span style={{ fontSize: 13, color: '#4E6470' }}>Aucun argent bloqué en ce moment.</span></div>
        ) : d.missions.map(m => (
          <div key={m.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <b style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.id.slice(0, 8).toUpperCase()}</b>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.alerte || m.litige ? '#c0503a' : '#0C8F7E' }}>
                {STATUT[m.payment_status] || m.payment_status}{m.litige ? ' · litige ouvert' : ''}{m.status === 'cancelled' ? ' · annulée' : ''}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#4E6470', marginTop: 6, lineHeight: 1.6 }}>
              Payé {eur(m.payeCents)} · total {eur(m.total_charged_cents)} · part prestataire {eur(m.payout_cents)}
              {' · '}{m.completed_at ? `terminée le ${new Date(m.completed_at).toLocaleString('fr-FR')}` : m.arrived_at ? 'en cours' : m.en_route_at ? 'prestataire en route' : 'à venir'}
              {m.alerte && <div style={{ color: '#c0503a', fontWeight: 600 }}>Alerte : {m.alerte}</div>}
            </div>
            {m.payeCents > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {(m.completed_at || m.status === 'cancelled') && !m.litige && (
                  <button disabled={busy === m.id} style={btn('#12B39C')}
                    onClick={() => act('/api/payments/release', { transactionId: m.id, immediat: true },
                      m.status === 'cancelled' ? `Verser ${eur(m.payeCents)} (frais d'annulation) au prestataire ?` : `Verser ${eur(m.payout_cents)} au prestataire maintenant ?`)}>
                    Verser au prestataire
                  </button>
                )}
                <button disabled={busy === m.id} style={btn('#123644')} onClick={() => refund(m)}>Rembourser le client</button>
              </div>
            )}
          </div>
        )))}
      </div>
    </div>
  )
}
