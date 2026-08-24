"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/BottomTabBar'
import NavDrawer from '@/components/NavDrawer'

function makeCode(firstName: string) {
  const base = (firstName || 'PING').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'PING'
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${suffix}`
}

export default function ParrainagePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [referrals, setReferrals] = useState<any[]>([])
  const [successfulCount, setSuccessfulCount] = useState(0)
  const [rewardsUsedThisMonth, setRewardsUsedThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      let { data: prof } = await supabase.from('profiles').select('referral_code, first_name').eq('id', user.id).single()
      let myCode = prof?.referral_code
      if (!myCode) {
        myCode = makeCode(prof?.first_name || '')
        await supabase.from('profiles').update({ referral_code: myCode }).eq('id', user.id)
      }
      setCode(myCode)

      const { data: refs } = await supabase.from('referrals').select('*').eq('referrer_id', user.id)
      setReferrals(refs ?? [])

      if (refs && refs.length > 0) {
        const referredIds = refs.map((r: any) => r.referred_id)
        const { data: txs } = await supabase.from('transactions')
          .select('buyer_id, seller_id, status')
          .or(`buyer_id.in.(${referredIds.join(',')}),seller_id.in.(${referredIds.join(',')})`)
          .in('status', ['completed', 'released'])
        const successfulIds = new Set<string>()
        ;(txs ?? []).forEach((t: any) => {
          if (referredIds.includes(t.buyer_id)) successfulIds.add(t.buyer_id)
          if (referredIds.includes(t.seller_id)) successfulIds.add(t.seller_id)
        })
        setSuccessfulCount(successfulIds.size)

        const now = new Date()
        const usedThisMonth = refs.filter((r: any) => {
          if (!r.reward_used_at) return false
          const d = new Date(r.reward_used_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length
        setRewardsUsedThisMonth(usedThisMonth)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const rewardsUsedTotal = referrals.filter(r => r.reward_used_at).length
  const rewardsAvailable = Math.max(0, successfulCount - rewardsUsedTotal)
  const eligibleNow = rewardsAvailable > 0 && rewardsUsedThisMonth === 0

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/signup?ref=${code}` : ''

  function copyLink() {
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Mon parrainage</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
        ) : (
          <>
            <div style={{ background: '#123644', borderRadius: 18, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Votre code</div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: '.06em', marginBottom: 14 }}>{code}</div>
              <button onClick={copyLink} style={{ padding: '11px 20px', borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
                Copier le lien de parrainage
              </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#123644', marginBottom: 4 }}>La règle</div>
              <p style={{ fontSize: 12.5, color: '#6E8592', lineHeight: 1.6, margin: 0 }}>
                Chaque filleul qui termine sa première mission sur PING vous offre une commission gratuite sur votre prochaine transaction — plafonnée à 50 €, une fois par mois maximum.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22 }}>{referrals.length}</div>
                <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600, marginTop: 2 }}>Filleul{referrals.length > 1 ? 's' : ''} inscrit{referrals.length > 1 ? 's' : ''}</div>
              </div>
              <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22 }}>{successfulCount}</div>
                <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600, marginTop: 2 }}>Parrainage{successfulCount > 1 ? 's' : ''} abouti{successfulCount > 1 ? 's' : ''}</div>
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 16, background: eligibleNow ? 'rgba(18,179,156,.1)' : '#F3F6F5', border: eligibleNow ? '1px solid rgba(18,179,156,.3)' : '1px solid #E7EDEB' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                {eligibleNow ? 'Récompense disponible ce mois-ci' : rewardsAvailable > 0 ? 'Récompense déjà utilisée ce mois-ci' : 'Aucune récompense disponible pour l\u2019instant'}
              </div>
              <p style={{ fontSize: 12, color: '#6E8592', marginTop: 4, lineHeight: 1.5 }}>
                {eligibleNow
                  ? 'Elle s\u2019appliquera automatiquement une fois le paiement en ligne activé.'
                  : rewardsAvailable > 0
                    ? 'Une nouvelle récompense sera utilisable le mois prochain.'
                    : 'Parrainez quelqu\u2019un qui termine une mission pour en débloquer une.'}
              </p>
            </div>
          </>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
