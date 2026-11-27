"use client"
import { useState } from 'react'
import { DISPUTE_CATEGORIES, MAX_PHOTOS, MAX_BYTES, TYPES, type DisputeExtra } from '@/lib/dispute'

/** Champs structurés d'un litige (voir src/lib/dispute.ts pour l'enregistrement). */
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
                style={{ padding: '8px 14px', minHeight: 44, borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: on ? '1.5px solid #12B39C' : '1.5px solid #DCE5E3', background: on ? 'rgba(18,179,156,.12)' : '#fff', color: on ? '#0B8374' : '#123644' }}>
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label style={label} htmlFor="dispute-amount">Montant réclamé en euros (facultatif)</label>
        <input id="dispute-amount" value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} inputMode="decimal" autoComplete="off"
          style={{ width: 140, minHeight: 44, padding: '10px 12px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div>
        <span style={label}>Photos (facultatif, 3 maximum, 10 Mo chacune)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {value.photos.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 10px', borderRadius: 999, background: '#F3F6F5', fontSize: 12, fontWeight: 600, color: '#123644', maxWidth: 190 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => onChange({ ...value, photos: value.photos.filter((_, j) => j !== i) })}
                style={{ width: 44, height: 44, margin: '-10px -6px -10px -8px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', background: '#DCE5E3', display: 'grid', placeItems: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></span>
              </button>
            </span>
          ))}
          {value.photos.length < MAX_PHOTOS && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box', padding: '8px 14px', borderRadius: 999, border: '1.5px dashed #12B39C', color: '#0B8374', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter une photo
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
        {err && <p style={{ color: '#B3402F', fontSize: 12, margin: '6px 0 0' }}>{err}</p>}
      </div>
    </div>
  )
}
