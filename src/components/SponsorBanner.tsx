"use client"
import type { CSSProperties } from 'react'

// Régie publicitaire — socle visuel (demande de Romain, 26/10).
// Un seul composant réutilisable, pensé pour deux cibles distinctes : du
// matériel/équipement (non concurrent des prestataires eux-mêmes) côté
// client, et des organismes (aide à domicile, formation, assistance) côté
// pro. Pour l'instant les données sont passées en props — câblage sur une
// vraie table Supabase (`sponsors`) dès la reconnexion, pour que les
// emplacements soient gérables sans redéploiement de code.

export interface Sponsor {
  id: string
  name: string
  tagline: string
  imageUrl?: string
  linkUrl: string
}

export default function SponsorBanner({ sponsor, label = 'Partenaire', style }: { sponsor: Sponsor; label?: string; style?: CSSProperties }) {
  return (
    <a
      href={sponsor.linkUrl}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
        background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14,
        padding: 12, margin: '0 16px 12px',
        ...style,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: sponsor.imageUrl ? 'transparent' : 'linear-gradient(160deg,#F2A93B,#d98a1f)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {sponsor.imageUrl
          ? <img src={sponsor.imageUrl} alt={sponsor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, color: '#fff', fontSize: 16 }}>{sponsor.name.charAt(0)}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>{sponsor.name}</div>
        <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sponsor.tagline}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
    </a>
  )
}
