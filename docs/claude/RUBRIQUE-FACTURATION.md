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

## Demande de Romain du 26/11/2026 : factures PING, numéros, CRM (lu dans le code, rien codé)
**Ce qui existe** (006, 040, 056) : table `invoices` avec `transaction_id`, `kind` (prestation, commission_client, commission_seller), `issuer_id`, `client_id`, avoir en colonnes `credit_*`. Index unique (transaction_id, kind) : un document de chaque sorte par transaction. Les deux parties lisent leurs factures (`invoices_parties_read`) : écrans `/documents` et `/mission/[id]/facture`. Chaque facture pointe déjà vers sa transaction.
**Ce qui manque ou ne tient pas :**
1. **Numérotation non continue.** Une seule suite `invoice_seq` partagée par les factures de prestation, les commissions et les avoirs (`AV-`). Une suite SQL a des trous (annulation de l'insertion après le tirage du numéro) et ne repart pas à chaque année. Une facture doit avoir une numérotation chronologique et continue : à faire valider par l'expert-comptable. Proposition : une suite par série et par année (ex. PING-CP-2026-000001 commission pro, PING-CC-… commission client, AV-…), tirée dans une table de compteurs verrouillée, pas par `nextval`.
2. **Pas de référence de transaction lisible.** Seul un identifiant technique (uuid). Proposition : `transactions.reference` (ex. PING-T-2026-000123), copiée sur chaque facture ; plus un numéro de compte `PING-C-…` (particulier) et `PING-P-…` (pro) sur le profil, pour retrouver une opération côté client, côté pro et entre les deux.
3. **Commissions encore en « relevés »** tant que la migration 063 (identité BAITA EURL) n'est pas collée : ce ne sont pas encore des factures.
4. **CRM** (« Jeffrey », nom à confirmer) : prévoir une vue en lecture seule (numéro, série, transaction, références client et pro, montants, dates, statut) et un export ou webhook à la création d'un document. Accès par clé serveur, jamais par le navigateur.
5. **Rangement dans les profils** : déjà lisible par chaque partie ; ajouter un écran « Mes factures PING » par profil si la liste actuelle ne les sépare pas des factures de prestation (vérifier `FacturesList.tsx`).
Ordre : 063, puis références et numérotation (une migration), puis vue CRM.

