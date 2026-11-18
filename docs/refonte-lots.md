# Refonte PING : plan de passage en production, lot par lot

Rédigé le 18/11/2026. C'est un plan : aucun code n'a été modifié pour l'écrire.

**Ce qui sert de référence.** La maquette v7, `public/maquette.html`. Sa source est `docs/audit-2026-11-07/maquette-artefact/index.html`. Les lignes AUDIT et QC sont dans `data.js`. S'y ajoutent les rapports `docs/audit-2026-11-07/*.md`, `v6-contre-audit/*.md` et `non-regression.md`.

**Ce qui a été comparé.** L'app réelle : `src/app/**`, `src/components/**`, `src/lib/**`, `public/admin.html` et `supabase/migrations`.

**Déjà en production (rien à refaire) :**
- les polices Quicksand et Inter (4cf6605) ;
- la carte client multi-activités (536f8b7, 87534b7) ;
- l'accueil de l'admin à 3 vignettes Admin, Prestataire, Client (8c4390e, a51a636) ;
- les textes « CESU préfinancé » (4e5dd5e).

---

## 0. Règles du passage en production

1. **Les lots sans migration passent d'abord.** Claude n'a pas accès à Supabase en ce moment. Un lot qui a besoin d'une migration doit attendre le retour de l'accès, ou que Romain colle le SQL lui-même. Dans ce cas, le fichier va dans `supabase/a_coller/` (même principe que `provider_services_public.sql`).
2. **Un lot = un commit sur `main`.** Avant chaque push : `npx tsc --noEmit` puis `npm run build`. Vercel déploie ensuite automatiquement. Romain valide sur nexto-eta.vercel.app. Pour revenir en arrière : `git revert <commit>`.
3. **Après chaque déploiement :**
   - Rejouer `scripts/e2e/separation-espaces.mjs` (26 OK attendus) et `scripts/e2e/factures.mjs` (20 OK). Ces deux scripts tournent aussi chaque jour par GitHub Actions.
   - Rejouer les scénarios propres au lot, avec les comptes `audit.client.claude@ping-demo.invalid` et `audit.pro.claude@ping-demo.invalid` (mot de passe `AuditPing2026!`).
   - `scripts/e2e/audit-scenarios.mjs` fait le tour de tous les écrans : utile dès qu'un lot touche la mise en page.
   - `scripts/e2e/parcours.mjs` crée une vraie mission en base : à lancer à la main, seulement quand un lot touche le chat, le QR ou la facture.
4. **Écrans d'admin.** Les comptes audit ne sont pas administrateurs. Ces écrans se testent avec le compte de Romain, ou avec `/admin?key=` (variable Vercel `ADMIN_FALLBACK_KEY`, que Claude n'a pas). Chaque lot d'admin prévoit donc une vérification à la main par Romain.
5. **Les invariants de CLAUDE.md priment sur la maquette :**
   - mono-produit ;
   - commission réglable ;
   - règle suprême du tarif ;
   - heure entamée ;
   - adresse visible seulement si la mission est confirmée et payée ;
   - langage déclaratif ;
   - pas d'emoji ;
   - pas de GPS en continu ;
   - pas de séquestre actif.

   Si la maquette contredit un invariant, l'invariant gagne.

---

## 1. Ce qui, dans la maquette, est volontairement fictif (ne pas porter)

La maquette est un prototype autonome. Les éléments suivants imitent l'app : il ne faut pas les recopier en production.

- **Personnes et données de démo.** Marie, Amélie, Nina, Nadia, Lina, Paul, Karim, Julien, Hugo, Inès, les e-mails `@exemple.fr`, les adresses et téléphones. La production a ses propres fictifs (colonne `fictif`, comptes Fictif 1 à 19), à ne pas mélanger avec ceux de la maquette.
- **IBAN et BIC d'exemple.** Par exemple « IBAN d'exemple (fictif) » ou « FR76 … 7781 ». En production, l'IBAN du pro vient de `provider_private` par la RPC `payee_bank_details`. L'IBAN de PING vient de `app_settings` (`ping_iban`), qui est vide à ce jour : il faut afficher « pas encore renseigné », jamais un numéro d'exemple.
- **Annuaire des entreprises d'exemple.** Essais « Azur » ou « Léo », étiquette « données d'exemple ». La production appelle le vrai annuaire (`src/lib/legalLookup.ts`, recherche-entreprises.api.gouv.fr). On garde seulement la règle : jamais « trouvé » sans vraie recherche.
- **Connexion simulée** (tout e-mail ouvre Marie), **CGU affichées en message**, **mot de passe oublié simulé.** La production a déjà les vraies pages `/auth/login`, `/auth/reset`, `/cgu` et `/confidentialite`.
- **« Confirmé par SMS ».** Aucun fournisseur de SMS n'est branché (`sendSms()` est désactivée). En production, on écrit « Téléphone renseigné ».
- **Carte dessinée de la maquette** (quartiers nommés, zoom simulé). La production garde Leaflet et OSM (`src/components/LiveMap.tsx`). On reprend seulement les comportements : volet, épingles, aperçu.
- **« Voir comme » en lecture seule.** C'est une simulation. Le hub admin de production ouvre l'app réelle, et les actions y sont réelles (un bandeau le dit déjà). On ne promet pas de lecture seule tant qu'elle n'est pas codée côté serveur.
- **Chiffres d'exemple de l'admin :**
  - visites `/l/` (« chiffres d'exemple ») ;
  - prospection (« données d'exemple ») ;
  - entonnoir « calculé sur les données de la démo » ;
  - bouton « Inclure les fictifs », qui s'appuie sur les données de la maquette.

  La production a ses vraies pages (`/admin/visites`, `/admin/parcours`) et la colonne `fictif` (migration 020).
- **Mission du jour forcée « pour jouer le parcours »** et dates recalculées à l'affichage.
- **Services hors mono-produit montrés comme actifs.** Fin de chantier, garde d'enfants, bâtiment, nettoyage médical, avec leurs pièces (décennale, dommages-ouvrage, RGE, CAP AEPE). Ils servent à montrer que le catalogue peut s'étendre (décision du 07/11). En production, on construit la structure du catalogue, mais on n'active aucun nouveau service sans décision de Romain.
- **Unités de prix « panier », « fenêtre », « m² ».** L'enum `pricing_type` de production ne connaît que `forfait`, `horaire` et `devis`, plus `included_hours`.
- **Séquestre, pourboire et frais tardifs** présentés comme des flux d'argent. En production, rien n'est prélevé : virement sur facture, pourboire annoncé comme une simple intention, frais tardifs « appliqués dès le paiement en ligne actif ».
- **« Geste 30 € » et « avoir » dans le litige.** Aucun avoir n'existe en production (vague 3, en attente de décision).
- **Outillage autour du téléphone.** Onglets Audit et QC, panneau « Aller à », « Retour à : … », « Vue ordinateur », méta à droite.
- **Défauts propres à la maquette, corrigés en v7, sans équivalent en production.** Par exemple `ACT.dgo` défini deux fois, l'envoi d'un tarif qui demande deux appuis, le formulaire d'avis qui garde ses valeurs. On ne les « corrige » pas en production sans les avoir reproduits (voir lot 1).
- **Écrans admin ajoutés en v7 qui existent déjà dans `public/admin.html`.** Transactions, Documents et factures, Conformité, Paiements, Carte en direct, Prospection, Communication, Visites, Parcours, Fiche utilisateur. Rien à porter : il faut seulement ne pas les retirer.

## 2. Ce qui marche en production et ne doit pas régresser

La liste vient de `non-regression.md`, section 7, P0. Chaque lot doit revérifier ce qu'il touche.

- **Négociation dans le chat.** Forfait, horaire ou forfait avec heures incluses ; accepter, refuser, contre-proposer ; « Vous percevez X € ».
- **Après l'accord.** Carte « Fixez le rendez-vous », adresse à valider par le pro (Accepter ou Refuser), `AddressChoice`, `DayTimePicker`.
- **Côté pro.** Bouton « Contacter le client » sur `/pro/carte`, qui est le flux principal. `/pro/disponibilites` et `book_slot`.
- **Mission.** Annulation (frais seulement si le client annule après « en route »). Client absent (QR sur place, code à 6 chiffres, photo et position avec accord). Heure entamée au scan de fin.
- **Après la mission.** Les 3 documents, avec `TransferCard` (IBAN, référence, statut). Avis complet et avis sur le client.
- **Retours.** Bulle verte de retours.

---

## 3. Les lots, dans l'ordre

Légende :
- **M** : migration nécessaire (oui ou non) ;
- **R** : décision de Romain nécessaire.

### Phase A : sans migration, sûrs et utiles (à faire tout de suite)

#### Lot 1. Contrôle préalable sur la prod : quels défauts de la maquette existent aussi dans l'app ?
- **But.** Ne corriger en production que des défauts reproduits, pas ceux de la maquette.
- **Fichiers.** Un nouveau script, `scripts/e2e/contre-audit-prod.mjs`, en lecture et écriture sur les comptes audit seulement. Aucun écran de l'app n'est touché.
- **À rejouer.** Ce sont les défauts P0 et P1 du contre-audit v6 :
  - une conversation par mission (réserver deux fois le même pro) ;
  - un ancien devis encore « Accepter » après une réservation à prix figé par `mission/new` ;
  - une réservation possible sans adresse, et une adresse qu'on peut effacer dans `/client/profil` ;
  - un focus perdu dans « Proposer un tarif » en forfait avec heures ;
  - un prix prérempli au budget ;
  - un accord « client absent » réutilisé d'une mission à l'autre (`ArrivalProof`, `src/lib/arrival.ts`) ;
  - « Je pars » et les scans possibles avant le jour du rendez-vous ;
  - le texte affiché quand le pro annule (le code de `chat/page.tsx:317` semble déjà juste) ;
  - le menu Support PING ;
  - « 1 missions » et les pluriels.
- **M** : non. **R** : non.
- **Risque.** Le script crée des missions de test sur les comptes audit, comme `parcours.mjs` le fait déjà.
- **Résultat attendu.** Une liste « reproduit / non reproduit ». Elle confirme ou supprime les lots 12, 13, 14 et 16.

#### Lot 2. Admin : échappement HTML partout
- **But.** Fermer l'injection HTML (P0 n° 1 de l'audit du 07/11).
- **Fichier.** `public/admin.html` seulement.
- **Écart.** La fonction `esc()` existe (ligne 3642) mais n'est appelée que 5 fois. Il reste des insertions brutes, par exemple ligne 3290 (`d.reason` des litiges) et ligne 3505 (`d.reason` et `d.status`). Les noms des inscrits, les messages de support et les retours de la bulle sont aussi concernés. Il faut passer tous les `innerHTML` qui contiennent une donnée de la base par `esc()`.
- **M** : non. **R** : non.
- **Risque.** Faible : un texte qui contenait volontairement du HTML s'afficherait en clair. Il n'y en a pas dans les données de la base.
- **Test.** Mettre temporairement le nom du compte audit.client à `<i>x</i>`, puis le remettre. Romain vérifie que l'admin affiche `<i>x</i>` en texte brut (Utilisateurs, Litiges, Retours).

#### Lot 3. Connexion : retour au bon espace et `?next=` respecté
- **But.** Que l'administrateur ne soit plus envoyé sur `/map`, et que la connexion ramène à la page demandée (P0 n° 7).
- **Fichier.** `src/app/auth/login/page.tsx` (ligne 88).
- **Écart.** `.from('profiles').select('is_admin, is_pro').single()` n'a pas de filtre. L'admin peut lire plusieurs profils, donc la requête renvoie une erreur 406 et le profil reste vide. Il faut écrire `.eq('id', user.id).maybeSingle()`, puis rendre `?next=` prioritaire, comme dans `auth/signup`.
- **M** : non. **R** : non.
- **Risque.** Faible.
- **Tests.**
  - Connexion audit.client sans `next` : on arrive sur `/map`.
  - Connexion audit.pro : on arrive sur l'espace pro.
  - `/auth/login?next=/agenda` : on arrive sur `/agenda`.
  - Romain : sa connexion arrive sur `/admin`.

#### Lot 4. Facture de la prestation sans logo PING
- **But.** Respecter l'invariant : le prestataire facture sous son en-tête, PING n'y apparaît pas (P1, AUDIT « Facture »).
- **Fichiers.** `src/app/mission/[id]/facture/page.tsx` (lignes 152 à 155 : `<Sign>` et « ping » en tête de chaque document). Vérifier aussi `src/lib/invoice-pdf.ts`.
- **Écart.**
  - Pour `FACT` et `RECAP` : en-tête du prestataire seul (nom, SIRET s'il est immatriculé).
  - Le logo reste sur `PING-C` et `PING-V`.
  - Le logo de la barre de page (ligne 97) peut rester, puisqu'il ne s'imprime pas : à confirmer avec `@media print`.
- **M** : non. **R** : non.
- **Risque.** Faible. Le PDF et l'aperçu doivent rester identiques.
- **Test.** `scripts/e2e/factures.mjs` (20 OK). En plus : capture de l'aperçu `FACT` d'une mission d'audit, sans le mot « ping » dans l'en-tête.

#### Lot 5. Inscription prestataire : le compte d'abord, le brouillon gardé
- **But.** Ne plus perdre un assistant pro rempli sans compte (P0 n° 2, AUDIT « Création de l'activité »).
- **Fichiers.**
  - `src/components/AuthGate.tsx` : `/pro/onboarding` est aujourd'hui exclu de la protection.
  - `src/app/pro/onboarding/page.tsx` : `finish()` renvoie vers `/auth/signup?role=pro` (ligne 165) et la saisie est perdue.
  - Éventuellement `src/app/l/[code]/route.ts`, pour `insp`.
- **Écart.**
  - Un visiteur sans session qui ouvre `/pro/onboarding` (ou `/l/insp`) passe d'abord par `/auth/signup?role=pro&next=/pro/onboarding`.
  - Filet de sécurité : brouillon dans `localStorage('ping_pro_draft')`, repris à la même étape.
  - Bouton « Plus tard », qui ramène à l'espace particulier.
- **M** : non. **R** : non.
- **Risque.** Moyen. C'est le tunnel pro, et un pro déjà connecté qui édite son activité ne doit pas être redirigé.
- **Tests.**
  - En navigation privée : `/l/insp`, puis arrivée sur signup avec `next`.
  - Avec audit.pro connecté : `/pro/onboarding` s'ouvre en édition, sans redirection, et `is_active` est conservé.
  - Relire `separation-espaces.mjs`.

#### Lot 6. Inscription : les CGU et le rôle n'effacent plus la saisie
- **But.** Qu'un appui sur « Conditions générales », un changement Particulier / Professionnel ou « Changer d'e-mail » ne vide plus le formulaire (P1).
- **Fichier.** `src/app/auth/signup/page.tsx` (lignes 248 et 249 : `<Link href="/cgu">` quitte la page).
- **Écart.** Ouvrir les CGU dans une fenêtre `Modal` (ou un nouvel onglet). Garder les champs en état, éventuellement avec `sessionStorage`. « Changer d'e-mail » rouvre l'étape 1 déjà remplie.
- **M** : non. **R** : non.
- **Risque.** Faible.
- **Test.** Script : remplir l'étape 2, ouvrir les CGU puis les fermer, vérifier les champs. Ne pas soumettre (aucun compte créé).

#### Lot 7. Page « introuvable » au lieu du prototype
- **But.** Qu'une adresse inconnue ne serve plus `client.html` avec un code 200 (P1).
- **Fichiers.** `next.config.js` (le `fallback` `/:path*` vers `/client.html`, ligne 55) et un nouveau `src/app/not-found.tsx` au design system.
- **Avant de retirer le fallback :** lister les liens anciens qui en dépendent encore (QR imprimés, anciens partages).
- **M** : non.
- **R** : oui, en une ligne : accepte-t-on que d'anciens liens imprimés renvoient « introuvable » ?
- **Risque.** Moyen : toutes les routes (`/demo`, `/admin`, `/bienvenue`, `/plaquettes`, animations, `/l/*`, `/maquette`) passent par `beforeFiles` et ne doivent pas changer.
- **Test.** Vérifier qu'une liste fixe de routes connues répond 200, puis que `/nimporte-quoi` répond 404 avec la nouvelle page.

#### Lot 8. Carte client mobile : fiche fermable, boutons jamais recouverts
- **But.**
  - Pouvoir fermer l'aperçu du prestataire.
  - Que la bulle « Laisser un commentaire » ne masque plus « Recentrer ».
  - Que le volet sur ordinateur ne recouvre plus « Passer en pro ».

  Ce sont les captures `client-01` à `client-04` et les lignes QC « Volet » et « Carte ».
- **Fichiers.** `src/components/DemoShell.tsx` (aperçu `.preview`, `closePreview`), `src/components/FeedbackBubble.tsx`, `src/app/ping-ui.css`.
- **Écart.**
  - Aperçu : croix toujours visible, et toucher la carte ferme l'aperçu.
  - Volet à 3 positions, avec la poignée « Afficher la liste ».
  - Un glisser n'est plus compté comme un toucher.
  - Bulle verte remontée au-dessus du volet, ou masquée sur `/map`.
- **M** : non. **R** : non.
- **Risque.** Moyen : la carte est l'écran principal, et la sélection multi-activités vient d'arriver (536f8b7).
- **Tests.**
  - `audit-scenarios.mjs` (captures `/map` en 390 et 1280 px).
  - Script : ouvrir un aperçu, le fermer, glisser le volet sur ses 3 crans.
  - Vérifier que les puces multi-activités et leurs compteurs ne changent pas.

#### Lot 9. Carte pro : les demandes sont dans le champ dès l'ouverture
- **But.** Que le pro voie ses demandes à l'ouverture, sans dézoomer (P1, régression du recentrage du 07/11).
- **Fichiers.** `src/app/pro/carte/page.tsx` et `src/components/LiveMap.tsx`.
- **Écart.**
  - `fitBounds` sur les demandes de la zone, avec un zoom maximal de type quartier.
  - Filtre sur les seuls métiers du pro.
  - Titre « Hors ligne » quand l'interrupteur est coupé.
- **M** : non. **R** : non.
- **Risque.** Faible à moyen : le panneau desktop `.detail-panel` et le mobile `preview show`.
- **Test.** audit.pro sur `/pro/carte` en 390 et 1280 px : au moins une épingle visible s'il existe une demande ouverte. Le flux « Contacter le client » ouvre toujours le chat.

#### Lot 10. Textes : séquestre « Bientôt », pluriels, libellés
- **But.** Retirer les textes contradictoires ou interdits relevés par les audits.
- **Fichiers.**
  - `src/app/pro/paiements/page.tsx` : badge « Bientôt » (ligne 175) et « Bientôt opérationnel » (ligne 251).
  - `src/app/pro/dashboard/page.tsx` : lignes 254 et 261.
  - Les pluriels (« 1 missions », « 2 litige ouvert ») dans `/agenda`, `/litiges` et le dashboard.
  - « Passer en pro » et « Devenir prestataire » dans `ModeSwitchPill` et `NavDrawer`.
- **Écart.**
  - La carte « Paiement en ligne sous séquestre » disparaît tant que le paiement est éteint (maquette : « Aucune mention : virement sur facture »).
  - Pluriels justes.
  - Un seul libellé pour la bascule.
- **M** : non.
- **R** : oui. Le séquestre est montré comme actif dans le marketing depuis le 03/11, mais l'app dit « bientôt ». La maquette tranche « aucune mention dans l'app » : à confirmer.
- **Risque.** Faible.
- **Test.** `audit-scenarios.mjs`, puis rechercher « Bientôt » et « bientôt » dans le texte des pages pro.

#### Lot 11. Fenêtre « Installer le raccourci » non bloquante sur mobile
- **But.** Que l'invitation à installer ne couvre plus tout l'écran (capture `client-05`).
- **Fichier.** `src/components/InstallPrompt.tsx`.
- **Écart.** Un bandeau compact en bas, au-dessus de la barre d'onglets, et fermable d'un appui.
- **M** : non. **R** : non.
- **Risque.** Faible.
- **Test.** Capture `/map` en 390 px avec un compte neuf (ou en vidant `localStorage`).

### Phase B : sans migration, corrections de parcours (si le lot 1 les confirme)

#### Lot 12. Adresse obligatoire à la réservation et au rendez-vous
- **But.** Plus aucune mission « adresse confirmée » vide (P0 du contre-audit client).
- **Fichiers.** `src/components/AddressChoice.tsx`, `src/app/mission/new/page.tsx`, la carte « Fixez le rendez-vous » de `chat/page.tsx`, `src/app/client/profil/page.tsx` (pour refuser l'effacement de l'adresse).
- **Écart.** Le bouton de confirmation reste désactivé sans adresse. Le profil garde la dernière adresse.
- **M** : non. La règle est appliquée par l'app. Une contrainte en base viendra plus tard, avec un lot migration.
- **R** : non.
- **Risque.** Moyen : le trigger `address_status` (migration 023) ne doit pas changer.
- **Test.** Script : compte audit.client sans adresse, la réservation est bloquée. Puis `parcours.mjs` en entier (adresse, rendez-vous, QR, 3 factures).

#### Lot 13. « Proposer un tarif » : prix vide, récapitulatif, garde-fou
- **But.** Éviter un tarif à 3030 € par erreur et une saisie perdue (P0 du contre-audit prestataire).
- **Fichier.** `src/app/mission/[id]/chat/page.tsx` (formulaire d'offre).
- **Écart.**
  - Le prix n'est pas prérempli : le budget du client apparaît en indication.
  - Récapitulatif sur place (« Vous percevez X € », pour forfait, horaire ou forfait avec heures).
  - Confirmation si le montant dépasse nettement le budget (3 fois, seuil à régler).
  - Focus gardé.
- **M** : non. **R** : non.
- **Risque.** Moyen : la négociation est le cœur de l'app (règle suprême du tarif, `price_confirmed`, `included_hours`).
- **Tests.** `parcours.mjs` (devis, accord). Puis le scénario du 17/09 en manuel : forfait 100 € pour 3 h et 25 €/h, contre-offre à 80 € pour 3 h et 15 €/h, acceptation, 5 h d'intervention, facture de 110,00 €.

#### Lot 14. Jour du rendez-vous et client absent propre à chaque mission
- **But.** Que « Je pars », le QR et le scan ne soient possibles que le jour du rendez-vous, et que l'accord ou la photo « client absent » ne passent pas d'une mission à l'autre.
- **Fichiers.** `src/components/DepartureBar.tsx`, `src/components/ArrivalProof.tsx`, `src/app/mission/[id]/scan/[phase]/page.tsx`, `src/lib/arrival.ts`.
- **Écart.**
  - Un bouton est actif seulement si `scheduled_at` tombe aujourd'hui. Une mission sans date reste libre, pour l'historique.
  - État de l'accord rangé par `transaction_id`.
  - Fin de mission client absent : code ou photo, comme à l'arrivée. Le code de fin demanderait une RPC : à vérifier, sinon le mettre dans le lot 24.
- **M** : non pour la partie « jour du rendez-vous » et « état par mission ».
- **R** : oui. Faut-il bloquer strictement, ou seulement avertir (« ce rendez-vous est prévu jeudi »), pour ne pas bloquer un pro arrivé en avance ?
- **Risque.** Moyen : le trigger `trg_enforce_arrival_departure` reste la vraie protection.
- **Test.** `parcours.mjs` : le scénario pose `scheduled_at`, à adapter pour aujourd'hui.

#### Lot 15. Fiche du prestataire : un seul bouton, la bonne prestation, précédent et suivant
- **But.** Rendre la fiche plus claire, comme la maquette `procard`.
- **Fichiers.** `src/app/pro/[id]/page.tsx`, `src/components/DemoShell.tsx` (aperçu).
- **Écart.**
  - Description non répétée.
  - Un seul bouton « Réserver · prix », collant, qui ouvre `mission/new` sur la prestation de ce prix (il ouvrait le forfait alors que l'horaire était affiché).
  - Section « Vérifications » qui regroupe ce qui est fourni, en langage déclaratif : « Pièce d'identité fournie », « Assurance renseignée ».
  - Dans l'aperçu de la carte : précédent et suivant dans la sélection en cours, et glisser.
- **M** : non. « Profil vérifié par PING » demande une migration : voir le lot 21.
- **R** : non.
- **Risque.** Faible à moyen : les favoris (le cœur) et « Contacter » sans être connecté, qui doit mener à `/auth/login`.
- **Test.** Script : `/map`, aperçu, suivant, puis précédent, fiche, Réserver. Vérifier que `mission/new?pro=` reçoit le bon service.

#### Lot 16. Proposition sans suite et conversations vides
- **But.** Qu'une proposition abandonnée ne laisse pas de conversation vide dans Messages, et que le pro retrouve ses « Propositions envoyées ».
- **Fichiers.** `src/app/messages/page.tsx`, `src/app/pro/carte/page.tsx`.
- **Écart.** Filtrer les transactions qui n'ont ni message ni devis. Ajouter un bloc « Propositions envoyées » côté pro.
- **M** : non. **R** : non.
- **Risque.** Faible.
- **Test.** `separation-espaces.mjs`, puis Messages pour les deux comptes audit.

### Phase C : admin, sans migration (tests par Romain)

#### Lot 17. Admin : recherche, tri et filtres qui marchent
- **But.** Que les listes de l'admin réagissent à la recherche (P0 n° 6).
- **Fichier.** `public/admin.html` : `enhanceTable` (ligne 2321) et `enhanceAll` (ligne 2384) sont appelées avant que les lignes arrivent.
- **Écart.** Rappeler `enhanceTable` après chaque rendu de données, ou filtrer sur les données plutôt que sur le DOM figé.
- **M** : non. **R** : non.
- **Risque.** Faible, limité à l'admin.
- **Test.** Romain : chercher un nom dans Utilisateurs, trier Transactions par date.

#### Lot 18. Admin : litiges, pièces et retours ont une suite
- **But.**
  - Liste des litiges cliquable vers le dossier.
  - Aperçu de la pièce et confirmation avant de valider ou refuser.
  - Entrée « Retours des testeurs » depuis l'accueil.

  C'est le P0 n° 5, et les écrans maquette `a_disp`, `a_docs` et `a_fb`.
- **Fichier.** `public/admin.html` (validation ligne 3255 : `update({ status })` sans confirmation).
- **Écart.** Visionneuse par URL signée du stockage, `confirm()`, liste des litiges qui lit `disputes` et ouvre `/litiges/[id]`, vignette Retours. Le motif de refus et la date d'expiration attendent le lot 22.
- **M** : non.
- **R** : non.
- **Risque.** Moyen. Valider une pièce a un effet public : badges, et plus tard « vérifié par PING ».
- **Test.** Romain : ouvrir une pièce du compte audit.pro, la valider avec confirmation, puis vérifier la fiche `/pro/[id]`.

#### Lot 19. Admin : des chiffres vrais, des liens vrais
- **But.** Ne plus mélanger le réel et le fictif. Plus de « 36 leads » codé en dur, plus de QR vers `ping.app` (P0 n° 3 et n° 4).
- **Fichier.** `public/admin.html` : `campUrl` (ligne 2419), liens `https://ping.app/` (lignes 1238 et 3016 à 3017), tuiles de la Vue d'ensemble, registre Documents.
- **Écart.**
  - Tuiles calculées avec le filtre `fictif` (réel par défaut).
  - « Réalisé » devient « Facturé ».
  - Documents lus dans la table `invoices`.
  - Campagnes vers les liens `/l/` réels de `nexto-eta`, ou marquées « exemple ».
  - Derniers inscrits, les plus récents d'abord.
- **M** : non.
- **R** : oui. Faut-il garder ou supprimer les campagnes et prospects d'exemple ?
- **Risque.** Moyen : beaucoup de code dans un fichier de 4 077 lignes. Faire un lot par section si c'est trop long.
- **Test.** Romain compare les tuiles avec une requête SQL simple (nombre de comptes réels, factures réelles).

### Phase D : avec migration (en attente de l'accès Supabase ou d'un collage par Romain)

Point d'attention : toute requête qui contient DROP ou DELETE demande une confirmation humaine. On préfère `ADD COLUMN` et `CREATE OR REPLACE`.

#### Lot 20. Activités du prestataire lisibles par tous (RPC déjà écrite)
- **But.** Rendre fiable la carte multi-activités.
- **Fichiers.** `supabase/a_coller/provider_services_public.sql`, à coller tel quel. Ensuite `src/lib/services.ts` (`fetchProviderActivities`) appelle la RPC avant la lecture directe.
- **M** : oui, la fonction SECURITY DEFINER est prête. **R** : non.
- **Risque.** Faible : la fonction ne renvoie que l'id et le nom de la prestation.
- **Test.** `/map` avec audit.client : les puces multi-activités affichent les mêmes compteurs qu'avant ou mieux.

#### Lot 21. « Profil vérifié par PING » seulement pour les pièces validées
- **But.** Appliquer l'exception du 03/11 et la section « Vérifications » de la maquette.
- **Fichiers.**
  - RPC `providers_nearby` : aujourd'hui `has_identity` compte `pending` et `valid` (migration 005, ligne 41). Il faut ajouter `identity_valid` et `rcpro_valid`.
  - `src/lib/services.ts`, `src/app/pro/[id]/page.tsx`, `DemoShell` (épingle avec le badge).
- **Écart.** « Profil vérifié par PING » quand la pièce est validée. « Fournie » ou « Renseignée » sinon.
- **M** : oui. Changer les colonnes renvoyées oblige à faire DROP puis CREATE de la fonction (garder `p_lat` et `p_lng`). Cela déclenche une confirmation.
- **R** : non (déjà décidé le 03/11).
- **Risque.** Moyen : c'est la RPC de la carte, et une erreur vide la carte.
- **Test.** `/map` (nombre d'épingles inchangé), fiche d'un prestataire Fictif, `separation-espaces.mjs`.

#### Lot 22. Pièces : motif de refus et date d'expiration
- **But.**
  - Le pro voit « Refusée : motif » et peut renvoyer la pièce.
  - L'admin saisit l'expiration de la RC Pro.
  - La Conformité alerte à 45 jours.
- **Fichiers.** Table `documents` : `ADD COLUMN rejection_reason text` et `expires_at date`. Le schéma de cette table n'est dans aucune migration du dépôt : il faut d'abord le lire en base. Ensuite `public/admin.html`, `src/app/pro/documents/page.tsx` et `src/app/pro/dashboard/page.tsx` (encadré « Il vous reste… »).
- **M** : oui. **R** : non.
- **Risque.** Faible.
- **Test.** Romain refuse une pièce de audit.pro avec un motif. audit.pro voit le motif dans Mes pièces.

#### Lot 23. Masquer un service (« Mes services »)
- **But.** Le pro masque une prestation sans la supprimer (AUDIT « Ajouter, masquer, supprimer un service »). Ajouter, modifier et supprimer existent déjà dans `/pro/tarifs`, avec forfait et heures incluses.
- **Fichiers.**
  - Table `services` : `ADD COLUMN is_visible boolean default true`. Sa RLS n'est décrite dans aucune migration : à lire en base.
  - `src/app/pro/tarifs/page.tsx` : bouton œil.
  - `mission/new`, `pro/[id]` et `src/lib/listing.ts` : filtrer sur `is_visible`.
- **M** : oui. **R** : non.
- **Risque.** Moyen : un service masqué ne doit plus être réservable.
- **Test.** audit.pro masque une prestation : elle disparaît de sa fiche et de `mission/new`, puis réapparaît quand il la démasque.

#### Lot 24. Signalement d'un échange, distinct du litige, et file admin
- **But.** Aujourd'hui « Signaler » dans le chat ouvre un litige (`createDispute`). La maquette sépare deux choses : un signalement de modération (propos, coordonnées partagées) et un litige sur la prestation.
- **Fichiers.** Nouvelle table `moderation_reports` (RLS : l'auteur écrit, `is_admin()` lit). Ensuite le chat (`submitReport`), la section Signalements de `admin.html` (aujourd'hui « — Données disponibles au lancement ») et le dossier `dossier_sig`.
- **M** : oui.
- **R** : oui. Faut-il deux boutons distincts (« Signaler l'échange » et « Ouvrir un litige ») ? Quelles actions pour l'admin : classer, avertir, bloquer ?
- **Risque.** Moyen : ne pas casser l'ouverture de litige depuis le chat et `?signaler` depuis l'écran QR.
- **Test.** Script : audit.client signale, rien n'est créé dans `disputes`. Romain voit le signalement.

#### Lot 25. Contrôle des droits en base (lecture d'abord)
- **But.** Vérifier la RLS de `dispute_messages` (activée dans la migration 021, mais les policies sont à relire en base) et la policy `profile_public_read`, jamais supprimée (audit transversal).
- **Fichiers.** Requêtes en lecture sur `pg_policies`, puis une migration seulement si c'est nécessaire.
- **M** : oui pour corriger, et un accès en lecture même pour vérifier. **R** : non.
- **Risque.** Élevé si on corrige à l'aveugle : tous les noms d'interlocuteurs passent par des RPC parce que `profiles` est en lecture strictement personnelle.
- **Tests.** `separation-espaces.mjs`, `factures.mjs`, puis `/litiges/[id]` pour les deux comptes audit.

#### Lot 26. Catalogue des services en données (structure seulement)
- **But.** Préparer la décision du 07/11 : un service = une ligne de catalogue, sans activer de nouveau métier.
- **Fichiers.**
  - Nouvelle table `service_catalog` (clé, libellé, domaine, modes de prix autorisés, pièces demandées, actif). Lecture publique, écriture par `is_admin()`.
  - Données de départ : ménage, repassage, nettoyage actifs ; vitres présent mais non proposé.
  - `src/lib/trades.ts` lit le catalogue, avec repli sur `TRADES` si la table manque (même principe que `fetchSlots()`).
  - Écran admin `a_catalog` dans `admin.html` : doublons refusés, modifier, impact annoncé avant de masquer.
- **M** : oui.
- **R** : oui. Quand faut-il ouvrir un premier nouveau service ? Il faut aussi trancher la tension entre l'invariant « mono-produit » de CLAUDE.md et la décision du 07/11.
- **Risque.** Élevé : métiers de la carte, de l'inscription pro, de la demande client et de `/menage/[ville]`. Il faut un repli strict.
- **Test.** Avec la table vide ou absente, l'app doit être identique à aujourd'hui. Avec la table remplie, mêmes puces, même assistant pro. Lancer les 4 scripts.

#### Lot 27. Pièces demandées par service et qualifications
- **But.** Les pièces du catalogue apparaissent dans l'inscription et dans Mes pièces. Qualifications par domaine (`qualadd`).
- **Dépend de.** Lot 26. Il faut aussi étendre l'enum `doc_kind`, et `ALTER TYPE ... ADD VALUE` doit être dans sa propre migration.
- **M** : oui.
- **R** : oui. Il faut d'abord décider d'ouvrir un service autre que le nettoyage : la décennale, le RGE et le CAP AEPE n'ont pas de sens avant.
- **Risque.** Moyen.
- **Test.** Inscription d'un pro de test, puis Mes pièces.

### Phase E : refonte de la navigation et du design (décision de Romain d'abord)

#### Lot 28. Agenda avec onglets En cours, Calendrier, Terminées, Factures
- **But.** Regrouper la mission éclatée entre 4 menus (AUDIT P0 « Missions, factures, litiges »). La maquette garde le titre « Agenda ».
- **Fichiers.** `src/app/agenda/page.tsx` (onglets) et `src/lib/agenda.ts`. On réutilise `/documents` pour l'onglet Factures. Messages et Litiges restent accessibles.
- **M** : non.
- **R** : oui. Cela touche la structure du menu à 4 entrées décidée le 30/10.
- **Risque.** Moyen : le tri par `scheduled_at`, la séparation particulier / prestataire (`useMode`) et le litige en tête.
- **Test.** `separation-espaces.mjs` (Agenda en deux modes), `audit-scenarios.mjs`.

#### Lot 29. Bouton central « Demander » dans la barre du bas
- **But.** Rendre visible le dépôt d'une demande (QC « Déposer une demande »).
- **Fichiers.** `src/components/BottomTabBar.tsx` (4 onglets aujourd'hui), `DesktopShell.tsx` et `NavDrawer.tsx`.
- **M** : non.
- **R** : oui. Passer de 4 à 5 onglets contredit « Menu réduit à 4 entrées, même structure dans les deux espaces ». Alternative sans décision : un bouton « Déposer une demande » en tête de la liste de la carte (déjà présent ailleurs).
- **Risque.** Moyen : pastille de non-lus, `--tabbar-h` des barres collantes.
- **Test.** `audit-scenarios.mjs` en 390 px (aucun chevauchement), pastille de non-lus.

#### Lot 30. Suivi de mission en frise
- **But.** Vue d'ensemble de la mission (frise des étapes, une seule action à la fois), écran maquette `mission`.
- **Fichiers.** Nouveau composant au-dessus du chat ou des QR (`MissionRecap`, `DepartureBar`).
- **M** : non. **R** : oui, sur la place de la frise (chat ou page dédiée).
- **Risque.** Moyen.
- **Test.** `parcours.mjs` en entier.

#### Lot 31. Accessibilité de base
- **But.**
  - Autoriser le zoom : retirer `maximumScale: 1` de `src/app/layout.tsx`, ligne 45.
  - Focus visible, libellés reliés aux champs, cibles de 44 px.
  - Contraste des boutons blancs sur teal : 2,6:1 aujourd'hui, 4,9:1 en teal foncé dans la maquette.
- **Fichiers.** `src/app/layout.tsx`, `src/app/ping-ui.css`.
- **M** : non.
- **R** : oui pour le teal foncé, qui change la couleur de la marque sur les boutons. Le zoom et le focus peuvent passer sans décision : à séparer en 31a sans décision et 31b avec décision.
- **Risque.** Moyen : sur la carte Leaflet, le zoom de la page peut gêner le pincement. Tester sur mobile.
- **Test.** `audit-scenarios.mjs` (débordement), pincement sur `/map` avec Playwright en mobile.

#### Lot 32. Visibilité d'un nouveau prestataire
- **But.** Choisir entre l'app actuelle (visible dès la fin de l'assistant, `is_active=true`) et la maquette (« visible, réservable après contrôle »).
- **Fichiers.** `src/app/pro/onboarding/page.tsx`, `/pro/attente`, `mission/new`. Il faut aussi une colonne d'état si « réservable après contrôle » est retenu.
- **M** : probablement. **R** : oui (`non-regression.md`, décisions).
- **Risque.** Élevé : l'offre visible sur la carte au lancement.

#### Lot 33. Litige : geste commercial et avoir
- **But.** Montant saisi puis confirmé, un seul geste, avoir sur la facture (contre-audit admin, P1 n° 6).
- **M** : oui (avoir, numérotation). **R** : oui (vague 3, « avoir » en attente).
- **Risque.** Élevé : facturation, 3 documents, `transfer_payments`.

---

## 4. Décisions à demander à Romain (récapitulatif)

1. **Barre du bas à 5 onglets avec « Demander »** (lot 29), ou menu à 4 entrées (décision du 30/10) avec un bouton « Déposer une demande » placé ailleurs.
2. **Agenda avec onglets** En cours, Calendrier, Terminées, Factures (lot 28).
3. **Séquestre dans l'app** : aucune mention tant que le paiement est éteint (maquette), ou « bientôt » (app actuelle) ? Lot 10. Rappel : le marketing le montre comme actif depuis le 03/11, ce qui est à réaligner avant le lancement public.
4. **« Je pars » et le scan** bloqués avant le jour du rendez-vous, ou seulement un avertissement (lot 14).
5. **Teal foncé** sur les boutons pour le contraste (lot 31b).
6. **Visibilité d'un nouveau pro** : tout de suite, ou réservable après contrôle (lot 32).
7. **Signalement de modération** distinct du litige, et actions de l'admin (lot 24).
8. **Ouverture d'un premier service hors nettoyage**, et des unités panier, fenêtre ou m² (lots 26 et 27).
9. **Avoir et geste commercial** dans le litige (lot 33).
10. **Anciens liens** qui tombaient sur le prototype et renverront désormais « introuvable » (lot 7).
11. **Campagnes et prospects d'exemple** dans l'admin : les garder marqués « exemple », ou les supprimer (lot 19).

## 5. Ordre conseillé, en une ligne

Lot 1 (constat), puis 2, 3, 4, 5, 6 (sécurité et pertes de données), puis 8, 9, 10, 11 (carte et textes), puis 7, puis 12 à 16 (parcours, selon le lot 1), puis 17 à 19 (admin). Ensuite 20 à 27 dès que l'accès Supabase revient. Enfin 28 à 33 après les décisions de Romain.
