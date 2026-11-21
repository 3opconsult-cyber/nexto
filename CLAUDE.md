# PING : contexte de travail (version courte prévue de CLAUDE.md, préparée le 21/11/2026)
@docs/claude/README.md
@docs/claude/REGLES-METIER.md
@docs/claude/REGLES-TECH.md
Historique complet (rien n'est supprimé) : docs/claude/HISTORIQUE.md. Contradictions à trancher : docs/claude/A-TRANCHER.md.

## Contexte projet
- Nom : PING. SIRET : [à compléter]. Prod : nexto-eta.vercel.app (déploiement automatique Vercel sur `main`). Dépôt : 3opconsult-cyber/nexto.
- Profils : particulier (client), prestataire (pro), administrateur. Un compte peut être client et prestataire (modes séparés).
- Données sensibles : pièces d'identité, adresses, téléphones, IBAN, photos de présence, paiements. Aucun mineur. Détail : docs/claude/DONNEES.md.
- Outils : Supabase `wmiawwaxwlvascyflpba` (eu-west-3 ; NE PAS confondre avec `ahtdevozpbeargnmvzcn`), Vercel projet `nexto` (équipe nextoping), GitHub. Resend, séquestre (Stripe, Mangopay, Lemonway) et Urssaf : écrits, NON branchés.
- Projets liés : [à compléter] (voir A-TRANCHER.md, ligne i). Fondateur : Romain (non développeur) : tout en français simple.
- Accès : écriture Supabase refusée à Claude ; Romain colle le SQL (`supabase/a_coller/`). Détail : docs/claude/ACCES.md.

## Produit
Place de marché de services de proximité (ménage, repassage, nettoyage) sur la Côte d'Azur. Deux côtés : particulier et prestataire.
But : réduire le délai besoin-achat, sécuriser (présélection, pointage QR avant/après, séquestre, chat, documentation des litiges).

## Règle de travail #1
Décision Romain du 17/09/2026 : plus de PR + preview validée ; Claude pousse ou fusionne sur `main` (branche + PR ou push direct, à sa discrétion)
dès que `npx tsc --noEmit` et `npm run build` passent ; Vercel déploie ; Romain valide APRÈS COUP sur nexto-eta.vercel.app et on corrige en avançant.
« Build OK » = « ça compile », pas « rendu conforme ». (Point à confirmer : A-TRANCHER k.)

## Stack
Next.js 14 (App Router, `src/app`), React + TS, Supabase (Postgres, Auth, Storage, RLS ; client `src/lib/supabase/client.ts`), Leaflet + fond vectoriel PING
(MapLibre + OpenFreeMap, `src/lib/mapStyle.ts`, `src/components/LiveMap.tsx`, repli OSM), design system `src/app/ping-ui.css` (teal #12B39C, navy #123644, gold,
Quicksand + Inter ; `ping-legacy.css` à retirer). Référence UX : `public/app.html` (`/demo`), `public/admin.html` (`/admin`) via rewrites `next.config.js` : ne pas casser.

## Navigation
- `DesktopShell.tsx` (sidebar >= 1000 px) et `NavDrawer.tsx` (mobile). Mode en `localStorage('ping_mode')`. Seuls `/pro/(carte|dashboard|documents|onboarding)` forcent le mode pro ; seul `/client/profil` force le particulier.
- Menu à 4 entrées identiques : pro = Demandes autour de moi, Messages, Agenda, Mon entreprise ; particulier = Carte, Messages, Agenda, Mon profil ; + Support PING. Le reste = lignes Hub (`Hub.tsx`). Ne plus ajouter d'entrée.
- Bascule de mode uniquement depuis le menu ; entrée « Mission » visible seulement les jours de mission ; agenda à onglets ; frise de suivi.

## Invariants métier (aucun ne doit disparaître)
1. Mono-produit : ménage, repassage, nettoyage (+ vitres en base) ; services extensibles par catalogue en données (décision 07/11, A-TRANCHER n).
2. Commission réglable (`app_settings` `commission_buyer_rate` / `commission_seller_rate`, `/admin/commission`, `getRates()` dans `pricing.ts`) ; 26/10/2026 : 8 % + 17 % = 25 % ; taux figés à la réservation ; 3 factures : le prestataire facture sous son en-tête, PING émet 2 commissions au taux réel ; chaque partie ne voit que sa commission (RLS `invoices` approximative : A-TRANCHER h).
3. Règle suprême du tarif : prix validé au paramétrage ; facturation suit ; seul un litige rouvre ; « Proposer un tarif » absent après devis accepté.
4. Heure entamée, heure due : après N min (`billing_hour_threshold_minutes`, 10 en base) ; horaire pur min 1 h ; forfait seul jamais ajusté ; scan de fin avec taux figés.
5. 3 modes de prix : forfait, horaire, sur devis (+ forfait avec heures incluses et dépassement).
6. Langage déclaratif : « pièce fournie », « assurance renseignée » ; « certifié » et « garanti » interdits ; exception 03/11 : « profil vérifié par PING » seulement si pièces validées (`documents.status = valid`, identité non expirée).
7. Pas d'emoji : pictogrammes SVG inline, jamais dans l'UI ni les messages système ; ✓ ✕ ★ ← → tolérés.
8. GPS seulement : (1) validation « client absent » (photo horodatée + GPS, consentement) ; (2) « Je suis en intervention ici » : secteur flouté (2 km, 12 h : A-TRANCHER m), arrêt à tout moment, jamais l'adresse du client. Aucun autre suivi.
9. Adresse du RDV visible du prestataire seulement quand la mission est confirmée ET payée (tant que le paiement en ligne est éteint : tarif validé) ; `transactions.price_confirmed` ; jamais pour un pro qui n'a pas répondu (`requests_nearby` : distance seule).
10. Nom de l'interlocuteur via RPC `transaction_counterparts` / `review_rater_names`, jamais un embed sur `profiles` (RLS self-read).
11. Réservation directe à accepter par le prestataire (24 h ou 2 h avant) ; adresse, QR, « Je pars » seulement après acceptation.
12. Annulation client en 3 paliers (base), prestataire absent, report, clôture sur preuve ; annulation possible après l'arrivée aux frais totaux + alerte (A-TRANCHER a).
13. Litige : dossier `/litiges/[id]`, 24 h après la fin, arrangement à l'amiable, Décision PING ; paiement bloqué tant qu'ouvert ; jamais de remboursement à la main après versement.
14. Paiement : virement SEPA d'abord (le client paie la prestation au prestataire, ses frais à PING ; le pro sa commission à PING) ; séquestre prêt, ÉTEINT ; versement par le serveur ou un admin seulement.
15. `transactions.status` : `pending` -> `arrived` -> `completed` ; `held`, `released`, `refunded` jamais posés dessus ; l'argent est dans `payment_status` (A-TRANCHER b).
16. Nouveau prestataire réservable tout de suite (badge « Nouveau / pièces en cours de contrôle ») ; PING = mise en relation, ni garante de la solvabilité ni de la qualité.
17. CESU phase 1 : le client gère son crédit d'impôt ; avance immédiate Urssaf prête, éteinte. Parrainage : compteurs seulement, aucune récompense.
18. Application non visitable sans compte (`AuthGate`) ; accès admin : compte `is_admin` (clé de secours en variable Vercel).
19. Séparation client / prestataire : agenda, messages, litiges, « Mes opérations » selon le mode ; aucune mission avec soi-même.
20. Notifications : non lus (`unread_counts`) ; e-mails sans texte de message ni adresse ; 1 par mission et destinataire / 10 min.

## Pièges techniques
- `providers_nearby` / `requests_nearby` : paramètres `p_lat` / `p_lng` ; renommer = DROP puis CREATE. Nommer les contraintes FK dans les embeds PostgREST.
- `apply_migration` agit en production ; `ALTER TYPE ... ADD VALUE` dans sa propre migration ; migrations rejouables, sans DROP ni DELETE.
- Tables réelles : `transactions` (pas missions), `disputes` (pas litiges), `profiles`, `provider_profiles`, `requests`, `messages`, `invoices`, `reviews`, `documents`, `favorites`, `referrals`.
- Messages système : `systemSender()`, jamais `sender_id: null`. `@supabase/ssr` 0.3 : cookies `get/set/remove`. `dispute_status` = open / resolved / rejected.
- Variables PL/pgSQL préfixées `v_` (incident 056/060). `/hub` = index de dev, orphelin volontaire, ne pas supprimer.
- Le workflow `db-migrate.yml` est neutralisé (il faisait DROP SCHEMA) : ne jamais le réactiver.

## Règles non négociables (détail : REGLES-TECH.md)
Aucun secret dans un fichier ; aucune suppression sans accord ; aucun accès admin créé ; données de test reconnaissables puis nettoyées ; aucune donnée inventée ;
honnêteté « non vérifié » ; corriger seul seulement l'additif réversible ; demander avant suppression, comportement existant, authentification, argent, juridique, envoi externe ;
alertes en 4 lignes ; pas de PDF ni de rapport périodique.

## Où lire la suite
Parcours et preuves : docs/claude/ETAT.md. Erreurs passées : ERREURS.md. Journal : JOURNAL.md. Contrôles : CONTROLES.md. Reprise : PLAN-DE-REPRISE.md.
Agents : `.claude/agents/<nom>.md` et docs/claude/agents/<nom>/MEMOIRE.md.
