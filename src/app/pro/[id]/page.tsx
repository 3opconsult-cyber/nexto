"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchProDetail } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'

import { TRADES } from '@/lib/trades'

export default function ProDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proId = params.id as string
  const [pro, setPro] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [extraServices, setExtraServices] = useState<any[]>([])
  const [hasDocuments, setHasDocuments] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'apropos' | 'avis'>('apropos')

  useEffect(() => {
    let cancelled = false
    fetchProDetail(proId).then(({ pro, reviews }) => {
      if (cancelled) return
      setPro(pro); setReviews(reviews); setLoading(false)
    })
    const supabase = createClient()
    supabase.from('services').select('name, price_cents').eq('provider_id', proId)
      .then(({ data }) => { if (!cancelled) setExtraServices(data ?? []) })
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', proId)
      .then(({ count }) => { if (!cancelled) setHasDocuments((count ?? 0) > 0) })
    return () => { cancelled = true }
  }, [proId])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#123644' }}>
      <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 18 }}>Chargement…</div>
    </div>
  )

  if (!pro) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#123644' }}>
      <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 18, marginBottom: 16 }}>Prestataire introuvable</div>
      <button onClick={() => router.push('/map')} style={{ padding: '12px 24px', borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}>Retour à la carte</button>
    </div>
  )

  const displayName = pro.profiles?.full_name?.trim() || TRADES[pro.trade] || pro.trade
  const initials = displayName.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '•'
  const hasFlat = pro.base_price_cents > 0
  const hasHourly = pro.hourly_rate_cents != null && pro.hourly_rate_cents > 0

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
      <div style={{ padding: '20px 20px 32px', background: '#123644' }}>
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>← Retour</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff', background: '#12B39C', flexShrink: 0 }}>{initials}</div>
          <div>
            <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>{displayName}</h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
              {Number(pro.rating) > 0 ? `${Number(pro.rating).toFixed(1)} ★` : 'Nouveau'} · {pro.reviews_count} avis
            </div>
            {pro.is_active && (
              <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(18,179,156,.18)', color: '#5EEAD4' }}>Actif</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', marginTop: -14, padding: '22px 20px', minHeight: '60vh' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {hasFlat && (
            <div style={{ flex: 1, padding: 14, borderRadius: 14, textAlign: 'center', background: '#F3F6F5' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#12B39C' }}>{(pro.base_price_cents / 100).toFixed(2)} €</div>
              <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600, marginTop: 2 }}>Forfait · {TRADES[pro.trade] || pro.trade}</div>
            </div>
          )}
          {hasHourly && (
            <div style={{ flex: 1, padding: 14, borderRadius: 14, textAlign: 'center', background: '#F3F6F5' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#12B39C' }}>{(pro.hourly_rate_cents / 100).toFixed(2)} €/h</div>
              <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600, marginTop: 2 }}>Taux horaire</div>
            </div>
          )}
        </div>

        {pro.sap_number && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 12, background: 'rgba(18,179,156,.08)', fontSize: 12, fontWeight: 700, color: '#0C8F7E' }}>
            Crédit d'impôt de 50 % — déclaration SAP {pro.sap_number}
          </div>
        )}

        {extraServices.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {extraServices.map((s, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(18,179,156,.1)', color: '#0C8F7E' }}>{s.name}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: '#F3F6F5', marginBottom: 18 }}>
          {([['apropos', 'À propos'], ['avis', 'Avis']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#123644' : '#6E8592' }}>{label}</button>
          ))}
        </div>

        {tab === 'apropos' && (
          <div>
            <p style={{ fontSize: 13.5, color: '#3d5560', lineHeight: 1.6, marginBottom: 16 }}>{pro.bio || "Ce prestataire n'a pas encore ajouté de description."}</p>
            {hasDocuments && (
              <div style={{ padding: 12, borderRadius: 12, background: '#F3F6F5', fontSize: 12, color: '#6E8592', fontWeight: 600 }}>
                Pièce d'identité et justificatifs fournis lors de l'inscription.
              </div>
            )}
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#FFF7ED', fontSize: 11.5, color: '#8a6520', fontWeight: 600 }}>
              PING met en relation clients et prestataires mais n'emploie ni ne supervise ce prestataire.
            </div>
          </div>
        )}

        {tab === 'avis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviews.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Aucun avis pour l'instant</div>}
            {reviews.map((r: any) => (
              <div key={r.id} style={{ padding: 14, borderRadius: 14, background: '#F3F6F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{r.profiles?.full_name?.split(' ')[0] || 'Client'}</span>
                  <span style={{ fontSize: 12, color: '#F59E0B' }}>{'★'.repeat(r.stars)}</span>
                </div>
                {r.comment && <p style={{ fontSize: 13, color: '#3d5560' }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: '#fff', padding: '14px 20px', borderTop: '1px solid #E7EDEB' }}>
        <button onClick={() => router.push(`/mission/new?pro=${proId}`)} style={{ width: '100%', padding: 15, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>
          Demander un devis
        </button>
      </div>
    </div>
  )
}
