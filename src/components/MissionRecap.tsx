"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EUR } from '@/lib/invoice-pdf'
import { TRADES } from '@/lib/trades'
import { CLIENT_TAGS } from './ClientReviewModal'

/**
 * Récapitulatif complet d'une mission, en tête du chat, côté client comme côté prestataire :
 * le contrat (tarif accepté, rendez-vous, durée scannée, montant final, ce que chacun paie ou perçoit),
 * l'avis du client sur le prestataire, l'avis du prestataire sur le client, le litige, les documents.
 * Chaque partie ne voit que SA part des frais (frais de service côté client, commission côté pro).
 * L'adresse n'est passée par le parent que si elle est autorisée (confirmée et réglée pour le pro).
 */
const C = { teal: '#12B39C', tealD: '#0C8F7E', navy: '#123644', slate: '#4E6470', line: '#E7EDEB', gold: '#F2A93B' }
const DISPUTE_STATUS: Record<string, string> = { open: 'En cours', resolved: 'Résolu', rejected: 'Rejeté' }

type Review = { stars: number; quality_stars: number | null; service_stars: number | null; recommend: boolean | null; tip_cents: number | null; comment: string | null; created_at: string }
type ClientReview = { stars: number; accuracy_stars: number | null; welcome_stars: number | null; recommend: boolean | null; tags: string[]; comment: string | null; is_public: boolean; rater_id: string }
type Dispute = { id?: string; reason: string; status: string; created_at: string; resolution: string | null }

const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fmtDur = (min: number) => `${Math.floor(min / 60) ? Math.floor(min / 60) + ' h ' : ''}${String(min % 60).padStart(2, '0')} min`

export function contractLabel(tx: any): string {
  if (tx.hourly_rate_cents != null && tx.included_hours != null) {
    return `Forfait + heures sup. · ${EUR(tx.base_forfait_cents ?? tx.subtotal_cents)} pour ${tx.included_hours} h, puis ${EUR(tx.hourly_rate_cents)}/h`
  }
  if (tx.hourly_rate_cents != null) return `À l'heure · ${EUR(tx.hourly_rate_cents)}/h`
  return `Forfait · ${EUR(tx.subtotal_cents)}`
}

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span aria-label={`${n} sur 5`} style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= n ? C.gold : '#DCE5E3'}><path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" /></svg>
      ))}
    </span>
  )
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 12.5 }}>
      <span style={{ color: C.slate }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

export default function MissionRecap({ tx, userId, counterpart, address, refreshKey }: {
  tx: any; userId: string; counterpart: string
  /** Change quand un avis vient d'être déposé dans le chat : relit avis et litige. */
  refreshKey?: string
  /** Adresse du rendez-vous, déjà filtrée par le parent (null si le prestataire n'y a pas encore droit). */
  address: string | null
}) {
  const router = useRouter()
  const isBuyer = userId === tx.buyer_id
  const done = ['completed', 'released'].includes(tx.status)
  const [review, setReview] = useState<Review | null>(null)
  const [clientReview, setClientReview] = useState<ClientReview | null>(null)
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    ;(async () => {
      const [rv, cr, dp, inv] = await Promise.all([
        supabase.from('reviews').select('stars, quality_stars, service_stars, recommend, tip_cents, comment, created_at').eq('transaction_id', tx.id).maybeSingle(),
        supabase.from('client_reviews').select('stars, accuracy_stars, welcome_stars, recommend, tags, comment, is_public, rater_id').eq('transaction_id', tx.id).maybeSingle(),
        supabase.from('disputes').select('id, reason, status, created_at, resolution').eq('transaction_id', tx.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('transaction_id', tx.id),
      ])
      if (!alive) return
      if (!rv.error) setReview(rv.data as Review | null)
      if (!cr.error) setClientReview(cr.data as ClientReview | null)
      if (!dp.error) setDispute((dp.data?.[0] as Dispute) ?? null)
      if (!inv.error) setInvoiceCount(inv.count ?? 0)
    })()
    return () => { alive = false }
  }, [tx.id, tx.status, tx.completed_at, refreshKey])

  // Ouvert d'office quand il y a un bilan à lire (mission terminée ou litige) ; replié sinon.
  const expanded = open ?? (done || !!dispute)

  if (!tx.price_confirmed && !done) return null

  const trade = tx.requests?.category ? (TRADES[tx.requests.category] || tx.requests.category) : null
  const summary = [contractLabel(tx), tx.scheduled_at ? `RDV ${fmtDate(tx.scheduled_at)}` : null].filter(Boolean).join(' · ')
  const statusLabel = tx.status === 'cancelled' ? 'Annulée' : dispute?.status === 'open' ? 'Litige en cours' : done ? 'Terminée' : tx.arrived_at ? 'En cours' : 'Confirmée'
  const statusColor = tx.status === 'cancelled' ? '#B42318' : dispute?.status === 'open' ? '#B54708' : done ? C.tealD : C.navy

  return (
    <div style={{ margin: '10px 16px 0', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 14px' }}>
      <button type="button" onClick={() => setOpen(!expanded)} aria-expanded={expanded}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.tealD} strokeWidth="2" style={{ flexShrink: 0 }}><path d="M6 2h9l3 3v17H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: C.navy }}>
            Récapitulatif de la mission <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: statusColor, marginLeft: 4 }}>{statusLabel}</span>
          </span>
          {!expanded && <span style={{ display: 'block', fontSize: 12, color: C.slate, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Contrat : {summary}</span>}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.slate} strokeWidth="2.2" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {expanded && (
        <>
          <Section title="Contrat accepté">
            <Row label={isBuyer ? 'Prestataire' : 'Client'} value={counterpart} />
            {trade && <Row label="Prestation" value={trade} />}
            <Row label="Tarif convenu" value={contractLabel(tx)} />
            {tx.scheduled_at && <Row label="Rendez-vous" value={fmtDate(tx.scheduled_at)} />}
            <Row label="Adresse" value={address || (isBuyer ? 'À compléter' : 'Communiquée une fois la mission validée et réglée')} />
          </Section>

          {(tx.arrived_at || tx.completed_at) && (
            <Section title="Intervention (codes QR scannés)">
              {tx.arrived_at && <Row label="Arrivée" value={fmtDate(tx.arrived_at)} />}
              {tx.completed_at && <Row label="Sortie" value={fmtTime(tx.completed_at)} />}
              {tx.duration_minutes != null && <Row label="Durée sur place" value={fmtDur(tx.duration_minutes)} />}
            </Section>
          )}

          <Section title={done ? 'Montant final' : 'Montant prévu'}>
            <Row label="Prestation" value={EUR(tx.subtotal_cents)} />
            {isBuyer ? (
              <>
                <Row label="Frais de service PING" value={EUR(tx.buyer_fee_cents)} />
                <Row label="Total payé" value={EUR(tx.total_charged_cents)} strong />
              </>
            ) : (
              <>
                <Row label="Commission PING" value={`− ${EUR(tx.seller_fee_cents)}`} />
                <Row label="Vous percevez" value={EUR(tx.payout_cents)} strong />
              </>
            )}
            {review?.tip_cents ? <Row label={isBuyer ? 'Pourboire laissé' : 'Pourboire indiqué par le client'} value={EUR(review.tip_cents)} /> : null}
          </Section>

          {done && (
            <Section title={isBuyer ? 'Votre avis sur le prestataire' : 'Avis du client'}>
              {review ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    <Stars n={review.stars} size={17} /><span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy }}>{review.stars}/5</span>
                  </div>
                  {review.quality_stars != null && <Row label="Qualité du travail" value={<Stars n={review.quality_stars} size={13} />} />}
                  {review.service_stars != null && <Row label="Contact et ponctualité" value={<Stars n={review.service_stars} size={13} />} />}
                  {review.recommend != null && <Row label="Recommande" value={review.recommend ? 'Oui' : 'Non'} />}
                  {review.comment && <p style={{ fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, margin: '4px 0 0', fontStyle: 'italic' }}>« {review.comment} »</p>}
                </>
              ) : (
                <p style={{ fontSize: 12.5, color: C.slate, margin: '2px 0' }}>{isBuyer ? 'Vous n’avez pas encore noté cette prestation.' : 'Le client n’a pas encore laissé d’avis.'}</p>
              )}
            </Section>
          )}

          {done && (!isBuyer || clientReview) && (
            <Section title={isBuyer ? 'Avis du prestataire sur vous' : `Votre avis sur le client${clientReview ? (clientReview.is_public ? ' · publié' : ' · note privée') : ''}`}>
              {clientReview ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    <Stars n={clientReview.stars} size={17} /><span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy }}>{clientReview.stars}/5</span>
                  </div>
                  {clientReview.accuracy_stars != null && <Row label="Demande conforme à la réalité" value={<Stars n={clientReview.accuracy_stars} size={13} />} />}
                  {clientReview.welcome_stars != null && <Row label="Accueil, accès, ponctualité" value={<Stars n={clientReview.welcome_stars} size={13} />} />}
                  {clientReview.recommend != null && <Row label="Retravaillerait pour ce client" value={clientReview.recommend ? 'Oui' : 'Non'} />}
                  {clientReview.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                      {clientReview.tags.map(t => (
                        <span key={t} style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(18,179,156,.1)', color: C.tealD, fontSize: 11, fontWeight: 700 }}>
                          {CLIENT_TAGS.find(x => x.key === t)?.label || t}
                        </span>
                      ))}
                    </div>
                  )}
                  {clientReview.comment && <p style={{ fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, margin: '6px 0 0', fontStyle: 'italic' }}>« {clientReview.comment} »</p>}
                </>
              ) : (
                <p style={{ fontSize: 12.5, color: C.slate, margin: '2px 0' }}>Vous n’avez pas encore noté ce client.</p>
              )}
            </Section>
          )}

          {dispute && (
            <Section title={`Litige · ${DISPUTE_STATUS[dispute.status] || dispute.status}`}>
              <Row label="Ouvert le" value={new Date(dispute.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <p style={{ fontSize: 12.5, color: '#3d5560', lineHeight: 1.5, margin: '4px 0 0' }}>{dispute.reason}</p>
              {dispute.resolution && <p style={{ fontSize: 12.5, color: C.navy, fontWeight: 600, lineHeight: 1.5, margin: '6px 0 0' }}>Décision : {dispute.resolution}</p>}
              {dispute.id && <a href={`/litiges/${dispute.id}`} style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 700, color: C.tealD }}>Ouvrir le dossier du litige</a>}
            </Section>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(done || invoiceCount > 0) && (
              <button type="button" onClick={() => router.push(`/mission/${tx.id}/facture`)}
                style={{ flex: 1, minWidth: 130, padding: '9px 12px', borderRadius: 999, border: 'none', background: C.teal, color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Voir les factures
              </button>
            )}
            {/* Les codes QR sont ceux du client : le prestataire les scanne chez lui, il ne doit pas les avoir. */}
            {isBuyer && tx.status !== 'cancelled' && !tx.completed_at && (
              <button type="button" onClick={() => router.push(`/mission/${tx.id}/qrcodes`)}
                style={{ flex: 1, minWidth: 130, padding: '9px 12px', borderRadius: 999, border: `1.5px solid ${C.teal}`, background: '#fff', color: C.tealD, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Codes QR
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
