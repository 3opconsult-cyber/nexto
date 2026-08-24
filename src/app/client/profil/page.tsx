"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

export default function ClientProfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [txs, setTxs] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: t } = await supabase.from('transactions')
        .select('*, requests(address, description)')
        .eq('buyer_id', user.id).order('created_at', { ascending: false })
      setProfile(p); setTxs(t ?? [])
    }
    load()
  }, [router])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente', held: 'En attente', arrived: 'En cours', completed: 'Terminée',
    released: 'Réglée', disputed: 'En litige', refunded: 'Remboursée', cancelled: 'Annulée',
  }
  const completedStatuses = ['completed', 'released']

  const completedCount = txs.filter(t => completedStatuses.includes(t.status)).length
  const totalSpentCents = txs.filter(t => completedStatuses.includes(t.status)).reduce((s, t) => s + (t.total_charged_cents || 0), 0)

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || 'Vous'
  const initial = (profile?.first_name || profile?.full_name || '?').charAt(0).toUpperCase()
  const avatarBg = profile?.avatar_hue != null ? `hsl(${profile.avatar_hue}, 55%, 45%)` : 'var(--accent)'

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className="px-5 pt-5 pb-8" style={{ background: 'var(--navy)' }}>
        <div className="flex items-center justify-between mb-5">
          <NavDrawer />
          <button onClick={() => router.push('/map')} className="text-white text-sm font-black">← Carte</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-fredoka text-xl text-white flex-shrink-0"
            style={{ background: avatarBg }}>
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-fredoka text-xl text-white truncate">{displayName}</div>
            <div className="text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{profile?.address || 'Adresse non renseignée'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5 min-h-screen" style={{ paddingBottom: 76 }}>

        <div className="grid grid-cols-2 gap-2.5 mb-6">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(18,179,156,.08)' }}>
            <div className="font-fredoka text-2xl text-navy">{completedCount}</div>
            <div className="text-xs font-bold text-gray-400 mt-1">Mission{completedCount > 1 ? 's' : ''} terminée{completedCount > 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-2xl p-4 border" style={{ borderColor: 'var(--line, #E7EDEB)' }}>
            <div className="font-fredoka text-2xl text-navy">{(totalSpentCents / 100).toFixed(0)} €</div>
            <div className="text-xs font-bold text-gray-400 mt-1">Dépensé au total</div>
          </div>
        </div>

        <h2 className="font-fredoka text-lg text-navy mb-3">Mes missions</h2>
        {txs.length === 0 ? (
          <div className="text-center py-10 rounded-2xl mb-6" style={{ background: 'var(--cream)' }}>
            <div className="font-bold text-sm text-gray-400">Aucune mission pour l'instant</div>
            <button onClick={() => router.push('/map')} className="mt-3 text-xs font-black" style={{ color: 'var(--accent-d)' }}>Trouver un prestataire →</button>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {txs.map(t => (
              <button key={t.id} onClick={() => router.push(`/mission/${t.id}/chat`)}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 hover:border-accent transition-all">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-navy">{t.requests?.address || 'Adresse non renseignée'}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
                    style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>{STATUS_LABELS[t.status] || t.status}</span>
                </div>
                <div className="text-xs font-bold text-gray-400 mt-1">{t.requests?.description?.slice(0, 60)}</div>
                <div className="text-xs font-bold text-gray-400 mt-1">{(t.total_charged_cents / 100).toFixed(2)} €</div>
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
      <BottomTabBar />
    </div>
  )
}
