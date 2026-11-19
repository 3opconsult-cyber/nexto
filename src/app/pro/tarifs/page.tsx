"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import PricingEditor from '@/components/PricingEditor'
import { TRADES, tradeOfServiceName } from '@/lib/trades'
import { useCatalog } from '@/lib/catalog'
import RetourLink from '@/components/RetourLink'
import { type PricingDraft, draftFromColumns, emptyDraft, pricingShort, pricingSummary, toColumns, validateDraft } from '@/lib/servicePricing'
import {
  type Prestation, fetchPrestations, prestationName, prestationPhotoUrl, removePrestationPhoto, uploadPrestationPhoto,
} from '@/lib/prestations'

type Cols = {
  pricing_type: 'forfait' | 'horaire' | 'devis'
  base_price_cents: number; included_hours: number | null; hourly_rate_cents: number | null
  price_cents?: number | null
}
type Primary = Cols & { trade: string }

// Ligne du catalogue en cours d'édition : le service principal (provider_profiles) ou une ligne `services`.
type Editing =
  | { kind: 'primary' }
  | { kind: 'row'; id: string }
  | { kind: 'new' }

const label: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#4E6470', fontWeight: 700, marginBottom: 5 }
const input: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #E7EDEB', borderRadius: 11,
  minHeight: 44, padding: '10px 12px', fontSize: 16, fontFamily: 'Inter, sans-serif', outline: 'none', color: '#123644',
}
const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13,
  border: on ? '1.5px solid #12B39C' : '1.5px solid #E7EDEB', background: on ? 'rgba(18,179,156,.08)' : '#fff', color: on ? '#0C8F7E' : '#4E6470',
})
const DESC_MAX = 280
const OTHER = '__autre'

/**
 * « Mes tarifs » (demande Romain 18/11) : une liste de prestations, chacune avec son métier, son nom,
 * sa manière de tarifer (forfait, forfait + heures incluses, à l'heure, sur devis), son prix, une
 * description courte, une photo facultative, et masquable. Plusieurs prestations par métier sont
 * possibles (« Ménage 2 h », « Grand ménage »). Le métier principal (provider_profiles) reste la
 * première ligne. Photo, métier et « masquée » ne s'enregistrent qu'avec la migration 041 (`ext`).
 */
export default function ProTarifsPage() {
  const router = useRouter()
  // Métiers proposés : catalogue en base (admin > Catalogue des services), repli trades.ts.
  const catalog = useCatalog()
  const TRADE_LIST = catalog.selectable.map(s => ({ key: s.key, label: s.label }))
  const [uid, setUid] = useState<string | null>(null)
  const [rows, setRows] = useState<Prestation[]>([])
  const [ext, setExt] = useState(false)
  const [primary, setPrimary] = useState<Primary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState<Editing | null>(null)
  const [trade, setTrade] = useState<string | null>(null) // clé de métier, OTHER = prestation libre
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [hidden, setHidden] = useState(false)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [draft, setDraft] = useState<PricingDraft>(emptyDraft())
  const [showErr, setShowErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login?next=/pro/tarifs'); return }
    setUid(user.id)
    const [res, { data: pp }] = await Promise.all([
      fetchPrestations(supabase, user.id),
      supabase.from('provider_profiles')
        .select('trade, pricing_type, base_price_cents, included_hours, hourly_rate_cents')
        .eq('id', user.id).maybeSingle(),
    ])
    if (res.error) setError('Vos tarifs n’ont pas pu être chargés. Rechargez la page.')
    setRows(res.rows); setExt(res.ext)
    setPrimary((pp as Primary) ?? null)
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Métiers sans aucune prestation (ni principal ni ligne) : proposés en raccourci.
  const taken = new Set<string>([...(primary ? [primary.trade] : []), ...rows.map(r => r.trade).filter((k): k is string => !!k)])
  const freeTrades = TRADE_LIST.map(t => t.key).filter(k => !taken.has(k))
  // Métiers proposés dans la fiche : ceux du catalogue, plus le métier déjà porté par la prestation
  // s'il n'est plus (ou pas) proposé au choix (ex. vitres), pour ne jamais le perdre à l'édition.
  const tradeChoices = [
    ...TRADE_LIST,
    ...(trade && trade !== OTHER && !TRADE_LIST.some(t => t.key === trade) && TRADES[trade] ? [{ key: trade, label: TRADES[trade] }] : []),
    { key: OTHER, label: 'Autre' },
  ]

  function setPhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  function openSheet(e: Editing, presetTrade?: string) {
    setEditing(e); setShowErr(false); setSheetError(''); setPhoto(null); setPhotoRemoved(false)
    if (e.kind === 'primary' && primary) {
      setTrade(primary.trade); setName(TRADES[primary.trade] || primary.trade); setDescription(''); setHidden(false); setPhotoPath(null)
      setDraft(draftFromColumns(primary))
    } else if (e.kind === 'row') {
      const r = rows.find(x => x.id === e.id)!
      setTrade(r.trade || OTHER); setName(prestationName(r)); setDescription(r.description || '')
      setHidden(r.hidden); setPhotoPath(r.photo_path); setDraft(draftFromColumns(r))
    } else {
      setTrade(presetTrade ?? null); setName(presetTrade ? TRADES[presetTrade] : ''); setDescription('')
      setHidden(false); setPhotoPath(null); setDraft(emptyDraft())
    }
  }
  function close() { setEditing(null); setPhoto(null) }

  function pickTrade(k: string) {
    // Le nom suit le métier tant que le prestataire ne l'a pas personnalisé.
    const auto = !name.trim() || Object.values(TRADES).includes(name.trim())
    setTrade(k)
    if (auto) setName(k === OTHER ? '' : TRADES[k])
  }

  // Sans la colonne `trade` (migration 041 absente), le métier n'est retrouvé que par le nom : on
  // préfixe un nom libre par le métier choisi (« Ménage · Grand ménage ») pour ne pas le perdre.
  function storedName(t: string | null, n: string) {
    if (ext || !t || t === OTHER || tradeOfServiceName(n) === t) return n
    return `${TRADES[t]} · ${n}`
  }

  async function save() {
    setSheetError('')
    if (editing?.kind === 'new' && !trade) { setSheetError('Choisissez le métier de la prestation.'); return }
    if (editing?.kind !== 'primary' && !name.trim()) { setSheetError('Indiquez le nom de la prestation.'); return }
    if (description.length > DESC_MAX) { setSheetError(`Description trop longue (${DESC_MAX} caractères au plus).`); return }
    if (validateDraft(draft)) { setShowErr(true); return }
    if (!uid || !editing) return
    setSaving(true)
    const supabase = createClient()
    const cols = toColumns(draft)
    let err: any = null
    if (editing.kind === 'primary') {
      ;({ error: err } = await supabase.from('provider_profiles').update({
        pricing_type: cols.pricing_type, base_price_cents: cols.base_price_cents,
        included_hours: cols.included_hours, hourly_rate_cents: cols.hourly_rate_cents,
      }).eq('id', uid))
    } else {
      const t = trade && trade !== OTHER ? trade : null
      const base: Record<string, any> = {
        ...cols, name: storedName(trade, name.trim()), description: description.trim() || null,
        ...(ext ? { trade: t, hidden } : {}),
      }
      let id = editing.kind === 'row' ? editing.id : null
      if (id) {
        ;({ error: err } = await supabase.from('services').update(base).eq('id', id))
      } else {
        const { data, error } = await supabase.from('services').insert({ provider_id: uid, ...base }).select('id').single()
        err = error; id = data?.id ?? null
      }
      // Photo : après l'enregistrement de la ligne (le chemin contient son id).
      if (!err && id && ext) {
        const previous = photoPath
        let next: string | null | undefined
        if (photoFile) {
          const up = await uploadPrestationPhoto(supabase, uid, id, photoFile)
          if (up.error) { setSaving(false); setSheetError(`Prestation enregistrée, mais ${up.error.charAt(0).toLowerCase()}${up.error.slice(1)}`); load(); return }
          next = up.path
        } else if (photoRemoved) next = null
        if (next !== undefined) {
          const { error: pErr } = await supabase.from('services').update({ photo_path: next }).eq('id', id)
          if (!pErr && previous && previous !== next) await removePrestationPhoto(supabase, previous)
        }
      }
    }
    setSaving(false)
    if (err) { setSheetError('Cette prestation n’a pas pu être enregistrée. Réessayez.'); return }
    close()
    load()
  }

  async function remove(id: string) {
    if (!confirm('Retirer cette prestation de votre catalogue ? Les clients ne pourront plus la réserver.' + (ext ? ' (Pour la retirer seulement un temps, masquez-la.)' : ''))) return
    const supabase = createClient()
    const r = rows.find(x => x.id === id)
    const { error: delErr } = await supabase.from('services').delete().eq('id', id)
    if (delErr) { setSheetError('Cette prestation n’a pas pu être retirée. Réessayez.'); return }
    if (r?.photo_path) await removePrestationPhoto(supabase, r.photo_path)
    close()
    setRows(rs => rs.filter(x => x.id !== id))
  }

  async function toggleHidden(r: Prestation) {
    const { error: e } = await createClient().from('services').update({ hidden: !r.hidden }).eq('id', r.id)
    if (e) { setError('La visibilité n’a pas pu être changée. Réessayez.'); return }
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, hidden: !r.hidden } : x))
  }

  const thumb = (path: string | null, size = 46) => {
    const url = prestationPhotoUrl(path)
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#F3F6F5' }} />
    ) : null
  }

  const line = (key: string, title: string, cols: Cols, onEdit: () => void, opts: { tag?: string; trade?: string | null; desc?: string | null; photo?: string | null; row?: Prestation } = {}) => (
    <div key={key} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '12px 14px', marginBottom: 8, opacity: opts.row?.hidden ? .6 : 1 }}>
      <div onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        {thumb(opts.photo ?? null)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{title}</span>
            {opts.tag && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 7px', borderRadius: 999, background: 'rgba(18,179,156,.12)', color: '#0C8F7E' }}>{opts.tag}</span>}
            {opts.trade && TRADES[opts.trade] !== title && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#F3F6F5', color: '#4E6470' }}>{TRADES[opts.trade]}</span>}
            {opts.row?.hidden && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 7px', borderRadius: 999, background: '#FFF4DD', color: '#8A5A00' }}>Masquée</span>}
          </div>
          <div style={{ fontSize: 12, color: '#4E6470', marginTop: 3 }}>{pricingSummary(cols)}</div>
          {opts.desc && <div style={{ fontSize: 12, color: '#6E8592', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opts.desc}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', whiteSpace: 'nowrap' }}>{pricingShort(cols) ?? 'À compléter'}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0C8F7E', marginTop: 2 }}>modifier</div>
        </div>
      </div>
      {opts.row && ext && (
        <button type="button" onClick={() => toggleHidden(opts.row!)}
          style={{ marginTop: 4, minHeight: 44, padding: '0 4px 0 0', border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: opts.row.hidden ? '#0C8F7E' : '#4E6470', cursor: 'pointer' }}>
          {opts.row.hidden ? 'Afficher sur ma fiche' : 'Masquer de ma fiche'}
        </button>
      )}
    </div>
  )

  const shownPhoto = photoPreview || (!photoRemoved ? prestationPhotoUrl(photoPath) : null)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <RetourLink />
      <div style={{ background: '#123644', padding: '16px 20px 20px' }}>
        <NavDrawer />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.72)', margin: '16px 0 4px' }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes tarifs</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#123644' }}>Mes prestations</div>
        <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 18px', lineHeight: 1.5 }}>
          Autant de prestations que vous voulez, chacune avec son prix : forfait, forfait avec heures incluses,
          à l&apos;heure, ou sur devis. Vos clients réservent directement celle de leur choix ; « sur devis »
          ouvre une conversation pour chiffrer.
        </p>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', color: '#c0503a', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

        {!loading && (
          <>
            {primary && line('primary', TRADES[primary.trade] || primary.trade, primary, () => openSheet({ kind: 'primary' }), { tag: 'Principal' })}
            {rows.map(r => line(r.id, prestationName(r), r, () => openSheet({ kind: 'row', id: r.id }), { trade: r.trade, desc: r.description, photo: r.photo_path, row: r }))}
            {!primary && rows.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, background: '#fff', borderRadius: 14, border: '1px solid #E7EDEB', fontSize: 12.5, color: '#4E6470' }}>
                Aucune prestation pour l&apos;instant : ajoutez la première.
              </div>
            )}
            {freeTrades.map(k => (
              <button key={k} type="button" onClick={() => openSheet({ kind: 'new' }, k)}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'transparent', border: '1.5px dashed #B9CBC7', borderRadius: 14, padding: '13px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{TRADES[k]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>+ Fixer un prix</span>
              </button>
            ))}
            <button onClick={() => openSheet({ kind: 'new' })}
              style={{ display: 'block', width: '100%', marginTop: 14, padding: 14, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              + Ajouter une prestation
            </button>
          </>
        )}
      </div>

      {editing && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 20 }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 14 }}>
              {editing.kind === 'new' ? 'Nouvelle prestation' : editing.kind === 'primary' ? name : 'Modifier la prestation'}
            </div>

            {editing.kind !== 'primary' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <span style={label}>Métier</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tradeChoices.map(t => (
                      <button key={t.key} type="button" onClick={() => pickTrade(t.key)} style={chip(trade === t.key)}>{t.label}</button>
                    ))}
                  </div>
                </div>

                {trade && (
                  <>
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      <span style={label}>Nom de la prestation</span>
                      <input value={name} onChange={e => setName(e.target.value)} maxLength={80}
                        placeholder={trade === OTHER ? 'Remise à blanc, fin de chantier…' : `${TRADES[trade]} 2 h, grand ${TRADES[trade].toLowerCase()}…`} style={input} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 14 }}>
                      <span style={label}>Description courte (facultatif)</span>
                      <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, DESC_MAX))} rows={2}
                        placeholder="Ce qui est compris, matériel fourni…" style={{ ...input, resize: 'vertical' }} />
                      <span style={{ display: 'block', textAlign: 'right', fontSize: 11, color: '#6E8592', marginTop: 3 }}>{description.length}/{DESC_MAX}</span>
                    </label>

                    {ext && (
                      <div style={{ marginBottom: 14 }}>
                        <span style={label}>Photo (facultatif)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {shownPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={shownPhoto} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', background: '#F3F6F5' }} />
                          ) : (
                            <div style={{ width: 72, height: 72, borderRadius: 12, background: '#F3F6F5', display: 'grid', placeItems: 'center' }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9FB2BA" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></svg>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button type="button" onClick={() => fileRef.current?.click()}
                              style={{ minHeight: 44, padding: '0 16px', borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              {shownPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                            </button>
                            {shownPhoto && (
                              <button type="button" onClick={() => { setPhoto(null); setPhotoRemoved(true) }}
                                style={{ minHeight: 44, padding: 0, border: 'none', background: 'none', color: '#c0503a', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>Retirer la photo</button>
                            )}
                          </div>
                          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden
                            onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; if (f) { setPhoto(f); setPhotoRemoved(false) } }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {(editing.kind === 'primary' || trade) && (
              <>
                <span style={label}>Manière de tarifer</span>
                <PricingEditor value={draft} onChange={setDraft} showError={showErr} allowDevis
                  allowedModes={trade && trade !== OTHER ? catalog.get(trade)?.pricing_modes : undefined} />
              </>
            )}

            {editing.kind !== 'primary' && trade && ext && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} style={{ width: 24, height: 24, margin: 0, flexShrink: 0, accentColor: '#12B39C' }} />
                <span style={{ fontSize: 13, color: '#123644' }}>Masquer de ma fiche <span style={{ color: '#6E8592', fontSize: 12 }}>(gardée ici, non réservable)</span></span>
              </label>
            )}

            {sheetError && <p style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '12px 0 0' }}>{sheetError}</p>}

            {/* Boutons collants en bas de la fenêtre (audit 19/11, correction 17) : « Enregistrer » toujours
                visible, sans défiler sous le formulaire de prix. */}
            <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: -20, zIndex: 2, margin: '18px -20px -20px', padding: '12px 20px calc(16px + env(safe-area-inset-bottom, 0px))', background: '#fff', borderTop: '1px solid #EEF2F1' }}>
              {editing.kind === 'row' && (
                <button type="button" onClick={() => remove(editing.id)}
                  style={{ minHeight: 48, padding: '12px 16px', borderRadius: 999, border: '1.5px solid #F3D3CC', background: '#fff', color: '#c0503a', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Retirer</button>
              )}
              <button type="button" onClick={close}
                style={{ flex: 1, minHeight: 48, padding: 12, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={save} disabled={saving}
                style={{ flex: 1.4, minHeight: 48, padding: 12, borderRadius: 999, border: 'none', background: '#0C8F7E', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
