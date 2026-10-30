"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import Modal from '@/components/Modal'
import { HubGroup, HubRow, HUB_ICONS } from '@/components/Hub'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 5px' }
const fieldInput: React.CSSProperties = { width: '100%', padding: '11px 13px', border: '1.5px solid #E7EDEB', borderRadius: 12, fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#123644', outline: 'none', boxSizing: 'border-box' }

export default function ClientProfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState<string>('')
  const [hasId, setHasId] = useState(false)
  const [emailOk, setEmailOk] = useState(false)
  const [uid, setUid] = useState('')
  const [editing, setEditing] = useState(false)
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
  const city = profile?.city || 'ville non renseignée'
  const phoneMasked = profile?.phone_enc ? '•• •• •• •• •• ✓' : 'Non renseigné'

  return (
    <div className="stage" id="stage">
      <div className="device"><div className="frame"><div className="screen" style={{ background: 'var(--paper)' }}>
        <section className="view on" id="v_profile" data-tab="profile">
          <div className="appbar">
            <NavDrawer dark={false} />
            <b style={{ marginLeft: 4 }}>Mon profil</b>
            <span style={{ flex: 1 }} />
            <span onClick={() => router.push('/map')} style={{ color: 'var(--teal)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>← Carte</span>
          </div>
          <div className="body">
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--coral)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Quicksand,sans-serif', fontWeight: 700, fontSize: 19, flex: '0 0 auto' }}>{initial}</div>
                <div style={{ flex: 1 }}>
                  <div className="nm" style={{ fontSize: 15 }}>{displayName}</div>
                  <div className="ds">Particulier · {city}</div>
                </div>
                <span className="edit" onClick={openEdit} style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Modifier</span>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="lrow"><span className="s">Adresse</span><span className="v" style={{ fontWeight: 600, textAlign: 'right', maxWidth: '62%' }}>{profile?.address || 'Non renseignée'}</span></div>
                <div className="lrow"><span className="s">Téléphone</span><span className="v">{phoneMasked}</span></div>
                <div className="lrow"><span className="s">E-mail</span><span className="v">{email}{email && emailOk ? ' ✓' : email ? ' · à confirmer' : ''}</span></div>
              </div>
            </div>

            {/* Même rubriques et même présentation que « Mon entreprise » côté prestataire. */}
            <HubGroup title="Mon activité">
              <HubRow icon={HUB_ICONS.list} label="Mes demandes" sub="Vos demandes publiées et les propositions reçues" onClick={() => router.push('/client/demandes')} />
              <HubRow icon={HUB_ICONS.alert} label="Mes réclamations" sub="Litiges ouverts sur vos missions" onClick={() => router.push('/litiges')} />
              <HubRow icon={HUB_ICONS.heart} label="Mes favoris" sub="Les prestataires que vous avez gardés" onClick={() => router.push('/client/favoris')} />
              <HubRow icon={HUB_ICONS.star} label="Avis publiés" onClick={() => router.push('/client/avis')} />
            </HubGroup>

            <HubGroup title="Paiements">
              <HubRow icon={HUB_ICONS.doc} label="Mes opérations" sub="Factures et reçus" onClick={() => router.push('/documents')} />
              <HubRow icon={HUB_ICONS.euro} label="Crédit d'impôt immédiat" sub="Ne payez que 50 % du ménage et du repassage" onClick={() => router.push('/client/avance-immediate')} />
              <HubRow icon={HUB_ICONS.card} label="Moyens de paiement" sub="Bientôt disponible" />
            </HubGroup>

            <HubGroup title="Mon compte">
              <HubRow icon={HUB_ICONS.id} label="Pièce d'identité" sub="Déposée sur PING, chiffrée et masquée"
                badge={hasId ? { text: 'fournie', tone: 'ok' } : { text: 'à fournir', tone: 'todo' }}
                onClick={() => router.push('/client/documents')} />
              <HubRow icon={HUB_ICONS.lock} label="Coordonnées et confidentialité" sub="Masquées jusqu'à la mission confirmée" onClick={() => router.push('/client/confidentialite')} />
            </HubGroup>

            <HubGroup title="Plus">
              <HubRow icon={HUB_ICONS.gift} label="Mon parrainage" sub="Invitez vos proches" onClick={() => router.push('/client/parrainage')} />
              <HubRow icon={HUB_ICONS.help} label="Support PING" onClick={() => router.push('/support')} />
              <HubRow icon={HUB_ICONS.swap} label="Proposer mes services" sub="Devenir prestataire : inscription gratuite" onClick={() => router.push('/pro/onboarding')} />
            </HubGroup>

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
        <label style={fieldLabel}>Adresse</label>
        <input style={fieldInput} value={f.address} autoComplete="street-address" onChange={e => setF({ ...f, address: e.target.value })} />
        <label style={fieldLabel}>Ville</label>
        <input style={fieldInput} value={f.city} autoComplete="address-level2" onChange={e => setF({ ...f, city: e.target.value })} />
        <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '10px 0 0' }}>Votre adresse n&apos;est montrée à un prestataire qu&apos;une fois une mission confirmée.</p>
        {editErr && <p style={{ color: '#C0503A', fontSize: 12.5, fontWeight: 600, margin: '10px 0 0' }}>{editErr}</p>}
        <button onClick={saveEdit} disabled={saving}
          style={{ width: '100%', marginTop: 16, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </Modal>
    </div>
  )
}
