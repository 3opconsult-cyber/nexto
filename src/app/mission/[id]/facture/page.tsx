"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import NavDrawer from '@/components/NavDrawer'
import { readScreenCache, writeScreenCache, sessionUserId } from '@/lib/screenCache'
import AvanceImmediateCard from '@/components/AvanceImmediateCard'
import TransferCard from '@/components/TransferCard'
import { EUR, KIND_LABEL, TITLE, docTitle, durationLabel, downloadInvoicePdf,
         PLATFORM_PENDING, tauxLabel, prestationSous, withProTaxStatus, invoiceCredit, type ProTaxStatus, type Invoice } from '@/lib/invoice-pdf'

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
  const [isSeller, setIsSeller] = useState(false)
  const [isBuyer, setIsBuyer] = useState(false)
  const [reviewed, setReviewed] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [txInfo, setTxInfo] = useState<{ self: boolean; completed: boolean; missing?: boolean } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const cacheKey = `facture_${params.id}`
    type Snap = { invoices: Invoice[]; isSeller: boolean; isBuyer: boolean; reviewed: boolean; txInfo: { self: boolean; completed: boolean; missing?: boolean } }
    async function load() {
      // Session locale (sans aller-retour réseau), dernier état connu tout de suite, puis mission,
      // factures et avis lus ensemble (audit 19/11, correction 3 : 2,3 s mesurées avant).
      const uid = await sessionUserId(supabase)
      if (!alive) return
      const user = uid ? { id: uid } : null
      setUserId(uid)
      const cached = readScreenCache<Snap>(cacheKey, uid)
      if (cached) {
        setInvoices(cached.invoices); setIsSeller(cached.isSeller); setIsBuyer(cached.isBuyer)
        setReviewed(cached.reviewed); setTxInfo(cached.txInfo); setLoading(false)
      }
      const [{ data: tx }, { data }, rvRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('id', params.id).maybeSingle(),
        supabase.from('invoices').select('*').eq('transaction_id', params.id),
        uid ? supabase.from('reviews').select('id').eq('transaction_id', params.id).eq('rater_id', uid).limit(1) : Promise.resolve({ data: [] as any[] }),
      ])
      if (!alive) return
      const amBuyer = user && tx ? user.id === (tx as any).buyer_id : true
      // Prestation d'abord, puis UNIQUEMENT la commission qui concerne le viewer
      // (client = frais de service 5 % ; prestataire = commission PING 11 %). Jamais les deux — comme Airbnb.
      const mine = amBuyer ? 'commission_client' : 'commission_pro'
      // Factures émises avant la migration 038 : la preuve réelle et le forfait sont repris de la mission.
      const t: any = tx
      const enrich = (v: Invoice): Invoice => {
        if (v.kind !== 'prestation' || !t || !Array.isArray(v.lines) || !v.lines[0]) return v
        const l0 = v.lines[0]
        return { ...v, lines: [{
          ...l0,
          preuve_arrivee: l0.preuve_arrivee ?? t.arrival_proof ?? t.arrival_method ?? null,
          preuve_depart: l0.preuve_depart ?? t.completion_proof ?? null,
          photo_arrivee: l0.photo_arrivee ?? (t.arrival_photo_path ? true : null),
          forfait_cents: l0.forfait_cents ?? t.base_forfait_cents ?? null,
          heures_incluses: l0.heures_incluses ?? t.included_hours ?? null,
        }, ...v.lines.slice(1)] }
      }
      // Forme juridique et TVA (migration 039) : pour une facture émise avant, statut actuel du prestataire,
      // si la base connaît déjà ces colonnes (sinon erreur ignorée, rien ne change).
      let live: ProTaxStatus | null = null
      if (t?.seller_id && (data ?? []).some((v: any) => v.template === 'facture' && v.issuer_snapshot?.forme_juridique == null && v.issuer_snapshot?.tva_regime == null)) {
        const { data: st, error: stErr } = await supabase.from('provider_profiles')
          .select('legal_form, vat_status, vat_number').eq('id', t.seller_id).maybeSingle()
        if (!stErr && st) live = st as ProTaxStatus
      }
      const list = ((data ?? []) as Invoice[]).map(enrich).map(v => withProTaxStatus(v, live))
        .filter(v => v.kind === 'prestation' || v.kind === mine)
        .sort((a, b) => (a.kind === 'prestation' ? 0 : 1) - (b.kind === 'prestation' ? 0 : 1))
      const info = !tx ? { self: false, completed: false, missing: true }
        : { self: (tx as any).buyer_id === (tx as any).seller_id, completed: !!(tx as any).completed_at || ['completed', 'released'].includes((tx as any).status) }
      const seller = !!user && !!tx && user.id === (tx as any).seller_id
      const buyer = !!user && !!tx && user.id === (tx as any).buyer_id
      const rv = buyer ? !!(rvRes as any).data?.length : true
      setTxInfo(info); setIsSeller(seller); setIsBuyer(buyer); setReviewed(rv)
      // L'onglet choisi est gardé si la liste n'a pas changé de longueur (relecture après le cache).
      setInvoices(list); setActive(a => (cached && cached.invoices.length === list.length ? a : 0)); setLoading(false)
      writeScreenCache(cacheKey, uid, { invoices: list, isSeller: seller, isBuyer: buyer, reviewed: rv, txInfo: info })
    }
    load()
    return () => { alive = false }
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
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: 12, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Facturation</span>
      </div>
      {children}
    </div>
  )

  if (loading) return shell(<p style={{ padding: 20, color: '#4E6470', fontSize: 13 }}>Chargement…</p>)

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
          <a href="/agenda" style={{ display: 'inline-block', marginTop: 12, color: '#0C8F7E', fontWeight: 700, fontSize: 13 }}>Ouvrir mon agenda</a>
        )}
        {txInfo?.completed && !txInfo.self && (
          <a href="/support" style={{ display: 'inline-block', marginTop: 12, color: '#0C8F7E', fontWeight: 700, fontSize: 13 }}>Contacter le support</a>
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

      {invoices.length > 1 && (
        <div className="no-print" style={{ display: 'flex', gap: 7, padding: '13px 16px 0', overflowX: 'auto' }}>
          {invoices.map((v, i) => (
            <button key={v.number} onClick={() => setActive(i)} style={{
              flexShrink: 0, border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 15px', borderRadius: 999,
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

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

          {inv.template === 'commission' ? (
            (inv.lines || []).map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.libelle}</div>
                  {l.detail && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>{l.detail}</div>}
                  {inv.legal?.taux && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>{tauxLabel(inv.legal.taux)}</div>}
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
            borderTop: '1px solid #DCE5E3', marginTop: 14, paddingTop: 12,
          }}>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>
              {inv.template === 'recapitulatif' ? 'Montant perçu' : 'Total'}
            </span>
            <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 21 }}>{EUR(inv.net_cents)}</span>
          </div>
          {inv.legal?.franchise_tva && (
            <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 4 }}>{inv.legal.franchise_tva}</div>
          )}
          {(() => {
            const av = invoiceCredit(inv)
            if (!av) return null
            return (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(18,179,156,.08)', border: '1px solid rgba(18,179,156,.3)' }}>
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

          <hr style={{ border: 0, borderTop: '1px solid #DCE5E3', margin: '18px 0' }} />

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
            background: 'rgba(242,169,59,.13)', color: '#8A6520', fontSize: 11.5, lineHeight: 1.55,
          }}>
            PING n'est pas encore immatriculée : le document le mentionne tel quel. Dès que le
            SIRET existe, il se saisit dans l'admin et apparaît sur les documents émis ensuite —
            ceux déjà émis gardent l'instantané de leur date, c'est voulu.
          </p>
        )}

        {err && <p className="no-print" style={{ maxWidth: 620, margin: '12px auto 0', color: '#B4402C', fontSize: 12.5 }}>{err}</p>}
        <div className="no-print" style={{ maxWidth: 620, margin: '0 auto' }}>
          {userId && (isBuyer || isSeller) && <TransferCard transactionId={String(params.id)} userId={userId} />}
          <AvanceImmediateCard transactionId={String(params.id)} isSeller={isSeller} />
        </div>

        <div className="no-print" style={{ maxWidth: 620, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={download} disabled={busy} style={{
            width: '100%', border: 'none', padding: 14, borderRadius: 999, cursor: 'pointer',
            background: '#0C8F7E', color: '#fff', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 14.5, boxShadow: '0 8px 18px rgba(18,179,156,.28)',
            opacity: busy ? .6 : 1,
          }}>{busy ? 'Génération…' : 'Télécharger le PDF'}</button>
          <button onClick={() => window.print()} style={{
            width: '100%', border: 'none', padding: 14, borderRadius: 999, cursor: 'pointer',
            background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif',
            fontWeight: 700, fontSize: 14.5, boxShadow: '0 0 0 1px #DCE5E3',
          }}>Imprimer</button>
        </div>

        {isBuyer && (
          <div className="no-print" style={{ maxWidth: 620, margin: '14px auto 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!reviewed && (
              <button onClick={() => router.push(`/mission/${params.id}/chat?avis`)} style={{
                flex: '1 1 200px', border: 'none', padding: 13, borderRadius: 999, cursor: 'pointer',
                background: 'rgba(18,179,156,.1)', color: '#0C8F7E', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14,
              }}>Laisser un avis</button>
            )}
            <button onClick={() => router.push(`/mission/${params.id}/chat?signaler`)} style={{
              flex: '1 1 200px', border: 'none', padding: 13, borderRadius: 999, cursor: 'pointer',
              background: '#fff', color: '#8a6520', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, boxShadow: '0 0 0 1px #DCE5E3',
            }}>Signaler un problème</button>
          </div>
        )}
      </div>
    </>
  )
}
