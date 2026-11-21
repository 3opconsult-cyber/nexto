# Règles techniques et règles non négociables (vérifié le 21/11/2026)

## Règles non négociables (s'ajoutent à celles du projet, valables pour tous les agents)
1. Aucun secret dans un fichier (mot de passe, clé, jeton, IBAN réel) : on écrit où il est rangé, jamais sa valeur.
2. Aucune suppression de données sans accord écrit de Romain (lignes, fichiers, tables, comptes, objets de stockage).
3. Aucun accès administrateur créé, aucune élévation de droits, aucun compte admin de test.
4. Données de test à motif reconnaissable (« QA ... », comptes `.invalid`, colonne `fictif`), listées puis nettoyées avec l'accord de Romain.
5. Aucune donnée inventée : valeur inconnue = `[à compléter]`. Jamais de chiffre, SIRET, date ou nom supposé.
6. Honnêteté : « build OK » veut dire « ça compile » ; tout ce qui n'a pas été vu en production est « non vérifié ».
7. Autonomie. Corriger seul : ce qui est additif ET réversible, dans le périmètre de l'agent, avec retour arrière écrit et preuve.
   Demander avant : suppression, changement d'un comportement existant (e-mails, règles métier, prix), authentification, argent, juridique, envoi externe.
8. Alertes en 4 lignes maximum : (1) problème + gravité ; (2) cause ; (3) solution ou fait avec preuve ; (4) décision attendue de Romain.
9. Pas de PDF ni de rapport périodique : un rapport court au moment où il y a quelque chose à dire.
10. Ne jamais pousser sur `main` ni réécrire l'historique sans accord (voir règle de travail #1 dans CLAUDE.index.md et A-TRANCHER.md).

## Flux de travail
- `npx tsc --noEmit` puis `npm run build` avant toute livraison ; la validation du rendu se fait sur nexto-eta.vercel.app (décision 17/09).
- Vercel déploie `main` automatiquement ; un workflow GitHub `deploy.yml` existe aussi -> `.github/workflows/deploy.yml`.
- `db-migrate.yml` est NEUTRALISÉ (il faisait DROP SCHEMA) : ne jamais le réactiver.
- Le dépôt est source de vérité en lecture ; Romain colle le SQL (`supabase/a_coller/`), l'ordre est dans `supabase/a_coller/README.md`.

## Base de données
- Tables réelles : `transactions` (pas missions), `disputes` (pas litiges), `profiles`, `provider_profiles`, `requests`, `messages`, `invoices`, `reviews`, `documents`, `favorites`, `referrals`.
- RPC `providers_nearby` / `requests_nearby` : paramètres `p_lat` / `p_lng` ; renommer un paramètre = DROP puis CREATE (confirmation humaine côté MCP).
- Nommer les contraintes FK dans les embeds PostgREST ; `ALTER TYPE ... ADD VALUE` dans sa propre migration.
- Migration idempotente (rejouable), sans DROP ni DELETE ; copie exacte dans `supabase/a_coller/` ; déployer l'application AVANT de coller.
- L'application détecte chaque migration (sondes) et garde l'ancien fonctionnement tant qu'elle manque -> ex. `cancellationAvailable`.
- Fonction `security definer` : toujours `set search_path = public` ; ne jamais nommer une variable PL/pgSQL comme une colonne (préfixe `v_`) -> incident 056/060.
- Droits : toute fonction sensible `revoke ... from public, anon` puis `grant` explicite ; un appel anonyme doit répondre 401/403, pas une fonction exécutable.
- RLS : `profiles` strictement self-read ; `requests` lisible par l'auteur et les parties d'une transaction ; `messages` refuse `sender_id` NULL.
- Triggers de garde : `trg_cancellation_rules` (aucune écriture directe de `status = 'cancelled'` ni de `scheduled_at` confirmé), `trg_guard_payment_status`, `trg_enforce_incident_window`.
- Statuts posés en pratique : `pending` -> `arrived` -> `completed` ; `dispute_status` = `open` / `resolved` / `rejected`.

## Code
- Next.js 14 App Router (`src/app`), React + TS, Supabase client `src/lib/supabase/client.ts`, serveur `src/lib/supabase/server.ts`.
- `@supabase/ssr` 0.3 : cookies `get/set/remove` (pas `getAll/setAll`) -> `src/lib/supabase/server.ts`, `src/middleware.ts`.
- Pas de fonctions serveur Supabase : l'API est faite de routes Next.js (`src/app/api`) + 2 crons Vercel (`vercel.json`).
- Routes serveur sensibles : clé service (`SUPABASE_SERVICE_ROLE_KEY`) lue côté serveur seulement, `CRON_SECRET` pour les crons.
- Design : `src/app/ping-ui.css` (teal #12B39C, navy #123644, Quicksand + Inter) ; `ping-legacy.css` à retirer.
- Cibles tactiles >= 44 px, pas de `confirm()`, fenêtres au-dessus de la barre du bas (z-index 3000), `Modal` garde `onClose` dans une ref.
- Carte : Leaflet + MapLibre (OpenFreeMap), repli sur tuiles OSM -> `src/components/LiveMap.tsx`, `src/lib/mapStyle.ts`.
- `/hub` = index de dev, orphelin volontaire : ne pas supprimer.
- Données de marque et vidéos : générées par `brand/*/build.py` (pages statiques dans `public/`) ; les MP4 sont régénérés à part.

## Tests
- Rejouables, sur la prod, comptes `.invalid` : `scripts/e2e/*.mjs` (README : `scripts/e2e/README.md`) ; calculs : `scripts/tests/*`.
- Un scénario réel attrape ce qu'une relecture rate (incident messages `sender_id` NULL, 30/10).
