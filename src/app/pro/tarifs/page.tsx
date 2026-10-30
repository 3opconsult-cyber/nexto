"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import PricingEditor from '@/components/PricingEditor'
import { TRADES } from '@/lib/trades'
import { type PricingDraft, draftFromColumns, emptyDraft, pricingShort, pricingSummary, toColumns, validateDraft } from '@/lib/servicePricing'

type Cols = {
  pricing_type: 'forfait' | 'horaire' | 'devis'
  base_price_cents: number; included_hours: number | null; hourly_rate_cents: number | null
  price_cents?: number | null
}
type ServiceRow = Cols & { id: string; name: string; description: string | null }
type Primary = Cols & { trade: string }

// Ligne du catalogue en cours d'édition : le service principal (provider_profiles) ou une ligne `services`.
type Editing =
  | { kind: 'primary' }
  | { kind: 'row'; id: string }
  | { kind: 'new' }

const label: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#4E6470', fontWeight: 700, marginBottom: 5 }
const input: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #E7EDEB', borderRadius: 11,
  padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', color: '#123644',
}

/**
 * Catalogue de prix, comme l'écran « Mes tarifs » de la démo (p_tarifs) : une ligne par prestation
 * (nom, mode de prix, prix à droite, « modifier »), et « + Ajouter un tarif ». Chaque service a son
 * propre prix dans l'un des trois modes (forfait, à l'heure, forfait + heures sup.) ; « Sur devis »
 * reste possible pour une prestation complémentaire. Tout est réservable séparément sur /pro/[id].
 */
export default function ProTarifsPage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [primary, setPrimary] = useState<Primary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState<Editing | null>(null)
  const [pick, setPick] = useState<string | null>(null) // nouveau tarif : clé de service ou '__libre'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<PricingDraft>(emptyDraft())
  const [showErr, setShowErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login?next=/pro/tarifs'); return }
    setUid(user.id)
    const [{ data, error: e1 }, { data: pp }] = await Promise.all([
      supabase.from('services')
        .select('id, name, description, pricing_type, base_price_cents, included_hours, hourly_rate_cents, price_cents')
        .eq('provider_id', user.id).order('created_at'),
      supabase.from('provider_profiles')
        .select('trade, pricing_type, base_price_cents, included_hours, hourly_rate_cents')
        .eq('id', user.id).maybeSingle(),
    ])
    if (e1) setError('Vos tarifs n’ont pas pu être chargés. Rechargez la page.')
    setRows((data as ServiceRow[]) ?? [])
    setPrimary((pp as Primary) ?? null)
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tradeOf = (n: string) => Object.keys(TRADES).find(k => k === n.toLowerCase() || TRADES[k].toLowerCase() === n.toLowerCase())
  const displayName = (n: string) => TRADES[n] || n
  // Services du catalogue PING déjà tarifés (principal + lignes), pour ne pas les proposer deux fois.
  const taken = new Set<string>([...(primary ? [primary.trade] : []), ...rows.map(r => tradeOf(r.name)).filter((k): k is string => !!k)])
  const freeTrades = Object.keys(TRADES).filter(k => !taken.has(k))

  function openSheet(e: Editing) {
    setEditing(e); setShowErr(false); setSheetError('')
    if (e.kind === 'primary' && primary) {
      setName(displayName(primary.trade)); setDescription('')
      setDraft(primary.pricing_type === 'devis' ? emptyDraft() : draftFromColumns(primary))
    } else if (e.kind === 'row') {
      const r = rows.find(x => x.id === e.id)!
      setName(displayName(r.name)); setDescription(r.description || ''); setDraft(draftFromColumns(r))
    } else {
      setPick(null); setName(''); setDescription(''); setDraft(emptyDraft())
    }
  }
  function close() { setEditing(null); setPick(null) }

  // Prestation libre (« Remise en état après travaux »…) : « Sur devis » permis. Service du catalogue
  // PING (ménage, repassage, nettoyage, vitres) : les trois modes seulement.
  const isTradeLine = editing?.kind === 'primary'
    || (editing?.kind === 'row' && !!tradeOf(rows.find(r => r.id === editing.id)?.name || ''))
    || (editing?.kind === 'new' && !!pick && pick !== '__libre')

  async function save() {
    setSheetError('')
    if (editing?.kind === 'new' && !pick) { setSheetError('Choisissez la prestation à tarifer.'); return }
    if (!isTradeLine && !name.trim()) { setSheetError('Indiquez le nom de la prestation.'); return }
    if (validateDraft(draft)) { setShowErr(true); return }
    if (!uid || !editing) return
    setSaving(true)
    const supabase = createClient()
    const cols = toColumns(draft)
    let err = null
    if (editing.kind === 'primary') {
      ;({ error: err } = await supabase.from('provider_profiles').update({
        pricing_type: cols.pricing_type, base_price_cents: cols.base_price_cents,
        included_hours: cols.included_hours, hourly_rate_cents: cols.hourly_rate_cents,
      }).eq('id', uid))
    } else if (editing.kind === 'row') {
      const r = rows.find(x => x.id === editing.id)!
      ;({ error: err } = await supabase.from('services').update({
        ...cols, name: tradeOf(r.name) ? r.name : name.trim(), description: description.trim() || null,
      }).eq('id', editing.id))
    } else {
      const finalName = pick && pick !== '__libre' ? TRADES[pick] : name.trim()
      ;({ error: err } = await supabase.from('services').insert({
        provider_id: uid, name: finalName, description: description.trim() || null, ...cols,
      }))
    }
    setSaving(false)
    if (err) { setSheetError('Ce tarif n’a pas pu être enregistré. Réessayez.'); return }
    close()
    load()
  }

  async function remove(id: string) {
    if (!confirm('Retirer ce tarif de votre catalogue ? Les clients ne pourront plus le réserver.')) return
    const { error: delErr } = await createClient().from('services').delete().eq('id', id)
    if (delErr) { setSheetError('Ce tarif n’a pas pu être retiré. Réessayez.'); return }
    close()
    setRows(rs => rs.filter(r => r.id !== id))
  }

  const line = (key: string, title: string, cols: Cols, onEdit: () => void, tag?: string) => (
    <div key={key} onClick={onEdit}
      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: '13px 14px', marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{title}</span>
          {tag && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 7px', borderRadius: 999, background: 'rgba(18,179,156,.12)', color: '#0C8F7E' }}>{tag}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#4E6470', marginTop: 3 }}>{pricingSummary(cols)}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', whiteSpace: 'nowrap' }}>{pricingShort(cols) ?? 'À compléter'}</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0C8F7E', marginTop: 2 }}>modifier</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#123644', padding: '16px 20px 20px' }}>
        <NavDrawer />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.72)', margin: '16px 0 4px' }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes tarifs</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#123644' }}>Catalogue de prix</div>
        <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 18px', lineHeight: 1.5 }}>
          Un prix pour chaque prestation, fixé à l&apos;avance : forfait, à l&apos;heure, ou forfait avec heures supplémentaires.
          Vos clients réservent directement la prestation de leur choix.
        </p>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', color: '#c0503a', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

        {!loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px 2px' }}>Prestations</div>
            {primary && line('primary', displayName(primary.trade), primary, () => openSheet({ kind: 'primary' }), 'Principal')}
            {rows.map(r => line(r.id, displayName(r.name), r, () => openSheet({ kind: 'row', id: r.id })))}
            {!primary && rows.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, background: '#fff', borderRadius: 14, border: '1px solid #E7EDEB', fontSize: 12.5, color: '#4E6470' }}>
                Aucun tarif pour l&apos;instant : ajoutez votre première prestation.
              </div>
            )}
            {/* Services du catalogue pas encore tarifés : une ligne en pointillé, un tap pour fixer le prix. */}
            {freeTrades.map(k => (
              <button key={k} type="button" onClick={() => { openSheet({ kind: 'new' }); setPick(k) }}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'transparent', border: '1.5px dashed #B9CBC7', borderRadius: 14, padding: '13px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{TRADES[k]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>+ Fixer un prix</span>
              </button>
            ))}
            <button onClick={() => openSheet({ kind: 'new' })}
              style={{ display: 'block', width: '100%', marginTop: 14, padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              + Ajouter une prestation
            </button>
          </>
        )}
      </div>

      {editing && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 20 }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 14 }}>
              {editing.kind === 'new' ? 'Ajouter un tarif' : name}
            </div>

            {editing.kind === 'new' && (
              <div style={{ marginBottom: 14 }}>
                <span style={label}>Prestation</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[...freeTrades.map(k => ({ k, t: TRADES[k] })), { k: '__libre', t: 'Autre prestation' }].map(({ k, t }) => (
                    <button key={k} type="button" onClick={() => { setPick(k); if (k !== '__libre' && draft.mode === 'devis') setDraft(emptyDraft()) }}
                      style={{ padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, border: pick === k ? '1.5px solid #12B39C' : '1.5px solid #E7EDEB', background: pick === k ? 'rgba(18,179,156,.08)' : '#fff', color: pick === k ? '#0C8F7E' : '#4E6470' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isTradeLine && (editing.kind !== 'new' || pick === '__libre') && (
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={label}>Nom de la prestation</span>
                <input value={name} onChange={e => setName(e.target.value)} style={input} />
              </label>
            )}
            {editing.kind !== 'primary' && (editing.kind !== 'new' || pick) && (
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={label}>Précision (facultatif)</span>
                <input value={description} onChange={e => setDescription(e.target.value)} style={input} />
              </label>
            )}

            {(editing.kind !== 'new' || pick) && (
              <PricingEditor value={draft} onChange={setDraft} showError={showErr} allowDevis={!isTradeLine} />
            )}

            {sheetError && <p style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '12px 0 0' }}>{sheetError}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {editing.kind === 'row' && (
                <button type="button" onClick={() => remove(editing.id)}
                  style={{ padding: '12px 16px', borderRadius: 999, border: '1.5px solid #F3D3CC', background: '#fff', color: '#c0503a', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Retirer</button>
              )}
              <button type="button" onClick={close}
                style={{ flex: 1, padding: 12, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={save} disabled={saving}
                style={{ flex: 1.4, padding: 12, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
