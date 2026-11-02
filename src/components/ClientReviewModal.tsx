"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'

/**
 * Le prestataire note et commente son client (pendant de ReviewModal, côté pro). Deux critères, des
 * remarques rapides, un commentaire que l'on peut publier (« Publier ce commentaire » : visible de tout
 * utilisateur connecté, migration 034) et une note personnelle jamais publiée, rangée dans la table
 * séparée `client_private_notes` (RLS prestataire seul). Pas de pourboire. Table `client_reviews`
 * (migration 016) : si elle n'existe pas encore, la fenêtre le dit au lieu d'échouer en silence.
 */
export const CLIENT_TAGS: { key: string; label: string }[] = [
  { key: 'acces_difficile', label: 'Accès difficile' },
  { key: 'demande_incomplete', label: 'Demande incomplète' },
  { key: 'plus_sale', label: 'Plus sale que prévu' },
  { key: 'plus_propre', label: 'Plus propre que prévu' },
  { key: 'materiel_fourni', label: 'Matériel fourni' },
  { key: 'tres_accueillant', label: 'Très accueillant' },
  { key: 'client_absent', label: 'Client absent' },
  { key: 'retard', label: 'Attente à l’arrivée' },
]

const laterKey = (tx: string) => `ping_client_review_later_${tx}`

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} aria-label={`${n} sur 5`}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 30, lineHeight: 1, color: n <= value ? '#F2A93B' : '#DCE5E3' }}>★</button>
        ))}
      </div>
    </div>
  )
}

export default function ClientReviewModal({ open, onClose, transactionId, raterId, clientId, clientName, onSubmitted }: {
  open: boolean; onClose: () => void
  transactionId: string; raterId: string; clientId: string; clientName: string
  onSubmitted?: (r: { stars: number; is_public: boolean; comment: string | null; tags: string[]; private_note?: string | null }) => void
}) {
  const [accuracy, setAccuracy] = useState(0)
  const [welcome, setWelcome] = useState(0)
  const [recommend, setRecommend] = useState<boolean | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [privateNote, setPrivateNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [suppressed, setSuppressed] = useState(false)

  useEffect(() => {
    if (!open) return
    const asked = new URLSearchParams(window.location.search).has('avis')
    let later = false
    try { later = localStorage.getItem(laterKey(transactionId)) === '1' } catch { }
    setSuppressed(!asked && later)
  }, [open, transactionId])

  const missing = [accuracy > 0, welcome > 0].filter(x => !x).length

  function later() { try { localStorage.setItem(laterKey(transactionId), '1') } catch { } onClose() }

  async function submit() {
    if (missing) return
    setBusy(true); setError('')
    const stars = Math.round((accuracy + welcome) / 2)
    const { error: err } = await createClient().from('client_reviews').insert({
      transaction_id: transactionId, rater_id: raterId, client_id: clientId,
      accuracy_stars: accuracy, welcome_stars: welcome, stars, recommend,
      tags, comment: comment.trim() || null, is_public: isPublic,
    })
    if (err) {
      setBusy(false)
      setError(err.code === '42P01' || /client_reviews/.test(err.message)
        ? 'La notation des clients s’active bientôt (mise à jour de la base en cours).'
        : 'Votre avis n’a pas pu être enregistré. Réessayez.')
      return
    }
    // Note personnelle : table séparée (le client ne peut jamais la lire). Un échec ici ne doit pas
    // faire rejouer l'avis, déjà enregistré.
    const note = privateNote.trim()
    let savedNote: string | null = null
    if (note) {
      const { error: nErr } = await createClient().from('client_private_notes').insert({
        seller_id: raterId, client_id: clientId, transaction_id: transactionId, note,
      })
      if (!nErr) savedNote = note
    }
    setBusy(false)
    onSubmitted?.({ stars, is_public: isPublic, comment: comment.trim() || null, tags, private_note: savedNote })
    onClose()
  }

  return (
    <Modal open={open && !suppressed} onClose={later} title="Je note et commente mon client">
      <p style={{ fontSize: 13, color: '#4E6470', lineHeight: 1.55, margin: '0 0 14px' }}>
        Notez <b style={{ color: '#123644' }}>{clientName.replace(/\.$/, "")}</b>. Vous choisissez de publier votre commentaire
        (visible des utilisateurs connectés) ou de le garder pour vous.
      </p>
      <Stars value={accuracy} onChange={setAccuracy} label="La demande correspondait à la réalité" />
      <Stars value={welcome} onChange={setWelcome} label="Accueil, accès et ponctualité" />

      <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 6 }}>Retravailleriez-vous pour ce client ?</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => setRecommend(recommend === v ? null : v)} aria-pressed={recommend === v}
            style={{ flex: 1, padding: 11, borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, border: recommend === v ? 'none' : '1px solid #DCE5E3', background: recommend === v ? (v ? '#12B39C' : '#123644') : '#fff', color: recommend === v ? '#fff' : '#123644' }}>
            {v ? 'Oui' : 'Non'}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 6 }}>Remarques <span style={{ color: '#6E8592', fontWeight: 600 }}>facultatif</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {CLIENT_TAGS.map(t => {
          const on = tags.includes(t.key)
          return (
            <button key={t.key} onClick={() => setTags(on ? tags.filter(x => x !== t.key) : [...tags, t.key])} aria-pressed={on}
              style={{ padding: '7px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: on ? '1.5px solid #12B39C' : '1px solid #DCE5E3', background: on ? 'rgba(18,179,156,.1)' : '#fff', color: on ? '#0C8F7E' : '#4E6470' }}>
              {t.label}
            </button>
          )
        })}
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 6 }}>Mon commentaire sur ce client <span style={{ color: '#6E8592', fontWeight: 600 }}>facultatif</span></label>
      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
        style={{ width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 4 }}>
        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: '#12B39C', flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#123644' }}>Publier ce commentaire</span>
      </label>
      <p style={{ fontSize: 11.5, color: '#4E6470', margin: '0 0 16px 28px', lineHeight: 1.5 }}>
        {isPublic
          ? 'Votre note, vos remarques et ce commentaire seront visibles de tout utilisateur connecté, dont ce client.'
          : 'Non publié : visible de vous seul.'}
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#123644', marginBottom: 6 }}>Note personnelle (jamais publiée) <span style={{ color: '#6E8592', fontWeight: 600 }}>facultatif</span></label>
      <textarea value={privateNote} onChange={e => setPrivateNote(e.target.value)} rows={3} maxLength={1000}
        placeholder="Pensez à prendre un escabeau la prochaine fois. Accès difficile, prévenir le client pour se garer."
        style={{ width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', marginBottom: 6, boxSizing: 'border-box' }} />
      <p style={{ fontSize: 11.5, color: '#4E6470', margin: '0 0 14px' }}>
        Pense-bête pour vous seul : ni le client ni les autres utilisateurs ne la voient. Elle vous est rappelée lors d&apos;une prochaine mission avec ce client.
      </p>

      {error && <p style={{ color: '#c0503a', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
      <button onClick={submit} disabled={busy || missing > 0}
        style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', cursor: missing ? 'default' : 'pointer', background: missing ? '#A9DED5' : '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
        {busy ? 'Enregistrement…' : missing ? `Encore ${missing} note${missing > 1 ? 's' : ''} à donner` : isPublic ? 'Publier mon commentaire' : 'Enregistrer ma note'}
      </button>
      <button onClick={later} style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
        Plus tard
      </button>
    </Modal>
  )
}
