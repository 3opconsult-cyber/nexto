"use client"
import ListingExtras from '@/components/ListingExtras'
import { TRADES } from '@/lib/trades'
import { pricingLabel } from '@/lib/servicePricing'

type Article = {
  id: string | null; name: string; description?: string | null
  pricing_type?: string | null; base_price_cents?: number | null; included_hours?: number | null
  hourly_rate_cents?: number | null; price_cents?: number | null
}

/**
 * Aperçu de l'annonce telle qu'un client la voit sur /pro/[id] : mêmes classes (ping-hero,
 * ping-vrow, ping-rev) et même ordre (en-tête, accroche, points forts, à propos, photos, zone,
 * informations déclarées, prestations). Les boutons sont inertes : c'est un aperçu.
 */
export default function ProListingPreview({ pro, name, services, hasIdentity, hasRcpro, online }: {
  pro: any
  name: string
  services: Article[]
  hasIdentity: boolean
  hasRcpro: boolean
  online: boolean
}) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const ratingTxt = pro.rating > 0 ? `${Number(pro.rating).toFixed(1)} (${pro.reviews_count} avis)` : 'Nouveau'
  const articles: Article[] = [
    {
      id: null, name: TRADES[pro.trade] || pro.trade, description: pro.bio || null,
      pricing_type: pro.pricing_type, base_price_cents: pro.base_price_cents,
      included_hours: pro.included_hours, hourly_rate_cents: pro.hourly_rate_cents,
    },
    ...services,
  ]

  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #E7EDEB', background: '#fff', boxShadow: '0 10px 30px rgba(18,54,68,.08)' }}>
      <div className="ping-hero" style={pro.photo_url ? { backgroundImage: `linear-gradient(160deg, rgba(18,54,68,.35), rgba(18,54,68,.55)), url(${pro.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className="big" style={pro.logo_url ? { backgroundImage: `url(${pro.logo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {!pro.logo_url && initial}
        </div>
        <h2>{name}</h2>
        <div className="meta">{ratingTxt}</div>
        <div className="dispo"><span style={{ width: 9, height: 9, borderRadius: '50%', background: online ? '#fff' : 'rgba(255,255,255,.45)', display: 'inline-block' }} /> {online ? 'Disponible' : 'Hors ligne pour le moment'}</div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <ListingExtras part="top" headline={pro.headline} highlights={pro.highlights} />
        {pro.bio ? (
          <>
            <div className="ping-h2" style={{ marginTop: 0 }}>À propos</div>
            <p className="ping-sub" style={{ marginBottom: 4, whiteSpace: 'pre-line' }}>{pro.bio}</p>
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: '#4E6470', fontStyle: 'italic', margin: '0 0 8px' }}>Votre présentation apparaîtra ici.</p>
        )}
        <ListingExtras part="gallery" gallery={pro.gallery_paths} />
        <ListingExtras part="zone" radiusKm={pro.service_radius_km} />

        <div className="ping-h2">Informations déclarées par le pro</div>
        {hasIdentity && (
          <div className="ping-vrow ok">
            <div className="ping-vt"><b>Pièce d'identité fournie</b><small>Déposée sur PING par le pro</small></div>
            <div className="ping-vs">Fournie</div>
          </div>
        )}
        {hasRcpro && (
          <div className="ping-vrow ok">
            <div className="ping-vt"><b>Assurance resp. civile</b><small>Renseignée par le pro (casse/dommage)</small></div>
            <div className="ping-vs">Renseignée</div>
          </div>
        )}
        {pro.sap_number && (
          <div className="ping-vrow ok">
            <div className="ping-vt"><b>Attestation crédit d'impôt</b><small>Peut établir la déclaration fiscale</small></div>
            <div className="ping-vs">Possible</div>
          </div>
        )}
        {!hasIdentity && !hasRcpro && !pro.sap_number && (
          <div className="ping-vrow"><div className="ping-vt"><small>Aucune information encore renseignée par le prestataire.</small></div></div>
        )}

        <div className="ping-h2">Prestations proposées</div>
        {articles.map(a => {
          const label = pricingLabel(a)
          return (
            <div key={a.id ?? 'primary'} className="ping-rev">
              <div className="t"><span className="n">{a.name}</span></div>
              {a.id && a.description && <p style={{ margin: '2px 0 0' }}>{a.description}</p>}
              <div style={{ fontSize: 12.5, color: label ? '#0C8F7E' : '#8A6520', fontWeight: 700, marginTop: 4 }}>{label || 'Prix à fixer dans Mes tarifs'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
