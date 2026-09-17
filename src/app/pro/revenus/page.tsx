"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

const DONE = ['completed', 'released']

function eur(c: number) { return `${(c / 100).toFixed(0)} €` }

export default function ProRevenusPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [monthCents, setMonthCents] = useState(0)
  const [yearCents, setYearCents] = useState(0)
  const [countYear, setCountYear] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('transactions')
        .select('payout_cents, status, completed_at, created_at')
        .eq('seller_id', user.id)
      const now = new Date()
      const rows = (data ?? []).filter((t: any) => DONE.includes(t.status))
      let m = 0, y = 0, cy = 0
      rows.forEach((t: any) => {
        const d = new Date(t.completed_at || t.created_at)
        if (d.getFullYear() === now.getFullYear()) {
          y += t.payout_cents || 0
          cy += 1
          if (d.getMonth() === now.getMonth()) m += t.payout_cents || 0
        }
      })
      setMonthCents(m); setYearCents(y); setCountYear(cy)
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes revenus &amp; déclaration</div>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(18,179,156,.08)' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#0C8F7E' }}>{eur(monthCents)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Ce mois</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{eur(yearCents)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Depuis janvier</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff', gridColumn: '1 / -1' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{countYear}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Prestations réalisées cette année</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, marginBottom: 14 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644', marginBottom: 6 }}>Obligation déclarative (DAC7)</div>
              <p style={{ fontSize: 12, color: '#6E8592', lineHeight: 1.55, margin: 0 }}>
                Les revenus perçus via une plateforme comme PING pour des prestations de services sont
                imposables et doivent être déclarés (formulaire 2042 C PRO). Conformément à la loi
                (art. 1649 ter D du CGI), PING vous transmettra chaque année le total net perçu et le
                nombre d&apos;opérations, et les déclarera à l&apos;administration fiscale avant le 31 janvier.
              </p>
            </div>

            <p style={{ fontSize: 10.5, color: '#9aa6a3', lineHeight: 1.5 }}>
              Montants nets, après commission PING — cohérents avec vos factures dans « Mes opérations ».
              Ce récapitulatif ne remplace pas un conseil comptable.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
