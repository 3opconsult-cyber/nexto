"use client"
import { MAIN_MODES, type PricingDraft, type PricingMode, pricingLabel, toColumns, validateDraft } from '@/lib/servicePricing'

// Saisie du tarif d'UN service : les trois modes (forfait, à l'heure, forfait + heures sup.), plus
// « Sur devis » quand l'appelant l'autorise (prestation complémentaire de « Mes tarifs »).
// Utilisé à l'inscription (une carte par service) et dans « Mes tarifs ».
export default function PricingEditor({
  value, onChange, allowDevis = false, showError = false,
}: {
  value: PricingDraft
  onChange: (d: PricingDraft) => void
  allowDevis?: boolean
  showError?: boolean
}) {
  const modes = allowDevis
    ? [...MAIN_MODES, { key: 'devis' as PricingMode, label: 'Sur devis', hint: 'Pas de prix à l’avance : vous chiffrez dans la conversation.' }]
    : MAIN_MODES
  const current = modes.find(m => m.key === value.mode) ?? modes[0]
  const set = (patch: Partial<PricingDraft>) => onChange({ ...value, ...patch })
  const error = validateDraft(value)
  const preview = error ? null : pricingLabel(toColumns(value))

  const field = (label: string, key: 'flat' | 'hours' | 'hourly', suffix: string) => (
    <label style={{ display: 'block', flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 11.5, color: '#6E8592', fontWeight: 700, marginBottom: 5 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E7EDEB', borderRadius: 11, background: '#fff', overflow: 'hidden' }}>
        <input type="number" inputMode="decimal" min="0" step={key === 'hours' ? '0.5' : '1'} value={value[key]}
          onChange={e => set({ [key]: e.target.value } as Partial<PricingDraft>)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#123644' }} />
        <span style={{ padding: '0 12px', fontSize: 12.5, fontWeight: 700, color: '#9CA3AF' }}>{suffix}</span>
      </span>
    </label>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${modes.length}, 1fr)`, gap: 6, background: '#F3F6F5', padding: 4, borderRadius: 12 }}>
        {modes.map(m => {
          const on = m.key === value.mode
          return (
            <button key={m.key} type="button" onClick={() => set({ mode: m.key })}
              style={{ border: 'none', borderRadius: 9, padding: '9px 6px', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, background: on ? '#fff' : 'transparent', color: on ? '#0C8F7E' : '#6E8592', boxShadow: on ? '0 1px 4px rgba(18,54,68,.12)' : 'none' }}>
              {m.label}
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 11.5, color: '#6E8592', margin: '8px 2px 12px', lineHeight: 1.45 }}>{current.hint}</p>

      {value.mode === 'forfait' && field('Prix du forfait', 'flat', '€')}
      {value.mode === 'horaire' && field('Taux horaire', 'hourly', '€/h')}
      {value.mode === 'forfait_heures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {field('Prix du forfait', 'flat', '€')}
            {field('Heures incluses', 'hours', 'h')}
          </div>
          {field('Tarif des heures supplémentaires', 'hourly', '€/h')}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>Affiché aux clients : {preview}</div>
      )}
      {showError && error && <div style={{ marginTop: 10, fontSize: 12, color: '#c0503a', fontWeight: 600 }}>{error}</div>}
    </div>
  )
}
