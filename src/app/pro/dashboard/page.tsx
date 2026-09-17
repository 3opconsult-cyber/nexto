"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const [tab, setTab] = useState<'hub' | 'overview' | 'missions' | 'factures'>('hub')
  const [docs, setDocs] = useState<Record<string, { status: string }>>({})
  const [city, setCity] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})

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
      if (tx?.length) {
        const { data: nrows } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: tx.map((t: any) => t.id) })
        const nmap: Record<string, string> = {}
        ;(nrows ?? []).forEach((n: any) => { if (n.full_name) nmap[n.transaction_id] = n.full_name })
        setNames(nmap)
      }

      const { data: inv } = await supabase.from('invoices').select('*').eq('issuer_id', pp.id).order('created_at', { ascending: false })
      setInvoices(inv ?? [])

      const { data: docRows } = await supabase.from('documents').select('kind, status').eq('owner_id', user.id)
      const docMap: Record<string, { status: string }> = {}
      ;(docRows ?? []).forEach((d: any) => { docMap[d.kind] = d })
      setDocs(docMap)

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

  const idOk = docs.identite?.status === 'valid' || docs.identite?.status === 'pending'
  const rcOk = docs.rcpro?.status === 'valid' || docs.rcpro?.status === 'pending'
  const diplomeOk = docs.diplome?.status === 'valid' || docs.diplome?.status === 'pending'
  const TAB_TITLES: Record<string, string> = { overview: 'Tableau de bord', missions: 'Missions', factures: 'Factures & documents' }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>

      {tab === 'hub' ? (
        <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>Mon entreprise</div>
          <button onClick={toggleAvailable}
            style={{ padding: '9px 14px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, background: available ? '#12B39C' : 'rgba(255,255,255,.12)', color: available ? '#fff' : 'rgba(255,255,255,.6)' }}>
            {available ? '● Visible sur la carte' : '○ Masqué'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => setTab('hub')} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M15 6l-6 6 6 6" /></svg>
          </div>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>{TAB_TITLES[tab]}</div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '22px 18px', minHeight: '70vh' }}>
        {tab === 'hub' && pro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 18, borderRadius: 16, background: 'linear-gradient(160deg,#12B39C,#0C8F7E)', color: '#fff' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 19, marginBottom: 10 }}>
                {(pro.company_name || firstName || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 19 }}>{pro.company_name || `Entreprise de ${firstName || ''}`.trim()}</div>
              <div style={{ fontSize: 12.5, opacity: .9, marginTop: 3 }}>
                {firstName ? `${firstName} · ` : ''}{LEGAL_STATUS_LABELS[pro.legal_status] || pro.legal_status}{city ? ` · ${city}` : ''}
              </div>
              <span onClick={() => router.push('/pro/onboarding')} style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Modifier</span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>Mon activité</div>
            {[
              { k: 'overview', label: 'Tableau de bord', sub: 'Revenus · statistiques · tarifs', color: '#12B39C,#0C8F7E', icon: <path d="M4 4h7v7H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 13h7v7H4z" /> },
              { k: 'missions', label: 'Demandes directes', sub: 'Réservations reçues · devis', color: '#F2A93B,#d98a1f', icon: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></> },
              { k: 'factures', label: 'Factures & documents', sub: 'Horodatés · exportables', color: '#6E8592,#4c6472', icon: <path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2V2z" /> },
            ].map(row => (
              <div key={row.k} onClick={() => setTab(row.k as any)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F3F6F5', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(160deg,${row.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>{row.icon}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{row.label}</div>
                  <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{row.sub}</div>
                </div>
                <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em' }}>Conformité</span>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: idOk && rcOk ? 'rgba(18,179,156,.14)' : 'rgba(242,169,59,.16)', color: idOk && rcOk ? '#0C8F7E' : '#9A6712' }}>
                {idOk && rcOk ? 'à jour' : 'à compléter'}
              </span>
            </div>
            {[
              { ok: idOk, label: 'Identité & statut', sub: 'Fichier masqué · déclaré', icon: <rect x="3" y="5" width="18" height="14" rx="2" /> },
              { ok: rcOk, label: 'Responsabilité civile pro', sub: 'Assurance déclarée', icon: <path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" /> },
              { ok: diplomeOk, label: 'Diplôme ou qualification', sub: 'Certification (facultatif)', icon: <path d="M12 2l9 5-9 5-9-5 9-5z" /> },
            ].map(r => (
              <div key={r.label} onClick={() => router.push('/pro/documents')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${r.ok ? 'rgba(18,179,156,.3)' : '#E7EDEB'}`, cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: r.ok ? 'rgba(18,179,156,.12)' : '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={r.ok ? '#0C8F7E' : '#9CA3AF'} strokeWidth={2}>{r.icon}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: '#123644' }}>{r.label}</div>
                  <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>{r.sub}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: r.ok ? '#0C8F7E' : '#9A6712' }}>{r.ok ? 'Fourni' : 'À fournir'}</span>
              </div>
            ))}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 6 }}>Mes pièces & documents</div>
            <div onClick={() => router.push('/pro/documents')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F3F6F5', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(160deg,#12B39C,#0e7f70)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M6 2h9l3 3v17H6z" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Pièces justificatives</div>
                <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>Identité · assurance · diplôme</div>
              </div>
              <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>
            </div>

            <div onClick={() => { localStorage.setItem('ping_mode', 'particulier'); router.push('/map') }}
              style={{ textAlign: 'center', marginTop: 10, padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              Revenir en mode particulier
            </div>
            <div onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
              style={{ textAlign: 'center', marginTop: 2, color: '#9CA3AF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Se déconnecter
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => router.push('/pro/tarifs')} style={{ flex: 1, padding: '12px 6px', borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff', fontSize: 11.5, fontWeight: 700, color: '#123644' }}>Mes tarifs</button>
              <button onClick={() => router.push('/pro/revenus')} style={{ flex: 1, padding: '12px 6px', borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff', fontSize: 11.5, fontWeight: 700, color: '#123644' }}>Mes revenus</button>
              <button onClick={() => router.push('/pro/documents')} style={{ flex: 1, padding: '12px 6px', borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff', fontSize: 11.5, fontWeight: 700, color: '#123644' }}>Documents</button>
            </div>
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

            {transactions.some(t => ['pending', 'arrived'].includes(t.status)) && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Prochains rendez-vous</div>
                {transactions.filter(t => ['pending', 'arrived'].includes(t.status)).slice(0, 3).map(t => (
                  <button key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, border: '1px solid #E7EDEB', background: '#fff', marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(160deg,#F2A93B,#d98a1f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {(names[t.id] || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#123644' }}>{names[t.id] || 'Client'}</div>
                      <div style={{ fontSize: 11, color: '#6E8592', marginTop: 1 }}>{new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: t.status === 'arrived' ? 'rgba(18,179,156,.12)' : '#FFF7ED', color: t.status === 'arrived' ? '#0C8F7E' : '#8a6520' }}>
                      {t.status === 'arrived' ? 'En cours' : 'À confirmer'}
                    </span>
                  </button>
                ))}
              </>
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

      </div>

      {/* Nav bas */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E7EDEB', padding: '10px 24px', display: 'flex', justifyContent: 'space-around' }}>
        <button onClick={() => setTab('hub')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: tab === 'hub' ? '#12B39C' : '#9CA3AF' }}>Entreprise</span>
        </button>
        <button onClick={() => router.push('/map')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>Carte</span>
        </button>
      </div>
    </div>
  )
}
