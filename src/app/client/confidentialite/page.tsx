"use client"
import { useRouter } from 'next/navigation'
import NavDrawer from '@/components/NavDrawer'

const ROWS: { ok: boolean; title: string; sub: string }[] = [
  { ok: true, title: 'Prénom & quartier approximatif', sub: 'Visibles dès le premier contact avec un prestataire' },
  { ok: false, title: 'Adresse exacte', sub: "Masquée jusqu'à la mission confirmée (aucun devis en attente)" },
  { ok: false, title: 'Téléphone & e-mail', sub: 'Jamais partagés — la messagerie PING suffit' },
]

export default function ClientConfidentialitePage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Coordonnées & confidentialité</span>
      </div>

      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 4 }}>
          Ce que voient les prestataires
        </div>
        <p style={{ fontSize: 12.5, color: '#6E8592', lineHeight: 1.5, marginBottom: 16 }}>
          Votre prénom, votre quartier approximatif et vos avis sont visibles. Le reste ne l&apos;est pas.
        </p>

        {ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${r.ok ? 'rgba(18,179,156,.4)' : '#E7EDEB'}`, borderRadius: 13, padding: '11px 12px', marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.ok ? 'rgba(18,179,156,.12)' : '#F3F6F5', color: r.ok ? '#0C8F7E' : '#9CA3AF' }}>
              {r.ok
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><path d="M4 4l16 16" /></svg>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{r.sub}</div>
            </div>
          </div>
        ))}

        <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginTop: 12 }}>
          <p style={{ fontSize: 12, color: '#6E8592', lineHeight: 1.5, margin: 0 }}>
            Vous pouvez demander la suppression de vos données à tout moment (RGPD) en contactant le{' '}
            <span style={{ color: '#0C8F7E', fontWeight: 700, cursor: 'pointer' }} onClick={() => router.push('/support')}>Support PING</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
