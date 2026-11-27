# Rubrique Automatisation : à décrire, rien à construire maintenant (créé le 25/11/2026)
Session « PING · Automatisation ». Agents : flux-integrations, continuite-reprise.

## Ce qui est propre
Trois plans : produit (crons, e-mails, relances), fabrication (améliorer le contenu : file de travail, contrôles, validation humaine), croissance (prospection e-mail, contenu, réseaux sociaux : calendrier, séquences, validation).

## Règles
- Rien ne sort à l'extérieur sans validation de Romain ; mode d'essai par défaut ; ancienne version conservée.
- Contrôles automatiques avant validation ; secrets dans le coffre du serveur ; accès minimal ; tout journalisé.
- Légal vérifié avant le premier envoi (prospection e-mail, données personnelles, conditions des plateformes).
- Moteur ou session : répétitif et en volume = moteur dans l'application ; ponctuel, créatif ou structurel = session de la rubrique.

## Argent
Renvoi : `RUBRIQUE-FACTURATION.md`. Toute automatisation touchant argent, e-mail externe, droits ou juridique : accord de Romain d'abord.

## Code
Existant : crons `vercel.json` (`/api/payments/release`, `/api/bookings/expire`), pg_cron `mark_overdue_transfers`, `src/lib/notifyServer.ts` (Resend, non branché), workflows `controles.yml`, `e2e-prod.yml`.

## Centre de contrôle prévu (admin + base, NON construit)
Registre : nom | rubrique responsable | déclencheur | fréquence | statut | dernier passage | coût | validation exigée. Interrupteur général et par automatisation ; journal ; plafond de dépense avec arrêt ; file d'approbation.

## Candidats, par ordre de risque croissant
1. Facturation : relances de virements en retard, rappel d'IBAN manquant, export comptable (données et cron déjà là).
2. Qualité : rejeu de `non-regression.sh` après chaque déploiement, alerte en cas de rouge.
3. Contenu : variantes de textes et visuels à valider (file, jamais de publication directe).
4. Prospection : séquences e-mail et calendrier de contenu, après décisions ci-dessous.

## État de la chaîne facture, séquestre, litige, Jeffrey CRM (relevé le 27/11/2026, lecture du code seulement, rien testé en production)
- Facture : émise par le SQL `generate_invoices` au passage de la mission à « terminée » (fin d'intervention), pas à la validation du client. 3 documents : prestataire -> client, PING -> client, PING -> prestataire.
- Pas d'envoi automatique : `notifyServer.ts` (Resend) non branché. Les factures sont seulement rangées dans l'app (`FacturesList`, tri par `issued_at`).
- Frais PING : aucune ligne TVA ni HT/TTC (pas de 20 %), une ligne « Frais de mise en relation ». Pas de facture mensuelle groupée.
- Séquestre : code `settle()` prêt (24 h, litige ouvert bloque, montant litige appliqué) mais ÉTEINT : `paymentsProvider()` renvoie null, le cron `/api/payments/release` répond « actif: false ».
- Litige : fenêtre 24 h (055), montant rendu = arrangement accepté ou décision PING (`disputeRefundCents`). Aucun déclencheur « client silencieux après 24 h » propre : le silence libère le paiement par le délai.
- Jeffrey CRM : rien dans le code (ni route, ni jeton, ni export). `jeffrey-crm` existe sur Vercel, lien non tranché (A-TRANCHER i).
- Détail et propositions : réponse du 27/11/2026 à Romain ; rien construit.

## À faire et notes (décisions qui appartiennent à Romain, « en attente »)
Variables Vercel (RESEND_API_KEY, NOTIFY_FROM, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET) ; outil d'envoi et domaine d'e-mail ; comptes de réseaux sociaux ; plafonds de dépense ; validateurs.
