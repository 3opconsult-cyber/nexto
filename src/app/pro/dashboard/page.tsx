"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import NavDrawer from '@/components/NavDrawer'
import BottomTabBar from '@/components/BottomTabBar'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import { writeMode } from '@/lib/mode'

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
// Statut juridique lisible, même pour une valeur non prévue dans la liste (jamais la clé brute).
const legalLabel = (k?: string | null) => !k ? '' : LEGAL_STATUS_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '))

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
  const [uploading, setUploading] = useState<'cover' | 'logo' | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'hub' | 'missions'>('hub')
  const [docs, setDocs] = useState<Record<string, { status: string }>>({})
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

      const { data: tx } = await supabase.from('transactions').select('*, requests(category)').eq('seller_id', pp.id).order('created_at', { ascending: false })
      setTransactions(tx ?? [])

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
    const { error } = await supabase.from('provider_profiles').update({ is_active: newVal }).eq('id', pro.id)
    if (error) setAvailable(!newVal)
  }

  // Couverture + logo de la fiche établissement (façon fiche Google) : le
  // bucket `avatars` existait déjà, configuré (public en lecture, upload
  // restreint à son propre dossier) mais jamais branché. Un seul fichier par
  // type (upsert) pour ne pas accumuler d'anciennes images orphelines.
  async function uploadImage(kind: 'cover' | 'logo', file: File) {
    if (!pro) return
    setUploading(kind)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${pro.id}/${kind}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (!upErr) {
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const col = kind === 'cover' ? 'photo_url' : 'logo_url'
      const url = `${pub.publicUrl}?v=${Date.now()}` // cache-bust après upsert
      await supabase.from('provider_profiles').update({ [col]: url }).eq('id', pro.id)
      setPro((p: any) => ({ ...p, [col]: url }))
    }
    setUploading(null)
  }

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
  const TAB_TITLES: Record<string, string> = { missions: 'Historique des missions' }

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
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#F3F6F5' }}>
              <div style={{
                height: 110, position: 'relative',
                background: pro.photo_url ? `url(${pro.photo_url}) center/cover` : 'linear-gradient(160deg,#12B39C,#0C8F7E)',
              }}>
                <input id="cover-input" type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage('cover', f) }} />
                <label htmlFor="cover-input" style={{
                  position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(18,54,68,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  {uploading === 'cover'
                    ? <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>…</span>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>}
                </label>
              </div>

              <div style={{ padding: '0 16px 16px', marginTop: -32 }}>
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16, border: '3px solid #fff', overflow: 'hidden',
                    background: pro.logo_url ? `url(${pro.logo_url}) center/cover` : '#12B39C',
                    display: 'grid', placeItems: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff',
                  }}>
                    {!pro.logo_url && (pro.company_name || firstName || '?').charAt(0).toUpperCase()}
                  </div>
                  <input id="logo-input" type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage('logo', f) }} />
                  <label htmlFor="logo-input" style={{
                    position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: '50%',
                    background: '#12B39C', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    {uploading === 'logo'
                      ? <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>…</span>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>}
                  </label>
                </div>

                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#123644', marginTop: 10 }}>
                  {pro.company_name || `Entreprise de ${firstName || ''}`.trim()}
                </div>
                <div style={{ fontSize: 12.5, color: '#6E8592', marginTop: 3 }}>
                  {firstName ? `${firstName} · ` : ''}{legalLabel(pro.legal_status)}{city ? ` · ${city}` : ''}
                </div>
                <span onClick={() => router.push('/pro/onboarding')} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: '#0C8F7E', cursor: 'pointer', textDecoration: 'underline' }}>Modifier</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em' }}>Conformité</span>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: idOk && rcOk ? 'rgba(18,179,156,.14)' : 'rgba(242,169,59,.16)', color: idOk && rcOk ? '#0C8F7E' : '#9A6712' }}>
                {idOk && rcOk ? 'à jour' : 'à compléter'}
              </span>
            </div>
            {[
              { ok: idOk, label: 'Identité & statut', sub: 'Fichier masqué · déclaré', icon: <rect x="3" y="5" width="18" height="14" rx="2" /> },
              { ok: rcOk, label: 'Responsabilité civile pro', sub: 'Assurance déclarée', icon: <path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" /> },
              { ok: diplomeOk, label: 'Diplôme ou qualification', sub: 'Qualification déclarée (facultatif)', icon: <path d="M12 2l9 5-9 5-9-5 9-5z" /> },
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

            <div onClick={() => router.push('/pro/disponibilites')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F3F6F5', cursor: 'pointer', marginTop: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(160deg,#12B39C,#0C8F7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Mes disponibilités</div>
                <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>Les créneaux que vos clients réservent en un clic</div>
              </div>
              <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>
            </div>

            <div onClick={() => setTab('missions')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F3F6F5', cursor: 'pointer', marginTop: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(160deg,#6E8592,#4c6472)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Historique de mes missions</div>
                <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>Statut et montant net, mission par mission</div>
              </div>
              <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>
            </div>

            {[
              { label: 'Mes tarifs', sub: 'Vos prestations et leurs prix', path: '/pro/tarifs', icon: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></> },
              { label: 'Mes revenus', sub: 'Récapitulatif et déclaration', path: '/pro/revenus', icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" /> },
              { label: 'Mes versements', sub: 'Compte de versement pour le paiement en ligne', path: '/pro/paiements', icon: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></> },
              { label: 'Voir mon profil public', sub: 'Ce que voient les clients', path: `/pro/${pro.id}`, icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></> },
            ].map(r => (
              <div key={r.path} onClick={() => router.push(r.path)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EDEB', cursor: 'pointer' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{r.sub}</div>
                </div>
                <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>
              </div>
            ))}

            <div onClick={() => { writeMode('particulier'); router.push('/map') }}
              style={{ textAlign: 'center', marginTop: 10, padding: 13, borderRadius: 999, border: '1.5px solid #DCE5E3', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              Revenir en mode particulier
            </div>
            <div onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
              style={{ textAlign: 'center', marginTop: 2, color: '#9CA3AF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Se déconnecter
            </div>
          </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: '#6E8592' }}>{t.requests?.category ? (TRADES[t.requests.category] || 'Prestation') : 'Prestation'}</span>
                    {(t.payout_cents || 0) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#0C8F7E' }}>{EUR(t.payout_cents)} net</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

      </div>

      <BottomTabBar />
    </div>
  )
}
