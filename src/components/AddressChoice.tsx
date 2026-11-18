"use client"
import { maskAddress } from '@/lib/address'

/**
 * Adresse d'intervention (Romain 31/10) : par défaut celle du profil du client, présélectionnée et
 * confirmée par le bouton final (audit ergonomie 18/11 : plus de case à cocher à part). « Une autre adresse » est possible mais soumise au prestataire, qui la voit sans le numéro
 * jusqu'à sa validation. Sans adresse au profil, le client la saisit (elle y est enregistrée).
 */
export type AddressValue = { mode: 'profil' | 'autre'; other: string; confirmed: boolean }

export default function AddressChoice({ profileAddress, value, onChange, error }: {
  profileAddress: string | null; value: AddressValue; onChange: (v: AddressValue) => void
  /** Erreur affichée juste sous le champ concerné (et non en bas de page). */
  error?: string
}) {
  const errEl = error ? <p role="alert" style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{error}</p> : null
  const field: React.CSSProperties = { display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }
  const opt = (on: boolean): React.CSSProperties => ({
    display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
    border: on ? '2px solid #12B39C' : '1px solid #DCE5E3', background: on ? 'rgba(18,179,156,.06)' : '#fff', marginBottom: 8, fontFamily: 'inherit',
  })
  const dot = (on: boolean) => <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, marginTop: 1, border: on ? '6px solid #12B39C' : '2px solid #A5B3B9', boxSizing: 'border-box' }} />

  if (!profileAddress) return (
    <div>
      <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Votre adresse</span>
      <input value={value.other} onChange={e => onChange({ mode: 'autre', other: e.target.value, confirmed: true })} autoComplete="street-address"
        aria-label="Adresse (numéro, rue, ville)" aria-invalid={!!error || undefined} style={{ ...field, ...(error ? { borderColor: '#c0503a' } : {}) }} />
      {errEl}
      <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 5 }}>Enregistrée dans votre profil pour les prochaines réservations.</div>
    </div>
  )

  return (
    <div>
      <span style={{ fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>Adresse d&apos;intervention</span>
      <div style={{ marginTop: 6 }}>
        <button type="button" aria-pressed={value.mode === 'profil'} onClick={() => onChange({ ...value, mode: 'profil', confirmed: true })} style={opt(value.mode === 'profil')}>
          {dot(value.mode === 'profil')}
          <span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#123644' }}>{profileAddress}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#4E6470', marginTop: 2 }}>Adresse de votre profil</span>
          </span>
        </button>
        <button type="button" aria-pressed={value.mode === 'autre'} onClick={() => onChange({ ...value, mode: 'autre', confirmed: false })} style={opt(value.mode === 'autre')}>
          {dot(value.mode === 'autre')}
          <span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#123644' }}>Une autre adresse</span>
            <span style={{ display: 'block', fontSize: 12, color: '#4E6470', marginTop: 2 }}>Soumise au prestataire pour validation</span>
          </span>
        </button>
      </div>
      {value.mode === 'profil' ? (
        <>
          {errEl}
          <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>Adresse retenue : vous la confirmez en validant.</div>
        </>
      ) : (
        <div>
          <input value={value.other} onChange={e => onChange({ ...value, other: e.target.value, confirmed: true })} autoComplete="street-address"
            aria-label="Adresse (numéro, rue, ville)" aria-invalid={!!error || undefined} style={{ ...field, ...(error ? { borderColor: '#c0503a' } : {}) }} />
          {errEl}
          {value.other.trim() && (
            <div style={{ fontSize: 12, color: '#4E6470', marginTop: 6, lineHeight: 1.5 }}>
              Le prestataire verra « <b style={{ color: '#123644' }}>{maskAddress(value.other)}</b> » et l&apos;acceptera ou non. Le numéro lui est transmis une fois l&apos;adresse acceptée.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Adresse finale, statut et message d'erreur éventuel à partir du choix du client. */
export function resolveAddress(profileAddress: string | null, v: AddressValue) {
  if (!profileAddress) return v.other.trim() ? { address: v.other.trim(), status: 'profil' as const, saveToProfile: true } : { error: 'Indiquez votre adresse.' }
  // Adresse du profil présélectionnée : la validation finale (réserver, publier, fixer le RDV) vaut confirmation.
  if (v.mode === 'profil') return { address: profileAddress, status: 'profil' as const, saveToProfile: false }
  return v.other.trim() ? { address: v.other.trim(), status: 'a_valider' as const, saveToProfile: false } : { error: 'Indiquez l’autre adresse d’intervention.' }
}
