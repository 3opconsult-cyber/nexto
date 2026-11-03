"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Bouton de bascule sur la carte : visible seulement si le compte a un profil prestataire créé.
export default function ModeSwitchPill({ to }: { to: 'pro' | 'particulier' }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setOk(!!data)
    })
  }, [])
  if (!ok) return null
  const pro = to === 'pro'
  return (
    <button
      onClick={() => {
        try { localStorage.setItem('ping_mode', to) } catch { }
        window.dispatchEvent(new Event('ping-mode'))
        router.push(pro ? '/pro/carte' : '/map')
      }}
      style={{ border: 0, borderRadius: 999, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', background: pro ? '#F2A93B' : '#12B39C', color: '#fff', marginRight: 8, whiteSpace: 'nowrap' }}
    >
      {pro ? 'Passer en pro' : 'Passer en particulier'}
    </button>
  )
}
