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
  const shareMsg = `Je t'invite sur PING — ${shareUrl}`

  function copyLink() {
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl)
  }
  function shareWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank')
  }
  function shareSms() {
    window.location.href = `sms:&body=${encodeURIComponent(shareMsg)}`
  }
  function shareEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent('Je t\u2019invite sur PING')}&body=${encodeURIComponent(shareMsg)}`
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={shareWhatsapp} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.6 14.3c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.6-.6-2.9-1.2-4.7-4.2-4.9-4.4-.1-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.2-.3.3-.1.6.2.3.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1l.7-.8c.2-.3.4-.2.6-.1l1.7.8c.2.1.3.2.4.3.1.2.1.9-.1 1.6z" /></svg>
                  WhatsApp
                </button>
                <button onClick={shareSms} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  SMS
                </button>
                <button onClick={shareEmail} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
                  Email
                </button>
                <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Copier
                </button>
              </div>
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
