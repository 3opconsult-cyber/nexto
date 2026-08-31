/**
 * Génération du PDF de facture.
 *
 * Le PDF est construit à partir de l'instantané enregistré en base au moment
 * de l'émission (`issuer_snapshot`, `client_snapshot`, `lines`, `legal`), et
 * jamais des profils actuels : une facture émise ne doit pas changer si le
 * prestataire déménage ou change de statut six mois plus tard.
 *
 * pdf-lib est chargé à la demande — il ne pèse sur aucune autre page.
 *
 * Mentions : calendrier vérifié le 28/08/2026.
 *   1er sept. 2026 — toutes les entreprises doivent pouvoir RECEVOIR une
 *                    facture électronique ; émission obligatoire pour les
 *                    grandes entreprises.
 *   1er sept. 2027 — émission obligatoire pour ETI, PME, TPE et micro, avec
 *                    quatre mentions de plus : SIREN du client, adresse de
 *                    livraison si différente, catégorie d'opération, et option
 *                    de paiement de la TVA.
 *   Franchise      — « art. 293 B du CGI » jusqu'au 31/12/2026, puis
 *                    « art. L. 233-1 du CIBS ».
 */

export type Invoice = {
  number: string
  kind: 'prestation' | 'commission_client' | 'commission_pro'
  issued_at: string
  net_cents: number
  issuer_snapshot: Record<string, any>
  client_snapshot: Record<string, any>
  lines: Array<Record<string, any>>
  legal: Record<string, any>
}

export const EUR = (c: number) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export const KIND_LABEL: Record<Invoice['kind'], string> = {
  prestation: 'Prestation',
  commission_client: 'Frais de service PING',
  commission_pro: 'Commission PING',
}

/** Le titre du document. Un particulier n'émet pas de facture : il émet un reçu. */
export function docTitle(inv: Invoice) {
  return inv.issuer_snapshot?.document === 'Recu de prestation' ? 'Reçu de prestation' : 'Facture'
}

export function durationLabel(min?: number | null) {
  if (!min) return null
  const h = Math.floor(min / 60), m = min % 60
  if (h && !m) return `${h} h`
  return `${h ? h + ' h ' : ''}${m} min`
}

export async function buildInvoicePdf(inv: Invoice): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  doc.setTitle(`${docTitle(inv)} ${inv.number}`)
  doc.setProducer('PING')
  doc.setCreator('PING')

  const page = doc.addPage([595.28, 841.89]) // A4 en points
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const INK = rgb(0.071, 0.212, 0.267)     // #123644
  const TEAL = rgb(0.071, 0.561, 0.494)    // #0C8F7E
  const GREEN = rgb(0.184, 0.816, 0.431)   // #2FD06E
  const SLATE = rgb(0.431, 0.522, 0.573)   // #6E8592
  const LINE = rgb(0.863, 0.898, 0.890)    // #DCE5E3

  const M = 48                              // marge unique, comme le print kit
  const W = 595.28
  let y = 841.89 - M

  const txt = (s: string, x: number, yy: number, size = 9.5, f = reg, color = INK) =>
    page.drawText(s ?? '', { x, y: yy, size, font: f, color })
  const right = (s: string, xEnd: number, yy: number, size = 9.5, f = reg, color = INK) =>
    page.drawText(s ?? '', { x: xEnd - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color })
  const rule = (yy: number) =>
    page.drawRectangle({ x: M, y: yy, width: W - M * 2, height: 0.7, color: LINE })

  // ---------- le signe : anneaux + point, dessiné en primitives ----------
  const cx = M + 11, cy = y - 6
  page.drawCircle({ x: cx, y: cy, size: 11, borderColor: TEAL, borderWidth: 0.8, opacity: 0 })
  page.drawCircle({ x: cx, y: cy, size: 7.2, borderColor: TEAL, borderWidth: 1.1, opacity: 0 })
  page.drawCircle({ x: cx, y: cy, size: 2.8, color: GREEN })
  txt('ping', M + 28, y - 11, 19, bold, INK)

  right(docTitle(inv).toUpperCase(), W - M, y - 4, 9, bold, SLATE)
  right(inv.number, W - M, y - 19, 14, bold, INK)
  right(new Date(inv.issued_at).toLocaleDateString('fr-FR'), W - M, y - 33, 9, reg, SLATE)

  y -= 56
  rule(y); y -= 26

  // ---------- émetteur / destinataire ----------
  const iss = inv.issuer_snapshot || {}
  const cli = inv.client_snapshot || {}
  const colR = M + (W - M * 2) / 2 + 12

  const block = (x: number, titre: string, o: Record<string, any>, extra: string[] = []) => {
    let yy = y
    txt(titre.toUpperCase(), x, yy, 7.5, bold, SLATE); yy -= 15
    const lines = [
      o.societe || o.nom || '— à compléter —',
      o.societe && o.nom ? o.nom : null,
      o.adresse, o.ville,
      o.siret ? `SIRET ${o.siret}` : null,
      ...extra,
    ].filter(Boolean) as string[]
    for (const l of lines) { txt(l, x, yy, 9.5, l === lines[0] ? bold : reg); yy -= 13 }
    return yy
  }

  const extraIssuer: string[] = []
  if (inv.legal?.forme) extraIssuer.push(inv.legal.forme)
  if (iss.sap) extraIssuer.push(`Déclaration SAP ${iss.sap}`)

  const yA = block(M, 'Émetteur', iss, extraIssuer)
  const yB = block(colR, 'Destinataire', cli)
  y = Math.min(yA, yB) - 16

  rule(y); y -= 22

  // ---------- lignes ----------
  txt('DÉSIGNATION', M, y, 7.5, bold, SLATE)
  right('MONTANT', W - M, y, 7.5, bold, SLATE)
  y -= 16

  for (const l of inv.lines || []) {
    txt(String(l.libelle ?? 'Prestation'), M, y, 10, bold)
    const det: string[] = []
    const d = durationLabel(l.duree_min)
    if (d) det.push(`Durée réelle relevée : ${d}`)
    if (l.taux_horaire_cents) det.push(`${EUR(l.taux_horaire_cents)} de l'heure`)
    right(EUR(Number(l.montant_cents ?? 0)), W - M, y, 10, bold)
    y -= 13
    if (det.length) { txt(det.join(' · '), M, y, 8.5, reg, SLATE); y -= 13 }
    y -= 3
  }

  y -= 6; rule(y); y -= 20

  // ---------- total ----------
  txt('Total', M, y, 12, bold)
  right(EUR(inv.net_cents), W - M, y, 15, bold, INK)
  y -= 16
  if (inv.legal?.franchise_tva) {
    txt(inv.legal.franchise_tva, M, y, 8.5, reg, SLATE); y -= 13
  }

  y -= 14; rule(y); y -= 20

  // ---------- mentions ----------
  txt('MENTIONS LÉGALES', M, y, 7.5, bold, SLATE); y -= 15
  const mentions = [
    inv.legal?.categorie_operation ? `Catégorie de l'opération : ${inv.legal.categorie_operation}.` : null,
    inv.legal?.penalites, inv.legal?.indemnite_recouvrement, inv.legal?.escompte,
    'Règlement à réception.',
  ].filter(Boolean) as string[]

  const wrap = (s: string, max: number, size: number) => {
    const out: string[] = []; let cur = ''
    for (const w of s.split(' ')) {
      const t = cur ? cur + ' ' + w : w
      if (reg.widthOfTextAtSize(t, size) > max) { out.push(cur); cur = w } else cur = t
    }
    if (cur) out.push(cur); return out
  }
  for (const m of mentions) {
    for (const l of wrap(m, W - M * 2, 8)) { txt(l, M, y, 8, reg, SLATE); y -= 11 }
    y -= 2
  }

  // ---------- pied ----------
  const foot = 'Document émis via PING — les heures d\'arrivée et de départ sont horodatées par code scanné sur place.'
  for (const l of wrap(foot, W - M * 2, 7.5)) { txt(l, M, M + 12, 7.5, reg, SLATE) }

  const bytes = await doc.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

export async function downloadInvoicePdf(inv: Invoice) {
  const blob = await buildInvoicePdf(inv)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${docTitle(inv).replace(/\s/g, '-')}-${inv.number}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
