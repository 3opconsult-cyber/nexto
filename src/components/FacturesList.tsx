"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShareInvoiceSheet from '@/components/ShareInvoiceSheet'
import { loadFactureSnap } from '@/lib/screenLoaders'
import { EUR, TITLE, docTitle, invoiceCredit, type Invoice } from '@/lib/invoice-pdf'
import {
  invoiceFile, invoiceShareText, invoiceLink, invoicesCsv, downloadBlob, annualTotals, annualCsv, annualPdf,
  providerSummary, providerSummaryTotals, type InvoiceRow, type AnnualTotals,
} from '@/lib/invoiceShare'

/**
 * Factures d'un espace (24/11/2026, remarques de Romain sur l'onglet « Factures »).
 *
 * Au premier plan : les documents du prestataire à son client (FACT-… sous l'en-tête du prestataire, ou
 * RECAP-… « Récapitulatif d'intervention » s'il n'est pas immatriculé), rangés par mois, le plus récent
 * d'abord ; côté prestataire « Factures de mes clients », côté particulier « Factures de mes prestataires ».
 * En bas, repliés : les documents PING (« Frais PING ») ; chaque partie ne voit que SA commission
 * (prestataire : PING-V, frais de mise en relation ; particulier : PING-C, frais de service).
 * Chaque document : « Voir », « Imprimer », « Envoyer » (e-mail, WhatsApp, comptable, lien).
 * En haut : relevé annuel (prestataire) ou résumé annuel par prestataire (particulier), déclaratifs.
 *
 * Aucun montant recalculé : tout vient des documents enregistrés (net_cents, avoir de la migration 040).
 * Utilisé par : src/app/agenda/page.tsx (onglet Factures), src/app/documents/page.tsx (Mes opérations).
 */
type Mode = 'pro' | 'particulier'
type Row = InvoiceRow & { id: string }

// Documents visibles dans chaque espace (règle inchangée, même filtre que /documents et l'agenda).
export const FACTURES_MODE_KINDS: Record<Mode, string[]> = { particulier: ['prestation', 'commission_client'], pro: ['prestation', 'commission_pro'] }

const INK = '#123644', MUT = '#4E6470', TEAL = '#0B8374'
const h2: React.CSSProperties = { font: '700 18px/1.4 Quicksand, sans-serif', color: INK, margin: '28px 0 6px' }
const monthStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: MUT, margin: '20px 0 10px' }
const actBtn: React.CSSProperties = {
  flex: 1, minHeight: 44, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  borderRadius: 12, border: 'none', background: 'rgba(18,179,156,.10)', color: TEAL, fontWeight: 700, fontSize: 15,
  cursor: 'pointer', fontFamily: 'inherit', padding: '0 8px',
}
const pill = (on: boolean): React.CSSProperties => ({
  minHeight: 44, minWidth: 64, padding: '0 14px', borderRadius: 999, border: on ? 'none' : '1px solid #E7EDEB',
  background: on ? INK : '#fff', color: on ? '#fff' : INK, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
})

const Svg = ({ d }: { d: JSX.Element }) => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d}</svg>
)
const IC = {
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  chev: <path d="M9 6l6 6-6 6" />,
}

const sortDesc = (a: Row, b: Row) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime() || String(b.number).localeCompare(String(a.number))
const monthOf = (r: Row) => new Date(r.issued_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
const dateOf = (r: Row) => new Date(r.issued_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Sheet = { title: string; subject: string; text: string; rows: Row[]; accountant: boolean; link?: string; csvName?: string; annual?: AnnualTotals }

export default function FacturesList({ mode, uid, rows, names = {}, services = {}, annual = true, monthTools = false, pageSize = 6, docsLink = false }: {
  mode: Mode
  uid: string
  /** Documents des missions de CE mode (le composant refiltre par nature : jamais la commission de l'autre partie). */
  rows: any[]
  /** Nom de l'interlocuteur par mission (RPC transaction_counterparts). */
  names?: Record<string, string>
  /** Service par mission (Ménage, Repassage…). */
  services?: Record<string, string>
  annual?: boolean
  /** Boutons « CSV » et « Envoyer au comptable » par mois (Mes opérations). */
  monthTools?: boolean
  pageSize?: number
  /** Lien vers « Mes opérations » en bas (onglet de l'agenda). */
  docsLink?: boolean
}) {
  const router = useRouter()
  const [full, setFull] = useState<Record<string, Row>>({})
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [shownMain, setShownMain] = useState(pageSize)
  const [pingOpen, setPingOpen] = useState(false)
  const [shownPing, setShownPing] = useState(pageSize)
  const [year, setYear] = useState(new Date().getFullYear())
  const [detail, setDetail] = useState(false)
  const [busy, setBusy] = useState('')

  const own = useMemo(() => (rows as Row[]).filter(r => FACTURES_MODE_KINDS[mode].includes(r.kind)).sort(sortDesc), [rows, mode])
  const main = own.filter(r => r.kind === 'prestation')
  const ping = own.filter(r => r.kind !== 'prestation')

  // Lignes complètes (en-tête, client, avoir) : déjà là sur « Mes opérations », lues ici sinon, pour les seuls
  // documents de ce mode (RLS du compte connecté).
  const idsKey = own.filter(r => !(r as any).issuer_snapshot && !full[r.id]).map(r => r.id).join(',')
  useEffect(() => {
    if (!idsKey) return
    let alive = true
    const ids = idsKey.split(',')
    const supabase = createClient()
    ;(async () => {
      const next: Record<string, Row> = {}
      for (let i = 0; i < ids.length; i += 80) {
        const { data } = await supabase.from('invoices').select('*').in('id', ids.slice(i, i + 80))
        ;(data ?? []).forEach((r: any) => { if (FACTURES_MODE_KINDS[mode].includes(r.kind)) next[r.id] = r })
      }
      if (alive) setFull(f => ({ ...f, ...next }))
    })().catch(() => { /* réseau : la liste reste affichée, les actions relisent le document */ })
    return () => { alive = false }
  }, [idsKey, mode])

  const get = (r: Row): Row => ((r as any).issuer_snapshot ? r : (full[r.id] || r))
  const serviceOf = (r: Row) => services[r.transaction_id] || null
  const providerName = (r: Row) => { const g = get(r); return g.issuer_snapshot?.enseigne || g.issuer_snapshot?.nom || names[r.transaction_id] || 'Prestataire' }
  const otherName = (r: Row) => mode === 'pro' ? (names[r.transaction_id] || get(r).client_snapshot?.nom || 'Client') : providerName(r)

  // Le document tel que « Voir » l'affiche (preuves de présence, forme juridique et TVA : loadFactureSnap).
  async function fullInvoice(r: Row): Promise<Invoice> {
    try {
      const snap = await loadFactureSnap(createClient(), uid, r.transaction_id)
      const inv = snap.invoices.find(v => v.number === r.number)
      if (inv) return inv
    } catch { /* repli ci-dessous */ }
    const g = get(r)
    if ((g as any).issuer_snapshot) return g
    const { data } = await createClient().from('invoices').select('*').eq('id', r.id).maybeSingle()
    if (!data) throw new Error('introuvable')
    return data as Invoice
  }

  function openSend(r: Row) {
    const g = get(r)
    setSheet({
      title: `Envoyer ${docTitle(g).toLowerCase().startsWith('facture') ? 'la facture' : 'le document'} ${r.number}`,
      subject: `${docTitle(g)} ${r.number}`, text: invoiceShareText(g, r.transaction_id, serviceOf(r)),
      rows: [r], accountant: false, link: invoiceLink(r.transaction_id),
    })
  }
  function openMonth(mois: string, list: Row[]) {
    const total = list.reduce((n, r) => n + (r.net_cents || 0), 0)
    setSheet({
      title: `Envoyer ${mois} à mon comptable`, subject: `Factures PING — ${mois}`, accountant: true,
      text: `Bonjour, voici mes documents PING de ${mois} : ${list.length} document${list.length > 1 ? 's' : ''}, ${EUR(total).replace(/[  ]/g, ' ')} au total. Le récapitulatif est joint (CSV).`,
      rows: list, csvName: `PING-${mois.replace(/\s+/g, '-')}.csv`,
    })
  }

  // ---- Relevé / résumé annuel ----
  const years = Array.from(new Set([new Date().getFullYear(), ...own.map(r => new Date(r.issued_at).getFullYear())])).sort((a, b) => b - a)
  const fullOwn = own.map(get)
  const proAnnual = mode === 'pro' ? annualTotals(fullOwn, 'pro', year, uid) : null
  const lines = mode === 'particulier' ? providerSummary(fullOwn, year, providerName) : []
  const clientName = (fullOwn.find(r => r.kind === 'prestation' && new Date(r.issued_at).getFullYear() === year)?.client_snapshot as any)?.nom || ''
  const clientAnnual = mode === 'particulier' ? providerSummaryTotals(lines, year, clientName) : null
  const yearTotal = (t: AnnualTotals | null) => t ? t.rows[t.rows.length - 1].cents : 0

  async function exportAnnual(t: AnnualTotals, kind: 'pdf' | 'csv') {
    setBusy('annual-' + kind)
    const base = mode === 'pro' ? `PING-releve-${t.year}` : `PING-resume-${t.year}`
    try { kind === 'csv' ? downloadBlob(annualCsv(t), `${base}.csv`) : downloadBlob(await annualPdf(t), `${base}.pdf`) } catch { }
    setBusy('')
  }
  function shareAnnual(t: AnnualTotals) {
    const label = mode === 'pro' ? `Relevé annuel ${t.year}` : `Résumé annuel ${t.year} par prestataire`
    setSheet({
      title: `Envoyer le ${label.charAt(0).toLowerCase() + label.slice(1)}`, subject: `PING — ${label}`, accountant: false, rows: [], annual: t,
      text: `${label} (PING) : ${t.rows.map(x => `${x.label} ${EUR(x.cents)}`).join(' ; ')}. Montants déclaratifs, tels qu’enregistrés sur PING.`.replace(/[  ]/g, ' '),
      csvName: `${mode === 'pro' ? 'PING-releve' : 'PING-resume'}-${t.year}.csv`,
    })
  }

  const yearChips = years.length > 1 && (
    <div role="group" aria-label="Année" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
      {years.map(y => <button key={y} type="button" aria-pressed={y === year} onClick={() => setYear(y)} style={pill(y === year)}>{y}</button>)}
    </div>
  )
  const annualButtons = (t: AnnualTotals, exportKind: 'pdf' | 'csv') => (
    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      <button type="button" disabled={!!busy} onClick={() => exportAnnual(t, exportKind)} style={{ ...actBtn, background: TEAL, color: '#fff', minHeight: 48 }}>
        {busy === 'annual-' + exportKind ? 'Préparation…' : exportKind === 'pdf' ? 'Exporter (PDF)' : 'Exporter (CSV)'}
      </button>
      <button type="button" onClick={() => shareAnnual(t)} style={{ ...actBtn, minHeight: 48 }}><Svg d={IC.send} />Partager</button>
    </div>
  )

  const annualBlock = !annual || !own.length ? null : mode === 'pro' && proAnnual ? (
    <section aria-label="Relevé annuel" style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ font: '700 17px/1.4 Quicksand, sans-serif', color: INK }}>Relevé annuel {year}</span>
        <span style={{ fontSize: 15, color: MUT, whiteSpace: 'nowrap' }}>net <b style={{ color: INK }}>{EUR(yearTotal(proAnnual))}</b></span>
      </div>
      {yearChips}
      {annualButtons(proAnnual, 'pdf')}
    </section>
  ) : clientAnnual ? (
    <section id="resume-annuel" aria-label="Résumé annuel par prestataire" style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 8 }}>
      <div style={{ font: '700 17px/1.4 Quicksand, sans-serif', color: INK }}>Résumé annuel {year} par prestataire</div>
      <div style={{ fontSize: 15, color: MUT, marginTop: 4, lineHeight: 1.5 }}>
        Pour votre déclaration d’impôt · {lines.length} prestataire{lines.length > 1 ? 's' : ''} · {EUR(yearTotal(clientAnnual))} payés via PING
      </div>
      {yearChips}
      <button type="button" aria-expanded={detail} onClick={() => setDetail(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, marginTop: 10, padding: 0, border: 'none', background: 'none', color: TEAL, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1 }}>{detail ? 'Masquer le détail par prestataire' : 'Voir le détail par prestataire'}</span>
        <span style={{ display: 'inline-flex', transform: detail ? 'rotate(90deg)' : 'none' }}><Svg d={IC.chev} /></span>
      </button>
      {detail && (
        lines.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, marginTop: 6 }}>
            <thead>
              <tr style={{ color: MUT, textAlign: 'left' }}>
                <th scope="col" style={{ padding: '8px 6px 8px 0', fontWeight: 700 }}>Prestataire</th>
                <th scope="col" style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'right' }}>Nb</th>
                <th scope="col" style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'right' }}>Payé</th>
                <th scope="col" style={{ padding: '8px 0 8px 6px', fontWeight: 700, textAlign: 'right' }}>Frais PING</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.key} style={{ borderTop: '1px solid #EEF2F1' }}>
                  <td style={{ padding: '10px 6px 10px 0', color: INK, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.name}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: INK }}>{l.count}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: INK, whiteSpace: 'nowrap' }}>{EUR(l.prestCents)}</td>
                  <td style={{ padding: '10px 0 10px 6px', textAlign: 'right', color: MUT, whiteSpace: 'nowrap' }}>{EUR(l.feeCents)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1.5px solid #E7EDEB' }}>
                <td style={{ padding: '10px 6px 10px 0', fontWeight: 700, color: INK }}>Total</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: INK }}>{clientAnnual.count}</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{EUR(clientAnnual.rows[0].cents)}</td>
                <td style={{ padding: '10px 0 10px 6px', textAlign: 'right', fontWeight: 700, color: MUT, whiteSpace: 'nowrap' }}>{EUR(clientAnnual.rows[1].cents)}</td>
              </tr>
            </tbody>
          </table>
        ) : <p style={{ fontSize: 15, color: MUT, margin: '6px 0 0' }}>Aucune prestation en {year}.</p>
      )}
      {detail && <p style={{ fontSize: 15, color: MUT, lineHeight: 1.55, margin: '12px 0 0' }}>{clientAnnual.note}</p>}
      {annualButtons(clientAnnual, 'csv')}
    </section>
  ) : null

  // ---- Une ligne de document ----
  const card = (r: Row, pingDoc = false) => {
    const g = get(r)
    const credit = invoiceCredit(g)
    const title = (g as any).issuer_snapshot ? docTitle(g) : (TITLE[r.template] ?? 'Document')
    const sub = [r.number, dateOf(r), pingDoc ? null : otherName(r), serviceOf(r)].filter(Boolean).join(' · ')
    return (
      <li key={r.id} data-kind={r.kind} data-number={r.number} style={{ listStyle: 'none', background: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 1px 2px rgba(18,54,68,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <b style={{ font: '700 16px/1.4 Quicksand, sans-serif', color: INK, minWidth: 0 }}>{title}</b>
          <b style={{ font: '700 16px/1.4 Quicksand, sans-serif', color: INK, whiteSpace: 'nowrap' }}>{EUR(credit ? credit.net : r.net_cents)}</b>
        </div>
        <div style={{ fontSize: 15, color: MUT, marginTop: 4, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
          {sub}{mode === 'pro' && r.kind === 'prestation' ? (r.template === 'facture' ? ' · émise sous votre en-tête' : ' · à votre nom') : ''}{credit ? ` · avoir ${EUR(credit.cents)} déduit` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" style={actBtn} aria-label={`Voir ${r.number}`} onClick={() => router.push(`/mission/${r.transaction_id}/facture`)}><Svg d={IC.eye} />Voir</button>
          <button type="button" style={actBtn} aria-label={`Imprimer ${r.number}`} onClick={() => router.push(`/mission/${r.transaction_id}/facture?imprimer=${encodeURIComponent(r.number)}`)}><Svg d={IC.print} />Imprimer</button>
          <button type="button" style={actBtn} aria-label={`Envoyer ${r.number}`} onClick={() => openSend(r)}><Svg d={IC.send} />Envoyer</button>
        </div>
      </li>
    )
  }
  const grouped = (list: Row[], pingDoc: boolean) => {
    const groups: [string, Row[]][] = []
    for (const r of list) { const k = monthOf(r); const last = groups[groups.length - 1]; if (last && last[0] === k) last[1].push(r); else groups.push([k, [r]]) }
    return groups.map(([mois, l]) => {
      const all = (pingDoc ? ping : main).filter(r => monthOf(r) === mois)
      return (
        <div key={mois}>
          <div style={{ ...monthStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{cap(mois)} · {all.length} document{all.length > 1 ? 's' : ''}</span>
            {monthTools && !pingDoc && (
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => downloadBlob(invoicesCsv(all.map(get), uid, x => serviceOf(x as Row)), `PING-${mois.replace(/\s+/g, '-')}.csv`)}
                  style={{ ...pill(false), minWidth: 0 }}>CSV</button>
                <button type="button" onClick={() => openMonth(mois, all)} style={{ ...pill(true), minWidth: 0 }}>Envoyer au comptable</button>
              </span>
            )}
          </div>
          <ul style={{ margin: 0, padding: 0 }}>{l.map(r => card(r, pingDoc))}</ul>
        </div>
      )
    })
  }
  const more = (left: number, onClick: () => void, what: string) => left > 0 && (
    <button type="button" onClick={onClick}
      style={{ width: '100%', minHeight: 52, marginBottom: 20, borderRadius: 14, border: 'none', background: '#fff', color: TEAL, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
      Voir {Math.min(left, 10)} {what} de plus ({left} restant{left > 1 ? 's' : ''})
    </button>
  )

  const pingTotal = ping.reduce((n, r) => n + (r.net_cents || 0), 0)
  const mainTitle = mode === 'pro' ? 'Factures de mes clients' : 'Factures de mes prestataires'
  const pingSub = mode === 'pro'
    ? 'Documents émis par PING : vos frais de mise en relation. Votre commission seulement.'
    : 'Documents émis par PING : vos frais de service. Vos frais seulement.'

  return (
    <div data-factures-list={mode}>
      {annualBlock}

      <h2 style={h2}>{mainTitle}</h2>
      <p style={{ fontSize: 15, color: MUT, lineHeight: 1.55, margin: '0 0 4px' }}>
        {mode === 'pro'
          ? 'Les documents que vous émettez à vos clients, sous votre en-tête (facture, ou récapitulatif d’intervention si vous n’êtes pas immatriculé).'
          : 'Les factures émises par vos prestataires, à garder pour votre déclaration.'}
      </p>
      {main.length ? (
        <>
          {grouped(main.slice(0, shownMain), false)}
          {more(main.length - shownMain, () => setShownMain(n => n + 10), 'factures')}
        </>
      ) : (
        <p style={{ fontSize: 15, color: MUT, lineHeight: 1.55, margin: '12px 0 20px' }}>Aucune facture pour l’instant. Elles apparaissent ici à la fin de chaque mission.</p>
      )}

      {ping.length > 0 && (
        <section aria-label="Frais PING" style={{ marginTop: 28 }}>
          <button type="button" aria-expanded={pingOpen} onClick={() => setPingOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '12px 16px', borderRadius: 16, border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: INK }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '700 17px/1.4 Quicksand, sans-serif' }}>Frais PING</span>
              <span style={{ display: 'block', fontSize: 15, color: MUT, marginTop: 2 }}>{ping.length} document{ping.length > 1 ? 's' : ''} · {EUR(pingTotal)}</span>
            </span>
            <span style={{ display: 'inline-flex', color: MUT, transform: pingOpen ? 'rotate(90deg)' : 'none' }}><Svg d={IC.chev} /></span>
          </button>
          {pingOpen && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 15, color: MUT, lineHeight: 1.55, margin: '0 0 4px' }}>{pingSub}</p>
              {grouped(ping.slice(0, shownPing), true)}
              {more(ping.length - shownPing, () => setShownPing(n => n + 10), 'documents')}
            </div>
          )}
        </section>
      )}

      {docsLink && (
        <button type="button" onClick={() => router.push('/documents')}
          style={{ display: 'block', width: '100%', minHeight: 52, marginTop: 28, border: '1px solid #E7EDEB', background: '#fff', borderRadius: 999, padding: '0 16px', fontWeight: 700, fontSize: 16, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
          Mes opérations : tous les documents
        </button>
      )}

      <ShareInvoiceSheet open={!!sheet} onClose={() => setSheet(null)}
        title={sheet?.title ?? ''} subject={sheet?.subject ?? ''} text={sheet?.text ?? ''} accountant={!!sheet?.accountant} link={sheet?.link}
        getFiles={async () => {
          if (!sheet) return []
          if (sheet.annual) return [new File([await annualPdf(sheet.annual)], `${(sheet.csvName || 'PING').replace(/\.csv$/, '')}.pdf`, { type: 'application/pdf' })]
          return Promise.all(sheet.rows.map(async r => invoiceFile(await fullInvoice(r))))
        }}
        csv={sheet?.csvName ? () => ({ blob: sheet!.annual ? annualCsv(sheet!.annual) : invoicesCsv(sheet!.rows.map(get), uid, x => serviceOf(x as Row)), name: sheet!.csvName! }) : undefined} />
    </div>
  )
}
