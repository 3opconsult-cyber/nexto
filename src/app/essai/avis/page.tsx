"use client"
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AXES: { key: 'simplicite' | 'ergonomie' | 'utilite'; label: string }[] = [
  { key: 'simplicite', label: 'Simplicité' },
  { key: 'ergonomie', label: 'Ergonomie' },
  { key: 'utilite', label: 'Utilité' },
]

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }} role="radiogroup">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} role="radio" aria-checked={value === n}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1, fontSize: 30, color: n <= value ? '#F2A93B' : '#DCE5E3' }}>★</button>
      ))}
    </div>
  )
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[{ v: true, label: 'Oui' }, { v: false, label: 'Non' }].map(o => (
        <button key={String(o.v)} type="button" onClick={() => onChange(o.v)}
          style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            border: value === o.v ? '2px solid #12B39C' : '2px solid #E7EDEB',
            background: value === o.v ? 'rgba(18,179,156,.08)' : '#fff', color: value === o.v ? '#0C8F7E' : '#6E8592' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function EssaiAvis() {
  const [role, setRole] = useState<'particulier' | 'pro' | 'les_deux' | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [recommanderait, setRecommanderait] = useState<boolean | null>(null)
  const [utiliserait, setUtiliserait] = useState<boolean | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const complete = role && AXES.every(a => scores[a.key]) && recommanderait !== null && utiliserait !== null

  async function submit() {
    if (!complete) return
    setSending(true)
    setError('')
    const { error: err } = await createClient().from('beta_feedback').insert({
      role,
      simplicite: scores.simplicite,
      ergonomie: scores.ergonomie,
      utilite: scores.utilite,
      recommanderait,
      utiliserait,
      commentaire: commentaire.trim() || null,
    })
    if (err) { setError("Impossible d'envoyer l'avis, réessaie dans un instant."); setSending(false); return }
    setDone(true)
    setSending(false)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#123644', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#fff' }}>Merci&nbsp;!</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 10, maxWidth: 300, lineHeight: 1.5 }}>
          Votre avis est enregistré. Si vous n'avez pas encore invité de proches à tester, c'est le bon moment.
        </p>
        <a href="/essai" style={{ marginTop: 24, padding: '14px 28px', borderRadius: 999, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Revenir à l'écran de partage
        </a>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '26px 24px 90px', maxWidth: 440, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Votre avis sur le test</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 6, lineHeight: 1.5 }}>
          Une minute, c'est tout ce qu'il faut — soyez franc, c'est fait pour ça.
        </p>

        <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginTop: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 8 }}>Vous avez testé en tant que…</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{ v: 'particulier', l: 'Particulier' }, { v: 'pro', l: 'Pro' }, { v: 'les_deux', l: 'Les deux' }].map(o => (
              <button key={o.v} type="button" onClick={() => setRole(o.v as any)}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 12, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                  border: role === o.v ? '2px solid #12B39C' : '2px solid #E7EDEB',
                  background: role === o.v ? 'rgba(18,179,156,.08)' : '#fff', color: role === o.v ? '#0C8F7E' : '#6E8592' }}>
                {o.l}
              </button>
            ))}
          </div>

          {AXES.map(a => (
            <div key={a.key} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 7 }}>{a.label}</div>
              <Stars value={scores[a.key] || 0} onChange={n => setScores(s => ({ ...s, [a.key]: n }))} />
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 7 }}>Vous la recommanderiez ?</div>
            <YesNo value={recommanderait} onChange={setRecommanderait} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 7 }}>Vous l'utiliseriez vous-même ?</div>
            <YesNo value={utiliserait} onChange={setUtiliserait} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 7 }}>Un commentaire ? (facultatif)</div>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
              placeholder="Ce qui vous a plu, ce qui vous a bloqué…"
              style={{ width: '100%', border: '1px solid #DCE5E3', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginTop: 12 }}>{error}</p>}

          <button onClick={submit} disabled={!complete || sending}
            style={{ width: '100%', marginTop: 20, padding: 15, borderRadius: 999, border: 'none',
              background: (!complete || sending) ? '#DCE5E3' : '#12B39C', color: '#fff',
              fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: complete ? 'pointer' : 'default' }}>
            {sending ? 'Envoi…' : 'Envoyer mon avis'}
          </button>
        </div>
      </div>
    </div>
  )
}
