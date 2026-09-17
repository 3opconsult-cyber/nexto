"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
const DONE = ['completed', 'released']
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(0)} €` : '' }

type Tx = { id: string; status: string; counterpart: string }

export default function MesDemandesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [txByRequest, setTxByRequest] = useState<Record<string, Tx[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

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
      // Une demande ouverte peut recevoir plusieurs propositions (un pro = une
      // transaction) : on les groupe toutes par demande, pas seulement la
      // derniere, sinon les autres propositions disparaissent silencieusement.
      const { data: txs } = await supabase.from('transactions').select('id, request_id, status').in('request_id', ids)
      const { data: names } = txs?.length
        ? await supabase.rpc('transaction_counterparts', { p_transaction_ids: txs.map((t: any) => t.id) })
        : { data: [] }
      const nameById: Record<string, string> = {}
      ;(names ?? []).forEach((n: any) => { if (n.full_name) nameById[n.transaction_id] = n.full_name })
      const grouped: Record<string, Tx[]> = {}
      ;(txs ?? []).forEach((t: any) => {
        if (!t.request_id) return
        ;(grouped[t.request_id] ||= []).push({ id: t.id, status: t.status, counterpart: nameById[t.id] || 'Prestataire' })
      })
      setTxByRequest(grouped)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function badge(r: any) {
    const group = txByRequest[r.id] || []
    if (r.status === 'cancelled') return { label: 'Annulée', bg: '#F3F6F5', fg: '#6E8592' }
    if (group.some(t => DONE.includes(t.status))) return { label: 'Terminée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (group.length > 0) return { label: `${group.length} proposition${group.length > 1 ? 's' : ''}`, bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (r.status === 'open') return { label: 'En attente', bg: '#FFF7ED', fg: '#8a6520' }
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
    if (error) { alert('Impossible de supprimer : cette demande est liée à une mission. Vous pouvez l’annuler.'); setBusy(''); return }
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
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 4 }}>Publiez votre demande</div>
        <p style={{ fontSize: 12.5, color: '#6E8592', marginBottom: 14, lineHeight: 1.5 }}>
          Personne de disponible autour de vous ? Décrivez ce dont vous avez besoin : les prestataires à proximité vous font une proposition chiffrée.
        </p>
        <button onClick={() => router.push('/client/demandes/new')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
          + Publier une demande
        </button>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Aucune demande pour l&apos;instant</div>
          </div>
        )}

        {!loading && Object.entries(groups).map(([mois, list]: [string, any[]]) => (
          <div key={mois} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>{mois}</div>
            {list.map(r => {
              const b = badge(r)
              const group = txByRequest[r.id] || []
              const isDone = group.some(t => DONE.includes(t.status))
              const canCancel = r.status !== 'cancelled' && !isDone
              const isOpen = expanded === r.id
              const budgetTxt = r.budget_min_cents || r.budget_max_cents
                ? `${eur(r.budget_min_cents) || '0 €'} – ${eur(r.budget_max_cents) || eur(r.budget_min_cents)}`
                : (r.budget_cents ? eur(r.budget_cents) : null)
              return (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, opacity: busy === r.id ? .5 : 1 }}>
                  <div onClick={() => group.length ? setExpanded(isOpen ? null : r.id) : undefined} style={{ cursor: group.length ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{r.title || TRAD[r.category] || r.category || 'Demande'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: b.bg, color: b.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#0C8F7E', fontWeight: 700, marginTop: 3 }}>{TRAD[r.category] || r.category}</div>
                    {r.description && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>{r.description}</div>}
                    <div style={{ fontSize: 11, color: '#9aa6a3', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{r.frequency && r.frequency !== 'ponctuel' ? ` · ${r.frequency}` : ''}</span>
                      {budgetTxt ? <b style={{ color: '#123644' }}>{budgetTxt}</b> : null}
                    </div>
                  </div>

                  {isOpen && group.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F4', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.map(t => (
                        <div key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', borderRadius: 10, background: '#F3F6F5', cursor: 'pointer' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#123644' }}>{t.counterpart}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0C8F7E' }}>Voir la conversation ›</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F4' }}>
                    {canCancel && <span onClick={() => cancel(r)} style={{ fontSize: 12, fontWeight: 700, color: '#8a6520', cursor: 'pointer' }}>Annuler</span>}
                    <span onClick={() => remove(r)} style={{ fontSize: 12, fontWeight: 700, color: '#c0503a', cursor: 'pointer', marginLeft: 'auto' }}>Supprimer</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {!loading && rows.length > 0 && (
          <p style={{ fontSize: 10.5, color: '#9CA3AF', lineHeight: 1.5, textAlign: 'center', marginTop: 4 }}>
            Votre adresse exacte reste masquée tant que vous n&apos;avez pas accepté une proposition.
          </p>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
