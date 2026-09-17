"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { TRADES } from '@/lib/trades'
import NavDrawer from '@/components/NavDrawer'

const LEGAL_STATUS_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  auto_entrepreneur: 'Auto-entrepreneur',
  eirl: 'EIRL',
  eurl: 'EURL',
  sarl: 'SARL',
  sas: 'SAS',
  sasu: 'SASU',
  association: 'Association',
}

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
  const [docs, setDocs] = useState<Record<string, { status: string }>>({})
  const [servicesCount, setServicesCount] = useState(0)
  const [city, setCity] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('profiles').select('first_name, city').eq('id', user.id).single()
      if (profile) { setFirstName(profile.first_name || ''); setCity(profile.city || '') }

      const { data: pp } = await supabase.from('provider_profiles').select('*').eq('id', user.id).single()
      if (!pp) { router.push('/pro/onboarding'); return }
      setPro(pp); setAvailable(pp.is_active)

      const { data: tx } = await supabase.from('transactions').select('*').eq('seller_id', pp.id).order('created_at', { ascending: false })
      setTransactions(tx ?? [])

      const { data: inv } = await supabase.from('invoices').select('*').eq('issuer_id', pp.id).order('created_at', { ascending: false })
      setInvoices(inv ?? [])

      const { data: docRows } = await supabase.from('documents').select('kind, status').eq('owner_id', user.id)
      const docMap: Record<string, { status: string }> = {}
      ;(docRows ?? []).forEach((d: any) => { docMap[d.kind] = d })
      setDocs(docMap)

      const { count } = await supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', pp.id)
      setServicesCount(count ?? 0)

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
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
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
        {([['overview', 'Résumé'], ['missions', 'Missions'], ['factures', 'Factures'], ['profil', 'Réglages']] as const).map(([k, label]) => (
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
                Aucun document pour l'instant.
                <div style={{ fontSize: 11.5, marginTop: 6 }}>Ils sont émis à la fin de chaque mission, au scan du code de départ.</div>
              </div>
            ) : invoices.map(i => (
              // Cliquable : la fiche ouvre la previsualisation et le telechargement PDF.
              <button key={i.id} onClick={() => router.push(`/mission/${i.transaction_id}/facture`)}
                style={{ padding: 14, borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff',
                         textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>{i.number}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0C8F7E' }}>{(i.net_cents / 100).toFixed(2)} €</span>
                </div>
                <div style={{ fontSize: 11, color: '#6E8592', marginTop: 3 }}>
                  {new Date(i.issued_at).toLocaleDateString('fr-FR')} · ouvrir et télécharger
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === 'profil' && pro && (() => {
          const idOk = docs.identite?.status === 'valid' || docs.identite?.status === 'pending'
          const rcOk = docs.rcpro?.status === 'valid' || docs.rcpro?.status === 'pending'
          const tarif = [
            pro.base_price_cents > 0 ? `${(pro.base_price_cents / 100).toFixed(2)} € forfait` : null,
            (pro.hourly_rate_cents != null && pro.hourly_rate_cents > 0) ? `${(pro.hourly_rate_cents / 100).toFixed(2)} €/h` : null,
            pro.pricing_type === 'devis' ? 'Sur devis' : null,
          ].filter(Boolean).join(' · ') || 'Non renseigné'
          const Row = ({ icon, title, subtitle, onClick, badge }: { icon: JSX.Element; title: string; subtitle: string; onClick?: () => void; badge?: { label: string; ok: boolean } }) => (
            <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F3F6F5', cursor: onClick ? 'pointer' : 'default' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{title}</div>
                <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{subtitle}</div>
              </div>
              {badge && (
                <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, flexShrink: 0, background: badge.ok ? 'rgba(18,179,156,.14)' : 'rgba(242,169,59,.16)', color: badge.ok ? '#0C8F7E' : '#9A6712' }}>{badge.label}</span>
              )}
              {onClick && <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>}
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 16, borderRadius: 16, background: '#F3F6F5', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#123644', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 19, flex: '0 0 auto' }}>
                  {(pro.company_name || firstName || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{pro.company_name || firstName || 'Mon entreprise'}</div>
                  <div style={{ fontSize: 12, color: '#6E8592', marginTop: 2 }}>Prestataire · {TRADES[pro.trade] || pro.trade}{city ? ` · ${city}` : ''}</div>
                </div>
                <span onClick={() => router.push('/pro/onboarding')} style={{ color: '#0C8F7E', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Modifier</span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em' }}>Identité &amp; sécurité</div>
              <Row onClick={() => router.push('/pro/documents')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /></svg>}
                title="Pièce d'identité" subtitle="Déposée sur PING · authenticité non garantie"
                badge={{ label: idOk ? 'Fournie' : 'À fournir', ok: idOk }} />
              <Row onClick={() => router.push('/pro/documents')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" /></svg>}
                title="Assurance RC Pro" subtitle="Renseignée par vous · casse et dommage"
                badge={{ label: rcOk ? 'Renseignée' : 'À renseigner', ok: rcOk }} />

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Mon activité professionnelle</div>
              <Row onClick={() => router.push('/pro/onboarding')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M20 6L9 17l-5-5" /></svg>}
                title={TRADES[pro.trade] || pro.trade} subtitle={pro.bio || 'Aucune description ajoutée'} />
              <Row onClick={() => router.push('/pro/tarifs')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                title="Tarifs & prestations" subtitle={`${tarif}${servicesCount ? ` · ${servicesCount} prestation${servicesCount > 1 ? 's' : ''} au catalogue` : ''}`} />
              <Row icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M4 6h16v13H4z" /></svg>}
                title="Statut juridique" subtitle={LEGAL_STATUS_LABELS[pro.legal_status] || pro.legal_status} />

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 4 }}>Mon entreprise</div>
              <Row onClick={() => router.push('/pro/revenus')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M3 3v18h18M7 14l3-3 3 3 5-5" /></svg>}
                title="Mes revenus & déclaration" subtitle="Récapitulatif mensuel et annuel, DAC7" />
              <Row onClick={() => router.push('/pro/documents')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><path d="M14 4v6h6" /><path d="M4 4h10l6 6v10H4z" /></svg>}
                title="Mes pièces" subtitle="Identité, assurance, justificatifs" />
              <Row onClick={() => router.push('/pro/onboarding')}
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                title="Modifier mes informations" subtitle="Statut, coordonnées, description" />

              <div onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
                style={{ textAlign: 'center', marginTop: 6, color: '#9CA3AF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Se déconnecter
              </div>
            </div>
          )
        })()}
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
