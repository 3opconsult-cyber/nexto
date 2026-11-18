"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchProDetail, fetchProviderFlags, openConversation } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'
import { pricingLabel, pricingShort } from '@/lib/servicePricing'
import ListingExtras from '@/components/ListingExtras'
import { fetchPrestations, prestationName, prestationPhotoUrl, type Prestation } from '@/lib/prestations'

export default function ProDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proId = params.id as string
  const [pro, setPro] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [extraServices, setExtraServices] = useState<Prestation[]>([])
  const [loading, setLoading] = useState(true)
  const [actionErr, setActionErr] = useState('')
  const [uid, setUid] = useState<string | null>(null)
  const [fav, setFav] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  // Pièces contrôlées par PING (RPC de la migration 039) : undefined tant qu'elle n'est pas appliquée.
  const [docsChecked, setDocsChecked] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetchProDetail(proId).then(({ pro, reviews }) => {
      if (cancelled) return
      setPro(pro); setReviews(reviews); setLoading(false)
    })
    fetchProviderFlags([proId]).then(f => { if (!cancelled) setDocsChecked(f[proId]?.checked) }).catch(() => { })
    const supabase = createClient()
    // Prestations visibles seulement (les masquées restent dans « Mes tarifs » du prestataire).
    fetchPrestations(supabase, proId, { visibleOnly: true })
      .then(({ rows }) => { if (!cancelled) setExtraServices(rows) })
    // Favori : état réel en base pour l'utilisateur connecté.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return
      setUid(user.id)
      const { data } = await supabase.from('favorites').select('provider_id').eq('user_id', user.id).eq('provider_id', proId).maybeSingle()
      if (!cancelled) setFav(!!data)
    })
    return () => { cancelled = true }
  }, [proId])

  // `devis` : « Demander un devis » pour une prestation précise — la conversation s'ouvre avec la
  // demande préremplie (le client l'envoie lui-même), le prestataire chiffre avec « + Proposer un tarif ».
  async function contact(devis?: { name: string; trade?: string | null }) {
    setActionErr('')
    const { missionId, error } = await openConversation(proId, devis)
    if (missionId) { router.push(`/mission/${missionId}/chat${devis ? `?devis=${encodeURIComponent(devis.name)}` : ''}`); return }
    // Sa propre fiche : on ne se contacte pas soi-même, on renvoie vers son espace pro.
    if (error === 'own_profile') { router.push('/pro/dashboard'); return }
    if (error === 'not_authenticated') { router.push(`/auth/login?next=${encodeURIComponent(`/pro/${proId}`)}`); return }
    setActionErr('La conversation n’a pas pu s’ouvrir. Réessayez dans un instant.')
  }

  async function toggleFav() {
    if (!uid) { router.push(`/auth/login?next=${encodeURIComponent(`/pro/${proId}`)}`); return }
    if (uid === proId) return
    setFavBusy(true); setActionErr('')
    const supabase = createClient()
    const { error } = fav
      ? await supabase.from('favorites').delete().eq('user_id', uid).eq('provider_id', proId)
      : await supabase.from('favorites').insert({ user_id: uid, provider_id: proId })
    if (error) setActionErr('Impossible de mettre à jour vos favoris pour le moment.')
    else setFav(!fav)
    setFavBusy(false)
  }

  // "Réserver" doit passer par l'écran de choix forfait/horaire + récap de prix
  // (mission/new) qui fixe le prix au paramétrage initial (règle suprême du
  // tarif) et permet une vraie confirmation — pas juste ouvrir une conversation.
  // Pour un pro (ou un article) "sur devis", il n'y a pas de prix à fixer :
  // ça reste le chat. `serviceId` : réserver un article précis du catalogue
  // (services) plutôt que le métier principal (provider_profiles) — chaque
  // article a sa propre fiche de prix depuis la migration 008.
  function reserve(a?: { id: string | null; name: string; trade?: string | null; pricing_type?: string | null }) {
    if (a ? a.pricing_type === 'devis' : (isDevis && !bookable)) { contact({ name: a?.name || articles[0].name, trade: a?.trade ?? pro.trade }); return }
    router.push(`/mission/new?pro=${proId}${a?.id ? `&service=${a.id}` : ''}`)
  }

  // Libellés de prix communs à « Mes tarifs » et à l'inscription (src/lib/servicePricing.ts).
  const articlePriceLabel = (a: Parameters<typeof pricingLabel>[0]) => pricingLabel(a)

  if (loading) return (
    <div className="ping-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#4E6470', fontFamily: 'var(--fh)', fontSize: 15 }}>Chargement…</div>
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
  const dist = pro.distance_m != null ? (pro.distance_m < 1000 ? `${Math.round(pro.distance_m)} m` : `${(pro.distance_m / 1000).toFixed(1).replace(".", ",")} km`) : null
  const ratingTxt = pro.rating > 0 ? `${pro.rating.toFixed(1)} (${pro.reviews_count} avis)` : 'Nouveau'
  const isDevis = (pro as any).pricing_type === 'devis'
  const priceLabel = pricingShort(pro as any)
  // Le métier principal (pro.trade) n'est jamais dans `services` (services.slice(1)
  // à l'onboarding) — l'oublier ici faisait disparaître la première prestation de la
  // fiche dès qu'un pro en avait déclaré d'autres. Chaque article de `services` a
  // maintenant sa propre fiche de prix (migration 008) : réservable individuellement,
  // pas juste une étiquette décorative.
  const articles: { id: string | null; name: string; trade: string | null; description: string | null; photo_path: string | null; pricing_type: any; base_price_cents: number; included_hours: number | null; hourly_rate_cents: number | null }[] = [
    {
      id: null as string | null,
      name: TRADES[pro.trade] || pro.trade,
      trade: pro.trade,
      photo_path: null,
      // La bio est déjà affichée dans « À propos » : ne pas la répéter sous la 1re prestation (lot 15).
      description: null as string | null,
      pricing_type: (pro as any).pricing_type,
      base_price_cents: pro.base_price_cents,
      included_hours: (pro as any).included_hours,
      hourly_rate_cents: pro.hourly_rate_cents,
    },
    ...extraServices.map(s => ({ ...s, name: prestationName(s) })),
  ]
  // Au moins une prestation à prix fixe : « Réserver » mène au choix de la prestation (mission/new).
  const bookable = articles.some(a => a.pricing_type !== 'devis')
  const photoOf = (path: string | null) => prestationPhotoUrl(path)

  return (
    <div className="ping-screen" style={{ paddingBottom: 0 }}>
      <div className="ping-appbar">
        <div className="ic" onClick={() => router.push('/map')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <b style={{ flex: 1 }}>Profil du pro</b>
        {uid !== proId && (
          <button onClick={toggleFav} disabled={favBusy} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={fav}
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: favBusy ? 0.6 : 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? '#12B39C' : 'none'} stroke={fav ? '#12B39C' : '#123644'} strokeWidth="2" strokeLinejoin="round"><path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" /></svg>
          </button>
        )}
      </div>

      <div className="ping-body nopad" style={{ paddingBottom: 150 }}>
        <div className="ping-hero" style={pro.photo_url ? { backgroundImage: `linear-gradient(160deg, rgba(18,54,68,.35), rgba(18,54,68,.55)), url(${pro.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <div className="big" style={pro.logo_url ? { backgroundImage: `url(${pro.logo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            {!pro.logo_url && initial}
          </div>
          <h2>{name}</h2>
          <div className="meta">{ratingTxt}{dist ? ` · à ${dist}` : ''}</div>
          {docsChecked === false && (
            <div style={{ display: 'inline-block', marginTop: 6, fontSize: 11.5, fontWeight: 700, color: '#8A5A00', background: '#FFF4DD', borderRadius: 999, padding: '4px 10px' }}>
              Nouveau · pièces en cours de contrôle
            </div>
          )}
          <div className="dispo"><span style={{ width: 9, height: 9, borderRadius: '50%', background: pro.is_active === false ? 'rgba(255,255,255,.45)' : '#fff', display: 'inline-block' }} /> {pro.is_active === false ? 'Hors ligne pour le moment' : 'Disponible'}</div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {/* « Mon annonce » (migration 026) : accroche et points forts, puis photos et zone. */}
          <ListingExtras part="top" headline={pro.headline} highlights={pro.highlights} />
          {pro.bio && (
            <>
              <div className="ping-h2" style={{ marginTop: 0 }}>À propos</div>
              <p className="ping-sub" style={{ marginBottom: 4 }}>{pro.bio}</p>
            </>
          )}
          <ListingExtras part="gallery" gallery={pro.gallery_paths} />
          <ListingExtras part="zone" radiusKm={pro.service_radius_km} />

          <div className="ping-h2" style={pro.bio || pro.gallery_paths?.length ? undefined : { marginTop: 0 }}>
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
          {pro.accepts_cesu_prefinance === true && (
            <div className="ping-vrow ok">
              <div className="ping-vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></svg></div>
              <div className="ping-vt"><b>Accepte le CESU préfinancé</b><small>Indiqué par le pro · titres employeur ou comité d&apos;entreprise</small></div>
              <div className="ping-vs"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> Oui</div>
            </div>
          )}
          {!pro.has_identity && !pro.has_rcpro && !pro.sap_number && !pro.accepts_cesu_prefinance && (
            <div className="ping-vrow"><div className="ping-vt"><small>Aucune information encore renseignée par le prestataire.</small></div></div>
          )}

          <p className="ping-sub">Place de marché : informations déclarées par le prestataire et collectées par PING, sans garantie.</p>

          <div className="ping-h2">Prestations proposées</div>
          {articles.map(a => {
            const label = articlePriceLabel(a)
            const devis = a.pricing_type === 'devis'
            const photo = photoOf(a.photo_path)
            return (
              <div key={a.id ?? 'primary'} className="ping-rev" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: '#F3F6F5' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ flexWrap: 'wrap', gap: 6 }}>
                    <span className="n">{a.name}</span>
                    {a.id && a.trade && TRADES[a.trade] && TRADES[a.trade] !== a.name && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#F3F6F5', color: '#4E6470' }}>{TRADES[a.trade]}</span>
                    )}
                  </div>
                  {a.description && <p style={{ margin: '2px 0 0' }}>{a.description}</p>}
                  {label && <div style={{ fontSize: 12.5, color: '#0C8F7E', fontWeight: 700, marginTop: 4 }}>{label}</div>}
                </div>
                <button className="ping-btn ghost" style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5, flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={() => reserve(a)}>
                  {devis ? 'Demander un devis' : 'Réserver'}
                </button>
              </div>
            )
          })}

          <div className="ping-h2">Avis <span className="ping-badge-teal">après prestation</span></div>
          {reviews.length === 0 && <p className="ping-sub">Pas encore d'avis — ils apparaîtront après les premières prestations.</p>}
          {reviews.map((r: any, i: number) => (
            <div key={i} className="ping-rev">
              <div className="t">
                <span className="n">{r.profiles?.full_name?.trim() || 'Client'}</span>
                <span className="ping-stars">{'★'.repeat(Math.round(r.stars || 5))}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop : la barre reste dans la colonne de contenu, à droite de la barre latérale (236 px). */}
      <style>{`@media (min-width:1000px){.pro-foot{left:236px !important;max-width:none !important;margin:0 !important}.pro-foot>div{max-width:640px;margin:0 auto}}`}</style>
      <div className="ping-foot pro-foot" style={{ position: 'fixed', bottom: 'var(--tabbar-h, 0px)', left: 0, right: 0, maxWidth: 480, zIndex: 20, margin: '0 auto', background: '#fff', borderTop: '1px solid var(--line)', padding: '12px 16px calc(14px + env(safe-area-inset-bottom,0px))' }}>
        {actionErr && <p style={{ color: '#c0503a', fontSize: 12, margin: '0 0 8px', textAlign: 'center' }}>{actionErr}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ping-btn ghost" style={{ flex: 1 }} onClick={() => contact()}>Contacter</button>
          <button className="ping-btn" style={{ flex: 1.4 }} onClick={() => reserve()}>
            {!bookable ? 'Demander un devis' : articles.length > 1 ? 'Réserver une prestation' : `Réserver${priceLabel ? ` · ${priceLabel}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
