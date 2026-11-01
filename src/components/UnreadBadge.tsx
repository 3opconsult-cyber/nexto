"use client"

// Pastille de messages non lus (aucun chiffre si 0). `absolute` : posée sur l'angle d'une icône.
export default function UnreadBadge({ n, absolute = false }: { n: number; absolute?: boolean }) {
  if (!n || n < 1) return null
  return (
    <span aria-label={`${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}`}
      style={{
        minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#E5484D', color: '#fff',
        fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 10, lineHeight: '16px', textAlign: 'center', boxSizing: 'border-box',
        ...(absolute ? { position: 'absolute', top: -5, right: -9 } : { marginLeft: 'auto' }),
      }}>{n > 9 ? '9+' : n}</span>
  )
}
