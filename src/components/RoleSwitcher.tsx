"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RoleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const [isPro, setIsPro] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsPro(false); return }
      const { data } = await supabase.from('profiles').select('is_pro').eq('id', user.id).single()
      setIsPro(!!data?.is_pro)
    })
  }, [])

  const onProSide = pathname.startsWith('/pro')

  return (
    <div style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.1)' }}>
      <button onClick={() => router.push('/map')}
        style={{ padding: '7px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: !onProSide ? '#12B39C' : 'transparent', color: '#fff' }}>
        Particulier
      </button>
      <button onClick={() => router.push(isPro ? '/pro/dashboard' : '/pro/onboarding')}
        style={{ padding: '7px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: onProSide ? '#12B39C' : 'transparent', color: onProSide ? '#fff' : 'rgba(255,255,255,.6)' }}>
        {isPro === null ? 'Prestataire' : isPro ? 'Prestataire' : 'Devenir prestataire'}
      </button>
    </div>
  )
}
