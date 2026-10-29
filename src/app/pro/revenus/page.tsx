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
  const [uid, setUid] = useState('')
  const [sap, setSap] = useState('')
  const [sapReady, setSapReady] = useState(false)
  const [sapSaved, setSapSaved] = useState(false)

  async function saveSap() {
    await createClient().from('provider_profiles').update({ sap_number: sap.trim() || null }).eq('id', uid)
    setSapSaved(true); setTimeout(() => setSapSaved(false), 1800)
  }
  const [monthCents, setMonthCents] = useState(0)
  const [yearCents, setYearCents] = useState(0)
  const [countYear, setCountYear] = useState(0)
  const [rating, setRating] = useState(0)
  const [reviewsCount, setReviewsCount] = useState(0)

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

      const { data: pp } = await supabase.from('provider_profiles').select('rating, reviews_count').eq('id', user.id).single()
      if (pp) { setRating(Number(pp.rating) || 0); setReviewsCount(pp.reviews_count || 0) }

      // Numéro SAP (migration 013) : requête séparée pour ne rien casser si la colonne n'existe pas encore.
      const { data: sapRow, error: sapErr } = await supabase.from('provider_profiles').select('sap_number').eq('id', user.id).maybeSingle()
      if (!sapErr) { setSap(sapRow?.sap_number || ''); setSapReady(true) }
      setUid(user.id)

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
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{countYear}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Prestations cette année</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#F59E0B' }}>{rating > 0 ? rating.toFixed(1) : '—'}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>{reviewsCount} avis</div>
              </div>
            </div>

            <button onClick={() => router.push('/pro/paiements')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, marginBottom: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Mes versements</span>
                <span style={{ display: 'block', fontSize: 12, color: '#6E8592', marginTop: 2 }}>Compte de versement et IBAN, pour le paiement en ligne</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            </button>

            {sapReady && (
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, marginBottom: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644', marginBottom: 6 }}>Crédit d&apos;impôt de vos clients (numéro SAP)</div>
                <p style={{ fontSize: 12, color: '#6E8592', lineHeight: 1.55, margin: '0 0 10px' }}>
                  Avec votre numéro de déclaration de services à la personne (gratuit sur le portail NOVA), vos clients
                  ne paient que 50 % grâce à l&apos;avance immédiate de l&apos;Urssaf. Un argument fort face à la concurrence.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={sap} onChange={e => setSap(e.target.value)} placeholder="SAP123456789"
                    style={{ flex: 1, minWidth: 0, border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 13.5, fontFamily: 'Inter, sans-serif' }} />
                  <button onClick={saveSap} style={{ border: 'none', borderRadius: 999, padding: '0 18px', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {sapSaved ? 'Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

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
