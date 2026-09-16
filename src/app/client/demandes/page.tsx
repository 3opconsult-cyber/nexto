"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
const DONE = ['completed', 'released']
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(2).replace('.', ',')} €` : '' }

export default function MesDemandesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [tx, setTx] = useState<Record<string, { id: string; status: string }>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('requests')
      .select('*').eq('requester_id', user.id).order('created_at', { ascending: false })
    const list = data ?? []
    setRows(list)
    const ids = list.map((r: any) => r.id)
    if (ids.length) {
      const { data: txs } = await supabase.from('transactions').select('id, request_id, status').in('request_id', ids)
      const m: Record<string, { id: string; status: string }> = {}
      ;(txs ?? []).forEach((t: any) => { if (t.request_id) m[t.request_id] = { id: t.id, status: t.status } })
      setTx(m)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function badge(r: any) {
    const t = tx[r.id]
    if (r.status === 'cancelled') return { label: 'Annulée', bg: '#F3F6F5', fg: '#6E8592' }
    if (t && DONE.includes(t.status)) return { label: 'Terminée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (t) return { label: 'Attribuée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (r.status === 'open') return { label: 'Ouverte', bg: '#FFF7ED', fg: '#8a6520' }
    return { label: r.status, bg: '#F3F6F5', fg: '#6E8592' }
  }

  async function cancel(r: any) {
    setBusy(r.id)
    const supabase = createClient()
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', r.id)
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x))
    setBusy('')
  }
  async function remove(r: any) {
    if (!confirm('Supprimer définitivement cette demande ?')) return
    setBusy(r.id)
    const supabase = createClient()
    const { error } = await supabase.from('requests').delete().eq('id', r.id)
    if (error) { alert('Impossible de supprimer : cette demande est liée à une mission. Vous pouvez l\u2019annuler.'); setBusy(''); return }
    setRows(rs => rs.filter(x => x.id !== r.id))
    setBusy('')
  }

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
              const b = badge(r)
              const t = tx[r.id]
              const isDone = t && DONE.includes(t.status)
              const canCancel = r.status !== 'cancelled' && !isDone
              return (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, opacity: busy === r.id ? .5 : 1 }}>
                  <div onClick={() => t && router.push(`/mission/${t.id}/chat`)} style={{ cursor: t ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{TRAD[r.category] || r.category || 'Demande'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: b.bg, color: b.fg, flexShrink: 0 }}>{b.label}</span>
                    </div>
                    {r.description && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>{r.description}</div>}
                    <div style={{ fontSize: 11, color: '#9aa6a3', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{r.address ? `${r.address} · ` : ''}{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                      {r.budget_cents ? <b style={{ color: '#123644' }}>{eur(r.budget_cents)}</b> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F4' }}>
                    {t && <span onClick={() => router.push(`/mission/${t.id}/chat`)} style={{ fontSize: 12, fontWeight: 700, color: '#0C8F7E', cursor: 'pointer' }}>Voir la mission ›</span>}
                    {canCancel && <span onClick={() => cancel(r)} style={{ fontSize: 12, fontWeight: 700, color: '#8a6520', cursor: 'pointer' }}>Annuler</span>}
                    <span onClick={() => remove(r)} style={{ fontSize: 12, fontWeight: 700, color: '#c0503a', cursor: 'pointer', marginLeft: 'auto' }}>Supprimer</span>
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
