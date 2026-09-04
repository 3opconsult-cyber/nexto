"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

export default function ClientProfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState<string>('')
  const [hasId, setHasId] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email || '')
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: docs } = await supabase.from('documents').select('kind').eq('owner_id', user.id).eq('kind', 'identite')
      setHasId(!!(docs && docs.length))
    }
    load()
  }, [router])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || 'Vous'
  const initial = (profile?.first_name || profile?.full_name || '?').charAt(0).toUpperCase()
  const city = profile?.city || 'Grasse'
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
                <span className="edit" style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Modifier</span>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="lrow"><span className="s">Adresse</span><span className="v" style={{ fontWeight: 600, textAlign: 'right', maxWidth: '62%' }}>{profile?.address || 'Non renseignée'}</span></div>
                <div className="lrow"><span className="s">Téléphone</span><span className="v">{phoneMasked}</span></div>
                <div className="lrow"><span className="s">E-mail</span><span className="v">{email}{email ? ' ✓' : ''}</span></div>
              </div>
            </div>

            <div className="h2">Identité &amp; sécurité</div>
            <div className={`vrow ${hasId ? 'ok' : ''}`}>
              <div className="vi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h4M7 14h7" /></svg></div>
              <div className="vt"><b>Pièce d&apos;identité {hasId ? 'fournie' : 'à fournir'}</b><small>Déposée sur PING · authenticité non garantie</small></div>
              <div className="vs">{hasId ? '✓ Fournie' : 'À fournir'}</div>
            </div>
            <div className="row" onClick={() => router.push('/documents')}>
              <div className="av g" style={{ width: 40, height: 40, fontSize: 15 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /></svg></div>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Mes documents &amp; identité</div><div className="ds">Pièce d&apos;identité · chiffré &amp; masqué</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" onClick={() => router.push('/documents')}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Coordonnées &amp; confidentialité</div><div className="ds">Masquées jusqu&apos;au QR · protégées</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" onClick={() => router.push('/documents')}>
              <div className="m"><div className="nm" style={{ fontSize: 13 }}>Moyens de paiement</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>

            <div className="h2">Mon activité</div>
            <div className="row" onClick={() => router.push('/documents')}>
              <div className="av gold" style={{ background: 'linear-gradient(160deg,#f2a93b,#d98a1f)', width: 40, height: 40, fontSize: 15 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M3 3v18h18M7 14l3-3 3 3 5-5" /></svg></div>
              <div className="m"><div className="nm">Mes revenus &amp; déclaration</div><div className="ds">Récapitulatif annuel · obligations fiscales</div></div>
              <span style={{ color: 'var(--slate)' }}>›</span>
            </div>
            <div className="row" onClick={() => router.push('/documents')}>
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
    </div>
  )
}
