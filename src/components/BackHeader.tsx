"use client"
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

// En-tête de la maquette (.hd) : flèche retour de 44 px, titre, élément optionnel à droite.
// Fond clair (défaut, comme la maquette) ou navy (dark). La flèche revient à l'écran d'où l'on vient,
// sinon à `fallback`.
export function BackArrow({ fallback, dark = false }: { fallback: string; dark?: boolean }) {
  const router = useRouter()
  return (
    <button type="button" aria-label="Retour"
      onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push(fallback) }}
      style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#fff' : '#123644', flexShrink: 0, marginLeft: -8 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  )
}

export default function BackHeader({ title, fallback, right, dark = false }: { title: string; fallback: string; right?: ReactNode; dark?: boolean }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, minHeight: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: dark ? '#123644' : '#fff', borderBottom: dark ? 'none' : '1px solid #E7EDEB' }}>
      <BackArrow fallback={fallback} dark={dark} />
      <h1 style={{ margin: 0, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: dark ? '#fff' : '#123644', flex: 1 }}>{title}</h1>
      {right}
    </div>
  )
}
