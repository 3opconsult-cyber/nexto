"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProDashboard() {
  const [proName, setProName] = useState('...')
  const [status, setStatus] = useState('pending')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
      const { data: pro } = await supabase.from('pro_profiles').select('status').eq('user_id', user.id).single()
      if (profile) setProName(profile.first_name)
      if (pro) setStatus(pro.status)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy)' }}>
      <div className="px-5 pt-8 pb-4 flex justify-between items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider mb-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}>Bonjour 👋</div>
          <div className="font-fredoka text-2xl text-white">{proName}</div>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-fredoka text-sm"
          style={{ background: 'var(--accent)' }}>
          {proName.charAt(0)}
        </div>
      </div>

      {status === 'pending' && (
        <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: '#FFF7ED', border: '2px solid #FB923C' }}>
          <div className="font-black text-sm" style={{ color: '#C2410C' }}>
            ⏳ Votre profil est en cours de vérification (24-48h)
          </div>
          <div className="text-xs font-bold mt-1" style={{ color: '#C2410C' }}>
            Vous recevrez une notification dès l'activation.
          </div>
        </div>
      )}

      <div className="bg-white rounded-t-3xl min-h-screen px-5 py-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Revenus ce mois', value: '0 €', color: 'var(--accent)' },
            { label: 'Interventions', value: '0', color: 'var(--navy)' },
            { label: 'Note moyenne', value: '—', color: '#F59E0B' },
            { label: 'Réponse moy.', value: '—', color: 'var(--ok)' },
          ].map(kpi => (
            <div key={kpi.label} className="p-4 rounded-2xl border-2 border-gray-100">
              <div className="font-fredoka text-2xl" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">{kpi.label}</div>
            </div>
          ))}
        </div>
        <div className="text-center py-12 text-gray-300">
          <div className="text-4xl mb-3">📭</div>
          <div className="font-fredoka text-lg text-gray-400">Aucune demande pour l'instant</div>
          <div className="text-sm text-gray-400 font-bold mt-1">
            Activez votre disponibilité pour apparaître sur la carte
          </div>
        </div>
      </div>
    </div>
  )
}
