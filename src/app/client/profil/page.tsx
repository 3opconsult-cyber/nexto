"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'
import Modal from '@/components/Modal'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 5px' }
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

            <div className="h2">Identité &amp; sécurité</div>
            <div className={`vrow ${hasId ? 'ok' : ''}`}>
              <div className="vi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h4M7 14h7" /></svg></div>
              <div className="vt"><b>Pièce d&apos;identité {hasId ? 'fournie' : 'à fournir'}</b><small>Déposée sur PING · authenticité non garantie</small></div>
              <div className="vs">{hasId ? '✓ Fournie' : 'À fournir'}</div>
            </div>
            <div className="row" onClick={() => router.push('/client/documents')}>
              <div className="av g" style={{ width: 40, height: 40, fontSize: 15 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /></svg></div>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Mes documents &amp; identité</div><div className="ds">Pièce d&apos;identité · chiffré &amp; masqué</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" onClick={() => router.push('/client/confidentialite')}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Coordonnées &amp; confidentialité</div><div className="ds">Masquées jusqu&apos;à la mission confirmée · protégées</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" style={{ cursor: 'default' }}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Moyens de paiement</div><div className="ds">Bientôt disponible</div></div>
            </div>
            <div className="row" onClick={() => router.push('/client/avance-immediate')}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Crédit d&apos;impôt immédiat</div><div className="ds">Ne payez que 50 % du ménage et du repassage</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>

            <div className="h2">Mon activité</div>
            <div className="row" onClick={() => router.push('/documents')}>
              <div className="av gold" style={{ background: 'linear-gradient(160deg,#f2a93b,#d98a1f)', width: 40, height: 40, fontSize: 15 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M3 3v18h18M7 14l3-3 3 3 5-5" /></svg></div>
              <div className="m"><div className="nm">Mes opérations</div><div className="ds">Réservations, factures et reçus</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" onClick={() => router.push('/client/avis')}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Avis publiés</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>

            <div className="h2">Vous proposez vos services&nbsp;?</div>
            <div className="card" style={{ padding: 14 }}>
              <div className="nm" style={{ fontSize: 14 }}>Devenez professionnel sur PING</div>
              <div className="sub" style={{ margin: '4px 0 12px' }}>Choisissez votre statut juridique — inscription gratuite, immédiate et non bloquante.</div>
              <div className="btn gold sm" onClick={() => router.push('/pro/onboarding')}>Saisir mon statut &amp; devenir pro</div>
            </div>

            <div onClick={logout} style={{ textAlign: 'center', marginTop: 18, color: 'var(--slate)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Se déconnecter</div>
          </div>
        </section>
        <BottomTabBar />
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
        <p style={{ fontSize: 11.5, color: '#6E8592', lineHeight: 1.5, margin: '10px 0 0' }}>Votre adresse n&apos;est montrée à un prestataire qu&apos;une fois une mission confirmée.</p>
        {editErr && <p style={{ color: '#C0503A', fontSize: 12.5, fontWeight: 600, margin: '10px 0 0' }}>{editErr}</p>}
        <button onClick={saveEdit} disabled={saving}
          style={{ width: '100%', marginTop: 16, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </Modal>
    </div>
  )
}
