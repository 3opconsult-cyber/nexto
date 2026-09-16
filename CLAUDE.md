# PING — contexte & passation (à lire en entier avant toute intervention)

PING = place de marché de **services de proximité** (ménage, repassage, nettoyage) sur
la Côte d'Azur. Deux côtés : **particulier** (client) et **prestataire** (pro). But :
réduire le délai besoin→achat, sécuriser par présélection, pointage QR avant/après,
séquestre, chat, et documentation en cas de litige.

Prod : **nexto-eta.vercel.app** — déploiement auto Vercel sur `main`.
Dépôt : `3opconsult-cyber/nexto`. Supabase projet `wmiawwaxwlvascyflpba` (eu-west-3).

## Règle de travail #1
Travailler sur **branche + PR**, jamais pousser direct sur `main` sans que Romain valide.
« Build OK » (tsc + `npm run build`) = ça compile, **PAS** « rendu conforme » : c'est
**Romain** qui juge le visuel sur l'URL déployée. Le build local échoue uniquement sur le
fetch des polices Google (bloqué hors-ligne) ; ça passe sur Vercel.

## Stack
Next.js 14 (App Router, `src/app`) · React + TS · Supabase (Postgres+Auth+Storage+RLS,
client `src/lib/supabase/client.ts`) · Leaflet + OSM (`src/components/LiveMap.tsx`) ·
design system `src/app/ping-ui.css` (teal #12B39C, navy #123644, gold, Quicksand+Inter).
`ping-legacy.css` = ancien style à retirer. Référence UX : `public/app.html` (servi sur
`/demo`), `public/admin.html` (servi sur `/admin`) — via rewrites `next.config.js`, ne pas casser.

## Navigation (source de vérité)
- `src/components/DesktopShell.tsx` : sidebar desktop (≥1000px). Mode pro/particulier
  **persisté en `localStorage('ping_mode')`**. Seul `/pro/(carte|dashboard|documents|onboarding)`
  force le mode pro ; seul `/client/profil` force le particulier ; le reste respecte le mode courant.
- `src/components/NavDrawer.tsx` : drawer mobile (même logique).
- Menu pro (dédupliqué) : Demandes autour de moi (/pro/carte) · Messages · Agenda · Litiges ·
  Mon entreprise (/pro/dashboard) — puis Mes opérations (/documents) · Mes pièces (/pro/documents) ·
  Mon parrainage (/client/parrainage) · Support PING.
- Menu client : Carte (/map) · Mes demandes (/client/demandes) · Messages · Agenda ·
  Mes réclamations (/litiges) · Profil — puis Mon parrainage · Mes favoris · Mes opérations · Support.

## Invariants métier — NE PAS enfreindre
- **Mono-produit** : ménage, repassage, nettoyage (+ vitres en base). Rien d'autre.
- **Commission : 5 % client + 11 % prestataire.** Modèle **3 factures** : le prestataire facture
  sous son en-tête (PING n'y apparaît pas) ; PING émet ses 2 commissions séparément. Chaque partie
  ne voit **que sa propre commission** + la prestation (RLS `invoices` correcte).
- **Règle suprême du tarif** : le prix se valide au **paramétrage initial** ; la facturation suit ;
  **seul un litige** peut le rouvrir. Pas de re-négociation une fois accepté. Dans le chat,
  « + Proposer un tarif » n'apparaît que tant qu'aucun devis n'est accepté.
- **3 modes de prix pro** : forfait, horaire, **sur devis** (enum `pricing_type` inclut `devis`).
- **Langage déclaratif** : « pièce fournie », « assurance renseignée » — jamais « vérifiée/certifié/garanti ».
- **Pas de GPS** pour le suivi, SAUF la validation d'arrivée « client absent » (photo horodatée + GPS).
- **Adresse du RDV** visible seulement quand la mission est **confirmée = aucun devis en attente**
  (voir DepartureBar : prop `confirmed`).

## Pièges techniques (ont coûté du temps)
- RPC `providers_nearby` / `requests_nearby` : paramètres **`p_lat` / `p_lng`** (jamais `lat`/`lng`).
  Renommer un param = DROP puis CREATE. Nommer les contraintes FK dans les embeds PostgREST.
- `apply_migration` s'applique **direct en prod**. `ALTER TYPE … ADD VALUE` dans sa propre migration.
- Tables réelles : `transactions` (PAS `missions`), `disputes` (PAS `litiges`), `profiles`,
  `provider_profiles`, `requests`, `messages`, `invoices`, `reviews`, `documents`, `favorites`, `referrals`.
- Statuts transaction posés en pratique : `pending` → `arrived` → `completed`. **`held`, `released`,
  `refunded` ne sont JAMAIS posés** (Stripe pas branché) — ne pas construire de logique qui en dépend.
- `/hub` = index de dev (tape l'URL pour sauter partout). Orphelin volontaire, ne pas supprimer.

## Audit — état au 17/09/2026 (main récent)
CORRIGÉ cette session : régression « Je pars/adresse » (basé sur devis accepté, plus sur `held`) ·
menu pro dédupliqué · bug mobile « Carte » pro → /pro/carte · avis ré-affiché dans le chat ·
page `/mission/[id]/litige` cassée+orpheline SUPPRIMÉE (le litige passe par le chat → table `disputes`) ·
onglet dashboard « Profil » → « Réglages » · carte pro : clic demande / « Voir les demandes » ne
renvoient plus vers /pro/dashboard.

## BUGS / TROUS OUVERTS (à traiter, dans l'ordre conseillé)
1. **Carte pro (`/pro/carte`) en layout cassé sur desktop** : la page utilise l'ancien cadre
   « téléphone » (`.stage .device .frame .screen`) dans le DesktopShell → double logo « ping »,
   carte riquiqui. À refondre pour remplir la zone desktop (comme les autres pages app).
2. **Flux « pro répond à une demande » inexistant** : sur `/pro/carte`, cliquer une demande ne fait
   plus rien (placeholder retiré). Construire : détail de la demande → proposer / contacter le client.
3. **Pages au vieux style** (Fredoka/Tailwind, hors design system) : `auth/login`, `auth/signup`
   (porte d'entrée !), `presentation`. À restyler en teal SANS toucher à la logique.
4. **Stripe non branché** = pas de séquestre réel, pas de `held`/`released`. Gros chantier, EN ATTENTE
   (décision Romain : on prépare mais pas maintenant).
5. **« Mon entreprise » à enrichir** : prix conseillés dans la zone, calendrier, moyens de paiement.

## Comptes de test
Admin : 3op.consult@gmail.com. Prestataires fictifs : fictif1..10@ping-demo.invalid / PingDemo2026!.
