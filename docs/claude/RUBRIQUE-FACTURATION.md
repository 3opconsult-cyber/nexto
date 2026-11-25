# Rubrique Facturation et paiement : émission, envoi, virements (créé le 25/11/2026)
Session « PING · Facturation et paiement ». Agents : mise-en-relation-paiements, flux-integrations.

## Ce qui est propre
Émission des factures (3 documents), envoi (e-mail, WhatsApp, comptable, impression), liste et catégorie « Frais PING », résumé annuel par prestataire (déclaration fiscale), virements SEPA et rapprochement, relances de retard, CESU, avance immédiate Urssaf, séquestre.

## Règles
Détail et chiffres : `REGLES-METIER.md` (sections Prix et facturation, Litige argent). Ici seulement : chaque partie ne voit que sa commission ; le prestataire facture sous son en-tête ; identité de l'émetteur PING dans `app_settings.platform_identity` ; paiement en ligne et Urssaf ÉTEINTS.

## Argent
Renvoi unique : `REGLES-METIER.md`. Aucun taux, prix ni délai recopié ici.

## Où ça vit
| Profil | Rôle |
|---|---|
| Prestataire | émet sa facture, reçoit le virement, règle sa commission |
| Particulier | reçoit la facture, paie la prestation et ses frais, résumé annuel |
| Admin | rapprochement, IBAN PING, Décision litige, relances |

## Code
`src/lib/invoice-pdf.ts`, `invoiceShare.ts`, `transfers.ts`, `billing.ts`, `pricing.ts`, `src/components/FacturesList.tsx`, `src/app/mission/[id]/facture`, `src/app/documents`, `src/lib/payments/`, `src/lib/urssaf/`. SQL : `generate_invoices`, `transfer_payments`, `mark_overdue_transfers`. Tests : `scripts/tests/facturation/run.cjs`, `scripts/e2e/facture-sections.mjs`, `factures-liste.mjs`.

## À faire et notes
Voir `A-FAIRE.md`, section Facturation (migration 063 identité émetteur, TVA, IBAN PING, CESU : `docs/cesu-ce-qui-manque.md`).
