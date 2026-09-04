"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchProDetail, openConversation } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'

export default function ProDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proId = params.id as string
  const [pro, setPro] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [extraServices, setExtraServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProDetail(proId).then(({ pro, reviews }) => {
      if (cancelled) return
      setPro(pro); setReviews(reviews); setLoading(false)
    })
    const supabase = createClient()
    supabase.from('services').select('name, price_cents').eq('provider_id', proId)
      .then(({ data }) => { if (!cancelled) setExtraServices(data ?? []) })
    return () => { cancelled = true }
  }, [proId])

  async function contact() {
    const { missionId } = await openConversation(proId)
    router.push(missionId ? `/mission/${missionId}/chat` : '/auth/login')
  }

  if (loading) return (
    <div className="ping-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6E8592', fontFamily: 'var(--fh)', fontSize: 15 }}>Chargement…</div>
    </div>
  )
  if (!pro) return (
    <div className="ping-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 16 }}>Prestataire introuvable</div>
      <button className="ping-btn" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => router.push('/map')}>Retour à la carte</button>
    </div>
  )

  const name = pro.profiles?.full_name?.trim() || TRADES[pro.trade] || pro.trade
  const initial = name.charAt(0).toUpperCase()
  const dist = pro.distance_m != null ? (pro.distance_m < 1000 ? `${Math.round(pro.distance_m)} m` : `${(pro.distance_m / 1000).toFixed(1)} km`) : null
  const ratingTxt = pro.rating > 0 ? `${pro.rating.toFixed(1)} (${pro.reviews_count} avis)` : 'Nouveau'
  const priceLabel = pro.base_price_cents > 0 ? `${(pro.base_price_cents / 100).toFixed(0)} €`
    : (pro.hourly_rate_cents ? `${(pro.hourly_rate_cents / 100).toFixed(0)} €/h` : null)
  const skills = extraServices.length ? extraServices.map((s: any) => s.name) : [TRADES[pro.trade] || pro.trade]

  return (
    <div className="ping-screen" style={{ paddingBottom: 0 }}>
      <div className="ping-appbar">
        <div className="ic" onClick={() => router.push('/map')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <b>Profil du pro</b>
      </div>

      <div className="ping-body nopad" style={{ paddingBottom: 150 }}>
        <div className="ping-hero">
          <div className="big">{initial}</div>
          <h2>{name}</h2>
          <div className="meta">{ratingTxt}{dist ? ` · à ${dist}` : ''}</div>
          <div className="dispo"><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', display: 'inline-block' }} /> Disponible maintenant</div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div className="ping-h2" style={{ marginTop: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.4"><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
              Informations déclarées par le pro
            </span>
          </div>

          {pro.has_identity && (
            <div className="ping-vrow ok">
              <div className="ping-vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2.2" /></svg></div>
              <div className="ping-vt"><b>Pièce d'identité fournie</b><small>Déposée sur PING par le pro</small></div>
              <div className="ping-vs"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> Fournie</div>
            </div>
          )}
          {pro.has_rcpro && (
            <div className="ping-vrow ok">
              <div className="ping-vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" /></svg></div>
              <div className="ping-vt"><b>Assurance resp. civile</b><small>Renseignée par le pro (casse/dommage)</small></div>
              <div className="ping-vs"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> Renseignée</div>
            </div>
          )}
          {pro.sap_number && (
            <div className="ping-vrow ok">
              <div className="ping-vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2"><path d="M4 6h16v13H4z" /><path d="M8 11h8M8 15h5" /></svg></div>
              <div className="ping-vt"><b>Attestation crédit d'impôt</b><small>Peut établir la déclaration fiscale</small></div>
              <div className="ping-vs"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> Possible</div>
            </div>
          )}
          {!pro.has_identity && !pro.has_rcpro && !pro.sap_number && (
            <div className="ping-vrow"><div className="ping-vt"><small>Aucune information encore renseignée par le prestataire.</small></div></div>
          )}

          <p className="ping-sub">Place de marché : informations déclarées par le prestataire et collectées par PING, sans garantie.</p>

          <div className="ping-h2">Compétences</div>
          <div className="ping-chipset">
            {skills.map((s: string, i: number) => <span key={i} className="ping-sk">{s}</span>)}
          </div>

          <div className="ping-h2">Avis <span className="ping-badge-teal">après prestation</span></div>
          {reviews.length === 0 && <p className="ping-sub">Pas encore d'avis — ils apparaîtront après les premières prestations.</p>}
          {reviews.map((r: any, i: number) => (
            <div key={i} className="ping-rev">
              <div className="t">
                <span className="n">{r.profiles?.full_name?.trim() || 'Client'}</span>
                <span className="ping-stars">{'★'.repeat(Math.round(r.rating || 5))}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ping-foot" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', background: '#fff', borderTop: '1px solid var(--line)', padding: '12px 16px calc(14px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ping-btn ghost" style={{ flex: 1 }} onClick={contact}>Contacter</button>
          <button className="ping-btn" style={{ flex: 1.4 }} onClick={contact}>Réserver{priceLabel ? ` · ${priceLabel}` : ''}</button>
        </div>
      </div>
    </div>
  )
}
