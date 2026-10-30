"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import NavDrawer from '@/components/NavDrawer'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import { writeMode } from '@/lib/mode'
import { HubGroup, HubRow, HUB_ICONS } from '@/components/Hub'

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

            {/* Tout ce qui sortait du menu latéral est rangé ici, par rubrique (même présentation que
                « Mon profil » côté particulier). */}
            <HubGroup title="Mon activité">
              <HubRow icon={HUB_ICONS.agenda} label="Agenda et disponibilités" sub="Vos rendez-vous et les créneaux que les clients réservent" onClick={() => router.push('/pro/disponibilites')} />
              <HubRow icon={HUB_ICONS.history} label="Historique de mes missions" sub="Statut et montant net, mission par mission" onClick={() => setTab('missions')} />
              <HubRow icon={HUB_ICONS.alert} label="Litiges" sub="Réclamations ouvertes sur vos missions" onClick={() => router.push('/litiges')} />
            </HubGroup>

            <HubGroup title="Prix et revenus">
              <HubRow icon={HUB_ICONS.tag} label="Mes tarifs" sub="Un prix par service : forfait, à l'heure, ou forfait + heures" onClick={() => router.push('/pro/tarifs')} />
              <HubRow icon={HUB_ICONS.chart} label="Mes revenus" sub="Récapitulatif et déclaration" onClick={() => router.push('/pro/revenus')} />
              <HubRow icon={HUB_ICONS.doc} label="Mes opérations" sub="Factures émises et commissions" onClick={() => router.push('/documents')} />
              <HubRow icon={HUB_ICONS.card} label="Mes versements" sub="Compte de versement pour le paiement en ligne" onClick={() => router.push('/pro/paiements')} />
            </HubGroup>

            <HubGroup title="Mon entreprise">
              <HubRow icon={HUB_ICONS.pin} label="Coordonnées" sub={[legalLabel(pro.legal_status), city].filter(Boolean).join(' · ') || 'Adresse et statut'} onClick={() => router.push('/pro/onboarding')} />
              <HubRow icon={HUB_ICONS.id} label="Mes pièces" sub="Identité, assurance RC pro, qualification"
                badge={idOk && rcOk ? { text: 'à jour', tone: 'ok' } : { text: 'à compléter', tone: 'todo' }}
                onClick={() => router.push('/pro/documents')} />
              <HubRow icon={HUB_ICONS.eye} label="Voir mon profil public" sub="Ce que voient les clients" onClick={() => router.push(`/pro/${pro.id}`)} />
            </HubGroup>

            <HubGroup title="Plus">
              <HubRow icon={HUB_ICONS.gift} label="Mon parrainage" sub="Invitez d'autres prestataires" onClick={() => router.push('/client/parrainage')} />
              <HubRow icon={HUB_ICONS.help} label="Support PING" onClick={() => router.push('/support')} />
              <HubRow icon={HUB_ICONS.swap} label="Revenir en mode particulier" onClick={() => { writeMode('particulier'); router.push('/map') }} />
            </HubGroup>

            <div onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
              style={{ textAlign: 'center', marginTop: 16, color: '#9CA3AF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
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

    </div>
  )
}
