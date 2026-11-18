// Pictogrammes PING, repris à l'identique de la maquette (docs/audit-2026-11-07/maquette-artefact,
// objet I) : traits 2 px, coins arrondis, aucune couleur propre (currentColor). Jamais d'emoji.
// Les chemins sont aussi exportés en texte brut pour les épingles Leaflet (divIcon en HTML).
import type { CSSProperties } from 'react'

export const ICON: Record<string, string> = {
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  ag: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  ent: '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>',
  doc: '<path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2V2z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.4"/><path d="M14 10h4M14 14h3"/>',
  list: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z"/><path d="M9 12l2 2 4-4"/>',
  shieldPlain: '<path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  loc: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  // Services (catalogue src/lib/trades.ts) : un pictogramme par métier.
  s_menage: '<path d="M5 9h14l-1.6 11H6.6z"/><path d="M8 9a4 4 0 0 1 8 0"/><path d="M9.5 13v3M14.5 13v3"/>',
  s_repassage: '<path d="M2 18h16a3 3 0 0 0 3-3v-3a5 5 0 0 0-5-5H9a7 7 0 0 0-7 7z"/><path d="M11 7V5h5"/><path d="M6 14h9"/>',
  s_nettoyage: '<path d="M9 3h5v4H9z"/><path d="M14 4h3l2 2"/><path d="M8 7h7l1 4v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9z"/><path d="M10 13h3"/>',
  s_vitres: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/>',
  s_chantier: '<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-5h4v5"/>',
  s_autre: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
}

/** Pictogramme d'un métier (clé du catalogue) ; repli sur l'étiquette « autre service ». */
export function svcIconKey(trade: string | null | undefined) {
  const k = `s_${trade || ''}`
  return ICON[k] ? k : 's_autre'
}

/** Balise SVG en texte (épingles Leaflet). */
export function iconSvg(name: string, size = 18, stroke = '#fff') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.doc}</svg>`
}

export function Ic({ name, size = 20, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', ...style }}
      dangerouslySetInnerHTML={{ __html: ICON[name] || ICON.doc }} />
  )
}

/** Étoiles d'avis (★ en texte, symbole typographique toléré), remplies au prorata de la note. */
export function Stars({ r, size = 12 }: { r: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, r * 20))
  return (
    <span className="ping-stars-r" aria-label={`${r.toFixed(1).replace('.', ',')} sur 5`} style={{ fontSize: size }}>
      <span className="st0" aria-hidden="true">☆☆☆☆☆</span>
      <span className="st1" aria-hidden="true" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  )
}

/** Note au format français : 4,9. */
export const r1 = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',')
