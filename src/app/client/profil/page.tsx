"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ClientProfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: m } = await supabase.from('missions')
        .select('*').eq('client_id', user.id).order('created_at', { ascending: false })
      setProfile(p); setMissions(m ?? [])
    }
    load()
  }, [router])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className="px-5 pt-6 pb-8" style={{ background: 'var(--navy)' }}>
        <button onClick={() => router.push('/map')} className="text-white mb-4 text-sm font-black">← Carte</button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-fredoka text-xl text-white"
            style={{ background: 'var(--accent)' }}>
            {profile?.first_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <div className="font-fredoka text-xl text-white">{profile?.first_name} {profile?.last_name}</div>
            <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{profile?.phone}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5 min-h-screen">
        <h2 className="font-fredoka text-lg text-navy mb-3">Mes demandes</h2>
        {missions.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <div className="text-3xl mb-2">📭</div>
            <div className="font-bold text-sm text-gray-400">Aucune demande pour l'instant</div>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {missions.map(m => (
              <button key={m.id} onClick={() => router.push(`/mission/${m.id}/chat`)}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 hover:border-accent transition-all">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-navy">{m.ref}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>{m.status}</span>
                </div>
                <div className="text-xs font-bold text-gray-400 mt-1">{m.description?.slice(0, 60)}</div>
              </button>
            ))}
          </div>
        )}

        <h2 className="font-fredoka text-lg text-navy mb-3">Historique & factures</h2>
        <div className="p-4 rounded-2xl mb-6" style={{ background: 'var(--cream)' }}>
          <div className="text-sm font-bold text-gray-400 text-center py-4">
            Vos factures apparaîtront ici après chaque intervention payée.
          </div>
        </div>

        <button onClick={logout}
          className="w-full py-3 rounded-full font-black text-sm text-gray-400 border-2 border-gray-100">
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
