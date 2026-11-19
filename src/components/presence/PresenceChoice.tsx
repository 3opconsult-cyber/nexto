"use client"
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyOther } from '@/lib/notify'
import { setClientPresence, type ClientPresence } from '@/lib/presence'

/**
 * Client, juste après la commande (migration 048) : « Je serai sur place » / « Je ne serai pas sur place ».
 * Un appui. Modifiable jusqu'à l'arrivée du prestataire, qui voit la réponse sur son billet de mission.
 * `compact` : deux boutons côte à côte (billet du chat) ; sinon deux grandes cartes avec ce qui se passera.
 * `toggle` (audit ergonomie 19/11, correction 12) : une réponse est déjà donnée ; la réponse courante et un
 * seul bouton « Changer ma réponse » qui bascule directement sur l'autre choix (1 appui, sans passer par /commande).
 */
export default function PresenceChoice({ txId, presence, proName, onChange, compact = false, toggle = false }: {
  txId: string; presence: ClientPresence | null | undefined; proName?: string; onChange: (p: ClientPresence) => void; compact?: boolean; toggle?: boolean
}) {
  const [busy, setBusy] = useState<ClientPresence | null>(null)
  const [err, setErr] = useState('')
  const who = proName || 'Le prestataire'

  async function choose(p: ClientPresence) {
    if (busy) return
    setBusy(p); setErr('')
    const r = await setClientPresence(createClient(), txId, p)
    setBusy(null)
    if (!r.ok) { setErr(r.message || 'Réponse non enregistrée, réessayez.'); return }
    if (!r.unchanged) notifyOther(txId, 'presence_client')
    onChange(p)
  }

  const opts: { v: ClientPresence; t: string; s: string }[] = [
    { v: 'sur_place', t: 'Je serai sur place', s: `${who} scanne votre QR à l’arrivée, puis à la fin.` },
    { v: 'absent', t: 'Je ne serai pas sur place', s: `${who} vous envoie une photo à son arrivée : vous confirmez d’un appui. À la fin, vous envoyez votre code de fin.` },
  ]

  if (toggle && presence) {
    const next: ClientPresence = presence === 'sur_place' ? 'absent' : 'sur_place'
    const nextLabel = next === 'sur_place' ? 'je serai sur place' : 'je ne serai pas sur place'
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 13, fontWeight: 600, color: '#123644' }}>
            {presence === 'sur_place' ? 'Votre réponse : je serai sur place' : 'Votre réponse : je ne serai pas sur place'}
          </span>
          <button type="button" onClick={() => choose(next)} disabled={!!busy} aria-label={`Changer ma réponse : ${nextLabel}`} style={{
            flexShrink: 0, minHeight: 44, borderRadius: 999, padding: '0 16px', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13,
            border: '1.5px solid #0C8F7E', background: '#fff', color: '#0C8F7E', opacity: busy ? .6 : 1,
          }}>{busy ? 'Enregistrement…' : 'Changer ma réponse'}</button>
        </div>
        <p style={{ fontSize: 11.5, color: '#4E6470', margin: '4px 0 0' }}>Un appui : {nextLabel}. {who} est prévenu.</p>
        {err && <p role="alert" style={{ color: '#B3402F', fontSize: 12, margin: '6px 0 0' }}>{err}</p>}
      </div>
    )
  }

  if (compact) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          {opts.map((o, i) => (
            <button key={o.v} type="button" onClick={() => choose(o.v)} disabled={!!busy} aria-pressed={presence === o.v} style={{
              flex: 1, minHeight: 48, borderRadius: 999, padding: '0 10px', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13,
              border: i === 0 ? 'none' : '1.5px solid #0C8F7E', background: i === 0 ? '#0C8F7E' : '#fff', color: i === 0 ? '#fff' : '#0C8F7E',
              opacity: busy && busy !== o.v ? .6 : 1,
            }}>{busy === o.v ? 'Enregistrement…' : o.t}</button>
          ))}
        </div>
        {err && <p role="alert" style={{ color: '#B3402F', fontSize: 12, margin: '6px 0 0' }}>{err}</p>}
      </div>
    )
  }

  return (
    <div>
      {opts.map(o => {
        const on = presence === o.v
        return (
          <button key={o.v} type="button" onClick={() => choose(o.v)} disabled={!!busy} aria-pressed={on} style={{
            display: 'block', width: '100%', textAlign: 'left', minHeight: 64, padding: '13px 16px', marginBottom: 10, borderRadius: 16, cursor: 'pointer',
            border: on ? '2px solid #0C8F7E' : '1.5px solid #DCE5E3', background: on ? 'rgba(18,179,156,.08)' : '#fff',
          }}>
            <b style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Quicksand, sans-serif', fontSize: 15.5, color: '#123644' }}>
              <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? '#0C8F7E' : '#C5D3CF'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0C8F7E' }} />}
              </span>
              {busy === o.v ? 'Enregistrement…' : o.t}
            </b>
            <span style={{ display: 'block', fontSize: 12.5, color: '#4E6470', lineHeight: 1.45, marginTop: 4, paddingLeft: 28 }}>{o.s}</span>
          </button>
        )
      })}
      {err && <p role="alert" style={{ color: '#B3402F', fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}
    </div>
  )
}
