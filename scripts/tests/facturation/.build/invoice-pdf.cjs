"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfSafe = exports.tauxLabel = exports.PLATFORM_PENDING = exports.accentuer = exports.docTitle = exports.TITLE = exports.KIND_LABEL = exports.CLIENT_FEE_NAME = exports.EUR = exports.invoiceCredit = void 0;
exports.displayLine = displayLine;
exports.durationLabel = durationLabel;
exports.prestationSous = prestationSous;
exports.withProTaxStatus = withProTaxStatus;
exports.buildInvoicePdf = buildInvoicePdf;
exports.downloadInvoicePdf = downloadInvoicePdf;
const presence_cjs_1 = require("./presence.cjs");
const proStatus_cjs_1 = require("./proStatus.cjs");
/** Avoir émis sur ce document (null sans avoir, ou avant la migration 040). */
const invoiceCredit = (inv) => inv.kind === 'prestation' && (inv.credit_cents ?? 0) > 0
    ? { cents: inv.credit_cents, number: inv.credit_number || '', date: inv.credit_issued_at || null,
        reason: inv.credit_reason || 'Arrangement à l\'amiable', net: Math.max(0, inv.net_cents - inv.credit_cents) }
    : null;
exports.invoiceCredit = invoiceCredit;
const EUR = (c) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
exports.EUR = EUR;
/** Nom unique des frais du client dans toute l'interface (écrans, bon de commande, devis, facture, PDF). */
exports.CLIENT_FEE_NAME = 'Frais de service PING';
exports.KIND_LABEL = {
    prestation: 'Prestation',
    commission_client: exports.CLIENT_FEE_NAME,
    commission_pro: 'Commission PING',
};
exports.TITLE = {
    recapitulatif: "Récapitulatif d'intervention",
    facture: 'Facture',
    commission: 'Frais de mise en relation',
};
/**
 * Les frais de mise en relation ne sont pas facturés d'avance : ils sont
 * prélevés sur une transaction terminée, comme les frais de service de Vinted
 * ou d'Airbnb. Tant que PING n'est pas immatriculée, le document s'appelle donc
 * un RELEVÉ — une entité non immatriculée ne peut pas émettre de facture. Dès
 * que le SIRET est saisi, le même document devient une facture, sans rien
 * changer d'autre.
 */
const docTitle = (inv) => {
    if (inv.template === 'commission') {
        if (inv.kind === 'commission_client')
            return inv.issuer_snapshot?.siret ? 'Facture' : 'Relevé de frais de service PING';
        return inv.issuer_snapshot?.siret ? 'Facture' : 'Relevé de frais de mise en relation';
    }
    return exports.TITLE[inv.template] ?? 'Document';
};
exports.docTitle = docTitle;
/**
 * Présentation seule des lignes d'un document de frais PING (le contenu enregistré en base ne change pas) :
 * - frais du client : nom unique « Frais de service PING » ;
 * - « Prélevés sur l'intervention du … » est inexact (rien n'est prélevé, le règlement se fait par virement) :
 *   « À régler par virement, intervention du … ».
 */
function displayLine(inv, l) {
    let libelle = String(l.libelle ?? 'Frais');
    if (inv.kind === 'commission_client' && /^frais de (mise en relation|service)/i.test(libelle))
        libelle = exports.CLIENT_FEE_NAME;
    let detail = l.detail ? String(l.detail) : null;
    if (detail)
        detail = detail.replace(/^Prélevés?\s+sur\s+l['\u2019]intervention/i, "À régler par virement, intervention");
    return { libelle, detail };
}
/**
 * Orthographe des mentions légales : la base les a enregistrées sans accents (migration 006). On les
 * affiche avec leurs accents, mot pour mot et sans rien changer au fond (police standard : é è ê à ç ô passent).
 */
const accentuer = (s) => String(s ?? '')
    .replace(/\bpenalites\b/g, 'pénalités').replace(/\bPenalites\b/g, 'Pénalités')
    .replace(/\binteret legal\b/g, 'intérêt légal').replace(/\binteret\b/g, 'intérêt')
    .replace(/\bprealable\b/g, 'préalable').replace(/\banticipe\b/g, 'anticipé')
    .replace(/\bIndemnite\b/g, 'Indemnité').replace(/\bindemnite\b/g, 'indemnité');
exports.accentuer = accentuer;
function durationLabel(min) {
    if (!min)
        return null;
    const h = Math.floor(min / 60), m = min % 60;
    if (h && !m)
        return `${h} h`;
    return `${h ? h + ' h ' : ''}${m} min`;
}
/** Ce que PING affiche d'elle-même tant qu'elle n'est pas immatriculée. */
// Ligne de prestation : date, heures et preuve réelle d'arrivée / de fin (migration 038 : `preuve_arrivee`,
// `preuve_depart`, `forfait_cents`, `heures_incluses` recopiés à l'émission), puis le tarif appliqué.
function prestationSous(l) {
    const tarif = l.forfait_cents != null && l.taux_horaire_cents
        ? `forfait ${(0, exports.EUR)(Number(l.forfait_cents))}${l.heures_incluses != null ? ` (${String(l.heures_incluses).replace('.', ',')} h incluses)` : ''}, puis ${(0, exports.EUR)(Number(l.taux_horaire_cents))} de l'heure`
        : l.taux_horaire_cents ? `${(0, exports.EUR)(Number(l.taux_horaire_cents))} de l'heure` : null;
    return [
        l.date && `Le ${l.date}`,
        (0, presence_cjs_1.presenceSentence)(l.arrivee, l.depart, l.preuve_arrivee, l.preuve_depart, !!l.photo_arrivee),
        tarif,
    ].filter(Boolean).join('  ·  ');
}
function withProTaxStatus(inv, live) {
    if (inv.template !== 'facture')
        return inv;
    const iss = inv.issuer_snapshot || {};
    const snapHas = iss.forme_juridique != null || iss.tva_regime != null;
    const form = snapHas ? iss.forme_juridique : live?.legal_form;
    const vat = snapHas ? iss.tva_regime : live?.vat_status;
    const vatNo = snapHas ? iss.tva_numero : live?.vat_number;
    if (!form && !vat)
        return inv;
    const legal = { ...(inv.legal || {}) };
    const forme = (0, proStatus_cjs_1.legalFormInvoiceLabel)(form);
    if (forme)
        legal.forme = forme;
    if (vat === 'assujetti') {
        delete legal.franchise_tva;
        if (vatNo)
            legal.tva_intracom = vatNo;
    }
    return { ...inv, legal };
}
exports.PLATFORM_PENDING = 'PING — société en cours de constitution';
/**
 * Les polices standard du PDF (WinAnsi) ne savent pas écrire certains caractères que produit le
 * formatage français : l'espace fine insécable des milliers (« 1 234,56 € », U+202F), l'espace
 * insécable (U+00A0), le signe moins (U+2212). Sans ce filtre, toute facture de 1 000 € ou plus
 * échouait à se générer (constaté le 31/10/2026).
 */
/** « 8.0 % du montant » (format de la base) → « 8 % du montant ». */
const tauxLabel = (t) => String(t ?? '').replace(/(\d+)\.0\b/g, '$1').replace(/(\d)\.(\d)/g, '$1,$2');
exports.tauxLabel = tauxLabel;
const pdfSafe = (s) => String(s ?? '')
    .replace(/[\u202F\u00A0\u2007\u2009]/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/[^\x20-\x7E\u00A1-\u00FF\u20AC\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2122\n]/g, '');
exports.pdfSafe = pdfSafe;
async function buildInvoicePdf(inv) {
    const { PDFDocument, StandardFonts, rgb } = await Promise.resolve().then(() => require('pdf-lib'));
    const doc = await PDFDocument.create();
    doc.setTitle(`${(0, exports.docTitle)(inv)} ${inv.number}`);
    // Le prestataire facture sous son propre en-tête : PING n'apparaît, ni dans le document ni
    // dans ses métadonnées, que sur ses propres relevés (frais de service, commission).
    const isPing = inv.template === 'commission';
    const issuerName = (0, exports.pdfSafe)(inv.issuer_snapshot?.enseigne || inv.issuer_snapshot?.nom || 'Prestataire');
    if (isPing) {
        doc.setProducer('PING');
        doc.setCreator('PING');
    }
    else {
        doc.setProducer(issuerName);
        doc.setCreator(issuerName);
        doc.setAuthor(issuerName);
    }
    const page = doc.addPage([595.28, 841.89]); // A4
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const INK = rgb(0.071, 0.212, 0.267);
    const TEAL = rgb(0.071, 0.561, 0.494);
    const GREEN = rgb(0.184, 0.816, 0.431);
    const SLATE = rgb(0.431, 0.522, 0.573);
    const LINE = rgb(0.863, 0.898, 0.890);
    const SAND = rgb(0.988, 0.957, 0.894);
    const M = 48, W = 595.28;
    let y = 841.89 - M;
    const txt = (s, x, yy, size = 9.5, f = reg, c = INK) => page.drawText((0, exports.pdfSafe)(s), { x, y: yy, size, font: f, color: c });
    const right = (s, xEnd, yy, size = 9.5, f = reg, c = INK) => page.drawText((0, exports.pdfSafe)(s), { x: xEnd - f.widthOfTextAtSize((0, exports.pdfSafe)(s), size), y: yy, size, font: f, color: c });
    const rule = (yy, c = LINE) => page.drawRectangle({ x: M, y: yy, width: W - M * 2, height: 0.7, color: c });
    const wrap = (s, max, size, f = reg) => {
        const out = [];
        let cur = '';
        for (const w of (0, exports.pdfSafe)(s).split(' ').filter(Boolean)) {
            const t = cur ? cur + ' ' + w : w;
            if (cur && f.widthOfTextAtSize(t, size) > max) {
                out.push(cur);
                cur = w;
            }
            else
                cur = t;
        }
        if (cur)
            out.push(cur);
        return out;
    };
    const para = (s, size = 8, c = SLATE, lead = 11) => {
        for (const l of wrap(s, W - M * 2, size)) {
            txt(l, M, y, size, reg, c);
            y -= lead;
        }
    };
    // Ligne de désignation : retour à la ligne dans la largeur disponible (hors colonne du montant si besoin).
    const wrapped = (s, size, c = SLATE, lead = 12, f = reg, maxW = W - M * 2) => {
        for (const l of wrap(s, maxW, size, f)) {
            txt(l, M, y, size, f, c);
            y -= lead;
        }
    };
    // ---------- en-tête ----------
    if (isPing) {
        const cx = M + 11, cy = y - 6;
        page.drawCircle({ x: cx, y: cy, size: 11, borderColor: TEAL, borderWidth: 0.8, opacity: 0 });
        page.drawCircle({ x: cx, y: cy, size: 7.2, borderColor: TEAL, borderWidth: 1.1, opacity: 0 });
        page.drawCircle({ x: cx, y: cy, size: 2.8, color: GREEN });
        txt('ping', M + 28, y - 11, 19, bold, INK);
    }
    else {
        // En-tête du prestataire seul : son nom (ou son enseigne), et son SIRET s'il est immatriculé.
        const nameLines = wrap(issuerName, (W - M * 2) / 2, 15, bold).slice(0, 2);
        let hy = y - 9;
        for (const l of nameLines) {
            txt(l, M, hy, 15, bold, INK);
            hy -= 17;
        }
        if (inv.issuer_snapshot?.siret)
            txt(`SIRET ${inv.issuer_snapshot.siret}`, M, hy + 3, 8.5, reg, SLATE);
    }
    right((0, exports.docTitle)(inv).toUpperCase(), W - M, y - 4, 8.5, bold, SLATE);
    right(inv.number, W - M, y - 19, 14, bold, INK);
    right(`Émis le ${new Date(inv.issued_at).toLocaleDateString('fr-FR')}`, W - M, y - 33, 8.5, reg, SLATE);
    y -= 56;
    // ---------- bandeau du récapitulatif ----------
    // Un lecteur doit comprendre en une ligne que ce n'est pas une facture.
    if (inv.template === 'recapitulatif' && inv.legal?.avertissement) {
        const lines = wrap(inv.legal.avertissement, W - M * 2 - 24, 8.5);
        const h = lines.length * 11 + 18;
        page.drawRectangle({ x: M, y: y - h + 6, width: W - M * 2, height: h, color: SAND });
        page.drawRectangle({ x: M, y: y - h + 6, width: 2.5, height: h, color: rgb(0.949, 0.663, 0.231) });
        let yy = y - 6;
        for (const l of lines) {
            txt(l, M + 12, yy, 8.5, reg, rgb(0.42, 0.29, 0.05));
            yy -= 11;
        }
        y -= h + 12;
    }
    rule(y);
    y -= 26;
    // ---------- émetteur / destinataire ----------
    const iss = inv.issuer_snapshot || {};
    const cli = inv.client_snapshot || {};
    const colR = M + (W - M * 2) / 2 + 12;
    const isCommission = inv.template === 'commission';
    const issuerTitle = isCommission ? 'Émis par' : inv.template === 'recapitulatif' ? 'Intervenant' : 'Émetteur';
    const issuerLines = [];
    if (isCommission) {
        // PING n'est pas encore immatriculée : on l'écrit, on n'invente pas de SIRET.
        issuerLines.push(iss.nom || exports.PLATFORM_PENDING);
        if (iss.forme)
            issuerLines.push(iss.forme);
        if (iss.adresse)
            issuerLines.push(iss.adresse);
        if (iss.ville)
            issuerLines.push(iss.ville);
        if (iss.siret)
            issuerLines.push(`SIRET ${iss.siret}`);
        if (iss.tva)
            issuerLines.push(`TVA ${iss.tva}`);
        if (!iss.siret)
            issuerLines.push('Immatriculation en cours');
    }
    else {
        issuerLines.push(iss.enseigne || iss.nom || '—');
        if (iss.enseigne && iss.nom && iss.enseigne !== iss.nom)
            issuerLines.push(iss.nom);
        if (iss.adresse)
            issuerLines.push(iss.adresse);
        if (iss.ville)
            issuerLines.push(iss.ville);
        if (iss.siret)
            issuerLines.push(`SIRET ${iss.siret}`);
        if (inv.legal?.forme)
            issuerLines.push(inv.legal.forme);
        if (inv.legal?.tva_intracom)
            issuerLines.push(`TVA intracommunautaire ${inv.legal.tva_intracom}`);
        if (iss.sap)
            issuerLines.push(`Déclaration SAP ${iss.sap}`);
        if (inv.template === 'recapitulatif')
            issuerLines.push('Particulier — non immatriculé');
    }
    const clientLines = [cli.nom, cli.adresse, cli.ville].filter(Boolean);
    const block = (x, titre, lines) => {
        let yy = y;
        txt(titre.toUpperCase(), x, yy, 7.5, bold, SLATE);
        yy -= 15;
        lines.forEach((l, i) => { txt(l, x, yy, 9.5, i === 0 ? bold : reg, i === 0 ? INK : SLATE); yy -= 13; });
        return yy;
    };
    const yA = block(M, issuerTitle, issuerLines);
    const yB = block(colR, isCommission ? 'Facturé à' : 'Client', clientLines);
    y = Math.min(yA, yB) - 16;
    rule(y);
    y -= 22;
    // ---------- le corps, selon le modèle ----------
    if (isCommission) {
        // Sobre : une ligne, un total. Rien à décortiquer.
        for (const l of inv.lines || []) {
            const dl = displayLine(inv, l);
            txt(dl.libelle, M, y, 10.5, bold);
            right((0, exports.EUR)(Number(l.montant_cents ?? 0)), W - M, y, 10.5, bold);
            y -= 13;
            if (dl.detail)
                wrapped(dl.detail, 8.5, SLATE, 12);
            y -= 4;
        }
        if (inv.legal?.taux) {
            wrapped((0, exports.tauxLabel)(inv.legal.taux), 8.5, SLATE, 12);
            y -= 3;
        }
    }
    else {
        // Sobre aussi : une ligne, et dessous ce qu'il faut pour refaire le calcul.
        // Pas de tableau à six lignes — le lecteur veut un montant, pas un formulaire.
        const l = (inv.lines || [])[0] || {};
        const titre = [l.prestation, durationLabel(l.duree_min)].filter(Boolean).join(' — ');
        const amountW = bold.widthOfTextAtSize((0, exports.pdfSafe)((0, exports.EUR)(Number(l.montant_cents ?? inv.net_cents))), 10.5) + 14;
        const titreLines = wrap(titre || 'Prestation', W - M * 2 - amountW, 10.5, bold);
        titreLines.forEach((tl, i) => {
            txt(tl, M, y, 10.5, bold);
            if (i === 0)
                right((0, exports.EUR)(Number(l.montant_cents ?? inv.net_cents)), W - M, y, 10.5, bold);
            y -= 14;
        });
        const sous = prestationSous(l);
        if (sous)
            wrapped(sous, 8.5);
        if (l.adresse)
            wrapped(String(l.adresse), 8.5);
        y -= 6;
    }
    rule(y);
    y -= 22;
    // ---------- total ----------
    txt(inv.template === 'recapitulatif' ? 'Montant perçu' : 'Total', M, y, 12, bold);
    right((0, exports.EUR)(inv.net_cents), W - M, y, 16, bold, INK);
    y -= 17;
    if (inv.legal?.franchise_tva) {
        txt(inv.legal.franchise_tva, M, y, 8.5, reg, SLATE);
        y -= 13;
    }
    const av = (0, exports.invoiceCredit)(inv);
    if (av) {
        y -= 8;
        const when = av.date ? ` du ${new Date(av.date).toLocaleDateString('fr-FR')}` : '';
        txt(`Avoir${av.number ? ` n° ${av.number}` : ''}${when}`, M, y, 10.5, bold);
        right(`- ${(0, exports.EUR)(av.cents)}`, W - M, y, 10.5, bold);
        y -= 12;
        txt(av.reason, M, y, 8.5, reg, SLATE);
        y -= 16;
        txt(inv.template === 'recapitulatif' ? 'Montant perçu après avoir' : 'Net à payer après avoir', M, y, 12, bold);
        right((0, exports.EUR)(av.net), W - M, y, 14, bold, INK);
        y -= 15;
    }
    y -= 14;
    rule(y);
    y -= 20;
    // ---------- mentions ----------
    if (inv.template === 'recapitulatif') {
        txt('DÉCLARATION', M, y, 7.5, bold, SLATE);
        y -= 15;
        if (inv.legal?.declaration) {
            para((0, exports.accentuer)(inv.legal.declaration));
            y -= 4;
        }
    }
    else if (!isCommission) {
        txt('MENTIONS LÉGALES', M, y, 7.5, bold, SLATE);
        y -= 15;
        for (const m of [
            inv.legal?.categorie_operation ? `Catégorie de l'opération : ${inv.legal.categorie_operation}.` : null,
            inv.legal?.penalites, inv.legal?.indemnite_recouvrement, inv.legal?.escompte,
            'Règlement à réception.',
        ].filter(Boolean).map(exports.accentuer)) {
            para(m);
            y -= 2;
        }
    }
    else {
        para('Règlement à réception. Document émis par PING au titre de la mise en relation.');
    }
    // ---------- pied ----------
    // « Ce relevé fait foi » : seulement sur le relevé de commission PING tant que PING n'a pas de SIRET
    // (jamais sur la facture du prestataire).
    const foot = "Les heures d'arrivée et de départ sont horodatées dans l'application à partir d'une preuve fournie par le client (QR, code ou confirmation)."
        + (isCommission && !inv.issuer_snapshot?.siret ? ' Ce relevé fait foi en cas de contestation.' : '');
    let fy = M + 22;
    for (const l of wrap(foot, W - M * 2, 7.5)) {
        txt(l, M, fy, 7.5, reg, SLATE);
        fy -= 10;
    }
    return new Blob([await doc.save()], { type: 'application/pdf' });
}
async function downloadInvoicePdf(inv) {
    const blob = await buildInvoicePdf(inv);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(0, exports.docTitle)(inv).replace(/[\s']/g, '-')}-${inv.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
