"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchProDetail } from '@/lib/services'
import { SERVICE_LABELS, ServiceType } from '@/types'

export default function ProDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proId = params.id as string
  const [pro, setPro] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'apropos' | 'avis' | 'galerie'>('apropos')

  useEffect(() => {
    fetchProDetail(proId).then(({ pro, reviews }) => {
      setPro(pro); setReviews(reviews); setLoading(false)
    })
  }, [proId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy)' }}>
      <div className="text-white font-fredoka text-xl">Chargement...</div>
    </div>
  )

  if (!pro) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--navy)' }}>
      <div className="text-4xl mb-3">❌</div>
      <div className="text-white font-fredoka text-xl mb-4">Pro introuvable</div>
      <button onClick={() => router.push('/map')} className="px-6 py-3 rounded-full font-black text-white" style={{ background: 'var(--accent)' }}>Retour carte</button>
    </div>
  )

  const services: ServiceType[] = (pro.pro_services ?? []).map((s: any) => s.service)
  const initials = pro.company_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Header navy */}
      <div className="px-5 pt-5 pb-8" style={{ background: 'var(--navy)' }}>
        <button onClick={() => router.back()} className="text-white mb-4 text-sm font-black">← Retour</button>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-fredoka text-2xl text-white border-4 border-white/10"
            style={{ background: 'var(--accent)' }}>{initials}</div>
          <div className="flex-1">
            <h1 className="font-fredoka text-2xl text-white">{pro.company_name}</h1>
            <div className="text-sm font-bold mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              ⭐ {pro.rating_avg?.toFixed(1) ?? '—'} · {pro.rating_count} avis · {pro.mission_count} missions
            </div>
            {pro.is_available && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-black"
                style={{ background: '#DCFCE7', color: '#15803D' }}>● Disponible</span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5 min-h-screen">
        {/* Tarifs */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'var(--cream)' }}>
            <div className="font-fredoka text-xl" style={{ color: 'var(--accent)' }}>{pro.hourly_rate ?? '—'} €</div>
            <div className="text-xs font-black text-gray-400">/ heure</div>
          </div>
          <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'var(--cream)' }}>
            <div className="font-fredoka text-xl" style={{ color: 'var(--accent)' }}>{pro.travel_fee ?? 0} €</div>
            <div className="text-xs font-black text-gray-400">déplacement</div>
          </div>
          <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'var(--cream)' }}>
            <div className="font-fredoka text-xl" style={{ color: 'var(--accent)' }}>{pro.radius_km} km</div>
            <div className="text-xs font-black text-gray-400">rayon</div>
          </div>
        </div>

        {/* Services */}
        <div className="flex flex-wrap gap-2 mb-5">
          {services.map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>
              {SERVICE_LABELS[s]?.emoji} {SERVICE_LABELS[s]?.label}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: 'var(--cream)' }}>
          {([['apropos', 'À propos'], ['avis', 'Avis'], ['galerie', 'Galerie']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
              style={tab === k ? { background: 'white', color: 'var(--navy)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : { color: '#9CA3AF' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'apropos' && (
          <div>
            <p className="text-sm font-bold text-gray-600 leading-relaxed mb-4">{pro.bio || 'Aucune description.'}</p>
            {/* Garanties / vérifications */}
            <div className="space-y-2">
              {[
                { icon: '🪪', label: 'Identité vérifiée', ok: true },
                { icon: '📋', label: 'Documents fournis', ok: true },
                { icon: '🛡️', label: 'RC Professionnelle', ok: true },
                { icon: '💳', label: 'Paiement sécurisé Nexto', ok: true },
              ].map(g => (
                <div key={g.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--cream)' }}>
                  <span className="text-lg">{g.icon}</span>
                  <span className="flex-1 text-sm font-black text-navy">{g.label}</span>
                  <span style={{ color: 'var(--ok)' }}>✓</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl text-xs font-bold text-gray-400" style={{ background: '#FFF7ED' }}>
              Nexto met à disposition les documents sur demande justifiée mais ne garantit pas leur authenticité.
              Plateforme de mise en relation — n'achète ni ne revend aucun service.
            </div>
          </div>
        )}

        {tab === 'avis' && (
          <div className="space-y-3">
            {reviews.length === 0 && <div className="text-center py-8 text-gray-300 font-bold">Aucun avis pour l'instant</div>}
            {reviews.map(r => (
              <div key={r.id} className="p-4 rounded-2xl" style={{ background: 'var(--cream)' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm text-navy">{r.profiles?.first_name ?? 'Client'}</span>
                  <span className="text-sm">{'⭐'.repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm font-bold text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === 'galerie' && (
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="aspect-square rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--cream)' }}>
                <span className="text-2xl opacity-30">📷</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA sticky */}
      <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100 flex gap-3">
        <button onClick={() => router.push(`/mission/new?pro=${proId}`)}
          className="flex-1 py-4 rounded-full text-white font-fredoka text-lg"
          style={{ background: 'var(--accent)' }}>
          Demander un devis
        </button>
      </div>
    </div>
  )
}
