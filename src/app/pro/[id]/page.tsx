"use client"
import '../../aere.css'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { loadProDetail, openConversation, readProDetailCache, type ProDetail } from '@/lib/services'
import { sessionUserId } from '@/lib/screenCache'
import { createClient } from '@/lib/supabase/client'
import { TRADES } from '@/lib/trades'
import { pricingLabel, pricingShort } from '@/lib/servicePricing'
import ListingExtras from '@/components/ListingExtras'
import { prestationName, prestationPhotoUrl, type Prestation } from '@/lib/prestations'
import { Ic, Stars, r1 } from '@/components/PingIcons'
import { legalFormLabel, VAT_FRANCHISE_MENTION } from '@/lib/proStatus'

// Unité d'une prestation, comme la maquette (« Ménage · Forfait », « Par heure », « Sur devis »).
function unitTxt(a: { pricing_type?: string | null; included_hours?: number | null; hourly_rate_cents?: number | null; base_price_cents?: number | null }) {
  if (a.pricing_type === 'devis') return 'Sur devis'
  if ((a.base_price_cents ?? 0) > 0 && a.included_hours && a.hourly_rate_cents) return `Forfait ${String(a.included_hours).replace('.', ',')} h, puis à l’heure`
  if (a.pricing_type === 'horaire' || (!(a.base_price_cents ?? 0) && a.hourly_rate_cents)) return 'Par heure'
  return 'Forfait'
}

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
  // Pièces contrôlées par PING (RPC des migrations 039 / 042) : undefined tant qu'elles ne sont pas appliquées.
  const [docsChecked, setDocsChecked] = useState<boolean | undefined>(undefined)
  const [rcproChecked, setRcproChecked] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    // Fiche déjà lue dans l'onglet (ou préchargée depuis l'aperçu de la carte) : affichée tout de
    // suite, la relecture la remplace (audit 19/11, correction 3).
    // Fiche, prestations visibles (les masquées restent dans « Mes tarifs ») et pièces contrôlées : une
    // seule lecture, partagée avec le préchargement de la carte (correction 4 du 19/11 ter).
    const apply = (d: ProDetail) => {
      setPro(d.pro); setReviews(d.reviews || []); setLoading(false)
      if (d.services) setExtraServices(d.services)
      if (d.flags) { setDocsChecked(d.flags.checked); setRcproChecked(d.flags.rcproChecked) }
    }
    const cached = readProDetailCache(proId)
    if (cached?.pro) apply(cached)
    loadProDetail(proId).then(d => { if (!cancelled) apply(d) }).catch(() => { if (!cancelled) setLoading(false) })
    const supabase = createClient()
    // Favori : état réel en base pour l'utilisateur connecté.
    sessionUserId(supabase).then(async id => {
      if (cancelled || !id) return
      setUid(id)
      const { data } = await supabase.from('favorites').select('provider_id').eq('user_id', id).eq('provider_id', proId).maybeSingle()
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

  // Statut et paiement (migration 039) : rien d'affiché pour une colonne absente.
  const statut = [
    pro.legal_status === 'particulier' ? 'Particulier (récapitulatif, sans facture)' : legalFormLabel(pro.legal_form),
    pro.legal_status === 'particulier' ? null : pro.vat_status === 'assujetti' ? 'assujetti à la TVA' : pro.vat_status === 'franchise' ? VAT_FRANCHISE_MENTION : null,
    'virement sur facture',
  ].filter(Boolean).join(' · ')

  return (
    <div className={uid !== proId ? 'ping-screen aere a-lift fiche-aere' : 'ping-screen'} style={{ paddingBottom: 0 }}>
      <div className="ping-appbar">
        <button type="button" className="ic" onClick={() => router.push('/map')} aria-label="Retour à la carte" style={{ border: 0, background: 'none', width: 44, height: 44, marginLeft: -6 }}>
          <Ic name="back" />
        </button>
        <b style={{ flex: 1 }}>{uid === proId ? 'Ma fiche publique' : 'Profil du pro'}</b>
        {uid !== proId && (
          <button onClick={toggleFav} disabled={favBusy} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={fav}
            style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: favBusy ? 0.6 : 1, color: fav ? '#E5484D' : 'var(--ink)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? '#E5484D' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          </button>
        )}
      </div>

      <div className="ping-body nopad" style={{ paddingBottom: 150 }}>
        {uid === proId && <div style={{ background: 'rgba(18,179,156,.1)', color: '#097A6C', font: '600 11.5px var(--fb)', textAlign: 'center', padding: '8px 16px' }}>Aperçu : ce que voient les clients</div>}
        {/* En-tête de la fiche (maquette, .hero) : avatar, nom, note et distance, disponibilité. */}
        <div className="mq-hero" style={pro.photo_url ? { backgroundImage: `linear-gradient(160deg, rgba(11,131,116,.82), rgba(8,105,93,.9)), url(${pro.photo_url})` } : undefined}>
          <span className="mq-av" style={pro.logo_url ? { backgroundImage: `url(${pro.logo_url})` } : undefined}>{!pro.logo_url && initial}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="nm">{name}</b>
            <div style={{ fontSize: 12 }}>{pro.rating > 0 ? `★ ${r1(pro.rating)} (${pro.reviews_count} avis)` : 'Nouveau sur PING'}{dist ? ` · à ${dist}` : ''}</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{pro.is_active === false ? '○ Hors ligne pour le moment' : '● Disponible'}</div>
          </div>
        </div>

        <div style={{ padding: '2px 16px 14px' }}>
          {/* Lot 21 : « Profil vérifié par PING » seulement si un admin a validé la pièce d'identité
              (et qu'elle n'est pas expirée, migration 042) — exception de langage du 03/11. */}
          {docsChecked === true && (
            <div className="mq-tags"><span className="mq-tag a-mini"><Ic name="shield" size={12} />Profil vérifié par PING</span></div>
          )}
          {docsChecked === false && (
            <div className="mq-tags"><span className="mq-tag warn a-mini">Nouveau · pièces en cours de contrôle</span></div>
          )}
          {/* « Mon annonce » (migration 026) : accroche et points forts, puis photos et zone. */}
          <ListingExtras part="top" headline={pro.headline} highlights={pro.highlights} />
          {pro.bio && (
            <>
              <div className="mq-sect">À propos</div>
              <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.55 }}>{pro.bio}</p>
            </>
          )}
          <ListingExtras part="gallery" gallery={pro.gallery_paths} />
          <ListingExtras part="zone" radiusKm={pro.service_radius_km} />

          <div className="mq-sect">Prestations</div>
          {articles.map(a => {
            const devis = a.pricing_type === 'devis'
            const px = devis ? 'Sur devis' : (pricingShort(a as any) || articlePriceLabel(a) || '')
            const photo = photoOf(a.photo_path)
            return (
              <div key={a.id ?? 'primary'} className="mq-prest">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: '#F3F6F5', marginRight: 10 }} />
                )}
                <span className="nm">
                  <b>{a.name}</b>
                  <small>{unitTxt(a)}{!devis && a.included_hours && a.hourly_rate_cents ? ` · ${articlePriceLabel(a)}` : ''}</small>
                  {a.description && <small style={{ marginTop: 2 }}>{a.description}</small>}
                </span>
                <span className="px">
                  {px}
                  {(articles.length > 1 || devis || !bookable) && <button type="button" onClick={() => reserve(a)}>{devis ? 'Demander un devis' : 'Réserver'}</button>}
                </span>
              </div>
            )
          })}
          <p className="mq-muted" style={{ fontSize: 15, marginTop: 4 }}>Le prix est figé à l&apos;accord. Seul un litige peut le rouvrir.</p>

          {statut && (<>
            <div className="mq-sect">Statut et paiement</div>
            <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.55 }}>{statut}{pro.accepts_cesu_prefinance === true && <> · <b style={{ color: '#097A6C' }}>Accepte le CESU préfinancé</b></>}{pro.sap_number ? ' · service à la personne déclaré (n° SAP renseigné)' : ''}</p>
          </>)}

          {/* Vérifications (maquette) : « Validée » seulement pour une pièce contrôlée par un admin PING. */}
          <div className="mq-sect">Vérifications</div>
          {docsChecked === true && (
            <div className="mq-vr ok"><span className="vi"><Ic name="id" size={15} /></span><span><b>Pièce d&apos;identité</b><small>Contrôlée par PING</small></span><span className="vs"><Ic name="check" size={11} />Validée</span></div>
          )}
          {docsChecked !== true && pro.has_identity && (
            <div className={`mq-vr ${docsChecked === false ? 'w' : 'ok'}`}><span className="vi"><Ic name="id" size={15} /></span><span><b>Pièce d&apos;identité</b><small>{docsChecked === false ? 'Envoyée, en contrôle par PING' : 'Déposée sur PING par le pro'}</small></span><span className="vs">{docsChecked === false ? 'En contrôle' : <><Ic name="check" size={11} />Fournie</>}</span></div>
          )}
          {rcproChecked === true && (
            <div className="mq-vr ok"><span className="vi"><Ic name="shieldPlain" size={15} /></span><span><b>Assurance responsabilité civile</b><small>Attestation contrôlée par PING · transmise sur demande</small></span><span className="vs"><Ic name="check" size={11} />Validée</span></div>
          )}
          {rcproChecked !== true && pro.has_rcpro && (
            <div className="mq-vr ok"><span className="vi"><Ic name="shieldPlain" size={15} /></span><span><b>Assurance responsabilité civile</b><small>Renseignée par le pro (casse, dommage) · Attestation transmise sur demande</small></span><span className="vs"><Ic name="check" size={11} />Renseignée</span></div>
          )}
          {/* SIRET : déclaratif (qc-production B6), jamais « vérifié ». Numéro public de l'entreprise. */}
          {pro.siret && (
            <div className="mq-vr ok"><span className="vi"><Ic name="ent" size={15} /></span><span><b>SIRET renseigné</b><small>Déclaré par le pro · n° {String(pro.siret).replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4')}</small></span><span className="vs"><Ic name="check" size={11} />Renseigné</span></div>
          )}
          {/* has_urssaf : à renvoyer par provider_trust_stats (migration à écrire, la table documents n'est
              lisible que par son auteur). Tant qu'elle ne le renvoie pas, la ligne reste masquée. */}
          {pro.has_urssaf && (
            <div className="mq-vr ok"><span className="vi"><Ic name="doc" size={15} /></span><span><b>Attestation URSSAF</b><small>Attestation de vigilance déposée sur PING par le pro</small></span><span className="vs"><Ic name="check" size={11} />Fournie</span></div>
          )}
          {pro.sap_number && (
            <div className="mq-vr ok"><span className="vi"><Ic name="doc" size={15} /></span><span><b>Attestation crédit d&apos;impôt</b><small>Peut établir la déclaration fiscale</small></span><span className="vs"><Ic name="check" size={11} />Possible</span></div>
          )}
          {pro.accepts_cesu_prefinance === true && (
            <div className="mq-vr ok"><span className="vi"><Ic name="card" size={15} /></span><span><b>Accepte le CESU préfinancé</b><small>Titres employeur ou comité d&apos;entreprise</small></span><span className="vs"><Ic name="check" size={11} />Oui</span></div>
          )}
          {!pro.has_identity && !pro.has_rcpro && !pro.siret && !pro.has_urssaf && !pro.sap_number && !pro.accepts_cesu_prefinance && docsChecked !== true && (
            <p className="ping-sub">Aucune information encore renseignée par le prestataire.</p>
          )}
          <p className="mq-muted">PING contrôle les pièces marquées « Validée ». Les autres informations sont déclarées par le prestataire.</p>
          {uid !== proId && (
            <p className="mq-muted" style={{ marginTop: 4 }}>{docsChecked === false ? 'Nouveau sur PING : réservable dès maintenant, pièces en cours de contrôle. ' : ''}PING est une plateforme de mise en relation : PING ne garantit ni la solvabilité ni la qualité des prestations ; vous choisissez librement votre prestataire.</p>
          )}

          <div className="mq-sect">Avis</div>
          {reviews.length === 0 && <p style={{ color: '#4E6470', fontSize: 15, lineHeight: 1.55 }}>Nouveau, pas encore d&apos;avis.</p>}
          {reviews.map((r: any, i: number) => (
            <div key={i} className="fa-avis" style={uid === proId ? { padding: '8px 0', borderTop: '1px solid #EEF2F1' } : undefined}>
              <Stars r={r.stars || 0} size={uid === proId ? 13 : 18} /> <small style={{ color: '#4E6470' }}>{r.profiles?.full_name?.trim() || 'Client'}</small>
              <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 2 }}>{r.comment ? `« ${r.comment} »` : 'Sans commentaire'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop : la barre reste dans la colonne de contenu, à droite de la barre latérale (236 px). */}
      <style>{`@media (min-width:1000px){.pro-foot{left:236px !important;max-width:none !important;margin:0 !important}.pro-foot>div{max-width:640px;margin:0 auto}}`}</style>
      <div className="ping-foot pro-foot" style={{ position: 'fixed', bottom: 'var(--tabbar-h, 0px)', left: 0, right: 0, maxWidth: 480, zIndex: 20, margin: '0 auto', background: '#fff', borderTop: '1px solid var(--line)', padding: '12px 16px calc(14px + env(safe-area-inset-bottom,0px))' }}>
        {actionErr && <p style={{ color: '#c0503a', fontSize: 15, margin: '0 0 8px', textAlign: 'center' }}>{actionErr}</p>}
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
