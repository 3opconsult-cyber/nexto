"use client"
import { useState } from 'react'
import { highlightLabel, listingPhotoUrl } from '@/lib/listing'

/**
 * Éléments de « Mon annonce » (migration 026) affichés sur la fiche publique /pro/[id] et dans
 * l'aperçu de /pro/annonce : accroche, points forts, galerie de photos, zone d'intervention.
 * Ne rend rien pour un champ vide (une ancienne fiche reste inchangée).
 */
export default function ListingExtras({ headline, highlights, gallery, radiusKm, city, part }: {
  headline?: string | null
  highlights?: string[] | null
  gallery?: string[] | null
  radiusKm?: number | null
  city?: string | null
  /** 'top' : accroche + points forts ; 'gallery' : photos ; 'zone' : rayon. Tout par défaut. */
  part?: 'top' | 'gallery' | 'zone'
}) {
  const [open, setOpen] = useState<string | null>(null)
  const photos = (gallery ?? []).filter(Boolean)
  const chips = (highlights ?? []).filter(Boolean)
  const show = (p: 'top' | 'gallery' | 'zone') => !part || part === p

  return (
    <>
      {show('top') && headline && (
        <p style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', lineHeight: 1.35, margin: '0 0 10px' }}>{headline}</p>
      )}
      {show('top') && chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {chips.map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'rgba(18,179,156,.1)', color: '#0C8F7E', fontSize: 12, fontWeight: 700 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              {highlightLabel(k)}
            </span>
          ))}
        </div>
      )}

      {show('gallery') && photos.length > 0 && (
        <>
          <div className="ping-h2">Photos</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
            {photos.map(p => (
              <button key={p} type="button" onClick={() => setOpen(p)} aria-label="Agrandir la photo"
                style={{ flex: '0 0 auto', width: 128, height: 96, borderRadius: 12, border: 'none', padding: 0, cursor: 'pointer',
                  background: `#F3F6F5 url(${listingPhotoUrl(p)}) center/cover` }} />
            ))}
          </div>
        </>
      )}

      {show('zone') && radiusKm != null && radiusKm > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#4E6470', fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
          Intervient jusqu’à {radiusKm} km{city ? ` autour de ${city}` : ' autour de sa position'}
        </div>
      )}

      {open && (
        <div onClick={() => setOpen(null)} role="dialog" aria-label="Photo"
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,30,38,.88)', display: 'grid', placeItems: 'center', padding: 16, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listingPhotoUrl(open)} alt="" style={{ maxWidth: '100%', maxHeight: '86vh', borderRadius: 12, objectFit: 'contain' }} />
          <button type="button" onClick={() => setOpen(null)} aria-label="Fermer"
            style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
    </>
  )
}
