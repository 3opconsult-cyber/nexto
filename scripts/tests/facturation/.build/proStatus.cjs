"use strict";
// Statut juridique et fiscal du prestataire (décision Romain du 18/11/2026).
//
// Colonnes de provider_profiles ajoutées par supabase/migrations/039_statut_pro_cesu.sql :
//   legal_form               micro | ei | eurl | sasu | sas | sarl | autre (null pour un particulier)
//   vat_status               franchise (« TVA non applicable, art. 293 B du CGI ») | assujetti
//   vat_number               n° de TVA intracommunautaire (seulement si assujetti)
//   accepts_cesu_prefinance  le prestataire accepte le CESU préfinancé
// L'app doit marcher AVANT la migration : écrire ces champs seulement s'ils existent (voir
// `isMissingColumnError` : on réessaie sans eux) et ne rien afficher quand ils sont absents.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRO_STATUS_COLUMNS = exports.cleanVat = exports.legalFormInvoiceLabel = exports.legalFormLabel = exports.VAT_FRANCHISE_MENTION = exports.LEGAL_FORMS = void 0;
exports.guessLegalForm = guessLegalForm;
exports.legalStatusFor = legalStatusFor;
exports.vatNumberValid = vatNumberValid;
exports.isMissingColumnError = isMissingColumnError;
exports.LEGAL_FORMS = [
    { key: 'micro', label: 'Micro-entrepreneur', invoice: 'Entrepreneur individuel (micro-entrepreneur)' },
    { key: 'ei', label: 'Entreprise individuelle (EI)', invoice: 'Entrepreneur individuel (EI)' },
    { key: 'eurl', label: 'EURL', invoice: 'EURL' },
    { key: 'sasu', label: 'SASU', invoice: 'SASU' },
    { key: 'sas', label: 'SAS', invoice: 'SAS' },
    { key: 'sarl', label: 'SARL', invoice: 'SARL' },
    { key: 'autre', label: 'Autre forme', invoice: null },
];
exports.VAT_FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';
const legalFormLabel = (k) => exports.LEGAL_FORMS.find(f => f.key === k)?.label ?? null;
exports.legalFormLabel = legalFormLabel;
const legalFormInvoiceLabel = (k) => exports.LEGAL_FORMS.find(f => f.key === k)?.invoice ?? null;
exports.legalFormInvoiceLabel = legalFormInvoiceLabel;
/** Forme juridique déduite du code INSEE de la recherche d'entreprise (pré-remplissage seulement). */
function guessLegalForm(natureJuridique) {
    if (!natureJuridique)
        return null;
    if (natureJuridique === '1000')
        return 'micro';
    if (natureJuridique === '5720')
        return 'sasu';
    if (natureJuridique === '5710')
        return 'sas';
    if (natureJuridique === '5498' || natureJuridique === '5499')
        return 'eurl';
    if (natureJuridique.startsWith('54'))
        return 'sarl';
    return 'autre';
}
/** Valeur historique de provider_profiles.legal_status (enum en base) correspondant à une forme juridique. */
function legalStatusFor(form, fallback) {
    if (form === 'micro')
        return 'auto_entrepreneur';
    if (form === 'eurl' || form === 'sasu' || form === 'sarl')
        return form;
    return fallback;
}
const cleanVat = (v) => v.replace(/[\s.\-]/g, '').toUpperCase();
exports.cleanVat = cleanVat;
/** Format d'un n° de TVA intracommunautaire : 2 lettres de pays puis 2 à 13 caractères (FR : 2 + 9 chiffres). */
function vatNumberValid(v) {
    const c = (0, exports.cleanVat)(v);
    if (c.startsWith('FR'))
        return /^FR[0-9A-Z]{2}\d{9}$/.test(c);
    return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(c);
}
/** Erreur PostgREST/Postgres « colonne inconnue » : la migration 039 n'est pas encore appliquée. */
function isMissingColumnError(err) {
    if (!err)
        return false;
    if (err.code === 'PGRST204' || err.code === '42703')
        return true;
    return /column .* does not exist|could not find the .* column/i.test(err.message || '');
}
exports.PRO_STATUS_COLUMNS = ['legal_form', 'vat_status', 'vat_number', 'accepts_cesu_prefinance'];
