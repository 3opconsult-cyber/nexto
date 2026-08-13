# PING (Nexto) - Etat livrables — 13/08/2026

## Schema reel en production (Supabase, projet wmiawwaxwlvascyflpba)
profiles, provider_profiles, services, documents, requests, transactions,
messages, reviews, invoices, disputes, events.
Fonctions : providers_nearby(), admin_stats(), is_admin(), handle_new_user().
NB : supabase/migrations/001_initial_schema.sql est perime (ancien schema
pro_profiles/missions/litiges) — le schema reel est documente dans
002_admin_access_and_security_fix.sql. Un snapshot complet remplacera 001
quand l'occasion se presentera.

## EN LIGNE (https://nexto-eta.vercel.app), reellement connecte a Supabase
- / -> /map : carte temps reel, prestataires reels (providers_nearby)
- /pro/[id] : fiche pro reelle
- /auth/login + /auth/signup
- /pro/onboarding + /pro/onboarding/documents : inscription pro, visible immediatement
- /pro/attente : vrai statut (profil actif + statut reel des documents)
- /pro/dashboard : missions et CA reels
- /mission/new : reservation reelle, calcule forfait/horaire + commission 5/11 %, cree la transaction
- /mission/[id]/qrcodes + /mission/[id]/scan/[phase] : QR reels, calcul de duree reel
- /mission/[id]/chat : connecte a la table messages
- /admin (protege par is_admin ou cle transitoire ping-sa-2026) :
  - Vue d'ensemble = demo (donnees fictives, outil de pitch, intact)
  - Apercu reel (nouvel onglet) = branche en direct sur Supabase : KPIs,
    prestataires (activer/desactiver), documents en attente (valider/rejeter),
    transactions, litiges ouverts

## Neutralise, redirige vers /demo (app.html) — pas encore compatibles
- /hub, /mission/[id]/facture, /mission/[id]/litige, /client/*

## RESTE A FAIRE
- Creer le compte admin de Romain (3op.consult@gmail.com) via /auth/signup,
  puis mettre profiles.is_admin=true — aucun compte n'existe encore en base.
  Sans ca, "Apercu reel" affiche "connectez-vous en admin" au lieu de donnees.
- generate_invoice() reste cassee (ancien schema) — a reconstruire quand la
  generation de facture reelle sera reprise (aucun code ne l'appelle
  actuellement, donc pas de risque immediat)
- /hub, /mission/[id]/facture, /mission/[id]/litige, /client/* a reecrire
  pour le nouveau schema
- Stripe Connect Express : selectionne strategiquement, aucun code reel
  (aucune route app/api n'existe dans le projet)
- admin.html : Litiges (arbitrage), Prospection, DAC7, Paiements & sequestre
  restent la demo — pas de table reelle derriere pour l'instant

## Nettoye cette session
- src/app/pro/[id]/page.tsx : plantait en prod (ancien schema), reecrite
- src/types/index.ts, src/app/demo/page.tsx, src/lib/demo.ts : supprimes —
  contenaient encore plomberie/electricite/jardinage/baby-sitting (violation
  de l'invariant mono-produit), code mort (route /demo toujours servie par
  public/app.html via le rewrite next.config.js, jamais par ce fichier)
- Faille : profiles.is_admin modifiable par l'utilisateur lui-meme via le
  client (policy "profiles self write" sans restriction de colonne) — fermee
  par trigger, ne peut plus etre modifie que via service_role
- admin_stats() : pointait vers l'ancien schema (aurait plante), puis etait
  appelable par n'importe qui meme non connecte — corrigee et restreinte aux
  admins
