"use client"
import { useState } from 'react'
import Modal, { Cta } from './Modal'
import { createClient } from '@/lib/supabase/client'

/**
 * Avis de fin de mission — le trou le plus ancien du produit.
 *
 * La table `reviews` existait depuis le premier schéma sans qu'aucun écran ne
 * puisse y écrire : toutes les notes affichées venaient de données de test.
 * Cet écran est le seul chemin d'écriture, et la note de la fiche prestataire
 * est désormais recalculée par un trigger à partir des vrais avis.
 *
 * Deux notes distinctes, parce qu'elles ne disent pas la même chose : la
 * qualité du travail rendu, et la relation pendant l'intervention. Un
 * prestataire consciencieux mais froid, ou l'inverse, doit pouvoir se lire.
 *
 * Le pourboire est une INTENTION, pas un encaissement : Stripe n'est pas
 * branché. L'écran le dit, et le code ne fait jamais croire au prestataire
 * qu'il a reçu quelque chose.
 */
const TIPS = [0, 200, 500, 1000]

export default function ReviewModal({
  open, onClose, transactionId, raterId, rateeId, proName,
}: {
  open: boolean; onClose: () => void
  transactionId: string; raterId: string; rateeId: string; proName: string
}) {
  const [quality, setQuality] = useState(0)
  const [service, setService] = useState(0)
  const [recommend, setRecommend] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [tip, setTip] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const complete = quality > 0 && service > 0 && recommend !== null

  async function submit() {
    if (!complete) return
    setBusy(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('reviews').insert({
      transaction_id: transactionId, rater_id: raterId, ratee_id: rateeId,
      // La note d'ensemble est la moyenne des deux, arrondie : on ne demande
      // pas au client de noter trois fois la même chose.
      stars: Math.round((quality + service) / 2),
      quality_stars: quality, service_stars: service,
      recommend, tip_cents: tip, comment: comment.trim() || null,
    })
    setBusy(false)
    if (err) { setError("Votre avis n'a pas pu être enregistré. " + err.message); return }
    onClose()
  }

  function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
    return (
      <div style={{ marginTop: 15 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 7 }} role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onChange(n)} role="radio" aria-checked={value === n}
              aria-label={`${n} sur 5`}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1,
                fontSize: 30, color: n <= value ? '#F2A93B' : '#DCE5E3',
              }}>★</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`Comment s'est passée l'intervention ?`} dismissable={false}>
      <p style={{ fontSize: 13, color: '#6E8592', margin: 0, lineHeight: 1.55 }}>
        Votre avis s'affichera sur la fiche de <b style={{ color: '#123644' }}>{proName}</b>.
        Il compte pour les clients suivants — et pour lui.
      </p>

      <Stars value={quality} onChange={setQuality} label="La qualité du travail rendu" />
      <Stars value={service} onChange={setService} label="Le contact et le respect des horaires" />

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Le recommanderiez-vous ?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[['Oui', true], ['Non', false]].map(([lbl, val]) => (
            <button key={String(val)} onClick={() => setRecommend(val as boolean)}
              aria-pressed={recommend === val}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14,
                border: 'none',
                background: recommend === val ? (val ? '#12B39C' : '#123644') : '#fff',
                color: recommend === val ? '#fff' : '#123644',
                boxShadow: recommend === val ? 'none' : '0 0 0 1px #DCE5E3',
              }}>{lbl as string}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label htmlFor="avis-com" style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
          Un mot à ajouter ? <span style={{ color: '#6E8592', fontWeight: 400 }}>facultatif</span>
        </label>
        <textarea id="avis-com" value={comment} onChange={e => setComment(e.target.value)}
          rows={3} maxLength={600} placeholder="Ce qui vous a plu, ce qui pourrait être mieux…"
          style={{
            width: '100%', marginTop: 7, padding: 11, borderRadius: 12, resize: 'vertical',
            border: '1.5px solid #DCE5E3', fontFamily: 'Inter, sans-serif', fontSize: 13.5,
            color: '#123644', outline: 'none',
          }} />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Laisser un pourboire ? <span style={{ color: '#6E8592', fontWeight: 400 }}>facultatif</span>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
          {TIPS.map(c => (
            <button key={c} onClick={() => setTip(c)} aria-pressed={tip === c}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
                fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5,
                background: tip === c ? '#123644' : '#fff', color: tip === c ? '#fff' : '#123644',
                boxShadow: tip === c ? 'none' : '0 0 0 1px #DCE5E3',
              }}>{c === 0 ? 'Aucun' : `${c / 100} €`}</button>
          ))}
        </div>
        {tip > 0 && (
          <div style={{
            marginTop: 9, padding: 10, borderRadius: 10, background: 'rgba(242,169,59,.12)',
            fontSize: 11.5, color: '#9A6712', lineHeight: 1.5,
          }}>
            Le paiement en ligne n'étant pas encore ouvert, ce pourboire est <b>enregistré comme
            une intention</b> : il n'est pas prélevé et {proName} ne le percevra pas tant que
            l'encaissement n'est pas en place. Vous pouvez le lui remettre directement.
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 13, padding: 11, borderRadius: 10, background: 'rgba(255,122,102,.12)',
                      color: '#B4402C', fontSize: 12.5, lineHeight: 1.5 }}>{error}</div>
      )}

      <div style={{ height: 8 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
        <Cta onClick={submit} disabled={!complete || busy}>
          {busy ? 'Enregistrement…' : complete ? 'Publier mon avis' : 'Notez les deux critères'}
        </Cta>
        <Cta variant="ghost" onClick={onClose}>Plus tard</Cta>
      </div>
    </Modal>
  )
}
