"use client"
import '../../../aere.css'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import NavDrawer from '@/components/NavDrawer'
import { readScreenCache, sessionUserId } from '@/lib/screenCache'
import { loadFactureSnap, factureCacheKey, type FactureSnap } from '@/lib/screenLoaders'
import AvanceImmediateCard from '@/components/AvanceImmediateCard'
import TransferCard from '@/components/TransferCard'
import ShareInvoiceSheet from '@/components/ShareInvoiceSheet'
import { invoiceFile, invoiceShareText, invoiceLink } from '@/lib/invoiceShare'
import { EUR, KIND_LABEL, TITLE, docTitle, durationLabel, downloadInvoicePdf,
         PLATFORM_PENDING, tauxLabel, displayLine, accentuer, prestationSous, invoiceCredit, type Invoice } from '@/lib/invoice-pdf'

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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [isSeller, setIsSeller] = useState(false)
  const [isBuyer, setIsBuyer] = useState(false)
  const [reviewed, setReviewed] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [txInfo, setTxInfo] = useState<{ self: boolean; completed: boolean; missing?: boolean } | null>(null)
  // Imprimer un seul document (24/11/2026) : les autres sections sont masquées à l'impression.
  // « ?imprimer=<numéro> » (depuis la liste des factures) lance l'impression à l'ouverture.
  const [printOnly, setPrintOnly] = useState<string | null>(null)
  const [sending, setSending] = useState<Invoice | null>(null)
  const [autoPrint, setAutoPrint] = useState<string | null>(null)
  useEffect(() => {
    try { setAutoPrint(new URLSearchParams(window.location.search).get('imprimer')) } catch { /* rien */ }
    const after = () => setPrintOnly(null)
    window.addEventListener('afterprint', after)
    return () => window.removeEventListener('afterprint', after)
  }, [])
  function printOne(number: string) {
    setPrintOnly(number)
    setTimeout(() => { try { window.print() } catch { /* impression indisponible */ } }, 250)
  }

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const txId = String(params.id)
    async function load() {
      // Session locale (sans aller-retour réseau), dernier état connu tout de suite (rempli aussi par le
      // préchargement de TabPrefetch, audit 19/11 bis correction 3), puis mission, factures et avis lus
      // ensemble (src/lib/screenLoaders.ts).
      const uid = await sessionUserId(supabase)
      if (!alive) return
      setUserId(uid)
      const cached = readScreenCache<FactureSnap>(factureCacheKey(txId), uid)
      if (cached) {
        setInvoices(cached.invoices); setIsSeller(cached.isSeller); setIsBuyer(cached.isBuyer)
        setReviewed(cached.reviewed); setTxInfo(cached.txInfo); setLoading(false)
      }
      const snap = await loadFactureSnap(supabase, uid, txId)
      if (!alive) return
      setTxInfo(snap.txInfo); setIsSeller(snap.isSeller); setIsBuyer(snap.isBuyer); setReviewed(snap.reviewed)
      setInvoices(snap.invoices); setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [params.id])

  useEffect(() => {
    if (!autoPrint || loading || !invoices.some(v => v.number === autoPrint)) return
    setAutoPrint(null)
    printOne(autoPrint)
  }, [autoPrint, loading, invoices])

  // Un seul défilement (maquette) : la prestation d'abord, puis la commission PING de CE lecteur.
  // Les documents viennent de la même lecture qu'avant (RLS : chaque partie ne reçoit que les siens).
  const ordered = [...invoices].sort((a, b) => Number(a.template === 'commission') - Number(b.template === 'commission'))
  const part = ordered.some(v => v.template === 'recapitulatif')
  const sectionTitle = (v: Invoice) => v.template === 'commission'
    ? (isSeller && !isBuyer ? 'Commission PING' : 'Frais de service PING')
    : (isSeller && !isBuyer ? (v.template === 'recapitulatif' ? 'Votre récapitulatif' : 'Votre facture') : 'Prestation')

  async function download(v: Invoice) {
    setBusy(v.number); setErr('')
    try { await downloadInvoicePdf(v) }
    catch { setErr("Le PDF n'a pas pu être généré. Vous pouvez utiliser l'impression de votre navigateur.") }
    setBusy(null)
  }

  const shell = (children: React.ReactNode) => (
    <div className="aere a-lift" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', color: '#123644', paddingBottom: 100 }}>
      <div className="no-print" style={{ padding: '24px 20px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} aria-label="Retour"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: 12, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <NavDrawer />
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff', margin: 0 }}>{part ? 'Récapitulatif' : 'Facture'}</h1>
      </div>
      {children}
    </div>
  )

  if (loading) return shell(<p style={{ padding: 20, color: '#4E6470', fontSize: 16 }}>Chargement…</p>)

  if (!invoices.length) return shell(
    <div style={{ padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, textAlign: 'center' }}>
        <Sign size={38} />
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, marginTop: 12 }}>
          {txInfo?.missing ? 'Mission introuvable' : txInfo?.self ? 'Mission de test sans facture' : txInfo?.completed ? 'Facture introuvable' : 'Pas encore de facture'}
        </h2>
        <p style={{ fontSize: 13, color: '#4E6470', marginTop: 6, lineHeight: 1.55 }}>
          {txInfo?.missing
            ? 'Cette mission n\u2019existe plus ou ne vous concerne pas. Vos missions sont dans l\u2019agenda.'
            : txInfo?.self
            ? 'Vous êtes à la fois le client et le prestataire de cette mission de test : aucune facture n\u2019est émise. Elle sera supprimée.'
            : txInfo?.completed
              ? 'Cette mission est terminée mais ses documents n\u2019ont pas été émis. Écrivez au support PING : nous les régénérons.'
              : 'Les documents sont émis automatiquement à la fin de la mission, dès que la fin est validée avec le client (QR, code ou confirmation) : c\u2019est elle qui fixe la durée réelle, donc le montant.'}
        </p>
        {txInfo?.missing && (
          <a href="/agenda" style={{ display: 'inline-block', marginTop: 12, color: '#0B8374', fontWeight: 700, fontSize: 13 }}>Ouvrir mon agenda</a>
        )}
        {txInfo?.completed && !txInfo.self && (
          <a href="/support" style={{ display: 'inline-block', marginTop: 12, color: '#0B8374', fontWeight: 700, fontSize: 13 }}>Contacter le support</a>
        )}
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

      <div style={{ padding: '24px 20px 16px' }}>
        {ordered.map(inv => (
        <section key={inv.number} aria-label={sectionTitle(inv)} className={printOnly && printOnly !== inv.number ? 'no-print' : undefined} style={{ marginBottom: 40 }}>
        <h2 className="no-print" style={{ font: '700 20px/1.4 Quicksand, sans-serif', color: '#123644', margin: '4px auto 16px', maxWidth: 620 }}>{sectionTitle(inv)}</h2>
        {/* La prévisualisation EST la page : ce qu'on voit est ce qui s'imprime. */}
        <div className="sheet" style={{
          background: '#fff', borderRadius: 14, padding: 0,
          maxWidth: 620, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            {/* Le prestataire facture sous son propre en-tête : PING n'apparaît que sur ses
                propres relevés de frais et de commission (PING-C, PING-V). */}
            {inv.template === 'commission' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Sign size={26} />
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-.02em' }}>ping</span>
              </div>
            ) : (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', lineHeight: 1.25 }}>
                  {inv.issuer_snapshot?.enseigne || inv.issuer_snapshot?.nom || 'Prestataire'}
                </div>
                {inv.issuer_snapshot?.siret && (
                  <div style={{ fontSize: 11, color: '#4E6470', marginTop: 2 }}>SIRET {inv.issuer_snapshot.siret}</div>
                )}
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4E6470', textTransform: 'uppercase' }}>
                {docTitle(inv)}
              </div>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, marginTop: 3 }}>{inv.number}</div>
              <div style={{ fontSize: 11, color: '#4E6470', marginTop: 2 }}>
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

          <hr style={{ border: 0, borderTop: '1px solid #E3EAE8', margin: '28px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#4E6470', textTransform: 'uppercase' }}>
                {inv.template === 'commission' ? 'Émis par' : inv.template === 'recapitulatif' ? 'Intervenant' : 'Émetteur'}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>
                {inv.template === 'commission' ? (
                  <>
                    <div style={{ fontWeight: 600 }}>{inv.issuer_snapshot?.nom || PLATFORM_PENDING}</div>
                    {inv.issuer_snapshot?.forme && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.forme}</div>}
                    {inv.issuer_snapshot?.adresse && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.adresse}</div>}
                    {inv.issuer_snapshot?.ville && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.ville}</div>}
                    {inv.issuer_snapshot?.siret
                      ? <div style={{ color: '#4E6470' }}>SIRET {inv.issuer_snapshot.siret}</div>
                      : <div style={{ color: '#4E6470' }}>Immatriculation en cours</div>}
                    {inv.issuer_snapshot?.tva && <div style={{ color: '#4E6470' }}>TVA {inv.issuer_snapshot.tva}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>{inv.issuer_snapshot?.enseigne || inv.issuer_snapshot?.nom || '—'}</div>
                    {inv.issuer_snapshot?.enseigne && inv.issuer_snapshot?.nom
                      && inv.issuer_snapshot.enseigne !== inv.issuer_snapshot.nom
                      && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.nom}</div>}
                    {inv.issuer_snapshot?.adresse && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.adresse}</div>}
                    {inv.issuer_snapshot?.ville && <div style={{ color: '#4E6470' }}>{inv.issuer_snapshot.ville}</div>}
                    {inv.issuer_snapshot?.siret && <div style={{ color: '#4E6470' }}>SIRET {inv.issuer_snapshot.siret}</div>}
                    {inv.legal?.forme && <div style={{ color: '#4E6470' }}>{inv.legal.forme}</div>}
                    {inv.legal?.tva_intracom && <div style={{ color: '#4E6470' }}>TVA intracommunautaire {inv.legal.tva_intracom}</div>}
                    {inv.issuer_snapshot?.sap && <div style={{ color: '#4E6470' }}>Déclaration SAP {inv.issuer_snapshot.sap}</div>}
                    {inv.template === 'recapitulatif' && <div style={{ color: '#4E6470' }}>Particulier — non immatriculé</div>}
                  </>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#4E6470', textTransform: 'uppercase' }}>
                {inv.template === 'commission' ? 'Facturé à' : 'Client'}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>
                <div style={{ fontWeight: 600 }}>{inv.client_snapshot?.nom || '—'}</div>
                {inv.client_snapshot?.adresse && <div style={{ color: '#4E6470' }}>{inv.client_snapshot.adresse}</div>}
                {inv.client_snapshot?.ville && <div style={{ color: '#4E6470' }}>{inv.client_snapshot.ville}</div>}
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #E3EAE8', margin: '28px 0' }} />

          {inv.template === 'commission' ? (
            (inv.lines || []).map((l, i) => { const dl = displayLine(inv, l); return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{dl.libelle}</div>
                  {dl.detail && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{dl.detail}</div>}
                  {inv.legal?.taux && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>{tauxLabel(inv.legal.taux)}</div>}
                </div>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {EUR(Number(l.montant_cents ?? 0))}
                </div>
              </div>
            ) })
          ) : (() => {
            // Sobre : une ligne, et dessous ce qu'il faut pour refaire le calcul.
            const l = (inv.lines || [])[0] || {}
            const titre = [l.prestation, durationLabel(l.duree_min)].filter(Boolean).join(' — ')
            const sous = prestationSous(l)
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{titre || 'Prestation'}</div>
                  {sous && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 3 }}>{sous}</div>}
                  {l.adresse && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{l.adresse}</div>}
                </div>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {EUR(Number(l.montant_cents ?? inv.net_cents))}
                </div>
              </div>
            )
          })()}

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            borderTop: '1px solid #E3EAE8', marginTop: 24, paddingTop: 20,
          }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>
              {inv.template === 'recapitulatif' ? 'Montant perçu' : 'Total'}
            </span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24 }}>{EUR(inv.net_cents)}</span>
          </div>
          {inv.legal?.franchise_tva && (
            <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>{inv.legal.franchise_tva}</div>
          )}
          {(() => {
            const av = invoiceCredit(inv)
            if (!av) return null
            return (
              <div style={{ marginTop: 20, padding: '16px 16px', borderRadius: 14, background: 'rgba(18,179,156,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, fontWeight: 700 }}>
                  <span>Avoir{av.number ? ` n° ${av.number}` : ''}{av.date ? ` du ${new Date(av.date).toLocaleDateString('fr-FR')}` : ''}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>− {EUR(av.cents)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{av.reason}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
                    {inv.template === 'recapitulatif' ? 'Montant perçu après avoir' : 'Net à payer après avoir'}
                  </span>
                  <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18 }}>{EUR(av.net)}</span>
                </div>
              </div>
            )
          })()}

          <hr style={{ border: 0, borderTop: '1px solid #E3EAE8', margin: '28px 0' }} />

          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', color: '#4E6470', textTransform: 'uppercase' }}>
            {inv.template === 'recapitulatif' ? 'Déclaration' : 'Mentions légales'}
          </div>
          <div style={{ fontSize: 11, color: '#4E6470', lineHeight: 1.6, marginTop: 7 }}>
            {inv.template === 'recapitulatif' ? (
              <p style={{ margin: 0 }}>{inv.legal?.declaration}</p>
            ) : inv.template === 'commission' ? (
              <p style={{ margin: 0 }}>Règlement à réception. Document émis par PING au titre de la mise en relation.</p>
            ) : (
              <>
                {inv.legal?.categorie_operation && <p style={{ margin: '0 0 5px' }}>Catégorie de l'opération : {inv.legal.categorie_operation}.</p>}
                {inv.legal?.penalites && <p style={{ margin: '0 0 5px' }}>{accentuer(inv.legal.penalites)}</p>}
                {inv.legal?.indemnite_recouvrement && <p style={{ margin: '0 0 5px' }}>{accentuer(inv.legal.indemnite_recouvrement)}</p>}
                {inv.legal?.escompte && <p style={{ margin: '0 0 5px' }}>{accentuer(inv.legal.escompte)}</p>}
                <p style={{ margin: 0 }}>Règlement à réception.</p>
              </>
            )}
          </div>
        </div>
        <div className="no-print" style={{ maxWidth: 620, margin: '24px auto 0' }}>
          <button onClick={() => download(inv)} disabled={busy !== null} aria-label={`Télécharger le PDF : ${sectionTitle(inv)}`} style={{
            width: '100%', minHeight: 54, border: 'none', padding: 14, borderRadius: 16, cursor: 'pointer',
            background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 17,
            opacity: busy === inv.number ? .6 : 1,
          }}>{busy === inv.number ? 'Génération…' : 'Télécharger le PDF'}</button>
          {/* Mêmes actions que la liste des factures (24/11/2026) : imprimer ce document seul, l'envoyer. */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={() => printOne(inv.number)} aria-label={`Imprimer : ${sectionTitle(inv)}`} style={{
              flex: 1, minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: 'rgba(18,179,156,.10)',
              color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16,
            }}>Imprimer</button>
            <button type="button" onClick={() => setSending(inv)} aria-label={`Envoyer : ${sectionTitle(inv)}`} style={{
              flex: 1, minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: 'rgba(18,179,156,.10)',
              color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16,
            }}>Envoyer</button>
          </div>
        </div>
        </section>
        ))}

        {err && <p className="no-print" style={{ maxWidth: 620, margin: '12px auto 0', color: '#B2432E', fontSize: 15 }}>{err}</p>}
        <div className="no-print" style={{ maxWidth: 620, margin: '0 auto' }}>
          {userId && (isBuyer || isSeller) && <TransferCard transactionId={String(params.id)} userId={userId} />}
          <AvanceImmediateCard transactionId={String(params.id)} isSeller={isSeller} />
        </div>

        <div className="no-print" style={{ maxWidth: 620, margin: '8px auto 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => { setPrintOnly(null); window.print() }} style={{
            width: '100%', border: 'none', padding: 14, borderRadius: 16, cursor: 'pointer', minHeight: 52,
            background: 'none', color: '#0B8374', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 16,
          }}>Tout imprimer</button>
        </div>

        {isBuyer && (
          <div className="no-print" style={{ maxWidth: 620, margin: '16px auto 0', display: 'flex', gap: 8, flexDirection: 'column' }}>
            {!reviewed && (
              <button onClick={() => router.push(`/mission/${params.id}/chat?avis`)} style={{
                border: 'none', padding: 13, borderRadius: 16, cursor: 'pointer', minHeight: 52,
                background: 'none', color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16,
              }}>Laisser un avis</button>
            )}
            <button onClick={() => router.push(`/mission/${params.id}/chat?signaler`)} style={{
              border: 'none', padding: 13, borderRadius: 16, cursor: 'pointer', minHeight: 52,
              background: 'none', color: '#6F4F12', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16,
            }}>Signaler un problème</button>
          </div>
        )}
      </div>
      <ShareInvoiceSheet open={!!sending} onClose={() => setSending(null)}
        title={sending ? `Envoyer ${sending.template === 'recapitulatif' ? 'le récapitulatif' : 'le document'} ${sending.number}` : ''}
        subject={sending ? `${docTitle(sending)} ${sending.number}` : ''}
        text={sending ? invoiceShareText(sending, String(params.id)) : ''}
        link={invoiceLink(String(params.id))}
        getFiles={async () => sending ? [await invoiceFile(sending)] : []} />
    </>
  )
}
