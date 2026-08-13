"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TRADES: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage' }

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'En attente',      color: '#8a6520', bg: '#FFF7ED' },
  held:      { label: 'Confirmée',       color: '#0C8F7E', bg: 'rgba(18,179,156,.1)' },
  arrived:   { label: 'En cours',        color: '#0C8F7E', bg: 'rgba(18,179,156,.1)' },
  completed: { label: 'Terminée',        color: '#123644', bg: '#F3F6F5' },
  released:  { label: 'Réglée',          color: '#15803D', bg: '#DCFCE7' },
  disputed:  { label: 'En litige',       color: '#B91C1C', bg: '#FEE2E2' },
  refunded:  { label: 'Remboursée',      color: '#6E8592', bg: '#F3F6F5' },
  cancelled: { label: 'Annulée',         color: '#6E8592', bg: '#F3F6F5' },
}

export default function ProDashboard() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [pro, setPro] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'missions' | 'factures' | 'profil'>('overview')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
      if (profile) setFirstName(profile.first_name || '')

      const { data: pp } = await supabase.from('provider_profiles').select('*').eq('id', user.id).single()
      if (!pp) { router.push('/pro/onboarding'); return }
      setPro(pp); setAvailable(pp.is_active)

      const { data: tx } = await supabase.from('transactions').select('*').eq('seller_id', pp.id).order('created_at', { ascending: false })
      setTransactions(tx ?? [])

      const { data: inv } = await supabase.from('invoices').select('*').eq('issuer_id', pp.id).order('created_at', { ascending: false })
      setInvoices(inv ?? [])

      setLoading(false)
    }
    load()
  }, [router])

  async function toggleAvailable() {
    if (!pro) return
    const supabase = createClient()
    const newVal = !available
    setAvailable(newVal)
    await supabase.from('provider_profiles').update({ is_active: newVal }).eq('id', pro.id)
  }

  const now = new Date()
  const completedStatuses = ['completed', 'released']
  const txThisMonth = transactions.filter(t => {
    const d = new Date(t.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && completedStatuses.includes(t.status)
  })
  const caMoisCents = txThisMonth.reduce((s, t) => s + (t.payout_cents || 0), 0)
  const completedCount = transactions.filter(t => completedStatuses.includes(t.status)).length
  const totalCommissionCents = transactions
    .filter(t => completedStatuses.includes(t.status))
    .reduce((s, t) => s + (t.seller_fee_cents || 0), 0)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#123644' }}>
        <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>{firstName || 'Bonjour'}</div>
        </div>
        <button onClick={toggleAvailable}
          style={{ padding: '9px 14px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, background: available ? '#12B39C' : 'rgba(255,255,255,.12)', color: available ? '#fff' : 'rgba(255,255,255,.6)' }}>
          {available ? '● Visible sur la carte' : '○ Masqué'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 4 }}>
        {([['overview', 'Résumé'], ['missions', 'Missions'], ['factures', 'Factures'], ['profil', 'Profil']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex: 1, padding: '10px 0', borderRadius: '12px 12px 0 0', border: 'none', fontSize: 12, fontWeight: 700, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#123644' : 'rgba(255,255,255,.5)' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '22px 18px', minHeight: '70vh' }}>
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(18,179,156,.08)' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#0C8F7E' }}>{(caMoisCents / 100).toFixed(0)} €</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Revenus ce mois</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{completedCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Missions terminées</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#F59E0B' }}>{Number(pro?.rating) > 0 ? Number(pro.rating).toFixed(1) : '—'}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>{pro?.reviews_count ?? 0} avis</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{(totalCommissionCents / 100).toFixed(0)} €</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Commission PING versée</div>
              </div>
            </div>

            {transactions.length === 0 && (
              <div style={{ padding: 18, borderRadius: 14, background: '#F3F6F5', fontSize: 12.5, color: '#6E8592', fontWeight: 600, textAlign: 'center' }}>
                Aucune mission pour l'instant. Votre profil est {available ? 'visible sur la carte' : 'actuellement masqué'} — les demandes apparaîtront ici dès qu'un client vous contacte.
              </div>
            )}
          </>
        )}

        {tab === 'missions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Aucune mission pour l'instant</div>
            ) : transactions.map(t => {
              const st = STATUS_LABELS[t.status] || STATUS_LABELS.pending
              return (
                <button key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                  style={{ textAlign: 'left', padding: 14, borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>
                      {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0C8F7E' }}>{((t.payout_cents || 0) / 100).toFixed(2)} € net</div>
                </button>
              )
            })}
          </div>
        )}

        {tab === 'factures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>
                Aucune facture émise pour l'instant.
                <div style={{ fontSize: 11.5, marginTop: 6 }}>Les factures apparaissent ici après chaque mission réglée.</div>
              </div>
            ) : invoices.map(i => (
              <div key={i.id} style={{ padding: 14, borderRadius: 14, border: '1px solid #E7EDEB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>{i.number}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0C8F7E' }}>{(i.net_cents / 100).toFixed(2)} €</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'profil' && pro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 16, background: '#F3F6F5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Service principal</div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{TRADES[pro.trade] || pro.trade}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F3F6F5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Tarif</div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>
                {pro.pricing_type === 'horaire' ? `${(pro.hourly_rate_cents / 100).toFixed(2)} €/h` : `${(pro.base_price_cents / 100).toFixed(2)} € forfait`}
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F3F6F5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: '#3d5560', lineHeight: 1.5 }}>{pro.bio || 'Aucune description ajoutée.'}</div>
            </div>
            <button onClick={() => router.push('/pro/onboarding')}
              style={{ width: '100%', padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
              Modifier mes informations
            </button>
            <button onClick={() => router.push('/pro/onboarding/documents')}
              style={{ width: '100%', padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
              Gérer mes documents
            </button>
          </div>
        )}
      </div>

      {/* Nav bas */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E7EDEB', padding: '10px 24px', display: 'flex', justifyContent: 'space-around' }}>
        <button onClick={() => router.push('/pro/dashboard')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#12B39C' }}>Tableau</span>
        </button>
        <button onClick={() => router.push('/map')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>Carte</span>
        </button>
      </div>
    </div>
  )
}
