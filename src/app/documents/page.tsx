"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import NavDrawer from '@/components/NavDrawer'
import { useMode, roleColumn } from '@/lib/mode'
import ModeHint from '@/components/ModeHint'
import { EUR, TITLE } from '@/lib/invoice-pdf'
import ShareInvoiceSheet from '@/components/ShareInvoiceSheet'
import { invoiceFile, invoiceSummary, invoicesCsv, annualCsv, annualPdf, downloadBlob, type InvoiceRow, type AnnualTotals } from '@/lib/invoiceShare'

/**
 * Mes documents — côté client comme côté prestataire.
 *
 * Un seul écran pour les trois natures de document, parce qu'un utilisateur ne
 * pense pas « facture de prestation » ou « facture de commission » : il pense
 * « mes papiers ». La RLS fait le tri toute seule — chacun ne voit que les
 * documents dont il est l'émetteur ou le destinataire.
 *
 * Tout se récupère ici, en PDF, et se transmet en deux gestes : au comptable (e-mail), sur WhatsApp,
 * par SMS, ou en relevé annuel pour l'Urssaf et les impôts (Romain 30/10).
 */
type Row = InvoiceRow

type Sheet = { title: string; subject: string; text: string; rows: Row[]; accountant: boolean; csvName?: string }

const ShareIco = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
)

export default function DocumentsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [svc, setSvc] = useState<Record<string, string>>({})
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [txRole, setTxRole] = useState<Record<string, { buyer_id: string; seller_id: string }>>({})
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [mode] = useMode(isPro)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [annualBusy, setAnnualBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setMe(user.id)
      const { data: pp } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setIsPro(!!pp)
      const { data } = await supabase.from('invoices').select('*').order('issued_at', { ascending: false })
      const list = ((data ?? []) as Row[]).sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime())
      setRows(list)
      const txIds = Array.from(new Set(list.map(r => r.transaction_id).filter(Boolean)))
      if (txIds.length) {
        const { data: txs } = await supabase.from('transactions').select('id, buyer_id, seller_id, requests(category)').in('id', txIds)
        const m: Record<string, string> = {}
        const roles: Record<string, { buyer_id: string; seller_id: string }> = {}
        ;(txs ?? []).forEach((t: any) => { if (t.requests?.category) m[t.id] = t.requests.category; roles[t.id] = { buyer_id: t.buyer_id, seller_id: t.seller_id } })
        setSvc(m); setTxRole(roles)
      }
      setLoading(false)
    })
  }, [router])

  const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
  // Comme Airbnb : en mode particulier, les factures reçues et SES frais de service ; en mode pro,
  // les factures émises et SA commission. Jamais la commission de l'autre partie.
  const MODE_KINDS = { particulier: ['prestation', 'commission_client'], pro: ['prestation', 'commission_pro'] }
  const inMode = (r: Row, m: 'particulier' | 'pro') => txRole[r.transaction_id]?.[roleColumn(m)] === me && MODE_KINDS[m].includes(r.kind)
  const shown = mode ? rows.filter(r => inMode(r, mode)) : []
  const otherCount = mode ? rows.filter(r => inMode(r, mode === 'pro' ? 'particulier' : 'pro') && txRole[r.transaction_id]?.buyer_id !== txRole[r.transaction_id]?.seller_id).length : 0
  const serviceOf = (r: Row) => svc[r.transaction_id] ? (TRAD[svc[r.transaction_id]] || svc[r.transaction_id]) : null
  const groups = shown.reduce((acc, r) => {
    const key = new Date(r.issued_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ;(acc[key] ||= []).push(r); return acc
  }, {} as Record<string, Row[]>)

  // Relevé annuel, pour l'Urssaf et les impôts : uniquement ce qui est passé par PING, déclaratif.
  const years = Array.from(new Set([new Date().getFullYear(), ...shown.map(r => new Date(r.issued_at).getFullYear())])).sort((a, b) => b - a)
  const ofYear = shown.filter(r => new Date(r.issued_at).getFullYear() === year)
  const sum = (k: string) => ofYear.filter(r => r.kind === k).reduce((n, r) => n + (r.net_cents || 0), 0)
  const myName = (mode === 'pro'
    ? ofYear.find(r => r.issuer_id === me && r.kind === 'prestation')?.issuer_snapshot
    : ofYear.find(r => r.client_id === me && r.kind === 'prestation')?.client_snapshot) as any
  const annual: AnnualTotals | null = mode ? (mode === 'pro' ? {
    year, mode, name: myName?.enseigne || myName?.nom || '', count: ofYear.length,
    rows: [
      { label: 'Chiffre d’affaires des prestations (via PING)', cents: sum('prestation') },
      { label: 'Frais de mise en relation PING', cents: sum('commission_pro') },
      { label: 'Montant net perçu', cents: sum('prestation') - sum('commission_pro') },
    ],
    note: 'Récapitulatif des prestations facturées via PING sur l’année, tel qu’enregistré sur la plateforme. À reporter sur votre déclaration de chiffre d’affaires (Urssaf) et de revenus ; les prestations réalisées hors de PING n’y figurent pas.',
  } : {
    year, mode, name: myName?.nom || '', count: ofYear.length,
    rows: [
      { label: 'Prestations payées (ménage, repassage, nettoyage)', cents: sum('prestation') },
      { label: 'Frais de service PING', cents: sum('commission_client') },
      { label: 'Total payé via PING', cents: sum('prestation') + sum('commission_client') },
    ],
    note: 'Les dépenses de services à la personne peuvent ouvrir droit au crédit d’impôt de 50 %, selon votre situation. Montant des prestations à reporter sur votre déclaration de revenus ; conservez les factures, elles restent disponibles ici.',
  }) : null

  async function downloadAnnual(kind: 'pdf' | 'csv') {
    if (!annual) return
    setAnnualBusy(true)
    try {
      if (kind === 'csv') downloadBlob(annualCsv(annual), `PING-releve-${annual.year}.csv`)
      else downloadBlob(await annualPdf(annual), `PING-releve-${annual.year}.pdf`)
    } catch { }
    setAnnualBusy(false)
  }
  function openShare(r: Row) {
    setSheet({ title: 'Transmettre ce document', subject: `${TITLE[r.template] ?? 'Document'} ${r.number}`, text: invoiceSummary(r, me), rows: [r], accountant: false })
  }
  function openMonth(mois: string, list: Row[]) {
    const total = list.reduce((n, r) => n + (r.net_cents || 0), 0)
    setSheet({
      title: `Envoyer ${mois} à mon comptable`, subject: `Factures PING — ${mois}`, accountant: true,
      text: `Bonjour, voici mes documents PING de ${mois} : ${list.length} document${list.length > 1 ? 's' : ''}, ${EUR(total).replace(/[\u202f\u00a0]/g, ' ')} au total. Le récapitulatif est joint (CSV).`,
      rows: list, csvName: `PING-${mois.replace(/\s+/g, '-')}.csv`,
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', paddingBottom: 40 }}>
      <div style={{ padding: '28px 16px 14px', background: '#123644', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} aria-label="Retour"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>‹</button>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Mes opérations</span>
      </div>

      <div style={{ padding: 16, maxWidth: 760, margin: '0 auto' }}>
        {!loading && isPro && mode && <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'documents' : 'document'} />}
        {!loading && annual && shown.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 18, border: '1px solid #E7EDEB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15 }}>Pour l&apos;Urssaf et les impôts</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {years.map(y => (
                  <button key={y} type="button" onClick={() => setYear(y)} aria-pressed={y === year}
                    style={{ padding: '5px 11px', borderRadius: 999, border: y === year ? 'none' : '1px solid #DCE5E3', background: y === year ? '#123644' : '#fff', color: y === year ? '#fff' : '#123644', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{y}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {annual.rows.map((x, i) => (
                <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: i ? '1px solid #F0F3F2' : 'none', fontSize: 13 }}>
                  <span style={{ color: i === annual.rows.length - 1 ? '#123644' : '#4E6470', fontWeight: i === annual.rows.length - 1 ? 700 : 500 }}>{x.label}</span>
                  <b style={{ fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap' }}>{EUR(x.cents)}</b>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '8px 0 12px' }}>{annual.note}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={annualBusy} onClick={() => downloadAnnual('pdf')}
                style={{ flex: 1.4, padding: 11, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: annualBusy ? .6 : 1 }}>
                Télécharger le relevé annuel
              </button>
              <button type="button" disabled={annualBusy} onClick={() => downloadAnnual('csv')}
                style={{ flex: 1, padding: 11, borderRadius: 999, border: '1.5px solid #12B39C', background: '#fff', color: '#0C8F7E', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                CSV
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <p style={{ color: '#4E6470', fontSize: 13 }}>Chargement…</p>
        ) : shown.length === 0 ? (
          <>
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, textAlign: 'center', marginBottom: 14 }}>
              <Sign size={32} />
              <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, marginTop: 10 }}>
                Aucune opération pour l&apos;instant
              </h2>
              <p style={{ fontSize: 12.5, color: '#4E6470', marginTop: 6, lineHeight: 1.55 }}>
                Factures et reçus sont émis à la fin de chaque mission, dès que le code de fin est scanné.
                Voici à quoi ressemblera cette page{mode === 'pro' ? ' côté prestataire' : ''} :
              </p>
            </div>
            {/* Exemples fictifs, clairement marqués : jamais cliquables, jamais confondus avec de vraies pièces. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9A6712', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>Exemple fictif</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, opacity: .75 }}>
              {(mode === 'pro' ? [
                { t: 'Facture · Ménage', n: 'FACT-2026-00012 · émise à Julie R.', a: 9000 },
                { t: 'Relevé de commission PING · Ménage', n: 'PING-V-2026-00012 · reçu de PING', a: 1530 },
                { t: 'Facture · Repassage', n: 'FACT-2026-00011 · émise à Marc D.', a: 6000 },
              ] : [
                { t: 'Facture · Ménage', n: 'FACT-2026-00012 · reçue de Sophie L.', a: 9000 },
                { t: 'Frais de service PING · Ménage', n: 'PING-C-2026-00012 · reçu de PING', a: 720 },
                { t: 'Facture · Repassage', n: 'FACT-2026-00011 · reçue de Karim B.', a: 6000 },
              ]).map(x => (
                <div key={x.n} style={{ background: '#fff', border: '1px dashed #DCE5E3', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>{x.t}</span>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#0C8F7E' }}>{EUR(x.a)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 3 }}>{x.n} · exemple</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          Object.entries(groups).map(([mois, list]) => (
            <div key={mois} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, margin: '0 0 10px 2px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {mois} · {EUR(list.reduce((n, r) => n + (r.net_cents || 0), 0))}
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => downloadBlob(invoicesCsv(list, me, serviceOf), `PING-${mois.replace(/\s+/g, '-')}.csv`)}
                    style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>CSV</button>
                  <button type="button" onClick={() => openMonth(mois, list)}
                    style={{ padding: '5px 10px', borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>Envoyer au comptable</button>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {list.map(r => {
                  const emis = r.issuer_id === me
                  const autre = emis ? (r.client_snapshot?.nom) : (r.issuer_snapshot?.enseigne || r.issuer_snapshot?.nom || 'PING')
                  const service = serviceOf(r)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'stretch', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(18,54,68,.05)', overflow: 'hidden' }}>
                    <button onClick={() => router.push(`/mission/${r.transaction_id}/facture`)}
                      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
                          {TITLE[r.template] ?? 'Document'}{service ? <span style={{ color: 'var(--teal, #0C8F7E)' }}> · {service}</span> : null}
                        </span>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#0C8F7E' }}>{EUR(r.net_cents)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 3 }}>
                        {r.number} · {emis ? 'émis à' : 'reçu de'} {autre || '—'} · {new Date(r.issued_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0C8F7E', marginTop: 5 }}>Voir l&apos;opération et la facture ›</div>
                    </button>
                    <button type="button" onClick={() => openShare(r)} aria-label={`Transmettre ${r.number}`}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, width: 70, border: 'none', borderLeft: '1px solid #F0F3F2', background: '#FAFCFB', color: '#0C8F7E', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>
                      <ShareIco />Partager
                    </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <ShareInvoiceSheet open={!!sheet} onClose={() => setSheet(null)}
        title={sheet?.title ?? ''} subject={sheet?.subject ?? ''} text={sheet?.text ?? ''} accountant={!!sheet?.accountant}
        getFiles={() => Promise.all((sheet?.rows ?? []).map(r => invoiceFile(r)))}
        csv={sheet?.csvName ? () => ({ blob: invoicesCsv(sheet!.rows, me, serviceOf), name: sheet!.csvName! }) : undefined} />
    </div>
  )
}
