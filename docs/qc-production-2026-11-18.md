# Contrôle qualité en production — 18/11/2026

Ce qui reste **Incomplet** ou **Absent** dans l'app en production (nexto-eta.vercel.app), après le contrôle du 18/11.
Le branchement du paiement en ligne (séquestre, PSP) est exclu, à la demande de Romain.

## Comment l'état a été vérifié

- **Visite de la prod** avec Playwright, en lecture seule. Comptes `audit.client.claude` et `audit.pro.claude`, en 390 et 1280 px, plus un visiteur sans compte. Scripts dans le scratchpad, `e2e/qcprod/` : `tour.mjs`, `prodchips.mjs`, `probe-db.mjs`.
- **Sonde de la base** en lecture, par l'API REST avec la clé publique et la session audit. Une colonne ou une RPC absente renvoie 400 ou 404. C'est ce qui prouve qu'une migration n'est pas appliquée. Le connecteur Supabase MCP a été refusé le 18/11.
- **Écrans d'admin.** Les comptes audit ne sont pas administrateurs : ces écrans ont été vérifiés dans le code déployé (`/admin.html`, lots 17 à 19). Romain doit les vérifier à la main.
- **Fait en production le 18/11 :** 29 lignes AUDIT sur 42 et 5 lignes QC « production ». Le détail est dans la maquette, onglets « Audit des manques » et « Contrôle qualité ».

Légende de l'effort : **S** moins d'une demi-journée · **M** une à deux journées · **L** plus.

## A. Déjà codé : il ne manque que la migration (Romain colle le SQL)

Ces lots sont déjà en ligne côté app et fonctionnent avant comme après la migration. Les fichiers sont dans `supabase/a_coller/`.

| # | Écran | Ce qui manque | Fichier(s) | Migration | Effort |
|---|---|---|---|---|---|
| A1 | Mission du jour, scans QR, client absent | Arrivée et départ sécurisés en base : jetons illisibles par le pro, RPC `arrive_with_token`, `complete_with_token` et `complete_with_code` (absentes, 404). Fin de mission à distance : l'API répond « pas encore disponible ». Contrôle « le jour même ». | `supabase/a_coller/038_arrivee_depart_securise.sql` ; rien à recoder (`src/app/api/arrival/route.ts`, `src/lib/presence.ts` sont prêts) | **038**, oui | S (collage) puis rejouer `scripts/e2e/parcours.mjs` |
| A2 | Inscription prestataire, Mon entreprise, factures | Statut juridique, TVA ou art. 293 B, CESU préfinancé, n° SAP ; `services.cesu_eligible`. Les colonnes `legal_form`, `vat_number`, `accepts_cesu` et `cesu_eligible` sont absentes. | `supabase/a_coller/039_statut_pro_cesu.sql` | **039**, oui | S |
| A3 | Litige `/litiges/[id]`, facture, virement | Arrangement à l'amiable (proposer, accepter), avoir AV-…, virement ajusté. Colonnes absentes. Reste à trancher : frais PING et commission inchangés après un avoir. | `supabase/a_coller/040_arrangement_amiable.sql` | **040**, oui | S, plus une décision R |
| A4 | Mes tarifs `/pro/tarifs` | « Masquer de ma fiche », photo et description d'une prestation (`services.hidden` est absente). Ajouter, modifier et supprimer fonctionnent déjà. | `supabase/a_coller/041_prestations_photos.sql` | **041**, oui | S |
| A5 | Fiche prestataire, carte | Activités du prestataire lisibles par tous (RPC `provider_services_public` absente, 404) : lot 20. | `supabase/a_coller/provider_services_public.sql` | oui (fonction prête) | S |
| A6 | Tests | Comptes de test `qa.…`. | `supabase/a_coller/comptes_qa.sql` | oui | S |

## B. À coder, sans migration

| # | Écran | Ce qui manque | Fichier(s) à modifier | Migration | Effort |
|---|---|---|---|---|---|
| B1 | Barre du haut, menu, barre latérale | **Libellé de la bascule** décidé le 18/11 : « Espace prestataire » / « Espace client », et « Devenir prestataire » pour un compte sans activité. La prod affiche encore « Passer en pro », « Passer en particulier », « Passer en mode pro » et « Revenir en mode particulier ». | `src/components/ModeSwitchPill.tsx:29`, `src/components/DesktopShell.tsx:149`, `src/components/NavDrawer.tsx:195`, commentaires et textes de `src/app/pro/onboarding/page.tsx` | non | S |
| B2 | Carte client, carte pro, dépôt de demande, inscription pro | **Explication de la position** avant la fenêtre du navigateur : pourquoi, pas de suivi continu, alternative « choisir une ville ». Aujourd'hui, `getCurrentPosition` est appelé directement. | `src/components/DemoShell.tsx:71`, `src/app/pro/carte/page.tsx:88`, `src/app/client/demandes/new/page.tsx:83`, `src/app/pro/onboarding/page.tsx:223` | non | S |
| B3 | Demande vue par le pro (`/pro/carte`) | **« Proposer mon tarif »** en second bouton, après « Contacter le client ». Aujourd'hui, seul « Contacter le client » existe. Ce choix attend Romain (onglet Propositions, recommandation « les deux »). | `src/app/pro/carte/page.tsx` (panneau de détail, vers ligne 276), RPC existante `provider_respond_to_request`, puis offre du chat (`src/app/mission/[id]/chat/page.tsx`) | non | M, plus une décision R |
| B4 | Notifications | Clé et domaine d'envoi d'e-mail à poser : l'e-mail est codé (`/api/notify`), mais sans `RESEND_API_KEY` ni domaine vérifié il ne part pas. Aucune notification push. Pas d'alerte « nouvelle demande près de vous » pour les pros (aucun cron). | Variables Vercel `RESEND_API_KEY` et `NOTIFY_FROM` ; push : nouveau service worker et `src/lib/notify.ts` | non pour l'e-mail ; oui pour l'abonnement push (table des abonnements) | S pour l'e-mail, L pour le push |
| B5 | `/admin.html` | La page statique de l'admin s'ouvre sans passer par le middleware (200 sans session), alors que `/admin` renvoie vers la connexion. Les données restent protégées par la RLS `is_admin()`, mais la coque et les libellés sont visibles de tous. Ajouter une redirection ou un en-tête dans `next.config.js` et le middleware. | `next.config.js`, `src/middleware.ts` | non | S |
| B6 | Fiche prestataire, Mes pièces | Lignes SIRET et attestation URSSAF dans « Informations déclarées par le pro » et dans le statut par ligne de Mes pièces (aujourd'hui : identité, assurance, SAP, CESU). | `src/app/pro/[id]/page.tsx` (vers ligne 175), `src/app/pro/documents/page.tsx` | non (le SIRET existe déjà) | S |

## C. À coder, avec une migration à écrire

| # | Écran | Ce qui manque | Fichier(s) à modifier | Migration | Effort |
|---|---|---|---|---|---|
| C1 | Fiche prestataire, carte | **« Profil vérifié par PING »**, seulement si les pièces sont validées (`documents.status = valid`, exception du 03/11) : lot 21. | RPC `providers_nearby` et `requests_nearby` (DROP puis CREATE, garder `p_lat` et `p_lng`), `src/app/pro/[id]/page.tsx`, `src/components/DemoShell.tsx` | oui (avec confirmation, car DROP) | M |
| C2 | Mes pièces (pro), Conformité (admin) | **Motif de refus et date d'expiration** des pièces, alerte à 45 jours, expiration de la RC Pro saisie à la validation : lot 22. `documents.expires_at` et le motif sont absents. | `src/app/pro/documents/page.tsx`, `public/admin.html` (Conformité, Pièces à valider) | oui | M |
| C3 | Conversation, admin Signalements | **Signalement distinct du litige.** Aujourd'hui, « Signaler cet échange » ouvre un litige (`dispute_messages`), et la section admin Signalements est vide (« Données disponibles au lancement »). Il faut une file à classer, avertir ou bloquer : lot 24. | `src/app/mission/[id]/chat/page.tsx` (vers ligne 498), `public/admin.html` (Signalements) | oui (nouvelle table) | M |
| C4 | Base | **Contrôle des droits** (lot 25) : relire les RLS des litiges, profils et invoices. La commission de l'autre partie est lisible par API directe ; le filtrage n'est fait que dans l'app. | `supabase/migrations/` | oui (lecture SQL d'abord, accès refusé le 18/11) | M |
| C5 | Admin Catalogue, carte, Mes services, inscription | **Catalogue des services en données** (décision du 07/11) : ajouter un service, ses manières de tarifer, `cesu_eligible`, l'activer. Les métiers sont aujourd'hui codés dans `src/lib/trades.ts` et `src/lib/services.ts`. Écran admin absent : lot 26. | `src/lib/trades.ts`, `src/lib/services.ts`, `src/components/DemoShell.tsx`, `src/app/pro/onboarding/page.tsx`, `public/admin.html` | oui (table catalogue) | L |
| C6 | Mes pièces, fiche, inscription pro | **Pièces demandées par service et qualifications** : RGE, CAP, décennale, petite enfance, avec justificatif et domaine. Aucune table : lot 27. | `src/app/pro/documents/page.tsx`, `src/app/pro/[id]/page.tsx`, `src/app/pro/onboarding/page.tsx` | oui | L |
| C7 | Avance immédiate (Urssaf) | **Faille** : le pro peut marquer une demande « payée ». À fermer avant toute activation. | `src/app/api/avance-immediate/*`, trigger sur `avance_immediate_demandes` | oui | S |
| C8 | Litige (admin) | **Geste commercial de PING** avec avoir, en dehors de l'arrangement amiable : lot 33. La 040 ne couvre que l'accord des deux parties. | `src/app/litiges/[id]/page.tsx`, `public/admin.html`, `/api/payments/refund` | oui (même colonnes d'avoir que 040, à étendre) | M, plus une décision R |

**Préparé le 18/11 (non appliqué)** : C1 (042, sans DROP : la RPC `provider_docs_status` remplace l'idée de modifier `providers_nearby`), C2 (042), C3 (043), C4 (044, rapport `docs/droits-base-2026-11-18.md`), C7 (046), plus la réservation calculée en base (045) et le réglage `commission_on_credit` (047, désactivé). Ordre de collage : `supabase/a_coller/README.md`.

## D. En cours ailleurs, ou à vérifier par Romain

- **Connexion par lien magique.** Un autre agent s'en charge. Le bouton « Recevoir un lien de connexion par e-mail » est visible sur `/auth/login` (38b498c). Il reste à vérifier de bout en bout : e-mail reçu, puis `/auth/callback`, puis le bon espace.
- **Admin, lots 17 à 19.** Ce qui a été vérifié dans le code déployé :
  - Pièces à valider : aperçu par URL signée.
  - Litiges : liste.
  - Retours des testeurs.
  - Réglage « Inclure les fictifs ».
  - Table invoices réelle.

  Romain doit encore les tester avec son compte.
- **Inscription.** Le nombre d'appuis (13 côté client, 30 côté prestataire au 07/11) n'a pas été remesuré. L'assistant prestataire a 7 étapes, la maquette en prévoit 4.

## Ce qui est hors de cette liste, parce que c'est fait en production

- Carte vectorielle PING : OpenFreeMap, usage commercial autorisé, attribution affichée.
- Carte multi-activités : sélection multiple vérifiée au toucher et à la souris.
- Volet à 3 positions, aperçu fermable, précédent et suivant.
- Inscription sans perte de saisie ; inscription prestataire avec le compte d'abord.
- Page introuvable (404).
- Agenda à onglets, frise de suivi, bouton et écran « Mission du jour ».
- Facture au seul en-tête du prestataire.
- Nouveau prestataire réservable tout de suite, avec le badge « Nouveau · pièces en cours de contrôle » et la clause de mise en relation dans les CGU.
- Accessibilité : zoom libre, contraste des boutons.
- Admin : échappement HTML, vrais chiffres et vrais liens.
- Liste des litiges, Mes pièces côté client.
- Barre du bas à 4 entrées, validée le 18/11.

## Bug de la maquette corrigé le même jour (sans équivalent en production)

« On ne peut pas sélectionner ménage, repassage » : dans la maquette, les puces de la carte client se réordonnaient à chaque appui, en mettant les puces sélectionnées en tête. La puce touchée quittait donc le doigt et « Tous » prenait sa place. Un deuxième appui au même endroit remettait toute la sélection à zéro, et la rangée revenait au début.

Correction :
- l'ordre des puces est maintenant fixe ;
- la position de défilement de la rangée est gardée ;
- côté prestataire, toucher un métier quand « Tous mes métiers » est actif ne montre plus que ce métier ;
- dans le dépôt de demande, retirer le dernier service affiche « Gardez au moins un service ».

La production n'a pas ce défaut : ses puces gardent un ordre fixe (vérifié le 18/11 au toucher et à la souris).
