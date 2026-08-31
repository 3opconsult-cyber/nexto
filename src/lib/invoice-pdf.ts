/**
 * Les trois documents d'une mission, en PDF.
 *
 * Le PDF est construit à partir de l'instantané enregistré en base au moment de
 * l'émission (`issuer_snapshot`, `client_snapshot`, `lines`, `legal`) et jamais
 * des profils actuels : un document émis ne doit pas changer si le prestataire
 * déménage ou change de statut six mois plus tard.
 *
 * Trois modèles, parce que trois situations juridiques différentes :
 *
 *   recapitulatif — l'intervenant est un PARTICULIER non immatriculé. Il n'a
 *                   pas le droit d'émettre une facture, donc on n'en émet pas.
 *                   Le document est un relevé horodaté qui lui sert pour sa
 *                   déclaration, et que PING tient à disposition de
 *                   l'administration si elle le demande.
 *
 *   facture       — le prestataire est IMMATRICULÉ. Enseigne en tête, numéro de
 *                   facture PING, une ligne, et dessous ce qu'il faut pour
 *                   refaire le calcul : date, arrivée, départ, durée réelle,
 *                   taux. Sobre — un montant, pas un formulaire.
 *
 *   commission    — les frais de mise en relation. Ils ne sont pas facturés
 *                   d'avance : ils sont prélevés sur une transaction terminée,
 *                   comme les frais de service de Vinted ou d'Airbnb. Tant que
 *                   PING n'est pas immatriculée, le document est un RELEVÉ et
 *                   non une facture ; il le devient dès que le SIRET est saisi.
 *
 * pdf-lib est chargé à la demande — il ne pèse sur aucune autre page.
 *
 * Mentions vérifiées sur sources publiques le 28/08/2026 :
 *   1er sept. 2026 — toutes les entreprises doivent pouvoir RECEVOIR une
 *                    facture électronique ; émission obligatoire pour les
 *                    grandes entreprises.
 *   1er sept. 2027 — émission obligatoire pour ETI, PME, TPE et micro.
 *   Franchise      — « art. 293 B du CGI » jusqu'au 31/12/2026, puis
 *                    « art. L. 233-1 du CIBS ».
 */

export type Invoice = {
  number: string
  kind: 'prestation' | 'commission_client' | 'commission_pro'
  template: 'recapitulatif' | 'facture' | 'commission'
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
  commission_client: 'Frais de service',
  commission_pro: 'Commission PING',
}

export const TITLE: Record<Invoice['template'], string> = {
  recapitulatif: "Récapitulatif d'intervention",
  facture: 'Facture',
  commission: 'Frais de mise en relation',
}

/**
 * Les frais de mise en relation ne sont pas facturés d'avance : ils sont
 * prélevés sur une transaction terminée, comme les frais de service de Vinted
 * ou d'Airbnb. Tant que PING n'est pas immatriculée, le document s'appelle donc
 * un RELEVÉ — une entité non immatriculée ne peut pas émettre de facture. Dès
 * que le SIRET est saisi, le même document devient une facture, sans rien
 * changer d'autre.
 */
export const docTitle = (inv: Invoice) => {
  if (inv.template === 'commission') {
    return inv.issuer_snapshot?.siret ? 'Facture' : 'Relevé de frais de mise en relation'
  }
  return TITLE[inv.template] ?? 'Document'
}

export function durationLabel(min?: number | null) {
  if (!min) return null
  const h = Math.floor(min / 60), m = min % 60
  if (h && !m) return `${h} h`
  return `${h ? h + ' h ' : ''}${m} min`
}

/** Ce que PING affiche d'elle-même tant qu'elle n'est pas immatriculée. */
export const PLATFORM_PENDING = 'PING — société en cours de constitution'

export async function buildInvoicePdf(inv: Invoice): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  doc.setTitle(`${docTitle(inv)} ${inv.number}`)
  doc.setProducer('PING'); doc.setCreator('PING')

  const page = doc.addPage([595.28, 841.89])      // A4
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const INK = rgb(0.071, 0.212, 0.267)
  const TEAL = rgb(0.071, 0.561, 0.494)
  const GREEN = rgb(0.184, 0.816, 0.431)
  const SLATE = rgb(0.431, 0.522, 0.573)
  const LINE = rgb(0.863, 0.898, 0.890)
  const SAND = rgb(0.988, 0.957, 0.894)

  const M = 48, W = 595.28
  let y = 841.89 - M

  const txt = (s: string, x: number, yy: number, size = 9.5, f = reg, c = INK) =>
    page.drawText(s ?? '', { x, y: yy, size, font: f, color: c })
  const right = (s: string, xEnd: number, yy: number, size = 9.5, f = reg, c = INK) =>
    page.drawText(s ?? '', { x: xEnd - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color: c })
  const rule = (yy: number, c = LINE) =>
    page.drawRectangle({ x: M, y: yy, width: W - M * 2, height: 0.7, color: c })
  const wrap = (s: string, max: number, size: number, f = reg) => {
    const out: string[] = []; let cur = ''
    for (const w of s.split(' ')) {
      const t = cur ? cur + ' ' + w : w
      if (f.widthOfTextAtSize(t, size) > max) { out.push(cur); cur = w } else cur = t
    }
    if (cur) out.push(cur); return out
  }
  const para = (s: string, size = 8, c = SLATE, lead = 11) => {
    for (const l of wrap(s, W - M * 2, size)) { txt(l, M, y, size, reg, c); y -= lead }
  }

  // ---------- en-tête commun ----------
  const cx = M + 11, cy = y - 6
  page.drawCircle({ x: cx, y: cy, size: 11, borderColor: TEAL, borderWidth: 0.8, opacity: 0 })
  page.drawCircle({ x: cx, y: cy, size: 7.2, borderColor: TEAL, borderWidth: 1.1, opacity: 0 })
  page.drawCircle({ x: cx, y: cy, size: 2.8, color: GREEN })
  txt('ping', M + 28, y - 11, 19, bold, INK)

  right(docTitle(inv).toUpperCase(), W - M, y - 4, 8.5, bold, SLATE)
  right(inv.number, W - M, y - 19, 14, bold, INK)
  right(`Émis le ${new Date(inv.issued_at).toLocaleDateString('fr-FR')}`, W - M, y - 33, 8.5, reg, SLATE)

  y -= 56

  // ---------- bandeau du récapitulatif ----------
  // Un lecteur doit comprendre en une ligne que ce n'est pas une facture.
  if (inv.template === 'recapitulatif' && inv.legal?.avertissement) {
    const lines = wrap(inv.legal.avertissement, W - M * 2 - 24, 8.5)
    const h = lines.length * 11 + 18
    page.drawRectangle({ x: M, y: y - h + 6, width: W - M * 2, height: h, color: SAND })
    page.drawRectangle({ x: M, y: y - h + 6, width: 2.5, height: h, color: rgb(0.949, 0.663, 0.231) })
    let yy = y - 6
    for (const l of lines) { txt(l, M + 12, yy, 8.5, reg, rgb(0.42, 0.29, 0.05)); yy -= 11 }
    y -= h + 12
  }

  rule(y); y -= 26

  // ---------- émetteur / destinataire ----------
  const iss = inv.issuer_snapshot || {}
  const cli = inv.client_snapshot || {}
  const colR = M + (W - M * 2) / 2 + 12

  const isCommission = inv.template === 'commission'
  const issuerTitle = isCommission ? 'Émis par' : inv.template === 'recapitulatif' ? 'Intervenant' : 'Émetteur'

  const issuerLines: string[] = []
  if (isCommission) {
    // PING n'est pas encore immatriculée : on l'écrit, on n'invente pas de SIRET.
    issuerLines.push(iss.nom || PLATFORM_PENDING)
    if (iss.forme) issuerLines.push(iss.forme)
    if (iss.adresse) issuerLines.push(iss.adresse)
    if (iss.ville) issuerLines.push(iss.ville)
    if (iss.siret) issuerLines.push(`SIRET ${iss.siret}`)
    if (iss.tva) issuerLines.push(`TVA ${iss.tva}`)
    if (!iss.siret) issuerLines.push('Immatriculation en cours')
  } else {
    issuerLines.push(iss.enseigne || iss.nom || '—')
    if (iss.enseigne && iss.nom && iss.enseigne !== iss.nom) issuerLines.push(iss.nom)
    if (iss.adresse) issuerLines.push(iss.adresse)
    if (iss.ville) issuerLines.push(iss.ville)
    if (iss.siret) issuerLines.push(`SIRET ${iss.siret}`)
    if (inv.legal?.forme) issuerLines.push(inv.legal.forme)
    if (iss.sap) issuerLines.push(`Déclaration SAP ${iss.sap}`)
    if (inv.template === 'recapitulatif') issuerLines.push('Particulier — non immatriculé')
  }

  const clientLines = [cli.nom, cli.adresse, cli.ville].filter(Boolean) as string[]

  const block = (x: number, titre: string, lines: string[]) => {
    let yy = y
    txt(titre.toUpperCase(), x, yy, 7.5, bold, SLATE); yy -= 15
    lines.forEach((l, i) => { txt(l, x, yy, 9.5, i === 0 ? bold : reg, i === 0 ? INK : SLATE); yy -= 13 })
    return yy
  }
  const yA = block(M, issuerTitle, issuerLines)
  const yB = block(colR, isCommission ? 'Facturé à' : 'Client', clientLines)
  y = Math.min(yA, yB) - 16

  rule(y); y -= 22

  // ---------- le corps, selon le modèle ----------
  if (isCommission) {
    // Sobre : une ligne, un total. Rien à décortiquer.
    for (const l of inv.lines || []) {
      txt(String(l.libelle ?? 'Frais'), M, y, 10.5, bold)
      right(EUR(Number(l.montant_cents ?? 0)), W - M, y, 10.5, bold)
      y -= 13
      if (l.detail) { txt(String(l.detail), M, y, 8.5, reg, SLATE); y -= 13 }
      y -= 4
    }
    if (inv.legal?.taux) { txt(inv.legal.taux, M, y, 8.5, reg, SLATE); y -= 15 }
  } else {
    // Sobre aussi : une ligne, et dessous ce qu'il faut pour refaire le calcul.
    // Pas de tableau à six lignes — le lecteur veut un montant, pas un formulaire.
    const l = (inv.lines || [])[0] || {}
    const titre = [l.prestation, durationLabel(l.duree_min)].filter(Boolean).join(' — ')
    txt(titre || 'Prestation', M, y, 10.5, bold)
    right(EUR(Number(l.montant_cents ?? inv.net_cents)), W - M, y, 10.5, bold)
    y -= 14

    const sous = [
      l.date && `Le ${l.date}`,
      l.arrivee && l.depart && `${l.arrivee} — ${l.depart}, scannés sur place`,
      l.taux_horaire_cents && `${EUR(l.taux_horaire_cents)} de l'heure`,
    ].filter(Boolean).join('  ·  ')
    if (sous) { txt(sous, M, y, 8.5, reg, SLATE); y -= 12 }
    if (l.adresse) { txt(String(l.adresse), M, y, 8.5, reg, SLATE); y -= 12 }
    y -= 6
  }

  rule(y); y -= 22

  // ---------- total ----------
  txt(inv.template === 'recapitulatif' ? 'Montant perçu' : 'Total', M, y, 12, bold)
  right(EUR(inv.net_cents), W - M, y, 16, bold, INK)
  y -= 17
  if (inv.legal?.franchise_tva) { txt(inv.legal.franchise_tva, M, y, 8.5, reg, SLATE); y -= 13 }

  y -= 14; rule(y); y -= 20

  // ---------- mentions ----------
  if (inv.template === 'recapitulatif') {
    txt('DÉCLARATION', M, y, 7.5, bold, SLATE); y -= 15
    if (inv.legal?.declaration) { para(inv.legal.declaration); y -= 4 }
  } else if (!isCommission) {
    txt('MENTIONS LÉGALES', M, y, 7.5, bold, SLATE); y -= 15
    for (const m of [
      inv.legal?.categorie_operation ? `Catégorie de l'opération : ${inv.legal.categorie_operation}.` : null,
      inv.legal?.penalites, inv.legal?.indemnite_recouvrement, inv.legal?.escompte,
      'Règlement à réception.',
    ].filter(Boolean) as string[]) { para(m); y -= 2 }
  } else {
    para('Règlement à réception. Document émis par PING au titre de la mise en relation.')
  }

  // ---------- pied ----------
  const foot = "Les heures d'arrivée et de départ sont horodatées par un code scanné sur place. "
             + 'Ce relevé fait foi en cas de contestation.'
  let fy = M + 22
  for (const l of wrap(foot, W - M * 2, 7.5)) { txt(l, M, fy, 7.5, reg, SLATE); fy -= 10 }

  return new Blob([await doc.save() as unknown as BlobPart], { type: 'application/pdf' })
}

export async function downloadInvoicePdf(inv: Invoice) {
  const blob = await buildInvoicePdf(inv)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${docTitle(inv).replace(/[\s']/g, '-')}-${inv.number}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
