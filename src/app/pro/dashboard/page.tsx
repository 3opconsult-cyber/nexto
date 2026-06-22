"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProDashboard() {
  const [proName, setProName] = useState('...')
  const [status, setStatus] = useState('pending')
  const [stripeConnected, setStripeConnected] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
      const { data: pro } = await supabase.from('pro_profiles').select('status, stripe_account_id').eq('user_id', user.id).single()
      if (profile) setProName(profile.first_name)
      if (pro) { setStatus(pro.status); setStripeConnected(!!pro.stripe_account_id) }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy)' }}>
      <div className="px-5 pt-8 pb-4 flex justify-between items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Bonjour 👋</div>
          <div className="font-fredoka text-2xl text-white">{proName}</div>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-fredoka text-sm" style={{ background: 'var(--accent)' }}>{proName.charAt(0)}</div>
      </div>

      {status === 'pending' && (
        <div className="mx-4 mb-3 p-4 rounded-2xl" style={{ background: '#FFF7ED', border: '2px solid #FB923C' }}>
          <div className="font-black text-sm" style={{ color: '#C2410C' }}>⏳ Profil en cours de vérification (24-48h)</div>
        </div>
      )}

      {/* Encart Stripe — branchement paiement */}
      {!stripeConnected && (
        <div className="mx-4 mb-3 p-4 rounded-2xl" style={{ background: 'var(--accent-l)', border: '2px solid var(--accent)' }}>
          <div className="font-black text-sm mb-1" style={{ color: 'var(--accent-d)' }}>💳 Activez les paiements</div>
          <div className="text-xs font-bold mb-3" style={{ color: 'var(--accent-d)' }}>
            Connectez votre compte pour recevoir vos virements en séquestre. Inscription gratuite via Stripe.
          </div>
          <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 rounded-full text-white font-black text-sm text-center" style={{ background: 'var(--accent)' }}>
            Connecter mes paiements →
          </a>
        </div>
      )}

      <div className="bg-white rounded-t-3xl min-h-screen px-5 py-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[{ label: 'Revenus ce mois', value: '0 €', color: 'var(--accent)' },
            { label: 'Interventions', value: '0', color: 'var(--navy)' },
            { label: 'Note moyenne', value: '—', color: '#F59E0B' },
            { label: 'Réponse moy.', value: '—', color: 'var(--ok)' }].map(kpi => (
            <div key={kpi.label} className="p-4 rounded-2xl border-2 border-gray-100">
              <div className="font-fredoka text-2xl" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Kit communication — QR code */}
        <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--navy)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📱</span>
            <div className="flex-1">
              <div className="font-black text-sm text-white">Kit communication</div>
              <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Votre QR code à coller sur véhicule / factures</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
            <svg width="70" height="70" viewBox="0 0 70 70">
              <rect width="70" height="70" fill="white"/>
              <rect x="5" y="5" width="20" height="20" fill="#1A1033"/><rect x="10" y="10" width="10" height="10" fill="white"/>
              <rect x="45" y="5" width="20" height="20" fill="#1A1033"/><rect x="50" y="10" width="10" height="10" fill="white"/>
              <rect x="5" y="45" width="20" height="20" fill="#1A1033"/><rect x="10" y="50" width="10" height="10" fill="white"/>
              <rect x="30" y="30" width="10" height="10" fill="#7C5CFC"/><rect x="45" y="45" width="8" height="8" fill="#1A1033"/>
            </svg>
            <div className="flex-1">
              <div className="text-xs font-black text-gray-400 mb-1">Vos clients scannent → vous gardez le contact</div>
              <button className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>Télécharger le kit</button>
            </div>
          </div>
        </div>

        <div className="text-center py-8 text-gray-300">
          <div className="text-4xl mb-3">📭</div>
          <div className="font-fredoka text-lg text-gray-400">Aucune demande pour l'instant</div>
          <div className="text-sm text-gray-400 font-bold mt-1">Activez votre disponibilité pour apparaître sur la carte</div>
        </div>
      </div>
    </div>
  )
}
