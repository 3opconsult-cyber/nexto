"use client"
// Écran de prise de vue de la maquette (« idcap ») : « Prenez le document en photo… », cadre pointillé
// « Cadrez le document en entier », « Prendre en photo » (caméra arrière) et « Choisir un fichier ».
// Les deux champs fichier sont les mêmes que ceux des listes de pièces : ce composant ne change ni le
// stockage ni les statuts, il remplace seulement le geste d'ajout. Plein écran, au-dessus de la barre du bas.
const camIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>

export default function DocCaptureSheet({ open, title, accept = '.pdf,.jpg,.jpeg,.png,.heic', onClose, onFile }: {
  open: boolean; title: string; accept?: string; onClose: () => void; onFile: (f: File) => void
}) {
  if (!open) return null
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { onFile(f); onClose() } }
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 54, borderRadius: 16, boxSizing: 'border-box', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer' }
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#F3F6F5', overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#fff', borderBottom: '1px solid #E7EDEB' }}>
        <button type="button" aria-label="Retour" onClick={onClose} style={{ width: 44, height: 44, marginLeft: -8, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: '#123644', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 style={{ margin: 0, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#123644', lineHeight: 1.4 }}>{title}</h1>
      </div>
      <div style={{ padding: '24px 20px 40px', maxWidth: 560, margin: '0 auto', lineHeight: 1.55 }}>
        <p style={{ color: '#4E6470', fontSize: 16, lineHeight: 1.55, margin: '0 0 16px' }}>Prenez le document en photo. Il n&apos;est jamais affiché publiquement.</p>
        <div style={{ margin: '16px 0 24px', height: 220, borderRadius: 18, background: '#0e1d24', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe3e8', fontWeight: 600, textAlign: 'center', fontSize: 16 }}>
          <div style={{ position: 'absolute', inset: '26px 24px', border: '3px dashed rgba(255,255,255,.6)', borderRadius: 14 }} />
          <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>{camIcon}<span>Cadrez le document en entier</span></span>
        </div>
        <label style={{ ...btn, background: '#0B8374', color: '#fff', marginTop: 0 }}>
          {camIcon} Prendre en photo
          <input type="file" accept="image/*" capture="environment" onChange={pick} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
        </label>
        <label style={{ ...btn, background: '#fff', color: '#123644', border: '1.5px solid #0B8374', marginTop: 16 }}>
          Choisir un fichier
          <input type="file" accept={accept} onChange={pick} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
        </label>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: '#4E6470', marginTop: 20 }}>PDF, JPG ou PNG · 10 Mo maximum.</p>
      </div>
    </div>
  )
}
