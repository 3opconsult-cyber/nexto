"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DOC_TYPES } from '@/lib/documents'

const STATUS_LABEL: Record<string, string> = {
  pending: 'En cours de vérification',
  valid: 'Validé',
  expired: 'À renouveler',
}

export default function ProAttente() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [docs, setDocs] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: pp } = await supabase.from('provider_profiles').select('is_active').eq('id', user.id).single()
      if (!pp) { router.push('/pro/onboarding'); return }
      setIsActive(pp.is_active)

      const { data: documents } = await supabase.from('documents').select('kind, status').eq('owner_id', user.id)
      const map: Record<string, string> = {}
      ;(documents ?? []).forEach((d: any) => { map[d.kind] = d.status })
      setDocs(map)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#123644' }}>
        <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', background: '#123644', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#fff', marginBottom: 10 }}>
        {isActive ? 'Votre profil est en ligne' : 'Dossier enregistré'}
      </h1>
      <p style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,.6)', maxWidth: 320, lineHeight: 1.6, marginBottom: 28 }}>
        {isActive
          ? "Vous êtes dès à présent visible sur la carte et joignable par les clients à proximité."
          : "Complétez votre profil pour apparaître sur la carte."}
      </p>

      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 16, borderRadius: 16, textAlign: 'left', background: 'rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>Documents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOC_TYPES.map(doc => {
              const status = docs[doc.key]
              return (
                <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    background: status === 'valid' ? '#12B39C' : status ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)',
                    color: '#fff',
                  }}>
                    {status === 'valid' ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: status ? '#fff' : 'rgba(255,255,255,.4)' }}>{doc.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>
                    {status ? STATUS_LABEL[status] : 'Non fourni'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <button onClick={() => router.push('/pro/onboarding/documents')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.06)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
          Compléter mes documents
        </button>
        <button onClick={() => router.push('/pro/dashboard')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
          Accéder à mon tableau de bord →
        </button>
      </div>
    </div>
  )
}
