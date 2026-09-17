"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

type Row = {
  id: string
  stars: number
  comment: string | null
  created_at: string
  ratee_id: string
}

export default function ClientAvisPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('reviews')
        .select('id, stars, comment, created_at, ratee_id')
        .eq('rater_id', user.id)
        .order('created_at', { ascending: false })
      const list = (data ?? []) as Row[]
      setRows(list)
      // Le nom affiché du pro passe par la meme fonction dediee que la fiche
      // pro (profiles est en lecture strictement personnelle) : provider_public_name.
      const map: Record<string, string> = {}
      await Promise.all(list.map(async r => {
        const { data: pub } = await supabase.rpc('provider_public_name', { provider_id: r.ratee_id })
        if (pub && pub.length) map[r.ratee_id] = pub[0].full_name
      }))
      setNames(map)
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Avis publiés</span>
      </div>

      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && (
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 14 }}>
            Vos {rows.length} avis
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun avis publié pour l&apos;instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Vos avis apparaîtront ici après vos prestations.</div>
          </div>
        )}

        {rows.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 13, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 13.5, color: '#123644' }}>
                {names[r.ratee_id] || 'Prestataire'}
              </b>
              <small style={{ color: '#9CA3AF' }}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</small>
            </div>
            <div style={{ marginTop: 6, color: 'var(--gold, #F2A93B)', fontSize: 14 }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
            {r.comment && <p style={{ marginTop: 6, fontSize: 12.5, color: '#6E8592', lineHeight: 1.5 }}>{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
