"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import { HubGroup, HubRow, HUB_ICONS } from '@/components/Hub'
import OrdersInProgress from '@/components/OrdersInProgress'
import { writeMode } from '@/lib/mode'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 5px' }
const fieldInput: React.CSSProperties = { width: '100%', padding: '11px 13px', border: '1.5px solid #E7EDEB', borderRadius: 12, fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644', outline: 'none', boxSizing: 'border-box' }

export default function ClientProfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState<string>('')
  const [hasId, setHasId] = useState(false)
  const [emailOk, setEmailOk] = useState(false)
  const [uid, setUid] = useState('')
  const [toPay, setToPay] = useState(0)
  const [editing, setEditing] = useState(false)
  const [more, setMore] = useState(false)
  const [coord, setCoord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', address: '', city: '' })

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email || '')
      setEmailOk(!!user.email_confirmed_at)
      setUid(user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      // « Fournie » seulement pour une pièce en cours de traitement ou acceptée — pas refusée ni expirée.
      const { data: docs } = await supabase.from('documents').select('status').eq('owner_id', user.id).eq('kind', 'identite')
      setHasId(!!docs?.some(d => d.status === 'pending' || d.status === 'valid'))
      // Virements du particulier encore à faire (même source que l'écran Paiements).
      const { count } = await supabase.from('transfer_payments').select('id', { count: 'exact', head: true }).eq('payer_id', user.id).eq('payer_role', 'client').neq('status', 'recu')
      setToPay(count ?? 0)
    }
    load()
  }, [router])

  function openEdit() {
    setF({
      first_name: profile?.first_name || '', last_name: profile?.last_name || '',
      phone: profile?.phone_enc || '', address: profile?.address || '', city: profile?.city || '',
    })
    setEditErr(''); setEditing(true)
  }

  async function saveEdit() {
    if (!f.first_name.trim() || !f.last_name.trim()) { setEditErr('Le prénom et le nom sont obligatoires.'); return }
    // Adresse obligatoire (lot 12) : une fois renseignée, elle se modifie mais ne s'efface plus.
    if (profile?.address?.trim() && !f.address.trim()) { setEditErr('L’adresse est obligatoire : modifiez-la plutôt que de l’effacer.'); return }
    setSaving(true); setEditErr('')
    const patch = {
      first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      full_name: `${f.first_name.trim()} ${f.last_name.trim()}`,
      phone_enc: f.phone.trim() || null, address: f.address.trim() || null, city: f.city.trim() || null,
    }
    const { data, error } = await createClient().from('profiles').update(patch).eq('id', uid).select().maybeSingle()
    setSaving(false)
    if (error || !data) { setEditErr('L’enregistrement a échoué. Réessayez dans un instant.'); return }
    setProfile(data); setEditing(false)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || 'Vous'
  const initial = (profile?.first_name || profile?.full_name || '?').charAt(0).toUpperCase()
  const phoneMasked = profile?.phone_enc ? '•• •• •• •• •• ✓' : 'Non renseigné'
  // Profil complet (barre de la maquette) : e-mail confirmé, téléphone, adresse, pièce d'identité. Montrée seulement s'il manque quelque chose.
  const steps: [string, boolean][] = [['E-mail confirmé', !!emailOk], ['Téléphone', !!profile?.phone_enc], ['Adresse', !!profile?.address], ['Pièce d’identité', hasId]]
  const done = steps.filter(x => x[1]).length
  const todo = steps.filter(x => !x[1]).map(x => x[0]).join(', ')

  return (
    <div className="stage" id="stage">
      <div className="device"><div className="frame"><div className="screen" style={{ background: 'var(--paper)' }}>
        <section className="view on" id="v_profile" data-tab="profile">
          {/* Racine d'onglet : pas de flèche ni de « ← Carte » (la barre du bas et le menu mènent à la carte). */}
          <div className="appbar">
            <b>Mon profil</b>
          </div>
          <div className="body">
            {/* Une ligne : nom et ville ; adresse, téléphone, e-mail et « Modifier » derrière un appui. */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button type="button" onClick={() => setCoord(o => !o)} aria-expanded={coord} aria-label={`${displayName} : mes coordonnées`}
                style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', minHeight: 64, padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--coral)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 18, flex: '0 0 auto' }}>{initial}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="nm" style={{ display: 'block', fontSize: 15 }}>{displayName}</span>
                  <span className="ds" style={{ display: 'block' }}>{profile?.city || 'Particulier'}</span>
                </span>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--slate)" strokeWidth={2.2} style={{ flexShrink: 0, transform: coord ? 'rotate(90deg)' : 'none' }}><path d="M9 6l6 6-6 6" /></svg>
              </button>
              {coord && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '8px 14px 12px' }}>
                  <div className="lrow"><span className="s">Adresse</span><span className="v" style={{ fontWeight: 600, textAlign: 'right', maxWidth: '62%' }}>{profile?.address || 'Non renseignée'}</span></div>
                  <div className="lrow"><span className="s">Téléphone</span><span className="v">{phoneMasked}</span></div>
                  <div className="lrow"><span className="s">E-mail</span><span className="v">{email}{email && emailOk ? ' ✓' : email ? ' · à confirmer' : ''}</span></div>
                  <button type="button" onClick={openEdit}
                    style={{ width: '100%', minHeight: 48, marginTop: 8, borderRadius: 14, border: '1.5px solid var(--teal)', background: '#fff', color: 'var(--teal)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Modifier mes informations
                  </button>
                </div>
              )}
            </div>
            <OrdersInProgress role="particulier" title="Mes commandes en cours" topGap={28} />
            {done < 4 && (
              <div style={{ margin: '10px 2px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                  <b>Profil complet : {done} sur 4</b><span style={{ color: 'var(--slate)', textAlign: 'right' }}>{todo}</span>
                </div>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                  <i style={{ display: 'block', height: '100%', width: `${done * 25}%`, background: 'var(--teal)' }} />
                </div>
              </div>
            )}

            {/* Deux accès en tête (demandes, paiements) ; le reste derrière « Voir plus » (un appui). */}
            <HubGroup title="Mon activité">
              <HubRow icon={HUB_ICONS.list} label="Mes demandes" onClick={() => router.push('/client/demandes')} />
              <HubRow icon={HUB_ICONS.card} label="Paiements" sub={toPay > 0 ? `${toPay} à régler` : undefined} onClick={() => router.push('/client/paiements')} />
              {!hasId && <HubRow icon={HUB_ICONS.id} label="Pièce d'identité" badge={{ text: 'à fournir', tone: 'todo' }} onClick={() => router.push('/client/documents')} />}
              {more && <>
                <HubRow icon={HUB_ICONS.doc} label="Mes factures" sub="Factures et reçus" onClick={() => router.push('/documents')} />
                <HubRow icon={HUB_ICONS.alert} label="Mes réclamations" sub="Litiges ouverts sur vos missions" onClick={() => router.push('/litiges')} />
                <HubRow icon={HUB_ICONS.heart} label="Mes favoris" sub="Prestataires gardés" onClick={() => router.push('/client/favoris')} />
              </>}
            </HubGroup>

            {!more && (
              <button type="button" onClick={() => setMore(true)} aria-expanded={false}
                style={{ width: '100%', minHeight: 48, marginTop: 16, borderRadius: 14, border: '1.5px solid var(--teal)', background: '#fff', color: 'var(--teal)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Voir plus : factures, compte, aide
              </button>
            )}
            {more && <>
            <HubGroup title="Mon compte">
              {hasId && <HubRow icon={HUB_ICONS.id} label="Pièce d'identité" sub="Déposée sur PING, chiffrée et masquée"
                badge={{ text: 'fournie', tone: 'ok' }}
                onClick={() => router.push('/client/documents')} />}
              <HubRow icon={HUB_ICONS.lock} label="Coordonnées et confidentialité" sub="Masquées jusqu'à la mission confirmée" onClick={() => router.push('/client/confidentialite')} />
              {/* Libellés de bascule décidés par Romain : « Espace prestataire » pour un compte qui a déjà une
                  activité prestataire, « Devenir prestataire » sinon. */}
              {profile?.is_pro
                ? <HubRow icon={HUB_ICONS.swap} label="Espace prestataire" sub="Mes demandes, mes missions, mon entreprise" onClick={() => { writeMode('pro'); router.push('/pro/carte') }} />
                : <HubRow icon={HUB_ICONS.swap} label="Devenir prestataire" sub="Proposer mes services : inscription gratuite" onClick={() => router.push('/pro/onboarding')} />}
            </HubGroup>

            <HubGroup title="Plus">
              <HubRow icon={HUB_ICONS.doc} label="Déposer une demande" sub="Une annonce à votre adresse" onClick={() => router.push('/client/demandes/new')} />
              <HubRow icon={HUB_ICONS.star} label="Avis publiés" onClick={() => router.push('/client/avis')} />
              <HubRow icon={HUB_ICONS.euro} label="Crédit d'impôt immédiat" sub="Ne payez que 50 % du ménage et du repassage" onClick={() => router.push('/client/avance-immediate')} />
              <HubRow icon={HUB_ICONS.gift} label="Mon parrainage" sub="Invitez vos proches" onClick={() => router.push('/client/parrainage')} />
              <HubRow icon={HUB_ICONS.help} label="Comment ça marche" sub="Une courte animation par rubrique" onClick={() => router.push('/aide')} />
              <HubRow icon={HUB_ICONS.help} label="Support PING" onClick={() => router.push('/support')} />
            </HubGroup>
            </>}

            <div onClick={logout} style={{ textAlign: 'center', marginTop: 16, color: 'var(--slate)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Se déconnecter</div>
          </div>
        </section>
      </div></div></div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Mes informations">
        <label style={fieldLabel}>Prénom</label>
        <input style={fieldInput} value={f.first_name} autoComplete="given-name" onChange={e => setF({ ...f, first_name: e.target.value })} />
        <label style={fieldLabel}>Nom</label>
        <input style={fieldInput} value={f.last_name} autoComplete="family-name" onChange={e => setF({ ...f, last_name: e.target.value })} />
        <label style={fieldLabel}>Téléphone</label>
        <input style={fieldInput} type="tel" value={f.phone} autoComplete="tel" onChange={e => setF({ ...f, phone: e.target.value })} />
        <label style={fieldLabel}>Adresse (obligatoire)</label>
        <input style={fieldInput} value={f.address} autoComplete="street-address" onChange={e => setF({ ...f, address: e.target.value })} />
        <label style={fieldLabel}>Ville</label>
        <input style={fieldInput} value={f.city} autoComplete="address-level2" onChange={e => setF({ ...f, city: e.target.value })} />
        <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '10px 0 0' }}>Votre adresse n&apos;est montrée à un prestataire qu&apos;une fois une mission confirmée.</p>
        {editErr && <p style={{ color: '#C0503A', fontSize: 12.5, fontWeight: 600, margin: '10px 0 0' }}>{editErr}</p>}
        <button onClick={saveEdit} disabled={saving}
          style={{ width: '100%', marginTop: 16, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </Modal>
    </div>
  )
}
