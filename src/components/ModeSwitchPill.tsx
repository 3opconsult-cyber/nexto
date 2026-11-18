"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Bouton de bascule sur la carte (maquette : .modepill, pilule dorée côté client, teal côté
// prestataire, texte encre). Libellés décidés par Romain : « Espace prestataire » / « Espace client » ;
// « Devenir prestataire » seulement pour un compte sans activité prestataire (mène à l'inscription pro).
export default function ModeSwitchPill({ to }: { to: 'pro' | 'particulier' }) {
  const router = useRouter()
  // null : pas encore lu (ou pas connecté) → rien d'affiché.
  const [hasPro, setHasPro] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setHasPro(!!data)
    })
  }, [])
  if (hasPro == null) return null
  const pro = to === 'pro'
  const label = pro ? (hasPro ? 'Espace prestataire' : 'Devenir prestataire') : 'Espace client'
  return (
    <button
      onClick={() => {
        try { localStorage.setItem('ping_mode', to) } catch { }
        window.dispatchEvent(new Event('ping-mode'))
        router.push(pro ? (hasPro ? '/pro/carte' : '/pro/onboarding') : '/map')
      }}
      style={{ border: 0, borderRadius: 999, minHeight: 38, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', background: pro ? '#F2A93B' : '#12B39C', color: '#123644', marginRight: 8, whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  )
}
