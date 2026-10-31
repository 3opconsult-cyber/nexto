"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CGV_VERSION } from '@/lib/cgv'

// Sous les conditions prestataires : un prestataire connecté qui ne les a pas encore acceptées (compte
// créé avant leur mise en place, ou nouvelle version) peut le faire ici.
export default function CgvAccept() {
  const [state, setState] = useState<'hidden' | 'todo' | 'done' | 'error'>('hidden')
  const [uid, setUid] = useState('')
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: pp } = await supabase.from('provider_profiles').select('cgv_version').eq('id', user.id).maybeSingle()
      if (!pp) return
      setUid(user.id)
      setState(pp.cgv_version === CGV_VERSION ? 'done' : 'todo')
    })
  }, [])
  async function accept() {
    const { error } = await createClient().from('provider_profiles')
      .update({ cgv_accepted_at: new Date().toISOString(), cgv_version: CGV_VERSION }).eq('id', uid)
    setState(error ? 'error' : 'done')
  }
  if (state === 'hidden') return null
  if (state === 'done') return <p style={{ fontSize: 13, fontWeight: 700, color: '#0C8F7E', margin: '10px 0 0' }}>Vous avez accepté ces conditions.</p>
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={accept} style={{ border: 'none', borderRadius: 999, padding: '11px 18px', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
        J&apos;accepte les CGV prestataires et le contrat de commission
      </button>
      {state === 'error' && <p style={{ color: '#c0503a', fontSize: 12.5, margin: '8px 0 0' }}>L&apos;acceptation n&apos;a pas pu être enregistrée. Réessayez.</p>}
    </div>
  )
}
