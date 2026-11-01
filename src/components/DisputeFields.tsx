"use client"
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Champs structurés d'un litige (motif, montant réclamé, jusqu'à 3 photos) + enregistrement.
 * Utilisé par la fenêtre « Signaler un problème » du chat. Les photos vont dans le bucket privé
 * `dispute-photos`, chemin `<uid>/<id du litige>/<fichier>` (migration 030) : l'autre partie et PING
 * les lisent par URL signée. La date cible de réponse (48 h) est posée par la base, pas par le client.
 */
export const DISPUTE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'non_realisee', label: 'Prestation non réalisée' },
  { key: 'qualite', label: 'Qualité insuffisante' },
  { key: 'casse', label: 'Dégât ou casse' },
  { key: 'retard_absence', label: 'Retard ou absence' },
  { key: 'montant', label: 'Montant contesté' },
  { key: 'autre', label: 'Autre' },
]
export const categoryLabel = (k: string | null | undefined) => DISPUTE_CATEGORIES.find(c => c.key === k)?.label ?? null

export type DisputeExtra = { category: string; amount: string; photos: File[] }
export const EMPTY_DISPUTE: DisputeExtra = { category: '', amount: '', photos: [] }

const MAX_PHOTOS = 3
const MAX_BYTES = 10 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Montant saisi en euros (« 25 », « 25,50 ») → centimes, null si vide ou invalide. */
export function amountToCents(v: string): number | null {
  const n = Number(v.replace(',', '.').replace(/\s/g, ''))
  return v.trim() && isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

/** Ouvre le litige : photos d'abord (l'id du litige est choisi ici pour fixer leur chemin), puis la ligne. */
export async function createDispute(
  supabase: SupabaseClient,
  p: { transactionId: string; userId: string; reason: string; extra: DisputeExtra },
): Promise<{ id: string } | { error: string }> {
  const id = crypto.randomUUID()
  const paths: string[] = []
  for (let i = 0; i < p.extra.photos.length; i++) {
    const f = p.extra.photos[i]
    const path = `${p.userId}/${id}/${Date.now()}-${i}.${EXT[f.type] || 'jpg'}`
    const { error } = await supabase.storage.from('dispute-photos').upload(path, f, { contentType: f.type })
    if (error) return { error: 'Une photo n’a pas pu être envoyée. Réessayez, ou retirez-la.' }
    paths.push(path)
  }
  const { error } = await supabase.from('disputes').insert({
    id, transaction_id: p.transactionId, opener_id: p.userId, reason: p.reason,
    category: p.extra.category || null,
    claimed_cents: amountToCents(p.extra.amount),
    photo_paths: paths,
  })
  if (error) return { error: 'Le litige n’a pas pu être enregistré. Réessayez, ou écrivez à info@opconsult.co.' }
  return { id }
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 6px' }

export default function DisputeFields({ value, onChange }: { value: DisputeExtra; onChange: (v: DisputeExtra) => void }) {
  const [err, setErr] = useState('')

  function addFiles(list: FileList | null) {
    if (!list) return
    setErr('')
    const next = [...value.photos]
    for (const f of Array.from(list)) {
      if (!TYPES.includes(f.type)) { setErr('Formats acceptés : JPG, PNG ou WebP.'); continue }
      if (f.size > MAX_BYTES) { setErr('Une photo dépasse 10 Mo.'); continue }
      if (next.length >= MAX_PHOTOS) { setErr(`${MAX_PHOTOS} photos au maximum.`); break }
      next.push(f)
    }
    onChange({ ...value, photos: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
      <div>
        <span style={label}>Motif</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Motif du litige">
          {DISPUTE_CATEGORIES.map(c => {
            const on = value.category === c.key
            return (
              <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, category: c.key })}
                style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: on ? '1.5px solid #12B39C' : '1.5px solid #DCE5E3', background: on ? 'rgba(18,179,156,.12)' : '#fff', color: on ? '#0C8F7E' : '#123644' }}>
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label style={label} htmlFor="dispute-amount">Montant réclamé en euros (facultatif)</label>
        <input id="dispute-amount" value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} inputMode="decimal" autoComplete="off"
          style={{ width: 140, padding: '10px 12px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div>
        <span style={label}>Photos (facultatif, 3 maximum, 10 Mo chacune)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {value.photos.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 10px', borderRadius: 999, background: '#F3F6F5', fontSize: 12, fontWeight: 600, color: '#123644', maxWidth: 190 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => onChange({ ...value, photos: value.photos.filter((_, j) => j !== i) })}
                style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#DCE5E3', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          ))}
          {value.photos.length < MAX_PHOTOS && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, border: '1.5px dashed #12B39C', color: '#0C8F7E', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter une photo
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
        {err && <p style={{ color: '#c0503a', fontSize: 12, margin: '6px 0 0' }}>{err}</p>}
      </div>
    </div>
  )
}
