# PING — contexte projet (à lire avant toute intervention)

PING est une **place de marché de services de proximité** (ménage, repassage, nettoyage)
sur la Côte d'Azur. Deux côtés : **particulier** (client) et **prestataire** (pro).
Objectif : réduire le délai entre le besoin et l'achat, sécuriser par la présélection,
le pointage QR avant/après, le séquestre, le chat, et la documentation en cas de litige.

Prod : **nexto-eta.vercel.app** — déploiement auto Vercel sur `main`.

## Stack
- **Next.js 14 (App Router)** + React + TypeScript, dans `src/app`.
- **Supabase** (Postgres + Auth + Storage + RLS), client dans `src/lib/supabase/client.ts`.
- **Leaflet + react-leaflet** (tuiles OpenStreetMap) pour la carte — composant `src/components/LiveMap.tsx`.
- Design system dans `src/app/ping-ui.css` (teal `#12B39C`, navy `#123644`, gold/coral ;
  polices Quicksand + Inter). `ping-legacy.css` = ancien style, à retirer au fil de l'eau.
- Référence UX : **`public/app.html`** (le « prototype cliquable »), servi sur `/demo` par un rewrite `next.config.js`.

## Architecture front
- `src/components/DesktopShell.tsx` : sur desktop (≥1000px), sidebar de navigation à gauche
  + contenu pleine largeur. Sur mobile : colonne téléphone + burger. **Le mode pro/particulier
  est persisté en `localStorage('ping_mode')`** ; seul `/pro/(carte|dashboard|documents|onboarding)`
  force le mode pro, seul `/client/profil` force le particulier, le reste respecte le mode courant.
- `src/components/NavDrawer.tsx` : le drawer mobile (même logique de mode).
- `src/components/DemoShell.tsx` : l'app carte client (`/map`), coque single-page (vues `.view`
  basculées par état), carte réelle + panneau de détail latéral (on change de prestataire sans quitter la carte).
- `src/app/pro/carte/page.tsx` : la carte pro (« Vous êtes visible », demandes ouvertes en pins orange).

## Invariants métier — NE PAS enfreindre
- **Mono-produit** : ménage, repassage, nettoyage (+ vitres en base). Aucune autre catégorie.
- **Commission : 5 % client + 11 % prestataire.** Modèle **3 factures** : le prestataire facture
  sous son en-tête (PING n'y apparaît pas) ; PING émet ses 2 commissions séparément. Chaque partie
  ne voit **que sa propre commission** + la prestation (RLS déjà correcte sur `invoices`).
- **Règle suprême du tarif** : le prix se valide au **paramétrage initial** ; la facturation suit
  ce paramétrage ; **seul un litige** peut le remettre en cause. Pas de re-négociation une fois accepté.
- **3 modes de prix pro** : forfait, taux horaire, **sur devis** (enum `pricing_type` inclut `devis`).
- **Langage déclaratif** partout : « pièce d'identité fournie », « assurance RC renseignée » —
  jamais « vérifiée / certifié / garanti ». Badge crédit d'impôt SAP **conditionnel** par prestataire.
- **Proximité** = point du client + point du prestataire ; le pro est visible quand « Disponible ».
- **Pas de GPS** pour le suivi, SAUF la validation d'arrivée « client absent » (photo horodatée + GPS).
- L'**adresse du rendez-vous** n'apparaît qu'une fois la mission **confirmée** (prix validé + séquestre).

## Pièges techniques (ont coûté du temps)
- RPC `providers_nearby` / `requests_nearby` : paramètres **`p_lat` / `p_lng`** (jamais `lat`/`lng`,
  sinon distances = 0). Renommer un paramètre = `DROP` puis `CREATE`, pas `CREATE OR REPLACE`.
- Embeds PostgREST à 2 chemins FK : nommer la contrainte (`profiles!provider_profiles_id_fkey(...)`),
  la forme courte échoue en silence.
- `apply_migration` s'applique **directement en prod** (pas de staging). `ALTER TYPE … ADD VALUE`
  dans sa **propre** migration isolée.
- Ne jamais appliquer `supabase/migrations/001_*` (schéma obsolète). Vrai schéma = 002, 003, 005+.
- `public/app.html` et `public/admin.html` sont servis par des **rewrites** (hors App Router) —
  ce sont les références, ne pas les casser.
- **Une seule session à la fois sur `main`** : deux agents qui poussent = collisions et écrasements
  (déjà arrivé). Travailler sur **branche + PR**.

## Vérif avant push
`npx tsc --noEmit` puis `npm run build`. « Build OK » = ça compile, **pas** « UI conforme » :
c'est Romain qui juge le rendu sur la vraie URL. Le build local échoue seulement sur le fetch
des polices Google (bloqué hors-ligne) — ça passe sur Vercel.

## Feuille de route (audit en cours)
1. **Déredondancier le menu pro** : « Mon entreprise » (réglages) vs « Tableau de bord » (stats) ;
   fusionner « Factures & documents » / « Mes documents » ; retirer le doublon « Carte » / « Demandes ».
2. **Afficher l'avis dans le chat** après dépôt (aujourd'hui visible seulement sur la fiche pro).
3. **Brancher Stripe** — séquestre réel (aujourd'hui « Encaissement à venir », placeholder).
4. Enrichir « Mon entreprise » : prix conseillés dans la zone, calendrier, moyens de paiement.
5. Retirer les dernières pages en style Fredoka/Tailwind (`auth/login`, `auth/signup`, `hub`).
