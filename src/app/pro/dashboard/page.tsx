"use client"
import LiveZoneCard from '@/components/LiveZoneCard'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import NavDrawer from '@/components/NavDrawer'
import { Ic, Stars, r1 } from '@/components/PingIcons'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import { CGV_VERSION } from '@/lib/cgv'
import { legalFormLabel } from '@/lib/proStatus'
import { writeMode } from '@/lib/mode'
import { HubGroup, HubRow, HUB_ICONS } from '@/components/Hub'
import { documentAlerts, type DocRowFull } from '@/lib/pieces'
import ProSuspensionBanner from '@/components/ProSuspensionBanner'
import ProMonthBlock from '@/components/ProMonthBlock'
import OrdersInProgress from '@/components/OrdersInProgress'
import MonAnnonceCard from '@/components/MonAnnonceCard'
import { paymentsActive } from '@/lib/paymentsClient'
import { readScreenCache, sessionUserId } from '@/lib/screenCache'
import '../../aere.css'
import '../../aere-pro.css'
import { loadDashboardSnap, loadDashboardListing, type DashboardSnap } from '@/lib/screenLoaders'

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
  held:      { label: 'Confirmée',       color: '#0B8374', bg: 'rgba(18,179,156,.1)' },
  arrived:   { label: 'En cours',        color: '#0B8374', bg: 'rgba(18,179,156,.1)' },
  completed: { label: 'Terminée',        color: '#123644', bg: '#F3F6F5' },
  released:  { label: 'Réglée',          color: '#15803D', bg: '#DCFCE7' },
  disputed:  { label: 'En litige',       color: '#C0503A', bg: '#FEE2E2' },
  refunded:  { label: 'Remboursée',      color: '#4E6470', bg: '#F3F6F5' },
  cancelled: { label: 'Annulée',         color: '#4E6470', bg: '#F3F6F5' },
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
  // Pièces refusées, expirées ou à renouveler sous 45 jours (migration 042 ; vide avant).
  const [docRowsFull, setDocRowsFull] = useState<DocRowFull[]>([])
  const [city, setCity] = useState('')
  // « Mon annonce » : complétude (même calcul que /pro/annonce).
  const [listingPct, setListingPct] = useState<number | null>(null)
  const [listingOk, setListingOk] = useState<boolean | null>(null)
  // Encart « Paiements et fiscalité » : état honnête de chaque élément. Tant que le paiement en
  // ligne est éteint, tout se règle par virement sur facture (rien n'est débité ni versé par PING).
  const [payOn, setPayOn] = useState(false)
  const [taxId, setTaxId] = useState<string | null>(null)
  const [hasIban, setHasIban] = useState(false)
  const [more, setMore] = useState(false)
  const [idOpen, setIdOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    type Snap = DashboardSnap
    const apply = (v: Snap) => {
      setFirstName(v.firstName); setCity(v.city)
      setPro(v.pro); setAvailable(v.pro.is_active)
      setTransactions(v.tx)
      const docMap: Record<string, { status: string }> = {}
      ;(v.docRows ?? []).forEach((d: any) => { docMap[d.kind] = d })
      setDocs(docMap); setDocRowsFull(v.docRows ?? [])
      if (v.listingPct != null) setListingPct(v.listingPct)
      if (v.listingOk != null) setListingOk(v.listingOk)
      setTaxId(v.taxId); setHasIban(v.hasIban)
      setLoading(false)
    }
    ;(async () => {
      // Session locale + dernier état connu affiché tout de suite (audit 19/11, correction 3) ; toutes
      // les lectures partent ensemble (avant : 6 requêtes en chaîne, 2,3-2,8 s mesurées).
      const id = await sessionUserId(supabase)
      if (!alive) return
      if (!id) { router.push('/auth/login'); return }
      const cached = readScreenCache<Snap>('dashboard', id)
      if (cached?.pro) apply(cached)
      paymentsActive().then(v => { if (alive) setPayOn(v) })
      // Lectures partagées avec le préchargement (src/lib/screenLoaders.ts), qui remplit ce cache d'avance.
      const snap = await loadDashboardSnap(supabase, id, cached?.listingPct ?? null)
      if (!alive) return
      if (!snap) { router.push('/pro/onboarding'); return }
      apply(snap)
      loadDashboardListing(supabase, id, snap).then(r => { if (alive) { setListingPct(r.pct); setListingOk(r.ok) } }).catch(() => {})
    })()
    return () => { alive = false }
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
  const docAlerts = documentAlerts(docRowsFull)
  const piecesTodo = docAlerts.length > 0 || !(idOk && rcOk)

  const live = available && !pro?.payments_suspended_at
  // Premier écran compact (passe 2, 23/11) : une ligne par bloc, l'action en attente d'abord ; la fiche
  // (couverture, logo, fiche publique, tarifs) est derrière un appui sur la ligne de l'entreprise.
  const identityName = pro ? (pro.company_name || `Entreprise de ${firstName || ''}`.trim()) : ''

  return (
    <div className="aere aere-pro a-lift a-navy" style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      {tab === 'hub' ? (
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <NavDrawer />
          <div style={{ flex: '1 1 auto', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff', whiteSpace: 'nowrap' }}>Mon entreprise</div>
          <button onClick={toggleAvailable} aria-pressed={available}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: 'none', fontSize: 15, fontWeight: 700, background: available ? '#12B39C' : 'rgba(255,255,255,.12)', color: available ? '#fff' : 'rgba(255,255,255,.6)' }}>
            {available ? '● Visible sur la carte' : '○ Masqué'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
          <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" aria-label="Retour à Mon entreprise" onClick={() => setTab('hub')} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>{TAB_TITLES[tab]}</div>
          </div>
        </>
      )}

      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '24px 20px 28px', minHeight: '70vh' }}>
        {tab === 'hub' && pro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '4px 2px 0' }}>
            <ProSuspensionBanner />

            {/* Une question : où en sont mes commandes ? Réservation à accepter, en route, sur place, à valider, litige : une ligne chacune. */}
            <OrdersInProgress role="pro" transactions={transactions} />

            {/* Mon annonce : état, complétude, actions à un appui (mise en pause, remise en ligne, modifier, aperçu). */}
            <MonAnnonceCard pro={pro} pct={listingPct} canPublishNow={listingOk}
              onActive={v => { setAvailable(v); setPro((p: any) => ({ ...p, is_active: v })) }} />

            {/* Fiche de l'entreprise : une ligne (nom + note, ou « Nouveau »), le reste derrière un appui. */}
            <div>
              <button type="button" onClick={() => setIdOpen(o => !o)} aria-expanded={idOpen} aria-label={`${identityName} : photos, fiche publique et tarifs`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 76, padding: '16px 0', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span aria-hidden style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: pro.logo_url ? `url(${pro.logo_url}) center/cover` : '#12B39C', display: 'grid', placeItems: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>
                  {!pro.logo_url && (pro.company_name || firstName || '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 18, lineHeight: 1.35, color: '#123644', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{identityName}</b>
                  <span style={{ display: 'block', fontSize: 15, lineHeight: 1.5, color: '#4E6470' }}>
                    {pro.rating > 0 ? <><Stars r={pro.rating} size={14} /> <b style={{ color: '#123644' }}>{r1(pro.rating)}</b> ({pro.reviews_count || 0} avis)</> : 'Nouveau, pas encore d’avis'}
                  </span>
                </span>
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2} style={{ flexShrink: 0, transform: idOpen ? 'rotate(90deg)' : 'none' }}><path d="M9 6l6 6-6 6" /></svg>
              </button>
              {idOpen && (
                <div style={{ borderRadius: 16, overflow: 'hidden', background: '#F3F6F5' }}>
                  <div style={{ height: 110, position: 'relative', background: pro.photo_url ? `url(${pro.photo_url}) center/cover` : 'linear-gradient(160deg,#12B39C,#0B8374)' }}>
                    <input id="cover-input" type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage('cover', f) }} />
                    <label htmlFor="cover-input" aria-label="Changer la photo de couverture" style={{
                      position: 'absolute', right: 8, top: 8, width: 44, height: 44, borderRadius: '50%',
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
                      {/* Un seul « + » dans le cadre (celui de la couverture) : le logo se change en touchant le logo. */}
                      <label htmlFor="logo-input" aria-label="Changer le logo" style={{ position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 16 }}>
                        {uploading === 'logo' && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(18,54,68,.45)', borderRadius: 16, color: '#fff', fontSize: 11, fontWeight: 700 }}>…</span>}
                      </label>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#4E6470', marginTop: 8 }}>
                      {firstName ? `${firstName} · ` : ''}{legalLabel(pro.legal_status)}{city ? ` · ${city}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button type="button" className="btn ghost" onClick={() => router.push(`/pro/${pro.id}`)} style={{ flex: 1, minHeight: 56, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 }}>
                        <Ic name="eye" size={18} />Ma fiche publique
                      </button>
                      <button type="button" className="btn ghost" onClick={() => router.push('/pro/tarifs')} style={{ flex: 1, minHeight: 56, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 }}>
                        <Ic name="tag" size={18} />Mes tarifs
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {docAlerts.length > 0 && (
              <button type="button" onClick={() => router.push('/pro/documents')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '14px 18px', borderRadius: 16, background: '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${docAlerts.some(a => a.urgent) ? 'rgba(255,122,102,.6)' : 'rgba(242,169,59,.6)'}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644' }}>Mes pièces : à mettre à jour</span>
                  <span style={{ display: 'block', fontSize: 15, lineHeight: 1.5, fontWeight: 600, marginTop: 2, color: docAlerts[0].urgent ? '#A8432F' : '#7A5717' }}>
                    {docAlerts[0].text}{docAlerts.length > 1 ? ` · et ${docAlerts.length - 1} autre${docAlerts.length > 2 ? 's' : ''}` : ''}
                  </span>
                </span>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></svg>
              </button>
            )}


            {(() => {
              const todo: { label: string; sub: string }[] = []
              if (!idOk) todo.push({ label: 'Pièce d’identité', sub: 'Une photo suffit' })
              if (!rcOk) todo.push({ label: 'Assurance responsabilité civile', sub: 'Conseillée · une photo suffit' })
              if (!todo.length || docAlerts.length > 0) return null
              return (
                <div style={{ padding: '16px 18px', borderRadius: 16, background: '#fff', border: '1.5px solid #F2A93B' }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 4 }}>Il vous reste {todo.length} élément{todo.length > 1 ? 's' : ''} à ajouter</div>
                  {todo.map(t => (
                    <button key={t.label} type="button" onClick={() => router.push('/pro/documents')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 16, color: '#123644' }}>{t.label}</b>
                        <small style={{ display: 'block', fontSize: 15, color: '#4E6470' }}>{t.sub}</small>
                      </span>
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E6470" strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* Trois accès en tête ; tout le reste de la page est derrière « Voir plus » (un appui), rien n'est retiré. */}
            <HubGroup>
              <HubRow icon={HUB_ICONS.eye} label="Mon annonce" sub="Modifier, mettre en pause, aperçu" onClick={() => router.push('/pro/annonce')} />
              <HubRow icon={HUB_ICONS.agenda} label="Agenda et disponibilités" onClick={() => router.push('/pro/disponibilites')} />
              <HubRow icon={HUB_ICONS.chart} label="Mes revenus" onClick={() => router.push('/pro/revenus')} />
              <HubRow icon={HUB_ICONS.id} label="Mes pièces"
                badge={docAlerts.length ? { text: 'à mettre à jour', tone: 'todo' } : idOk && rcOk ? { text: 'à jour', tone: 'ok' } : { text: 'à compléter', tone: 'todo' }}
                onClick={() => router.push('/pro/documents')} />
            </HubGroup>

            {/* Maquette : « Mon activité » vient après l'annonce, la fiche et les éléments à ajouter ; le résumé du mois suit. */}
            <ProMonthBlock pro={pro} transactions={transactions} hideDispute />

            {!more && (
              <button type="button" onClick={() => setMore(true)} aria-expanded={false} aria-label="Voir plus : historique, paiements, aide"
                style={{ minHeight: 52, marginTop: 14, borderRadius: 14, border: '1.5px solid #12B39C', background: '#fff', color: '#0B8374', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                Voir plus
              </button>
            )}

            <LiveZoneCard />
            {more && <>
            <HubGroup title="Mon activité">
              <HubRow icon={HUB_ICONS.history} label="Historique de mes missions" sub="Statut et montant net, mission par mission" onClick={() => setTab('missions')} />
              <HubRow icon={HUB_ICONS.alert} label="Litiges" sub="Réclamations ouvertes sur vos missions" onClick={() => router.push('/litiges')} />
              <HubRow icon={HUB_ICONS.doc} label="Mes opérations" sub="Factures émises et commissions" onClick={() => router.push('/documents')} />
              <HubRow icon={HUB_ICONS.pin} label="Coordonnées" sub={[legalFormLabel(pro.legal_form) || legalLabel(pro.legal_status), city, pro.website ? String(pro.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : null].filter(Boolean).join(' · ') || 'Adresse, site internet et statut'} onClick={() => router.push('/pro/onboarding')} />
            </HubGroup>

            <HubGroup title="Paiements et fiscalité">
              <HubRow icon={HUB_ICONS.card} label="IBAN pour être payé par virement" sub="Vos clients vous paient par virement après l'intervention, sur facture"
                badge={hasIban ? { text: 'renseigné', tone: 'ok' } : { text: 'à renseigner', tone: 'todo' }} onClick={() => router.push('/pro/paiements')} />
              <HubRow icon={HUB_ICONS.lock} label="Prélèvement SEPA des commissions" sub={payOn ? 'Mandat de prélèvement automatique' : 'Non requis : commissions réglées par virement sur facture'}
                badge={!payOn ? { text: 'non requis', tone: 'ok' }
                  : pro.sepa_mandate_status === 'active' ? { text: 'actif', tone: 'ok' }
                  : ['revoked', 'failed'].includes(pro.sepa_mandate_status) ? { text: 'à régulariser', tone: 'todo' }
                  : { text: 'à signer', tone: 'todo' }}
                onClick={() => router.push('/pro/paiements#mandat')} />
              <HubRow icon={HUB_ICONS.euro} label="Numéro fiscal (déclaration DAC7)" sub="Transmis à l'administration avec vos revenus annuels"
                badge={taxId ? { text: 'renseigné', tone: 'ok' } : { text: 'à renseigner', tone: 'todo' }} onClick={() => router.push('/pro/revenus#fiscal')} />
              <HubRow icon={HUB_ICONS.id} label="Numéro SAP et avance immédiate Urssaf" sub="Crédit d'impôt de 50 % pour vos clients · avance immédiate pas encore ouverte"
                badge={pro.sap_number ? { text: 'renseigné', tone: 'ok' } : { text: 'à renseigner', tone: 'todo' }} onClick={() => router.push('/pro/revenus#sap')} />
              <HubRow icon={HUB_ICONS.doc} label="CGV et contrat de commission" sub="Conditions acceptées à l'inscription"
                badge={pro.cgv_accepted_at && pro.cgv_version === CGV_VERSION ? { text: 'accepté', tone: 'ok' } : pro.cgv_accepted_at ? { text: 'nouvelle version', tone: 'todo' } : { text: 'à accepter', tone: 'todo' }} onClick={() => router.push('/cgu#prestataires')} />
            </HubGroup>


            <HubGroup title="Plus">
              <HubRow icon={HUB_ICONS.gift} label="Mon parrainage" sub="Invitez d'autres prestataires" onClick={() => router.push('/client/parrainage')} />
              <HubRow icon={HUB_ICONS.help} label="Comment ça marche" sub="Une courte animation par rubrique" onClick={() => router.push('/aide')} />
              <HubRow icon={HUB_ICONS.help} label="Support PING" onClick={() => router.push('/support')} />
              <HubRow icon={HUB_ICONS.swap} label="Espace client" onClick={() => { writeMode('particulier'); router.push('/map') }} />
            </HubGroup>

            </>}

            <button type="button" onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
              style={{ alignSelf: 'center', minHeight: 44, padding: '0 16px', marginTop: 12, border: 'none', background: 'none', color: '#4E6470', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Se déconnecter
            </button>
          </div>
        )}

        {tab === 'missions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Aucune mission pour l'instant</div>
            ) : transactions.map(t => {
              const st = STATUS_LABELS[t.status] || STATUS_LABELS.pending
              return (
                <button key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                  style={{ textAlign: 'left', padding: '16px 0', borderRadius: 0, border: 'none', borderBottom: '1px solid #E3EAE8', background: 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, color: '#123644' }}>
                      {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: '#4E6470' }}>{t.requests?.category ? (TRADES[t.requests.category] || 'Prestation') : 'Prestation'}</span>
                    {(t.payout_cents || 0) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#0B8374' }}>{EUR(t.payout_cents)} net</span>}
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
