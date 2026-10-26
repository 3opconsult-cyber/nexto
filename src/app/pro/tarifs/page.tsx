"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

type ServiceRow = {
  id: string; name: string; description: string | null
  pricing_type: 'forfait' | 'horaire' | 'devis'
  base_price_cents: number; included_hours: number | null; hourly_rate_cents: number | null
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11,
  padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
}

function priceLabel(r: ServiceRow) {
  const hasFlat = r.base_price_cents > 0
  const hasHourly = r.hourly_rate_cents != null && r.hourly_rate_cents > 0
  if (hasFlat && hasHourly && r.included_hours != null) {
    return `${(r.base_price_cents / 100).toFixed(0)} € (${r.included_hours} h incluse${r.included_hours > 1 ? 's' : ''}), puis ${(r.hourly_rate_cents! / 100).toFixed(0)} €/h`
  }
  if (hasFlat) return `${(r.base_price_cents / 100).toFixed(0)} € forfait`
  if (hasHourly) return `${(r.hourly_rate_cents! / 100).toFixed(0)} €/h`
  return '—'
}

/**
 * Catalogue d'articles réellement réservables (26/10) : chaque article a sa
 * propre fiche de prix (comme le métier principal à l'onboarding — forfait +
 * heures incluses + dépassement, ou taux horaire pur), pas juste un nom et
 * un prix plat. Affiché sur /pro/[id] et sélectionnable à la réservation
 * (mission/new?service=<id>).
 */
export default function ProTarifsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [quoteMode, setQuoteMode] = useState(false)
  const [flatRate, setFlatRate] = useState('')
  const [includedHours, setIncludedHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('services')
      .select('id, name, description, pricing_type, base_price_cents, included_hours, hourly_rate_cents')
      .eq('provider_id', user.id).order('created_at')
    setRows((data as ServiceRow[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function resetForm() {
    setName(''); setDescription(''); setQuoteMode(false)
    setFlatRate(''); setIncludedHours(''); setHourlyRate(''); setAdding(false)
  }

  async function addService() {
    if (!name.trim()) return
    const flatCents = Math.round(Number(flatRate || 0) * 100)
    const hourlyCents = hourlyRate ? Math.round(Number(hourlyRate) * 100) : null
    if (!quoteMode && flatCents <= 0 && !hourlyCents) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('services').insert({
      provider_id: user.id, name: name.trim(), description: description.trim() || null,
      pricing_type: quoteMode ? 'devis' : (flatCents > 0 ? 'forfait' : 'horaire'),
      base_price_cents: quoteMode ? 0 : flatCents,
      included_hours: (!quoteMode && flatCents > 0 && includedHours) ? Number(includedHours) : null,
      hourly_rate_cents: quoteMode ? null : hourlyCents,
      price_cents: quoteMode ? 0 : (flatCents || hourlyCents || 0), // compat ancien affichage
    })
    setSaving(false)
    resetForm()
    load()
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('services').delete().eq('id', id)
    setRows(rows.filter(r => r.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes articles & tarifs</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 6, maxWidth: '40ch' }}>
          Chaque article est réservable séparément par vos clients, avec son propre prix — forfait avec heures incluses, ou taux horaire.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && rows.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun article ajouté pour l&apos;instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Votre tarif de base reste celui défini dans « Paramétrer mes services ».</div>
          </div>
        )}

        {rows.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{r.name}</div>
                {r.description && <div style={{ fontSize: 12, color: '#6E8592', marginTop: 3, lineHeight: 1.45 }}>{r.description}</div>}
                <div style={{ fontSize: 12.5, color: '#0C8F7E', fontWeight: 700, marginTop: 6 }}>
                  {r.pricing_type === 'devis' ? 'Sur devis' : priceLabel(r)}
                </div>
              </div>
              <span onClick={() => remove(r.id)} style={{ color: '#C0503A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Retirer</span>
            </div>
          </div>
        ))}

        {adding ? (
          <div style={{ background: '#fff', border: '1.5px solid #12B39C', borderRadius: 14, padding: 14, marginTop: 4 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 600 }}>Nom de l&apos;article</span>
              <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 600 }}>Description</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} />
            </label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div onClick={() => setQuoteMode(false)} style={{ flex: 1, textAlign: 'center', padding: '9px 8px', borderRadius: 11, cursor: 'pointer', fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 12, border: !quoteMode ? '1.5px solid #12B39C' : '1px solid #E7EDEB', background: !quoteMode ? 'rgba(18,179,156,.08)' : '#fff', color: !quoteMode ? '#0C8F7E' : '#6E8592' }}>Forfait / horaire</div>
              <div onClick={() => { setQuoteMode(true); setFlatRate(''); setHourlyRate('') }} style={{ flex: 1, textAlign: 'center', padding: '9px 8px', borderRadius: 11, cursor: 'pointer', fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 12, border: quoteMode ? '1.5px solid #12B39C' : '1px solid #E7EDEB', background: quoteMode ? 'rgba(18,179,156,.08)' : '#fff', color: quoteMode ? '#0C8F7E' : '#6E8592' }}>Sur devis</div>
            </div>

            {!quoteMode && (
              <>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 600 }}>Forfait (€)</span>
                  <input type="number" min="0" step="0.5" value={flatRate} onChange={e => setFlatRate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                </label>
                {flatRate && (
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 600 }}>Heures incluses (facultatif)</span>
                    <input type="number" min="0" step="0.5" value={includedHours} onChange={e => setIncludedHours(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                  </label>
                )}
                <label style={{ display: 'block', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#6E8592', fontWeight: 600 }}>{flatRate && includedHours ? 'Taux horaire au-delà (€/h)' : 'Taux horaire (€/h)'}</span>
                  <input type="number" min="0" step="0.5" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                </label>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetForm}
                style={{ flex: 1, padding: 11, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>Annuler</button>
              <button onClick={addService} disabled={saving}
                style={{ flex: 1, padding: 11, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, opacity: saving ? .6 : 1 }}>
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => setAdding(true)}
            style={{ textAlign: 'center', padding: 14, borderRadius: 999, border: '1.5px dashed #12B39C', color: '#0C8F7E', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', marginTop: 4 }}>
            + Ajouter un article
          </div>
        )}
      </div>
    </div>
  )
}
