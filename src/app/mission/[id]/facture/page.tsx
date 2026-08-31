"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import { EUR, KIND_LABEL, TITLE, docTitle, durationLabel, downloadInvoicePdf,
         PLATFORM_PENDING, type Invoice } from '@/lib/invoice-pdf'

/**
 * Facturation — les trois documents d'une mission.
 *
 * L'ancienne version de cet écran interrogeait des tables qui n'existent pas
 * (`missions`, `pro_profiles`, `invoices.mission_id`) : elle affichait donc
 * toujours « Facture non disponible ». Elle est réécrite sur le schéma réel.
 *
 * Une mission terminée produit trois documents, générés en base par trigger :
 *   FACT-…   le prestataire facture le client
 *   PING-C-… PING facture ses frais de service au client
 *   PING-V-… PING facture sa commission au prestataire
 *
 * Chacun n'est visible que par ses deux parties (RLS). Le client et le
 * prestataire voient donc les leurs, ici, sans échange d'e-mail.
 */
export default function FacturePage() {
  const params = useParams()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('invoices').select('*').eq('transaction_id', params.id).order('kind')
      .then(({ data }) => { setInvoices((data ?? []) as Invoice[]); setLoading(false) })
  }, [params.id])

  const inv = invoices[active]

  async function download() {
    if (!inv) return
    setBusy(true); setErr('')
    try { await downloadInvoicePdf(inv) }
    catch { setErr("Le PDF n'a pas pu être généré. Vous pouvez utiliser l'impression de votre navigateur.") }
    setBusy(false)
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
      <div className="no-print" style={{ padding: '28px 16px 14px', background: '#123644', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} aria-label="Retour"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>‹</button>
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Facturation</span>
      </div>
      {children}
    </div>
  )

  if (loading) return shell(<p style={{ padding: 20, color: '#6E8592', fontSize: 13 }}>Chargement…</p>)

  if (!invoices.length) return shell(
    <div style={{ padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, textAlign: 'center' }}>
        <Sign size={38} />
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, marginTop: 12 }}>
          Pas encore de facture
        </h2>
        <p style={{ fontSize: 13, color: '#6E8592', marginTop: 6, lineHeight: 1.55 }}>
          Les documents sont émis automatiquement à la fin de la mission, une fois le code de
          départ scanné — c'est ce scan qui fixe la durée réelle, donc le montant.
        </p>
      </div>
    </div>
  )

  return shell(
    <>
      <style>{`
        @media print {
          .no-print { display: none !important }
          body { background: #fff !important }
          .sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
                   margin: 0 !important; padding: 14mm !important }
        }
        @page { size: A4; margin: 0 }
      `}</style>

      {invoices.length > 1 && (
        <div className="no-print" style={{ display: 'flex', gap: 7, padding: '13px 16px 0', overflowX: 'auto' }}>
          {invoices.map((v, i) => (
            <button key={v.number} onClick={() => setActive(i)} style={{
              flexShrink: 0, border: 'none', cursor: 'pointer', padding: '8px 13px', borderRadius: 999,
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 12.5,
              background: i === active ? '#123644' : '#fff', color: i === active ? '#fff' : '#123644',
              boxShadow: i === active ? 'none' : '0 0 0 1px #DCE5E3',
            }}>{KIND_LABEL[v.kind]}</button>
          ))}
        </div>
      )}

      <div style={{ padding: 16 }}>
        {/* La prévisualisation EST la page : ce qu'on voit est ce qui s'imprime. */}
        <div className="sheet" style={{
          background: '#fff', borderRadius: 14, padding: 22,
          boxShadow: '0 1px 2px rgba(18,54,68,.06)', maxWidth: 620, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Sign size={26} />
              <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-.02em' }}>ping</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#6E8592', textTransform: 'uppercase' }}>
                {docTitle(inv)}
              </div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, marginTop: 3 }}>{inv.number}</div>
              <div style={{ fontSize: 11, color: '#6E8592', marginTop: 2 }}>
                {new Date(inv.issued_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>

          {/* Un lecteur doit comprendre en une ligne que ce n'est pas une facture. */}
          {inv.template === 'recapitulatif' && inv.legal?.avertissement && (
            <div style={{
              marginTop: 16, padding: '11px 13px', borderRadius: 9, background: '#FCF4E4',
              borderLeft: '3px solid #F2A93B', fontSize: 11.5, lineHeight: 1.55, color: '#6B4A0D',
            }}>{inv.legal.avertissement}</div>
          )}

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#6E8592', textTransform: 'uppercase' }}>
                {inv.template === 'commission' ? 'Émis par' : inv.template === 'recapitulatif' ? 'Intervenant' : 'Émetteur'}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>
                {inv.template === 'commission' ? (
                  <>
                    <div style={{ fontWeight: 600 }}>{inv.issuer_snapshot?.nom || PLATFORM_PENDING}</div>
                    {inv.issuer_snapshot?.forme && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.forme}</div>}
                    {inv.issuer_snapshot?.adresse && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.adresse}</div>}
                    {inv.issuer_snapshot?.ville && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.ville}</div>}
                    {inv.issuer_snapshot?.siret
                      ? <div style={{ color: '#6E8592' }}>SIRET {inv.issuer_snapshot.siret}</div>
                      : <div style={{ color: '#6E8592' }}>Immatriculation en cours</div>}
                    {inv.issuer_snapshot?.tva && <div style={{ color: '#6E8592' }}>TVA {inv.issuer_snapshot.tva}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>{inv.issuer_snapshot?.enseigne || inv.issuer_snapshot?.nom || '—'}</div>
                    {inv.issuer_snapshot?.enseigne && inv.issuer_snapshot?.nom
                      && inv.issuer_snapshot.enseigne !== inv.issuer_snapshot.nom
                      && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.nom}</div>}
                    {inv.issuer_snapshot?.adresse && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.adresse}</div>}
                    {inv.issuer_snapshot?.ville && <div style={{ color: '#6E8592' }}>{inv.issuer_snapshot.ville}</div>}
                    {inv.issuer_snapshot?.siret && <div style={{ color: '#6E8592' }}>SIRET {inv.issuer_snapshot.siret}</div>}
                    {inv.legal?.forme && <div style={{ color: '#6E8592' }}>{inv.legal.forme}</div>}
                    {inv.issuer_snapshot?.sap && <div style={{ color: '#6E8592' }}>Déclaration SAP {inv.issuer_snapshot.sap}</div>}
                    {inv.template === 'recapitulatif' && <div style={{ color: '#6E8592' }}>Particulier — non immatriculé</div>}
                  </>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#6E8592', textTransform: 'uppercase' }}>
                {inv.template === 'commission' ? 'Facturé à' : 'Client'}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>
                <div style={{ fontWeight: 600 }}>{inv.client_snapshot?.nom || '—'}</div>
                {inv.client_snapshot?.adresse && <div style={{ color: '#6E8592' }}>{inv.client_snapshot.adresse}</div>}
                {inv.client_snapshot?.ville && <div style={{ color: '#6E8592' }}>{inv.client_snapshot.ville}</div>}
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

          {inv.template === 'commission' ? (
            (inv.lines || []).map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.libelle}</div>
                  {l.detail && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{l.detail}</div>}
                  {inv.legal?.taux && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 4 }}>{inv.legal.taux}</div>}
                </div>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {EUR(Number(l.montant_cents ?? 0))}
                </div>
              </div>
            ))
          ) : (() => {
            // Sobre : une ligne, et dessous ce qu'il faut pour refaire le calcul.
            const l = (inv.lines || [])[0] || {}
            const titre = [l.prestation, durationLabel(l.duree_min)].filter(Boolean).join(' — ')
            const sous = [
              l.date && `Le ${l.date}`,
              l.arrivee && l.depart && `${l.arrivee} — ${l.depart}, scannés sur place`,
              l.taux_horaire_cents && `${EUR(l.taux_horaire_cents)} de l'heure`,
            ].filter(Boolean).join('  ·  ')
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{titre || 'Prestation'}</div>
                  {sous && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>{sous}</div>}
                  {l.adresse && <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{l.adresse}</div>}
                </div>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {EUR(Number(l.montant_cents ?? inv.net_cents))}
                </div>
              </div>
            )
          })()}

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            borderTop: '1px solid #DCE5E3', marginTop: 14, paddingTop: 12,
          }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>
              {inv.template === 'recapitulatif' ? 'Montant perçu' : 'Total'}
            </span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21 }}>{EUR(inv.net_cents)}</span>
          </div>
          {inv.legal?.franchise_tva && (
            <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 4 }}>{inv.legal.franchise_tva}</div>
          )}

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#6E8592', textTransform: 'uppercase' }}>
            {inv.template === 'recapitulatif' ? 'Déclaration' : 'Mentions légales'}
          </div>
          <div style={{ fontSize: 11, color: '#6E8592', lineHeight: 1.6, marginTop: 7 }}>
            {inv.template === 'recapitulatif' ? (
              <p style={{ margin: 0 }}>{inv.legal?.declaration}</p>
            ) : inv.template === 'commission' ? (
              <p style={{ margin: 0 }}>Règlement à réception. Document émis par PING au titre de la mise en relation.</p>
            ) : (
              <>
                {inv.legal?.categorie_operation && <p style={{ margin: '0 0 5px' }}>Catégorie de l'opération : {inv.legal.categorie_operation}.</p>}
                {inv.legal?.penalites && <p style={{ margin: '0 0 5px' }}>{inv.legal.penalites}</p>}
                {inv.legal?.indemnite_recouvrement && <p style={{ margin: '0 0 5px' }}>{inv.legal.indemnite_recouvrement}</p>}
                {inv.legal?.escompte && <p style={{ margin: '0 0 5px' }}>{inv.legal.escompte}</p>}
                <p style={{ margin: 0 }}>Règlement à réception.</p>
              </>
            )}
          </div>
        </div>

        {inv.template === 'commission' && !inv.issuer_snapshot?.siret && (
          <p className="no-print" style={{
            maxWidth: 620, margin: '12px auto 0', padding: 12, borderRadius: 11,
            background: 'rgba(242,169,59,.13)', color: '#9A6712', fontSize: 11.5, lineHeight: 1.55,
          }}>
            PING n'est pas encore immatriculée : le document le mentionne tel quel. Dès que le
            SIRET existe, il se saisit dans l'admin et apparaît sur les documents émis ensuite —
            ceux déjà émis gardent l'instantané de leur date, c'est voulu.
          </p>
        )}

        {err && <p className="no-print" style={{ maxWidth: 620, margin: '12px auto 0', color: '#B4402C', fontSize: 12.5 }}>{err}</p>}

        <div className="no-print" style={{ maxWidth: 620, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={download} disabled={busy} style={{
            width: '100%', border: 'none', padding: 14, borderRadius: 999, cursor: 'pointer',
            background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 14.5, boxShadow: '0 8px 18px rgba(18,179,156,.28)',
            opacity: busy ? .6 : 1,
          }}>{busy ? 'Génération…' : 'Télécharger le PDF'}</button>
          <button onClick={() => window.print()} style={{
            width: '100%', border: 'none', padding: 14, borderRadius: 999, cursor: 'pointer',
            background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 14.5, boxShadow: '0 0 0 1px #DCE5E3',
          }}>Imprimer</button>
        </div>
      </div>
    </>
  )
}
