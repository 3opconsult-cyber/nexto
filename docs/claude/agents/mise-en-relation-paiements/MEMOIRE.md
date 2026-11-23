# Mémoire mise-en-relation-paiements (vérifié le 21/11/2026)
## Cycle d'une mission (tables : transactions, requests, disputes, invoices, transfer_payments)
- Réservation directe `book_service` (045) naît « en_attente » ; le prestataire accepte (24 h ou 2 h avant, min 30 min) ou refuse ; sinon expirée (052). Devis accepté dans le chat = accepté.
- Prix validé = règle suprême ; `price_confirmed` ; adresse au pro seulement après confirmation et paiement ; `address_status` (a_valider) pour une autre adresse (023).
- Statuts posés : `pending` -> `arrived` -> `completed` ; l'argent a sa colonne `payment_status` (none, awaiting, held, complement_due, released, refunded, failed).
- Présence (038, 048) : « Je serai / ne serai pas sur place » posé par le client seul ; photo d'arrivée obligatoire si absent ; code de fin saisi par le pro ; seul le pro pose l'arrivée ; QR unique `create_onsite_token`.
- Fin : `_presence_amounts` (SQL) = `computeFinalAmounts` (TS), parité testée sur 400 cas ; heure entamée due après `billing_hour_threshold_minutes` (10).
## Annulation (056, 060)
- Client : gratuite avant « Je pars » ; motif sérieux si pro en route et >= `cancel_free_minutes` (15) ; frais totaux sinon (double confirmation, 3 documents, alerte `late_cancellation_fees`) ; après arrivée : frais totaux + alerte `cancel_after_arrival`.
- Prestataire : motif obligatoire, jamais de frais, compteur 30 jours, alerte `provider_cancellations` au seuil 3. Absence du pro après 30 min : sans frais, remboursement 100 %.
- Report : > 24 h gratuit ; sinon accord. Client muet 2 h : `close_on_proof`. Seules les RPC annulent (`trg_cancellation_rules`).
## Litige (021, 030, 040, 054, 055, 059b)
- Dossier `/litiges/[id]` ; miroir dans le chat ; fenêtre 24 h ; arrangement à l'amiable (avoir) ; demande d'intervention PING puis « Décision PING » (`ping_decide_dispute`) ; paiement bloqué tant qu'ouvert.
- Test en attente de Romain : litige « QA scénario E » (décision PING à prendre depuis l'admin).
## Factures et virements
- 3 documents (FACT/RECAP, PING-C, PING-V) créés par `generate_invoices` à `completed` ; taux appliqué = celui figé sur la transaction ; avoir sans changement de frais (047).
- Virement SEPA (025) : lignes `transfer_payments` a_payer / declare_paye / recu / en_retard ; « non reçu » (059) ; relance 15 j ; commission pro impayée = dette `commission_debts`, suspension au-delà de 50 EUR.
## Séquestre (éteint)
- Adaptateurs Stripe, Mangopay, Lemonway ; versement 24 h après la fin sans litige ; seul PING libère ; délai d'incident 24 h (055). Jamais essayé avec un vrai PSP.
## Pièges
- `cancel_booking` : variables `v_`. Ordre de collage 052 -> 054 -> 055 -> 056 -> 060. Ne jamais écrire `sender_id: null`.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- cancel_booking : variable `kind` ambiguë avec une colonne (056, corrigé par 060) ; toujours préfixer les variables PL/pgSQL par v_.
- Annulation après l'arrivée : les gardes 014 (guard_payment_status) et 027 (guard_transaction_core) sont assouplies par le drapeau de session `ping.cancel_rpc` posé par cancel_booking seule ; frais totaux + alerte cancel_after_arrival.
- Alertes admin : 062 (non collée au 23/11) fait alimenter admin_notifications par payment_alerts et disputes, libellés français (src/lib/adminAlerts.ts) ; ajoute messages à la publication Realtime.
- Devis dans le chat et adresse « à valider » : aucun délai ni sortie (à décider : délai de 24 h ou texte).
- Le bon de commande (/commande) montre l'état d'attente de l'autre partie ; « Modifier l'adresse » : écriture non testée en production.
