# Mémoire securite-donnees (vérifié le 21/11/2026)
## Droits qui existent (à ne pas affaiblir)
- `profiles` : RLS strictement self-read (044) ; noms d'interlocuteurs par RPC `transaction_counterparts` / `review_rater_names`.
- `requests` : lisible par l'auteur et les parties d'une transaction ; `anon` retiré (fuite d'adresse corrigée le 17/09) ; pros via `requests_nearby` (SECURITY DEFINER, position floutée ~500 m, sans adresse).
- `messages` : RLS refuse `sender_id` NULL (`systemSender()`). Garde 027 : rien n'est modifiable sur `messages`.
- `transfer_payments` : payeur ou destinataire seulement ; IBAN dans `provider_private`, donné via RPC `payee_bank_details` à l'acheteur d'une mission terminée facturée.
- `admin_notifications`, `mission_cancellations` : lecture admin (`is_admin()`). `provider_live_zone` : jamais lisible directement, RPC seulement.
- Triggers de garde : `trg_cancellation_rules`, `trg_guard_payment_status`, `trg_enforce_incident_window`, `trg_enforce_arrival_departure`, `trg_guard_avance_immediate*`, `trg_guard_transfer_not_received`.
## Faiblesses connues
- RLS `invoices` permissive : chaque partie peut lire la commission de l'autre par appel API direct ; filtrage applicatif (A-TRANCHER h, AMELIORATIONS A-012).
- Mots de passe de test en clair dans CLAUDE.md et `supabase/a_coller/README.md` (A-TRANCHER l).
- Droit sur fonctions : après `revoke` à anon, un appel anonyme répond PGRST202 : comportement attendu, ne pas « corriger » en rouvrant.
- Admin : clé de secours `ADMIN_FALLBACK_KEY` (variable Vercel, désactivée si absente) ; la vraie protection = compte `is_admin` + middleware.
- CGU, CGV, confidentialité PROVISOIRES : juridique à valider (A-TRANCHER j).
## Méthode
- Tester les droits avec un vrai compte (anon, client, pro, admin) : une relecture ne suffit pas (incidents #10, #11 d'ERREURS.md).
- Fonction SECURITY DEFINER : `set search_path = public`, `revoke ... from public, anon`, `grant` explicite, variables `v_`.
- Requête `pg_policies` de référence : docs/droits-base-2026-11-18.md.
- Toute requête MCP contenant DROP/DELETE déclenche une confirmation humaine ; privilégier ADD COLUMN / CREATE OR REPLACE.
## Données sensibles (DONNEES.md)
- Pièces d'identité, Kbis, assurances, adresses, téléphones chiffrés `phone_enc`, IBAN, photos de présence, positions floutées, messages, litiges. Aucun mineur. Durées de conservation : [à compléter].

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- events.path ne garde plus les paramètres (jeton ?token= du QR, ?code= de connexion) : `safePath()` dans src/lib/tracking.ts (73bf766) ; anciennes lignes à nettoyer SEULEMENT avec accord de Romain.
- Contrôle de nuit SQL prêt (061) mais non collé le 23/11 ; il lira droits anon, RLS, intégrité, pg_cron, dérive du schéma.
- npm audit : 18 failles (2 critiques : next 14.2.35, maplibre-gl 5.24.0) ; 8 dépendances inutilisées retirées (e59afad) ; montée de version = chantier séparé.
- Mots de passe des comptes de test en clair dans le dépôt (HISTORIQUE.md, scripts e2e) : A-TRANCHER l, décision de Romain attendue.
- Aucune purge des journaux (events, notification_log, payment_alerts) : durées à fixer (A-033).

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : aucune adresse du client visible d'un pro non confirmé ; le GPS seulement pour centrer la carte (un relevé rapide puis un relevé précis, jamais de suivi) et pour les deux cas autorisés ; le mot de passe des comptes audit ne s'écrit dans aucun fichier ; les captures ne doivent contenir aucun jeton.
