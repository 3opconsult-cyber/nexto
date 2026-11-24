# Mémoire flux-integrations (vérifié le 21/11/2026)
## Architecture
- Aucune fonction serveur Supabase : API = routes Next.js `src/app/api` (admin/document-alert, arrival, avance-immediate, bookings/ended|expire, disputes/apply, notify, payments/*).
- 2 crons Vercel (`vercel.json`) : `/api/payments/release` 07:17 UTC, `/api/bookings/expire` 05:43 UTC (quotidiens, limite Hobby). pg_cron côté base : voir CONTROLES.md.
- Routes sensibles : clé service lue côté serveur seulement ; crons protégés par `CRON_SECRET` ; `/api/notify` réservé aux parties ou admins.
## Intégrations : toutes ÉTEINTES ou non vérifiées
- Resend (e-mails) : `RESEND_API_KEY`, `NOTIFY_FROM` (défaut `PING <notifications@ping.invalid>`, à remplacer par un domaine vérifié), `ADMIN_NOTIFY_EMAIL` (repli info@opconsult.co). Sans clé : `{sent:false, reason:'off'}`, rien ne casse. Variables NON posées (non vérifié).
- E-mails : événements message, offer, booking, dispute, cancelled_by_*, provider_no_show, reschedule_*, closed_on_proof, ping_message, booking_refunded, dispute_closed ; 1 e-mail par mission et destinataire / 10 min (`notification_log`) ; comptes `.invalid` ignorés ; jamais le texte du message ni l'adresse.
- Séquestre : `PAYMENT_PROVIDER` = stripe | mangopay | lemonway (`src/lib/payments/`, REST via fetch, sans SDK). Webhooks `/api/payments/webhook/<psp>`. Noms de champs et d'événements à recontrôler en bac à sable ; Lemonway = hypothèse. Jamais essayé avec un vrai PSP.
- `GET /api/payments` dit si c'est actif ; `PAYMENT_RELEASE_MODE=manuel` coupe le versement automatique ; versement uniquement serveur ou admin.
- Urssaf avance immédiate : `URSSAF_CLIENT_ID`, `URSSAF_CLIENT_SECRET`, puis `NEXT_PUBLIC_AVANCE_IMMEDIATE=1` ; habilitation absente ; noms de champs à recontrôler sur le Swagger officiel.
- SMS : `sendSms()` désactivée (aucun fournisseur).
## Pièges
- Vercel Hobby : un cron par jour ; sur Pro, passer à `*/15 * * * *` (AMELIORATIONS A-017).
- Un rattrapage d'alertes pièces vit dans le cron `/api/bookings/expire`.
- Remboursement : `/api/payments/refund` rembourse à 100 % pour gratuite / motif grave / prestataire / absence ; frais totaux = rien rendu.
- Adaptateurs : `release` à 0 EUR et remboursement partiel à recontrôler en bac à sable.
## Ce qui bloque (Romain)
- Choix du PSP, clés, domaine Resend, variables Vercel, habilitation Urssaf.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Chaque envoi sur main crée DEUX déploiements de production (Vercel Git + deploy.yml) : confirmé le 21/11 sur c13d631 (A-036) ; neutraliser deploy.yml demande l'accord de Romain.
- Resend, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NOTIFY_FROM, ADMIN_NOTIFY_EMAIL : non posés (non vérifié) ; sans eux aucun e-mail ne part, tout est tracé dans l'app et l'admin.
- Cron Vercel quotidien (offre gratuite) : /api/bookings/expire (5 h 43 UTC) expire les réservations, envoie les alertes de pièces et de paiement, appelle expire_documents.
- controles.yml : le chargement des polices Google par next/font échoue parfois sur GitHub ; 3 essais ajoutés (251c49b).
- Un tag git ne peut pas être poussé depuis cette session (403) : créer prod-AAAA-MM-JJ via GitHub > Releases.
