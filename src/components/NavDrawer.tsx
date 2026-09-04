"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ICONS: Record<string, JSX.Element> = {
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  off: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M8 14h8" /></>,
  msg: <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />,
  ag: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  prof: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  ent: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M3 12h18M12 8v13" /><path d="M12 8c-1.5-4-6-4-6-1s3 1 6 1zM12 8c1.5-4 6-4 6-1s-3 1-6 1z" /></>,
}

function Icon({ name }: { name: string }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2" style={{ flexShrink: 0 }}>{ICONS[name] || ICONS.doc}</svg>
}

export default function NavDrawer({ dark = true }: { dark?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('first_name, city, created_at, is_pro, avatar_hue').eq('id', user.id).single()
      setProfile(data)
      setIsPro(!!data?.is_pro)
    })
  }, [])

  const onProSide = pathname.startsWith('/pro')
  const memberYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null
  const initial = (profile?.first_name || '?').charAt(0).toUpperCase()
  const avatarBg = profile?.avatar_hue != null ? `hsl(${profile.avatar_hue}, 55%, 45%)` : '#12B39C'

  function go(path: string) {
    router.push(path)
  }

  function switchMode() {
    router.push(onProSide ? '/map' : (isPro ? '/pro/dashboard' : '/pro/onboarding'))
  }

  const clientLinks = [
    { label: 'Carte', path: '/map', icon: 'map' },
    { label: 'Mes demandes', path: '/agenda', icon: 'off' },
    { label: 'Messages', path: '/messages', icon: 'msg' },
    { label: 'Agenda', path: '/agenda', icon: 'ag' },
    { label: 'Mes réclamations', path: '/litiges', icon: 'doc' },
    { label: 'Profil', path: '/client/profil', icon: 'prof' },
  ]
  const clientLinksBottom = [
    { label: 'Comment ça marche', path: '/comment-ca-marche', icon: 'doc' },
    { label: 'Mon parrainage', path: '/client/parrainage', icon: 'gift' },
    { label: 'Mes favoris', path: '/client/favoris', icon: 'heart' },
    { label: 'Mes documents', path: '/documents', icon: 'doc' },
    { label: 'Support PING', path: '/support', icon: 'msg' },
  ]
  const proLinks = [
    { label: 'Carte', path: '/map', icon: 'map' },
    { label: 'Demandes autour de moi', path: '/pro/dashboard', icon: 'off' },
    { label: 'Messages', path: '/messages', icon: 'msg' },
    { label: 'Agenda', path: '/agenda', icon: 'ag' },
    { label: 'Litiges', path: '/litiges', icon: 'doc' },
    { label: 'Mon entreprise', path: '/pro/dashboard', icon: 'ent' },
  ]
  const proLinksBottom = [
    { label: 'Comment ça marche', path: '/comment-ca-marche', icon: 'doc' },
    { label: 'Tableau de bord', path: '/pro/dashboard', icon: 'doc' },
    { label: 'Factures & documents', path: '/pro/dashboard', icon: 'doc' },
    { label: 'Mes pièces', path: '/pro/documents', icon: 'doc' },
    { label: 'Mon parrainage', path: '/client/parrainage', icon: 'gift' },
    { label: 'Mes documents', path: '/documents', icon: 'doc' },
    { label: 'Support PING', path: '/support', icon: 'msg' },
  ]
  const links = onProSide ? proLinks : clientLinks
  const linksBottom = onProSide ? proLinksBottom : clientLinksBottom

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: dark ? 'rgba(255,255,255,.1)' : '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark ? '#fff' : '#123644'} strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.45)', zIndex: 3000, display: 'flex', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, height: '100%', marginRight: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E7EDEB', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, flexShrink: 0 }}>{initial}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{profile?.first_name || 'Vous'}</div>
                <div style={{ fontSize: 12, color: '#6E8592', fontWeight: 600 }}>{[profile?.city, memberYear ? `membre depuis ${memberYear}` : null].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: '8px 8px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {links.map(l => (
                <button key={l.label} onClick={() => go(l.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 12px', borderRadius: 10, border: 'none', background: l.path === pathname ? '#F3F6F5' : 'none', fontSize: 14.5, fontWeight: 700, color: '#123644', cursor: 'pointer' }}>
                  <Icon name={l.icon} />{l.label}
                </button>
              ))}
              <div style={{ height: 1, background: '#E7EDEB', margin: '6px 12px' }} />
              {linksBottom.map(l => (
                <button key={l.label} onClick={() => go(l.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 12px', borderRadius: 10, border: 'none', background: l.path === pathname ? '#F3F6F5' : 'none', fontSize: 14.5, fontWeight: 700, color: '#123644', cursor: 'pointer' }}>
                  <Icon name={l.icon} />{l.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #E7EDEB' }}>
              <button onClick={switchMode}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderRadius: 14, border: 'none', background: '#123644', cursor: 'pointer' }}>
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{onProSide ? 'Revenir en mode particulier' : (isPro ? 'Passer en mode pro' : 'Devenir prestataire')}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 1 }}>{onProSide ? 'Chercher un service près de moi' : 'Proposer mes services'}</span>
                </span>
                <span style={{ width: 38, height: 22, borderRadius: 999, background: onProSide ? '#12B39C' : 'rgba(255,255,255,.18)', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: onProSide ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
