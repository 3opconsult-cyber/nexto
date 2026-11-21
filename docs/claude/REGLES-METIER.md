# Règles métier PING (vérifié le 21/11/2026 contre CLAUDE.md et le code)
Format : règle -> fichier de code qui l'applique. Détail : HISTORIQUE.md. Contradictions : A-TRANCHER.md.

## Produit
- Mono-produit : ménage, repassage, nettoyage (+ vitres en base, non proposé). Catalogue extensible en données -> `src/lib/trades.ts`, table `service_catalog` (050).
- Deux côtés sur un même compte : particulier et prestataire ; mode en `localStorage('ping_mode')` -> `src/lib/mode.ts`, `DesktopShell.tsx`, `NavDrawer.tsx`.
- Menu à 4 entrées identiques dans les deux espaces ; ne plus ajouter d'entrée, ajouter une ligne Hub -> `src/components/Hub.tsx`.
- Application non visitable sans compte (03/11) -> `AuthGate` (layout).
- Accès `/demo` et `/admin` servis par rewrites : ne pas casser -> `next.config.js`.

## Prix et facturation
- Prix validé au paramétrage ; seul un litige le rouvre ; « Proposer un tarif » absent après devis accepté -> chat `src/app/mission/[id]/chat`.
- 3 modes de prix : forfait, horaire, sur devis (enum `pricing_type` inclut `devis`) ; forfait + heures incluses + dépassement horaire -> `src/lib/billing.ts` (`computeFinalAmounts`), SQL `_presence_amounts` (038).
- Heure entamée due après N min (réglage `billing_hour_threshold_minutes`, 10 min depuis le 03/11) ; horaire pur min 1 h ; forfait seul jamais ajusté -> `billedHours()` `src/lib/pricing.ts`.
- Commission réglable en base, jamais en dur : `app_settings` `commission_buyer_rate` / `commission_seller_rate` ; valeur au 26/10 : 8 % + 17 % -> `getRates()` `src/lib/pricing.ts`, écran `/admin/commission`.
- Taux figés sur la transaction (`buyer_fee_cents`, `seller_fee_cents`) ; un changement ne touche que les réservations futures.
- Modèle 3 factures : le prestataire facture sous son en-tête, PING émet 2 commissions au taux réellement appliqué ; chacun ne voit que sa commission -> `generate_invoices` (SQL), `src/lib/invoice-pdf.ts`, `/mission/[id]/facture`.
- Frais et commission PING inchangés après un avoir (047, `commission_on_credit = false`).
- Factures PDF : `pdfSafe()` (espace fine des milliers) -> `src/lib/invoice-pdf.ts`.

## Réservation, présence, annulation
- Réservation directe à accepter par le prestataire (24 h ou 2 h avant le RDV) ; adresse, QR, « Je pars » seulement après acceptation -> `src/lib/booking.ts` (052).
- Adresse exacte au prestataire seulement si mission confirmée ET payée (tant que paiement en ligne éteint : tarif validé) ; sinon distance seule -> `transactions.price_confirmed`, `addressUsable()`, `maskAddress`, RPC `requests_nearby`.
- Adresse proposée autre que celle du profil : `a_valider`, vue sans numéro, le pro accepte/refuse (023) -> `src/components/AddressChoice.tsx`.
- Nom de l'interlocuteur : RPC `transaction_counterparts` / `review_rater_names`, jamais un embed sur `profiles` (RLS self-read).
- Seul le prestataire pose l'arrivée, jamais le client ; preuve du client obligatoire (038, 048) -> `src/lib/presence.ts`, `src/lib/arrival.ts`.
- Annulation client en 3 paliers tenus par la base (gratuite / motif sérieux / frais totaux avec double confirmation) -> `cancel_booking` (056, correctif 060), `src/lib/cancellation.ts`.
- Annulation après arrivée possible aux frais totaux + alerte `cancel_after_arrival` (décision 20/11) ; prestataire : motif obligatoire, jamais de frais.
- Prestataire absent après `no_show_minutes` (30) : annulation sans frais, remboursement 100 %, alerte -> `declare_provider_no_show`.
- Report : gratuit > 24 h avant, sinon accord obligatoire -> `propose_reschedule` / `accept_reschedule`.
- Client muet après `client_silence_hours` (2) : clôture sur preuve du prestataire -> `close_on_proof`.
- Contrainte : aucune mission avec soi-même -> `transactions_buyer_ne_seller`.

## Litige, argent
- Litige = dossier dédié `/litiges/[id]` (tables `disputes`, `dispute_messages`), miroir dans le chat (059b) ; statuts `open` / `resolved` / `rejected`.
- Délai d'incident 24 h après la fin, ensuite paiement libéré, plus de litige ; jamais de remboursement à la main après versement (055, `src/lib/incident.ts`).
- Arrangement à l'amiable = avoir + virement ajusté (040) ; « Décision PING » par un admin (054, `ping_decide_dispute`).
- Virement SEPA d'abord (025) : le client paie la prestation directement au prestataire, ses frais à PING, le pro sa commission à PING -> `src/lib/transfers.ts`.
- Séquestre (Stripe, Mangopay, Lemonway) écrit mais ÉTEINT ; `transactions.status` jamais `held/released/refunded`, l'argent vit dans `payment_status` -> `src/lib/payments/`.
- Versement par le serveur ou un admin seulement ; `PAYMENT_RELEASE_MODE=manuel` coupe l'automatique.
- Pare-feu des commissions : dette `commission_debts`, suspension au-delà de `unpaid_ceiling_cents` -> `src/lib/payments/firewall.ts`.
- Avance immédiate Urssaf : code prêt, ÉTEINT -> `src/lib/urssaf/`. CESU phase 1 : le client gère son crédit d'impôt (`docs/cesu-ce-qui-manque.md`).

## Langage, GPS, données
- Langage déclaratif : « pièce fournie », « assurance renseignée » ; jamais « certifié » ni « garanti ». Exception 03/11 : « profil vérifié par PING » seulement si pièce d'identité `valid` non expirée (042).
- Nouveau prestataire réservable tout de suite (18/11) : badge « Nouveau / pièces en cours de contrôle », PING = mise en relation, pas garant.
- Pas d'emoji : pictogrammes SVG inline ; ✓ ✕ ★ ← → tolérés. Aucun emoji dans les messages système en base.
- GPS seulement : (1) validation « client absent » (photo horodatée + GPS, consentement) ; (2) option « Je suis en intervention ici » : floutée, 12 h, arrêt à tout moment, jamais l'adresse du client -> `src/lib/liveZone.ts`, 058.
- Messages système : toujours `systemSender()`, jamais `sender_id: null` -> `src/lib/systemMessage.ts`.
- E-mails : jamais le texte du message ni l'adresse ; 1 e-mail par mission et destinataire / 10 min -> `src/lib/notifyServer.ts`.
