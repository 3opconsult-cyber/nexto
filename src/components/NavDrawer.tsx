"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NavDrawer() {
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
    setOpen(false)
    router.push(path)
  }

  function switchMode() {
    setOpen(false)
    router.push(onProSide ? '/map' : (isPro ? '/pro/dashboard' : '/pro/onboarding'))
  }

  const links = onProSide
    ? [
        { label: 'Carte', path: '/map' },
        { label: 'Tableau de bord', path: '/pro/dashboard' },
        { label: 'Mes documents', path: '/pro/onboarding/documents' },
        { label: 'Messages', path: '/messages' },
      ]
    : [
        { label: 'Carte', path: '/map' },
        { label: 'Mes missions', path: '/client/profil' },
        { label: 'Mes favoris', path: '/client/favoris' },
        { label: 'Messages', path: '/messages' },
        { label: 'Mon profil', path: '/client/profil' },
      ]

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.45)', zIndex: 3000, display: 'flex', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, height: '100%', marginRight: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E7EDEB', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, flexShrink: 0 }}>{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{profile?.first_name || 'Vous'}</div>
                <div style={{ fontSize: 12, color: '#6E8592', fontWeight: 600 }}>{[profile?.city, memberYear ? `membre depuis ${memberYear}` : null].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>

            <div style={{ padding: '8px 8px', flex: 1 }}>
              {links.map(l => (
                <button key={l.label} onClick={() => go(l.path)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '13px 12px', borderRadius: 10, border: 'none', background: 'none', fontSize: 14.5, fontWeight: 700, color: '#123644', cursor: 'pointer' }}>
                  {l.label}
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
