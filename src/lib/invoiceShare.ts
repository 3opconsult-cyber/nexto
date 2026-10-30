"use client"
import { buildInvoicePdf, docTitle, EUR, type Invoice } from '@/lib/invoice-pdf'

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

export type AnnualTotals = {
  year: number; mode: 'pro' | 'particulier'; name: string
  rows: { label: string; cents: number }[]
  count: number; note: string
}

export function annualCsv(t: AnnualTotals) {
  const lines = [`Relevé annuel ${t.year};${csvCell(t.name)}`, '', 'Poste;Montant (EUR)',
    ...t.rows.map(r => `${csvCell(r.label)};${euros(r.cents)}`), '', `Nombre de documents;${t.count}`, csvCell(t.note)]
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** Relevé annuel en PDF : récapitulatif déclaratif, à reporter soi-même sur sa déclaration. */
export async function annualPdf(t: AnnualTotals): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(`Relevé annuel ${t.year}`); doc.setProducer('PING'); doc.setCreator('PING')
  const page = doc.addPage([595.28, 841.89])
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const INK = rgb(0.071, 0.212, 0.267), TEAL = rgb(0.071, 0.561, 0.494), SLATE = rgb(0.306, 0.392, 0.439)
  const M = 56, W = 595.28
  let y = 841.89 - M
  const txt = (s: string, x: number, size = 10, f = reg, c = INK) => page.drawText(clean(s), { x, y, size, font: f, color: c })
  const right = (s: string, size = 10, f = reg, c = INK) => { const v = clean(s); page.drawText(v, { x: W - M - f.widthOfTextAtSize(v, size), y, size, font: f, color: c }) }
  const wrap = (s: string, size: number) => {
    const out: string[] = []; let cur = ''
    for (const w of clean(s).split(' ')) { const n = cur ? cur + ' ' + w : w; if (reg.widthOfTextAtSize(n, size) > W - M * 2) { out.push(cur); cur = w } else cur = n }
    if (cur) out.push(cur); return out
  }
  txt('PING', M, 20, bold, TEAL); y -= 34
  txt(`Relevé annuel ${t.year}`, M, 17, bold); y -= 20
  txt(t.mode === 'pro' ? 'Espace prestataire — activité encaissée via PING' : 'Espace particulier — sommes payées via PING', M, 10, reg, SLATE); y -= 16
  txt(t.name, M, 10); y -= 30
  page.drawRectangle({ x: M, y: y + 14, width: W - M * 2, height: 0.7, color: rgb(0.86, 0.9, 0.89) })
  for (const r of t.rows) { txt(r.label, M, 11); right(EUR(r.cents), 11, bold); y -= 24 }
  page.drawRectangle({ x: M, y: y + 14, width: W - M * 2, height: 0.7, color: rgb(0.86, 0.9, 0.89) })
  txt(`Nombre de documents : ${t.count}`, M, 9.5, reg, SLATE); y -= 30
  for (const l of wrap(t.note, 9)) { txt(l, M, 9, reg, SLATE); y -= 13 }
  y -= 10
  txt(`Édité le ${new Date().toLocaleDateString('fr-FR')} depuis PING. Montants déclarés tels qu'enregistrés sur la plateforme.`, M, 8, reg, SLATE)
  return new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' })
}
