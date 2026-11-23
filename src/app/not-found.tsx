import Link from 'next/link'
import type { Metadata } from 'next'
import { Sign, Wordmark } from '@/components/Brand'

/**
 * Page « introuvable » (statut 404).
 *
 * Avant, toute adresse inconnue tombait sur le prototype statique client.html
 * avec un statut 200 (fallback de next.config.js) : un lien mal tapé ressemblait
 * à un bug de l'app. Désormais, la vraie page, au design de l'app, avec un
 * chemin de retour vers la carte.
 */
export const metadata: Metadata = {
  title: 'Page introuvable — PING',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh', background: '#F3F6F5', color: '#123644',
      fontFamily: 'var(--font-inter), Inter, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18,
        border: '1px solid #DCE5E3', padding: '28px 22px', textAlign: 'center',
        boxShadow: '0 1px 2px rgba(18,54,68,.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Sign size={46} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-quicksand), Quicksand, sans-serif', fontWeight: 700,
          fontSize: 21, margin: 0, lineHeight: 1.3,
        }}>Cette page est introuvable</h1>
        <p style={{ fontSize: 14, color: '#4E6470', lineHeight: 1.55, margin: '10px 0 0' }}>
          L&apos;adresse est peut-être mal tapée, ou la page n&apos;existe plus.
          Revenez à la carte pour trouver un prestataire près de chez vous.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 22 }}>
          <Link href="/map" style={{
            display: 'block', background: '#0B8374', color: '#fff', textDecoration: 'none',
            fontFamily: 'var(--font-quicksand), Quicksand, sans-serif', fontWeight: 700, fontSize: 15,
            padding: 14, borderRadius: 999, boxShadow: '0 8px 18px rgba(18,179,156,.28)',
          }}>Aller à la carte</Link>
          <Link href="/pro/carte" style={{
            display: 'block', background: '#fff', color: '#123644', textDecoration: 'none',
            fontFamily: 'var(--font-quicksand), Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5,
            padding: 13, borderRadius: 999, boxShadow: '0 0 0 1px #DCE5E3',
          }}>Je suis prestataire</Link>
          <Link href="/support" style={{ color: '#0B8374', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
            Contacter le support PING
          </Link>
        </div>
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
          <Wordmark size={18} />
        </div>
      </div>
    </main>
  )
}
