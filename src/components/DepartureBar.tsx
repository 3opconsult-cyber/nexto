"use client"
import { useEffect, useState } from 'react'
import Modal, { Cta } from './Modal'
import { createClient } from '@/lib/supabase/client'

/**
 * Suivi d'arrivée — volontairement sobre.
 *
 * Pas de GPS, pas de position suivie en continu : le prestataire déclare son
 * départ et le temps de trajet qu'il estime, et le client voit un compte à
 * rebours qui se vide. Ça donne l'information utile (« il arrive dans 12 min »)
 * sans pister qui que ce soit, et sans dépendre d'une permission de
 * géolocalisation que la moitié des gens refusent.
 *
 * Deux faces du même composant : le prestataire voit un bouton, le client voit
 * la barre d'approche. L'arrivée reste validée par le code scanné sur place —
 * c'est lui qui fait foi, pas ce compte à rebours.
 */
const ETAS = [5, 10, 15, 20, 30, 45]

export default function DepartureBar({
  tx, userId, onChange,
}: { tx: any; userId: string; onChange: (t: any) => void }) {
  const [ask, setAsk] = useState(false)
  const [eta, setEta] = useState(15)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const isSeller = userId === tx.seller_id
  const enRoute = !!tx.en_route_at && !tx.arrived_at
  const bookable = ['pending', 'held'].includes(tx.status) && !tx.arrived_at

  // Le compte à rebours n'a besoin de battre que pendant l'approche.
  useEffect(() => {
    if (!enRoute) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enRoute])

  async function declareDeparture() {
    setBusy(true)
    const supabase = createClient()
    const at = new Date().toISOString()
    const { data, error } = await supabase.from('transactions')
      .update({ en_route_at: at, eta_minutes: eta }).eq('id', tx.id).select().single()
    if (!error && data) {
      onChange(data)
      await supabase.from('messages').insert({
        transaction_id: tx.id, sender_id: null,
        body: `→ En route — arrivée estimée dans ${eta} min`,
      })
    }
    setBusy(false); setAsk(false)
  }

  // ---------- côté prestataire : annoncer le départ ----------
  if (isSeller && bookable && !tx.en_route_at) {
    return (
      <>
        <div style={{ padding: '10px 16px', background: '#F3F6F5', borderBottom: '1px solid #E7EDEB' }}>
          <button onClick={() => setAsk(true)} style={{
            width: '100%', border: 'none', borderRadius: 999, padding: '11px 0', cursor: 'pointer',
            background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 13.5,
          }}>Je pars maintenant</button>
          <div style={{ fontSize: 10.5, color: '#6E8592', textAlign: 'center', marginTop: 6 }}>
            Le client verra votre heure d'arrivée estimée.
          </div>
        </div>

        <Modal open={ask} onClose={() => setAsk(false)} title="Dans combien de temps arrivez-vous ?">
          <p style={{ fontSize: 13, color: '#6E8592', margin: 0, lineHeight: 1.55 }}>
            Le client verra un compte à rebours. Ce n'est qu'une estimation : c'est le code scanné
            sur place qui déclenchera réellement la mission.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {ETAS.map(m => (
              <button key={m} onClick={() => setEta(m)} aria-pressed={eta === m} style={{
                flex: '1 0 28%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15,
                background: eta === m ? '#12B39C' : '#fff', color: eta === m ? '#fff' : '#123644',
                boxShadow: eta === m ? 'none' : '0 0 0 1px #DCE5E3',
              }}>{m} min</button>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
            <Cta onClick={declareDeparture} disabled={busy}>
              {busy ? 'Envoi…' : `Prévenir le client — ${eta} min`}
            </Cta>
            <Cta variant="ghost" onClick={() => setAsk(false)}>Annuler</Cta>
          </div>
        </Modal>
      </>
    )
  }

  // ---------- côté client : l'approche ----------
  if (!enRoute) return null

  const total = (tx.eta_minutes || 15) * 60_000
  const elapsed = Math.max(0, now - new Date(tx.en_route_at).getTime())
  const left = Math.max(0, total - elapsed)
  const pct = Math.min(100, (elapsed / total) * 100)
  const mins = Math.ceil(left / 60_000)
  const late = left === 0

  return (
    <div style={{ padding: '13px 16px', background: '#123644', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
          {late ? 'Devrait être arrivé' : 'Arrive dans'}
        </span>
        <span style={{
          fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20,
          fontVariantNumeric: 'tabular-nums', color: late ? '#F2A93B' : '#fff',
        }}>{late ? "d'un instant à l'autre" : `${mins} min`}</span>
      </div>

      {/* La barre est le seul mouvement de l'écran : le point avance, rien d'autre. */}
      <div style={{
        position: 'relative', height: 4, borderRadius: 2, marginTop: 11,
        background: 'rgba(255,255,255,.15)', overflow: 'visible',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: '#2FD06E', borderRadius: 2,
          transition: 'width 1s linear',
        }} />
        <span style={{
          position: 'absolute', top: '50%', left: `${pct}%`, width: 11, height: 11,
          marginLeft: -5.5, marginTop: -5.5, borderRadius: '50%', background: '#2FD06E',
          boxShadow: '0 0 0 4px rgba(47,208,110,.25)', transition: 'left 1s linear',
        }} />
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 9, lineHeight: 1.5 }}>
        Estimation annoncée au départ. La mission démarrera au scan du code d'arrivée.
      </div>
    </div>
  )
}
