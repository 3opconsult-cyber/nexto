"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: 'Ouverte', bg: '#FFF7ED', fg: '#8a6520' },
  matched: { label: 'Attribuée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' },
  cancelled: { label: 'Annulée', bg: '#F3F6F5', fg: '#6E8592' },
  expired: { label: 'Expirée', bg: '#F3F6F5', fg: '#6E8592' },
}
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(2).replace('.', ',')} €` : '' }

export default function MesDemandesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('requests')
        .select('*').eq('requester_id', user.id).order('created_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const groups = rows.reduce((acc, r) => {
    const key = new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ;(acc[key] ||= []).push(r); return acc
  }, {} as Record<string, any[]>)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff', flex: 1 }}>Mes demandes</span>
      </div>

      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        <button onClick={() => router.push('/mission/new')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
          + Publier une demande
        </button>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Aucune demande pour l&apos;instant</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 5 }}>Personne de disponible autour de vous ? Publiez une demande, les prestataires à proximité vous font une proposition chiffrée.</div>
          </div>
        )}

        {!loading && Object.entries(groups).map(([mois, list]: [string, any[]]) => (
          <div key={mois} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>{mois}</div>
            {list.map(r => {
              const st = STATUS[r.status] || { label: r.status, bg: '#F3F6F5', fg: '#6E8592' }
              return (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>
                      {TRAD[r.category] || r.category || 'Demande'}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.fg, flexShrink: 0 }}>{st.label}</span>
                  </div>
                  {r.description && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>{r.description}</div>}
                  <div style={{ fontSize: 11, color: '#9aa6a3', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.address ? `${r.address} · ` : ''}{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                    {r.budget_cents ? <b style={{ color: '#123644' }}>{eur(r.budget_cents)}</b> : null}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <BottomTabBar />
    </div>
  )
}
