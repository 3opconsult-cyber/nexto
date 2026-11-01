"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import QrCode from '@/components/QrCode'

function makeCode(firstName: string) {
  const base = (firstName || 'PING').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'PING'
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${suffix}`
}

export default function ParrainagePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  // Chiffres réels (RPC my_referral_stats) : filleuls enregistrés, et filleuls qui ont terminé une mission.
  const [registered, setRegistered] = useState(0)
  const [completed, setCompleted] = useState(0)
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

      const { data: stats } = await supabase.rpc('my_referral_stats')
      const row = Array.isArray(stats) ? stats[0] : stats
      setRegistered(row?.registered ?? 0)
      setCompleted(row?.completed ?? 0)
      setLoading(false)
    }
    load()
  }, [router])

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/signup?ref=${code}` : ''
  const shareMsg = `Je t'invite sur PING — ${shareUrl}`

  const [copied, setCopied] = useState(false)
  function copyLink() {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
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
  const [showQr, setShowQr] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Mon parrainage</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
        ) : (
          <>
            <div style={{ background: '#123644', borderRadius: 18, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Votre code</div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: '.06em', marginBottom: 14 }}>{code}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
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
                  {copied ? 'Copié' : 'Copier'}
                </button>
                <button onClick={() => setShowQr(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 999, border: 'none', background: showQr ? '#fff' : 'rgba(255,255,255,.14)', color: showQr ? '#123644' : '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" /></svg>
                  QR code
                </button>
              </div>
              {showQr && shareUrl && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: 12 }}>
                    <QrCode data={shareUrl} size={140} />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', margin: 0, textAlign: 'center' }}>
                    À afficher sur votre stand, votre boutique ou votre camion — flashé, ça inscrit directement avec votre code.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22 }}>{registered}</div>
                <div style={{ fontSize: 11, color: '#4E6470', fontWeight: 600, marginTop: 2 }}>Filleul{registered > 1 ? 's' : ''} enregistré{registered > 1 ? 's' : ''}</div>
              </div>
              <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22 }}>{completed}</div>
                <div style={{ fontSize: 11, color: '#4E6470', fontWeight: 600, marginTop: 2 }}>Filleul{completed > 1 ? 's' : ''} ayant terminé une mission</div>
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 16, background: '#F3F6F5', border: '1px solid #E7EDEB' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Comment ça marche</div>
              <p style={{ fontSize: 12, color: '#4E6470', marginTop: 4, lineHeight: 1.5, marginBottom: 0 }}>
                Votre filleul est enregistré dès son inscription avec votre code ou votre lien. L&apos;avantage sera communiqué lors du lancement.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
