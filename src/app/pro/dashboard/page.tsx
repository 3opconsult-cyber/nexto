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
import { usePendingBookings, deadlineLeft } from '@/lib/booking'
import { paymentsActive } from '@/lib/paymentsClient'
import { readScreenCache, sessionUserId } from '@/lib/screenCache'
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
  held:      { label: 'Confirmée',       color: '#0C8F7E', bg: 'rgba(18,179,156,.1)' },
  arrived:   { label: 'En cours',        color: '#0C8F7E', bg: 'rgba(18,179,156,.1)' },
  completed: { label: 'Terminée',        color: '#123644', bg: '#F3F6F5' },
  released:  { label: 'Réglée',          color: '#15803D', bg: '#DCFCE7' },
  disputed:  { label: 'En litige',       color: '#C0503A', bg: '#FEE2E2' },
  refunded:  { label: 'Remboursée',      color: '#4E6470', bg: '#F3F6F5' },
  cancelled: { label: 'Annulée',         color: '#4E6470', bg: '#F3F6F5' },
}

export default function ProDashboard() {
  const router = useRouter()
  // Réservations directes en attente de ma réponse (migration 052 ; liste vide avant).
  const bookings = usePendingBookings(true)
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
  // Encart « Paiements et fiscalité » : état honnête de chaque élément. Tant que le paiement en
  // ligne est éteint, tout se règle par virement sur facture (rien n'est débité ni versé par PING).
  const [payOn, setPayOn] = useState(false)
  const [taxId, setTaxId] = useState<string | null>(null)
  const [hasIban, setHasIban] = useState(false)

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
      loadDashboardListing(supabase, id, snap).then(pct => { if (alive) setListingPct(pct) }).catch(() => {})
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

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>

      {tab === 'hub' ? (
        <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>Mon entreprise</div>
          <button onClick={toggleAvailable}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, background: available ? '#12B39C' : 'rgba(255,255,255,.12)', color: available ? '#fff' : 'rgba(255,255,255,.6)' }}>
            {available ? '● Visible sur la carte' : '○ Masqué'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" aria-label="Retour à Mon entreprise" onClick={() => setTab('hub')} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>{TAB_TITLES[tab]}</div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '22px 18px', minHeight: '70vh' }}>
        {tab === 'hub' && pro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ProSuspensionBanner />
            {/* « Mon annonce » en tête, comme l'annonce d'un hôte Airbnb : état et complétude. */}
            {(() => {
              const live = available && !pro.payments_suspended_at
              return (
                // Carte « Mon annonce » de la maquette (.annc) : titre, étiquette d'état, jauge, conseil.
                <button onClick={() => router.push('/pro/annonce')}
                  style={{ textAlign: 'left', width: '100%', padding: 14, borderRadius: 16, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    border: `1px solid ${live ? 'rgba(18,179,156,.45)' : '#E7EDEB'}`, background: live ? 'rgba(18,179,156,.06)' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <b style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Mon annonce</b>
                    <span className={`mq-tag ${live ? '' : 'warn'}`} style={pro.payments_suspended_at ? { background: '#FEE2E2', color: '#C0503A' } : undefined}>
                      {pro.payments_suspended_at ? 'Suspendue' : live ? 'En ligne, visible sur la carte' : 'Hors ligne'}
                    </span>
                  </div>
                  {listingPct != null && (
                    <>
                      <div style={{ height: 6, borderRadius: 999, background: '#E3EBE9', overflow: 'hidden', margin: '10px 0 4px' }}>
                        <div style={{ width: `${listingPct}%`, height: '100%', background: '#12B39C', borderRadius: 999 }} />
                      </div>
                      <small style={{ display: 'block', fontSize: 11.5, color: '#4E6470', lineHeight: 1.45 }}>
                        Complète à {listingPct} %{listingPct < 100 ? ' · voir ce qui manque' : ''} · plus vos pièces sont validées, plus vous apparaissez en tête
                      </small>
                    </>
                  )}
                </button>
              )
            })()}
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#F3F6F5' }}>
              <div style={{
                height: 110, position: 'relative',
                background: pro.photo_url ? `url(${pro.photo_url}) center/cover` : 'linear-gradient(160deg,#12B39C,#0C8F7E)',
              }}>
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
                  <label htmlFor="logo-input" aria-label="Changer le logo" style={{
                    position: 'absolute', right: -10, bottom: -10, width: 36, height: 36, borderRadius: '50%',
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
                <div style={{ fontSize: 12.5, color: '#4E6470', marginTop: 3 }}>
                  {firstName ? `${firstName} · ` : ''}{legalLabel(pro.legal_status)}{city ? ` · ${city}` : ''}
                </div>
                {/* Note (maquette) : étoiles au prorata, ou « Nouveau ». */}
                <p style={{ marginTop: 4, fontSize: 13, color: '#123644' }}>
                  {pro.rating > 0 ? <><Stars r={pro.rating} size={13} /> <b>{r1(pro.rating)}</b> <span style={{ color: '#4E6470' }}>({pro.reviews_count || 0} avis)</span></> : <span style={{ color: '#4E6470' }}>Nouveau, pas encore d&apos;avis</span>}
                </p>
                {/* Raccourcis (audit 19/11, correction 16) : pièces et revenus sans défiler. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => router.push(`/pro/${pro.id}`)} style={{ minHeight: 44, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, position: 'relative' }}>
                    <Ic name="eye" size={18} />Ma fiche publique
                  </button>
                  <button type="button" className="btn ghost" onClick={() => router.push('/pro/tarifs')} style={{ minHeight: 44, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, position: 'relative' }}>
                    <Ic name="tag" size={18} />Mes tarifs
                  </button>
                  <button type="button" className="btn ghost" onClick={() => router.push('/pro/documents')} style={{ minHeight: 44, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, position: 'relative' }}>
                    <Ic name="id" size={18} />Mes pièces{piecesTodo && <span aria-label="À compléter" style={{ width: 9, height: 9, borderRadius: '50%', background: '#E5484D', position: 'absolute', top: 8, right: 10 }} />}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => router.push('/pro/revenus')} style={{ minHeight: 44, padding: '10px 8px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, position: 'relative' }}>
                    <Ic name="card" size={18} />Mes revenus
                  </button>
                </div>
                <button type="button" onClick={() => router.push('/pro/onboarding')} className="btn ghost" style={{ width: '100%', minHeight: 44, marginTop: 10, padding: '0 12px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 }}>Modifier mes informations</button>
              </div>
            </div>

            {/* Réservations directes à accepter (052) : un appui ouvre la conversation, où sont Accepter / Refuser. */}
            {bookings.length > 0 && (
              <button type="button" onClick={() => router.push(`/mission/${bookings[0].id}/chat`)}
                style={{ width: '100%', margin: '0 0 12px', minHeight: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, border: '1.5px solid #F2A93B', background: '#FFF7ED', textAlign: 'left', cursor: 'pointer' }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#E8743B', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                    {bookings.length > 1 ? `${bookings.length} nouvelles réservations : accepter` : 'Nouvelle réservation : accepter'}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#8a6520', fontWeight: 600, marginTop: 2 }}>Répondez sous {deadlineLeft(bookings[0].accept_deadline)}, sinon elle est annulée</span>
                </span>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a6520" strokeWidth={2.4}><path d="M9 6l6 6-6 6" /></svg>
              </button>
            )}

            {docAlerts.length > 0 && (
              <div role="status" style={{ margin: '0 0 12px', padding: '12px 14px', borderRadius: 14, background: '#fff', border: `1px solid ${docAlerts.some(a => a.urgent) ? 'rgba(255,122,102,.45)' : 'rgba(242,169,59,.5)'}` }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', marginBottom: 6 }}>Mes pièces : à mettre à jour</div>
                {docAlerts.map(a => (
                  <div key={a.kind} style={{ fontSize: 12.5, color: a.urgent ? '#A8432F' : '#7A5717', fontWeight: 600, lineHeight: 1.5 }}>{a.text}</div>
                ))}
                <button type="button" onClick={() => router.push('/pro/documents')} style={{ marginTop: 8, minHeight: 44, width: '100%', border: '1.5px solid #12B39C', borderRadius: 999, background: '#fff', padding: '0 14px', color: '#0C8F7E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ouvrir Mes pièces</button>
              </div>
            )}

            <LiveZoneCard />

            <ProMonthBlock pro={pro} transactions={transactions} />

            {/* Tout ce qui sortait du menu latéral est rangé ici, par rubrique (même présentation que
                « Mon profil » côté particulier). */}
            <HubGroup title="Mon activité">
              <HubRow icon={HUB_ICONS.agenda} label="Agenda et disponibilités" sub="Vos rendez-vous et les créneaux que les clients réservent" onClick={() => router.push('/pro/disponibilites')} />
              <HubRow icon={HUB_ICONS.history} label="Historique de mes missions" sub="Statut et montant net, mission par mission" onClick={() => setTab('missions')} />
              <HubRow icon={HUB_ICONS.alert} label="Litiges" sub="Réclamations ouvertes sur vos missions" onClick={() => router.push('/litiges')} />
            </HubGroup>

            <HubGroup title="Prix et revenus">
              <HubRow icon={HUB_ICONS.tag} label="Mes tarifs" sub="Vos prestations : forfait, à l'heure, sur devis, avec photo" onClick={() => router.push('/pro/tarifs')} />
              <HubRow icon={HUB_ICONS.chart} label="Mes revenus" sub="Récapitulatif et déclaration" onClick={() => router.push('/pro/revenus')} />
              <HubRow icon={HUB_ICONS.doc} label="Mes opérations" sub="Factures émises et commissions" onClick={() => router.push('/documents')} />
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

            <HubGroup title="Mon entreprise">
              <HubRow icon={HUB_ICONS.pin} label="Coordonnées" sub={[legalFormLabel(pro.legal_form) || legalLabel(pro.legal_status), city, pro.website ? String(pro.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : null].filter(Boolean).join(' · ') || 'Adresse, site internet et statut'} onClick={() => router.push('/pro/onboarding')} />
              <HubRow icon={HUB_ICONS.id} label="Mes pièces" sub="Identité, assurance RC pro, qualification"
                badge={docAlerts.length ? { text: 'à mettre à jour', tone: 'todo' } : idOk && rcOk ? { text: 'à jour', tone: 'ok' } : { text: 'à compléter', tone: 'todo' }}
                onClick={() => router.push('/pro/documents')} />
              <HubRow icon={HUB_ICONS.eye} label="Mon annonce" sub="Photos, présentation, points forts, mise en ligne"
                badge={listingPct === 100 ? { text: 'complète', tone: 'ok' } : listingPct != null ? { text: `${listingPct} %`, tone: 'todo' } : undefined}
                onClick={() => router.push('/pro/annonce')} />
            </HubGroup>

            <HubGroup title="Plus">
              <HubRow icon={HUB_ICONS.gift} label="Mon parrainage" sub="Invitez d'autres prestataires" onClick={() => router.push('/client/parrainage')} />
              <HubRow icon={HUB_ICONS.help} label="Comment ça marche" sub="Une courte animation par rubrique" onClick={() => router.push('/aide')} />
              <HubRow icon={HUB_ICONS.help} label="Support PING" onClick={() => router.push('/support')} />
              <HubRow icon={HUB_ICONS.swap} label="Espace client" onClick={() => { writeMode('particulier'); router.push('/map') }} />
            </HubGroup>

            <button type="button" onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); router.push('/') }}
              style={{ alignSelf: 'center', minHeight: 44, padding: '0 16px', marginTop: 12, border: 'none', background: 'none', color: '#4E6470', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Se déconnecter
            </button>
          </div>
        )}

        {tab === 'missions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Aucune mission pour l'instant</div>
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
                    <span style={{ fontSize: 12.5, color: '#4E6470' }}>{t.requests?.category ? (TRADES[t.requests.category] || 'Prestation') : 'Prestation'}</span>
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
