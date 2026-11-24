"use client"
import { buildInvoicePdf, docTitle, EUR, pdfSafe, type Invoice } from '@/lib/invoice-pdf'

/**
 * Récupérer et transmettre ses factures : au comptable (e-mail), sur WhatsApp, par SMS, ou pour
 * l'Urssaf et les impôts (relevé annuel). Sur mobile, la feuille de partage du téléphone joint
 * directement le PDF ; ailleurs, le PDF est téléchargé et le message pré-rempli.
 */

export type InvoiceRow = Invoice & { id: string; transaction_id: string; issuer_id: string; client_id: string }

const clean = (s: string) => s.replace(/[  ]/g, ' ')

export const invoiceFileName = (inv: Invoice) =>
  `${docTitle(inv).replace(/[\s'’]/g, '-')}-${inv.number}.pdf`

export function counterpartOf(inv: InvoiceRow, me: string | null) {
  return inv.issuer_id === me
    ? (inv.client_snapshot?.nom || 'Client')
    : (inv.issuer_snapshot?.enseigne || inv.issuer_snapshot?.nom || 'PING')
}

export function invoiceSummary(inv: InvoiceRow, me: string | null) {
  const emis = inv.issuer_id === me
  return clean(`${docTitle(inv)} ${inv.number} du ${new Date(inv.issued_at).toLocaleDateString('fr-FR')}`
    + ` — ${EUR(inv.net_cents)} — ${emis ? 'émise à' : 'émise par'} ${counterpartOf(inv, me)}.`)
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function invoiceFile(inv: Invoice): Promise<File> {
  const blob = await buildInvoicePdf(inv)
  return new File([blob], invoiceFileName(inv), { type: 'application/pdf' })
}

/** Feuille de partage du téléphone avec les fichiers joints. 'unsupported' = utiliser le menu de repli. */
export async function shareFiles(files: File[], title: string, text: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
  if (!nav?.share || !nav?.canShare || !nav.canShare({ files })) return 'unsupported'
  try { await nav.share({ files, title, text }); return 'shared' }
  catch (e: any) { return e?.name === 'AbortError' ? 'cancelled' : 'unsupported' }
}

export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
export const smsUrl = (text: string) => `sms:?&body=${encodeURIComponent(text)}`

const csvCell = (v: string | number) => {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',')

/** CSV (séparateur « ; », ouvrable dans Excel en français) d'une liste de factures. */
export function invoicesCsv(rows: InvoiceRow[], me: string | null, service: (r: InvoiceRow) => string | null) {
  const head = ['Date', 'Numéro', 'Document', 'Sens', 'Contrepartie', 'Service', 'Montant (EUR)']
  const lines = rows.map(r => [
    new Date(r.issued_at).toLocaleDateString('fr-FR'), r.number, docTitle(r),
    r.issuer_id === me ? 'Émise' : 'Reçue', counterpartOf(r, me), service(r) || '', euros(r.net_cents),
  ].map(csvCell).join(';'))
  return new Blob(['﻿' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/**
 * Lien de la facture dans PING (24/11/2026). Il ne contient que l'identifiant de la mission : jamais de
 * nom, de téléphone ni d'adresse ; la page n'est lisible que par les deux parties connectées (RLS).
 */
export const invoiceLink = (transactionId: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : 'https://nexto-eta.vercel.app'}/mission/${transactionId}/facture`

/**
 * Texte d'envoi d'un document (e-mail, WhatsApp, SMS, presse-papiers) : titre, numéro, date, montant et lien.
 * Volontairement sans le nom ni les coordonnées du client ou du prestataire : ce texte part dans une URL
 * (wa.me, mailto) ; les coordonnées restent dans le PDF joint.
 */
export function invoiceShareText(inv: Invoice, transactionId: string, service?: string | null) {
  return clean(`${docTitle(inv)} ${inv.number} du ${new Date(inv.issued_at).toLocaleDateString('fr-FR')}`
    + ` — ${EUR(inv.net_cents)}${service ? ` — ${service}` : ''}.`
    + ` Lien (accès réservé aux parties connectées à PING) : ${invoiceLink(transactionId)}`)
}

export type AnnualTotals = {
  year: number; mode: 'pro' | 'particulier'; name: string
  rows: { label: string; cents: number }[]
  count: number; note: string
  /** Titre du document (défaut « Relevé annuel »). */
  title?: string
  /** Résumé par prestataire (particulier, 24/11/2026) : tableau ajouté au CSV et au PDF. */
  table?: { head: string[]; rows: string[][] }
}

/**
 * Relevé annuel d'un mode (mêmes postes et mêmes sommes que « Mes opérations » depuis le 30/10) :
 * déclaratif, uniquement ce qui est passé par PING. `rows` = documents DU mode (chaque partie, SA commission).
 */
export function annualTotals(rows: InvoiceRow[], mode: 'pro' | 'particulier', year: number, me: string | null): AnnualTotals {
  const ofYear = rows.filter(r => new Date(r.issued_at).getFullYear() === year)
  const sum = (k: string) => ofYear.filter(r => r.kind === k).reduce((n, r) => n + (r.net_cents || 0), 0)
  const who = (mode === 'pro'
    ? ofYear.find(r => r.issuer_id === me && r.kind === 'prestation')?.issuer_snapshot
    : ofYear.find(r => r.client_id === me && r.kind === 'prestation')?.client_snapshot) as any
  return mode === 'pro' ? {
    year, mode, name: who?.enseigne || who?.nom || '', count: ofYear.length,
    rows: [
      { label: 'Chiffre d’affaires des prestations (via PING)', cents: sum('prestation') },
      { label: 'Frais de mise en relation PING', cents: sum('commission_pro') },
      { label: 'Montant net perçu', cents: sum('prestation') - sum('commission_pro') },
    ],
    note: 'Récapitulatif des prestations facturées via PING sur l’année, tel qu’enregistré sur la plateforme. À reporter sur votre déclaration de chiffre d’affaires (Urssaf) et de revenus ; les prestations réalisées hors de PING n’y figurent pas.',
  } : {
    year, mode, name: who?.nom || '', count: ofYear.length,
    rows: [
      { label: 'Prestations payées (ménage, repassage, nettoyage)', cents: sum('prestation') },
      { label: 'Frais de service PING', cents: sum('commission_client') },
      { label: 'Total payé via PING', cents: sum('prestation') + sum('commission_client') },
    ],
    note: 'Les dépenses de services à la personne peuvent ouvrir droit au crédit d’impôt de 50 %, selon votre situation. Montant des prestations à reporter sur votre déclaration de revenus ; conservez les factures, elles restent disponibles ici.',
  }
}

export type ProviderLine = { key: string; name: string; siret: string; count: number; prestCents: number; feeCents: number }

/**
 * Résumé annuel du particulier, par prestataire (24/11/2026), pour sa déclaration d'impôt (CESU phase 1 :
 * le client gère lui-même son crédit d'impôt). Sommes des montants enregistrés sur les documents (aucun
 * nouveau calcul) : factures et récapitulatifs du prestataire, puis les frais de service PING de la même mission.
 */
export function providerSummary(rows: InvoiceRow[], year: number, nameOf: (r: InvoiceRow) => string): ProviderLine[] {
  const ofYear = rows.filter(r => new Date(r.issued_at).getFullYear() === year)
  const byTx = new Map<string, string>()
  const out = new Map<string, ProviderLine>()
  for (const r of ofYear.filter(x => x.kind === 'prestation')) {
    const key = r.issuer_id || r.transaction_id
    byTx.set(r.transaction_id, key)
    const cur = out.get(key) || { key, name: nameOf(r), siret: String(r.issuer_snapshot?.siret || ''), count: 0, prestCents: 0, feeCents: 0 }
    cur.count += 1; cur.prestCents += r.net_cents || 0
    if (!cur.siret && r.issuer_snapshot?.siret) cur.siret = String(r.issuer_snapshot.siret)
    out.set(key, cur)
  }
  for (const r of ofYear.filter(x => x.kind === 'commission_client')) {
    const key = byTx.get(r.transaction_id)
    const cur = key ? out.get(key) : null
    if (cur) cur.feeCents += r.net_cents || 0
  }
  return Array.from(out.values()).sort((a, b) => b.prestCents - a.prestCents)
}

export function providerSummaryTotals(lines: ProviderLine[], year: number, name: string): AnnualTotals {
  const prest = lines.reduce((n, l) => n + l.prestCents, 0), fee = lines.reduce((n, l) => n + l.feeCents, 0)
  return {
    year, mode: 'particulier', name, count: lines.reduce((n, l) => n + l.count, 0), title: 'Résumé annuel par prestataire',
    rows: [
      { label: 'Prestations (factures et récapitulatifs des prestataires)', cents: prest },
      { label: 'Frais de service PING', cents: fee },
      { label: 'Total payé via PING', cents: prest + fee },
    ],
    table: {
      head: ['Prestataire', 'SIRET', 'Nombre', 'Prestations (EUR)', 'Frais PING (EUR)'],
      rows: lines.map(l => [l.name, l.siret || '—', String(l.count), euros(l.prestCents), euros(l.feeCents)]),
    },
    note: 'Résumé déclaratif des prestations passées par PING, tel qu’enregistré sur la plateforme. Les dépenses de services à la personne peuvent ouvrir droit au crédit d’impôt de 50 %, selon votre situation : vous le déclarez vous-même ; conservez les factures, elles restent disponibles dans PING.',
  }
}

export function annualCsv(t: AnnualTotals) {
  const lines = [`${t.title || 'Relevé annuel'} ${t.year};${csvCell(t.name)}`, '', 'Poste;Montant (EUR)',
    ...t.rows.map(r => `${csvCell(r.label)};${euros(r.cents)}`), '', `Nombre de documents;${t.count}`, csvCell(t.note)]
  if (t.table) lines.push('', t.table.head.map(csvCell).join(';'), ...t.table.rows.map(r => r.map(csvCell).join(';')))
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** Relevé annuel en PDF : récapitulatif déclaratif, à reporter soi-même sur sa déclaration. */
export async function annualPdf(t: AnnualTotals): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(`${t.title || 'Relevé annuel'} ${t.year}`); doc.setProducer('PING'); doc.setCreator('PING')
  const page = doc.addPage([595.28, 841.89])
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const INK = rgb(0.071, 0.212, 0.267), TEAL = rgb(0.071, 0.561, 0.494), SLATE = rgb(0.306, 0.392, 0.439)
  const M = 56, W = 595.28
  let y = 841.89 - M
  const txt = (s: string, x: number, size = 10, f = reg, c = INK) => page.drawText(pdfSafe(clean(s)), { x, y, size, font: f, color: c })
  const right = (s: string, size = 10, f = reg, c = INK) => { const v = pdfSafe(clean(s)); page.drawText(v, { x: W - M - f.widthOfTextAtSize(v, size), y, size, font: f, color: c }) }
  const wrap = (s: string, size: number) => {
    const out: string[] = []; let cur = ''
    for (const w of clean(s).split(' ')) { const n = cur ? cur + ' ' + w : w; if (reg.widthOfTextAtSize(n, size) > W - M * 2) { out.push(cur); cur = w } else cur = n }
    if (cur) out.push(cur); return out
  }
  txt('PING', M, 20, bold, TEAL); y -= 34
  txt(`${t.title || 'Relevé annuel'} ${t.year}`, M, 17, bold); y -= 20
  txt(t.mode === 'pro' ? 'Espace prestataire — activité encaissée via PING' : 'Espace particulier — sommes payées via PING', M, 10, reg, SLATE); y -= 16
  txt(t.name, M, 10); y -= 30
  page.drawRectangle({ x: M, y: y + 14, width: W - M * 2, height: 0.7, color: rgb(0.86, 0.9, 0.89) })
  for (const r of t.rows) { txt(r.label, M, 11); right(EUR(r.cents), 11, bold); y -= 24 }
  page.drawRectangle({ x: M, y: y + 14, width: W - M * 2, height: 0.7, color: rgb(0.86, 0.9, 0.89) })
  txt(`Nombre de documents : ${t.count}`, M, 9.5, reg, SLATE); y -= 30
  if (t.table && t.table.rows.length) {
    // Tableau par prestataire : nom, SIRET, nombre, montant des prestations, frais PING (colonnes fixes).
    const cols = [M, M + 170, M + 270, M + 330, M + 420]
    const cell = (s: string, i: number, f = reg) => {
      let v = pdfSafe(clean(s)); const max = (cols[i + 1] ?? W - M) - cols[i] - 8
      while (v.length > 1 && f.widthOfTextAtSize(v, 8.5) > max) v = v.slice(0, -2) + '…'
      page.drawText(v, { x: cols[i], y, size: 8.5, font: f, color: i ? SLATE : INK })
    }
    t.table.head.forEach((h, i) => cell(h.replace(' (EUR)', ''), i, bold)); y -= 16
    for (let k = 0; k < t.table.rows.length; k++) {
      const r = t.table.rows[k]
      if (y < M + 90) { txt(`Et ${t.table.rows.length - k} autre(s) prestataire(s) : voir le fichier CSV.`, M, 8.5, reg, SLATE); y -= 15; break }
      r.forEach((v, i) => cell(v, i)); y -= 15
    }
    y -= 16
  }
  for (const l of wrap(t.note, 9)) { txt(l, M, 9, reg, SLATE); y -= 13 }
  y -= 10
  txt(`Édité le ${new Date().toLocaleDateString('fr-FR')} depuis PING. Montants déclarés tels qu'enregistrés sur la plateforme.`, M, 8, reg, SLATE)
  return new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' })
}
