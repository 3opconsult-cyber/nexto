"use strict";
// Calcul pur du montant à la fin d'une mission (aucun import : testable sans réseau ni base).
// Test : node scripts/tests/facturation/run.cjs
// Miroir exact de la fonction SQL `_presence_amounts` (migrations 038/048), qui fait foi en production
// depuis la validation sécurisée du départ ; le scan historique (/mission/[id]/scan/complete) l'utilise encore.
Object.defineProperty(exports, "__esModule", { value: true });
exports.billedHours = billedHours;
exports.computeFinalAmounts = computeFinalAmounts;
// Heures facturées pour une durée réelle : 3 h 10 → 3 h, 3 h 20 → 4 h (seuil 15 min).
function billedHours(minutes, thresholdMinutes) {
    const full = Math.floor(minutes / 60);
    return full + (minutes % 60 >= thresholdMinutes ? 1 : 0);
}
/**
 * Montants au scan de fin.
 * - Pas de tarif horaire (forfait seul) : jamais ajusté, les montants figés à la réservation restent.
 * - Forfait + heures incluses : forfait entier + heures au-delà des heures incluses (heure entamée due à partir du seuil).
 * - Horaire pur : minimum 1 h.
 * - Commissions : taux figés à la réservation (frais / sous-total d'origine) ; à défaut, taux du jour (`liveRates`).
 */
function computeFinalAmounts(tx, minutes, thresholdMinutes, liveRates) {
    const hourly = Number(tx.hourly_rate_cents ?? 0);
    if (!hourly) {
        return {
            recalcule: false,
            subtotal_cents: Number(tx.subtotal_cents ?? 0), buyer_fee_cents: Number(tx.buyer_fee_cents ?? 0),
            seller_fee_cents: Number(tx.seller_fee_cents ?? 0), total_charged_cents: Number(tx.total_charged_cents ?? 0),
            payout_cents: Number(tx.payout_cents ?? 0),
        };
    }
    const orig = Number(tx.subtotal_cents ?? 0);
    const rates = orig > 0
        ? { buyer: Number(tx.buyer_fee_cents ?? 0) / orig, seller: Number(tx.seller_fee_cents ?? 0) / orig }
        : liveRates;
    const forfait = tx.base_forfait_cents != null && tx.included_hours != null;
    const billed = forfait
        ? billedHours(Math.max(0, minutes - Number(tx.included_hours) * 60), thresholdMinutes)
        : Math.max(1, billedHours(minutes, thresholdMinutes));
    const subtotal = forfait ? Number(tx.base_forfait_cents) + hourly * billed : hourly * billed;
    const buyerFee = Math.round(subtotal * rates.buyer);
    const sellerFee = Math.round(subtotal * rates.seller);
    return {
        recalcule: true, billed_hours: billed, subtotal_cents: subtotal, buyer_fee_cents: buyerFee, seller_fee_cents: sellerFee,
        total_charged_cents: subtotal + buyerFee, payout_cents: subtotal - sellerFee,
    };
}
