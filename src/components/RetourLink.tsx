'use client'
import { useEffect, useState } from 'react'

// Lien « Retour à mon annonce » : lit ?retour=/chemin (chemin interne uniquement).
export default function RetourLink({ label = 'Retour à mon annonce' }: { label?: string }) {
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    try {
      const r = new URLSearchParams(window.location.search).get('retour')
      if (r && r.startsWith('/') && !r.startsWith('//')) setHref(r)
    } catch { /* ignore */ }
  }, [])
  if (!href) return null
  return (
    <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '12px 20px 0', fontSize: 13, fontWeight: 700, color: '#0E8F7D', textDecoration: 'none' }}>
      <span aria-hidden>←</span> {label}
    </a>
  )
}
