# Lot 1 : constat sur la production (18/11/2026)

Ce document vérifie, dans l'app en production (https://nexto-eta.vercel.app), les défauts trouvés dans la maquette par le contre-audit v6. Le périmètre est celui du lot 1 et des lots 12 à 16 de `docs/refonte-lots.md`.

**Méthode.**
- Parcours joués avec Playwright (390×844, fr-FR), comptes `audit.client.claude` et `audit.pro.claude`. Les scripts sont dans le scratchpad, `e2e/lot1/` (`a.mjs`, `b.mjs`, `b2.mjs`).
- Lecture du code (`src/app/**`, `src/components/**`, `src/lib/**`).
- Les captures sont dans `docs/audit-2026-11-07/captures/lot1/`.

**Hors périmètre.** L'arrivée, le départ, le QR, le code et le client absent sont audités par un autre agent. Les points correspondants sont seulement renvoyés à cet audit.

**Aucun fichier de l'app n'a été modifié.**

## Données créées (comptes audit uniquement, titres « QA lot1 »)

| Objet | Id | État final |
|---|---|---|
| Transaction B (« Contacter » depuis la fiche, devis 120 € « QA lot1 devis 120 € (conversation B) » accepté) | `37a27da0-9812-415b-983e-c653a30e16d6` | annulée par le client |
| Transaction C (`mission/new`, description « QA lot1 réservation C (mission/new) », RDV sam. 21/11 10:00), avec une offre de 50 € restée « pending » | `64010841-7dfb-4f33-92db-2d8b25eec6c5` | annulée par le prestataire |
| Demande ouverte « QA lot1 demande ouverte » (budget 30-40 €) | `d6c0fd48-ce4d-4f8c-9661-a72d087de4ea` | `cancelled` |
| Transaction E (réponse du pro via `provider_respond_to_request`, sans message) | `f4671360-b764-4831-a288-bb7e9db73761` | annulée |

Autre écriture : l'adresse du profil d'audit.client a été vidée par l'écran « Modifier » de `/client/profil`, puis remise à sa valeur d'origine, « 2 rue de l Audit, Grasse ».

Au départ, il n'y avait aucune transaction ouverte entre les deux comptes. À la fin, il n'en reste aucune.

## Tableau des constats

Légende : **PRÉSENT** = reproduit dans l'app ; **ABSENT** = non reproduit ; **PARTIEL** = un défaut voisin existe ; **NON TESTÉ** = hors périmètre ou non testable.

| # | Défaut (maquette) | Lot | App | Preuve |
|---|---|---|---|---|
| 1 | Une conversation passe d'une mission à l'autre : « Contacter » un pro déjà réservé rouvre la mission réservée | 1, 16 | **PRÉSENT** | La réservation C est faite (prix figé, RDV fixé). Ensuite, « Contacter » sur la fiche du même pro rouvre le chat de C au lieu d'une nouvelle conversation : log `Contacter rouvre 6401… = C`, capture `a08-client-contacter-rouvre.png`. Cause : `src/lib/services.ts:164-172`. La fonction réutilise toute transaction `pending/held/arrived` avec ce pro, y compris une mission confirmée. Elle reprendrait aussi une mission de l'autre agent en cours entre les deux comptes. |
| 2 | Ancien devis encore « Accepter » après une réservation à prix figé par `mission/new` | 1, 13 | **PRÉSENT** | La conversation B a un devis de 120 € en attente. Le client réserve C par `mission/new`. Il revient sur B : le devis est toujours « Accepter » (`a06-client-B-ancien-devis.png`). L'accepter confirme B : on a alors **deux missions confirmées** chez le même pro, B à 120 € et C à 100 € (log `open tx after accept`, `a07`). Rien ne relie ni ne prévient. |
| 2b | « + Proposer un tarif » proposé sur une mission à prix déjà figé (règle suprême du tarif) | 13 | **PRÉSENT (bloqué en base)** | Sur C, le pro voit « + Proposer un tarif » (`a09-pro-chat-C-prix-fige.png`). Il peut envoyer une offre de 50 €, et le client voit « Accepter ». Au clic, la base refuse (« Tarif validé : il ne peut plus être modifié (seul un litige le rouvre) »). L'écran affiche alors « Acceptation non enregistrée — réessayez » et l'offre reste « Accepter » indéfiniment (`a10-client-C-accepter-refuse-par-la-base.png`). Le prix n'a pas changé (10000 c). C'est donc un défaut d'interface, pas de données. Cause : `src/app/mission/[id]/chat/page.tsx:824`, qui teste seulement les offres et pas `tx.price_confirmed` (une réservation `mission/new` n'a aucun message d'offre). |
| 3 | Réservation possible sans adresse | 12 | **ABSENT** | Profil sans adresse : `mission/new` affiche « Votre adresse » et refuse la réservation (« Indiquez votre adresse. », `b09-mission-new-sans-adresse-bloque.png`). `resolveAddress` (`src/components/AddressChoice.tsx:70-74`) bloque aussi la carte « Fixez le rendez-vous » du chat. |
| 3b | Adresse effaçable dans `/client/profil` | 12 | **PRÉSENT (mineur)** | L'écran « Modifier » accepte un champ adresse vide : `profiles.address` passe à `null` (log `adresse après enregistrement null`, `b08-profil-adresse-videe.png`). Cause : `src/app/client/profil/page.tsx:55` (`address: f.address.trim() \|\| null`). Sans conséquence grave, puisque la réservation redemande l'adresse (ligne 3). |
| 4 | Focus perdu dans « Proposer un tarif » (forfait avec heures) | 13 | **ABSENT** | On saisit chiffre par chiffre « 2 » dans Heures incluses, puis « 15 » dans Tarif horaire. Le focus est conservé et les valeurs sont gardées (log `focus kept heures true horaire true values 2 15`). Le formulaire est inline, sans re-rendu destructeur. |
| 5 | Prix prérempli, saisie à la suite (« 3030 € ») | 13 | **PRÉSENT (variante)** | Le champ Montant n'est pas prérempli au budget du client mais au **prix de base du pro** (`tx.subtotal_cents`). Exemple : 100 € alors que la demande indiquait 30-40 € (`b02-pro-form-prefill-demande.png`). Taper à la suite donne **10030** (`a03-pro-form-tarif-garde-fou.png`). Le bouton « Envoyer la proposition » reste actif sans aucun garde-fou. Cause : `src/app/mission/[id]/chat/page.tsx:826`. |
| 5b | Pas de récapitulatif « Vous percevez X € » avant l'envoi | 13 | **PRÉSENT** | Le formulaire ne contient pas « percevez » (log `récap percevez dans le formulaire false`). Le montant perçu n'apparaît qu'une fois le devis envoyé (`chat/page.tsx:735-738`). |
| 5c | Heures incluses saisies sans tarif horaire : perdues sans message | 13 | **PRÉSENT (code)** | `chat/page.tsx:236` : `includedHoursNum` vaut `null` si le tarif horaire est vide. Le devis part en prix fixe sans avertir. |
| 6 | Accord « client absent » réutilisé d'une mission à l'autre | 14 | **NON TESTÉ** | Périmètre de l'agent arrivée/départ. |
| 7 | « Je pars » et scans possibles avant le jour du RDV | 14 | **NON TESTÉ** | Périmètre de l'agent arrivée/départ. Observation incidente : sur C (RDV le samedi 21/11, testé le 18/11), le pro voyait déjà le bandeau de départ et « Client absent ? Valider mon arrivée » (`a09`). |
| 8 | Annulation par le pro : « frais tardifs versés au prestataire », texte à la 3e personne | 1 | **ABSENT** | Le pro annule C : la confirmation dit « Annuler cette réservation ? Cette action est définitive. » et le message système dit « ✕ Réservation annulée par le prestataire. », sans frais (`a13-pro-annule-C.png`). Les frais ne s'appliquent que si `isBuyer` (`chat/page.tsx:318`). Le cas du pro déjà « en route » n'a pas été joué (périmètre départ), mais le code donne un texte dédié, sans frais (`chat/page.tsx:320-323`). |
| 9 | Menu > Support PING n'ouvre aucun écran | 1 | **ABSENT** | Le menu ouvre `/support` (« Une question, un souci ? Écrivez-nous… ») côté client comme côté pro (`b06-support-client.png`, `b06-support-pro.png`). |
| 10 | « 1 missions » et pluriels | 1, 10 | **ABSENT dans l'app / PRÉSENT dans l'admin** | Recherche de `1 <mot>s` sur 19 écrans (client : map, messages, agenda, profil, demandes, avis, litiges, documents, parrainage ; pro : carte, dashboard, messages, agenda, revenus, tarifs, disponibilités, annonce, litiges, documents) : aucun cas. Le code accorde partout (`messages/page.tsx:170`, `ProMonthBlock.tsx:92`, `pro/annonce/page.tsx:355`…). **Admin** : `public/admin.html:3682`, `k.terminees + ' missions'` donne « 1 missions » (non testé en vrai, les comptes audit ne sont pas administrateurs). |
| 11 | Proposition sans suite : conversation vide dans Messages | 16 | **PRÉSENT** | Le pro répond à une demande puis abandonne sans écrire. Une ligne « Audit C. — Aucun message — ouvrir la conversation » apparaît chez le pro (`b03-pro-messages-conversation-vide.png`) **et** chez le client (`b04-…`). Même effet pour un « Contacter » client abandonné. Cause : `src/app/messages/page.tsx:97`, sans filtre sur les transactions vides. |
| 12 | Pas de « Propositions envoyées » côté pro ; la demande reste listée | 16 | **PRÉSENT** | Après la réponse, `/pro/carte` liste toujours la demande comme si de rien n'était, et n'a aucun bloc « Propositions envoyées » (log `demande encore listée true / bloc propositions envoyées false`, `b05-pro-carte-apres-reponse.png`). « Mes interventions à venir » ne montre que `price_confirmed = true` (`pro/carte/page.tsx:108-112`). |
| 13 | Fiche pro : description répétée | 15 | **PRÉSENT** | La bio « Menage complet, minutieux… » apparaît 2 fois : dans « À propos », puis comme description de la 1re prestation (`a01b-fiche-pro-full.png`). Cause : `src/app/pro/[id]/page.tsx:109` (`description: pro.bio`). |
| 14 | « Réserver · 22 €/h » ouvre le forfait | 15 | **ABSENT** | `pricingShort` (`src/lib/servicePricing.ts:111`) et `mission/new` (`page.tsx:87-104`) partent de la même règle : forfait si `base_price_cents > 0`. Sur audit.pro, « Réserver · 100 € » ouvre bien le forfait de 100 € avec 3 h incluses (`a05`). |
| 15 | Fiche : deux boutons (Contacter et Réserver) au lieu d'un | 15 | **PRÉSENT (choix de design)** | `pro/[id]/page.tsx:227-228`. Ce n'est pas un bogue, mais la cible du lot 15. À noter : « Contacter » a le défaut de la ligne 1. |
| 16 | Aperçu de la carte sans précédent et suivant | 15 | **PRÉSENT (code)** | `src/components/DemoShell.tsx:270-280` : l'aperçu n'a ni flèche ni glisser pour passer d'un pro à l'autre. |
| 17 | Conversation non chronologique (devis après les messages) | 1 | **ABSENT** | Messages et devis sont triés ensemble par `created_at` (`chat/page.tsx:126`, rendu 700+). |
| 18 | « Forfait + heures incluses » absent de Mes tarifs et de l'assistant | 1 | **ABSENT** | `PricingEditor` (mode `forfait_heures`, `src/components/PricingEditor.tsx:52`) est utilisé par `/pro/tarifs` et `/pro/onboarding`. |
| 19 | Interrupteur coupé, titre resté « Disponible maintenant » | 1 | **ABSENT** | `pro/carte/page.tsx:226` : `available ? 'Disponible maintenant' : 'Hors ligne'`. |
| 20 | Avis : valeurs reprises d'une mission à l'autre | 1 | **ABSENT (code)** | L'état de `ReviewModal` est local à chaque montage. Le chat est une page par mission. Non joué en vrai (il faudrait une mission terminée, donc des scans : autre périmètre). |

Incident sans lien avec la maquette : un `/messages` pro a une fois renvoyé « Loading chunk 4750 failed » (React #423). L'écran était vide (`a12-pro-messages.png`), probablement pendant un déploiement. La passe suivante (`b03`) était normale.

## Corrections pour les défauts présents

### Lot 16 (et ligne 1) : une conversation par mission
1. **`src/lib/services.ts:164-172` (`openConversation`).** Ne réutiliser qu'une conversation **non confirmée** : ajouter `.eq('price_confirmed', false)` et réduire le filtre de statut à `.eq('status', 'pending')`. Une mission confirmée se retrouve par l'Agenda ou Messages ; un nouveau « Contacter » ouvre alors une nouvelle conversation pour un nouveau besoin.
2. **`src/app/messages/page.tsx:97` (`visible`).** Écarter les transactions vides : `lastMessage == null`, `!price_confirmed`, `status === 'pending'`. Les compter à part pour le pro (point 3).
3. **`src/app/pro/carte/page.tsx`.**
   - Ajouter un bloc « Propositions envoyées » au-dessus de « Mes interventions à venir ». Requête : `transactions` où `seller_id = moi`, `price_confirmed = false`, `status = 'pending'`, avec `requests(title, category)`. Chaque ligne mène au chat.
   - Dans la liste des demandes, marquer « Déjà contactée » (ou masquer) celles dont le `request_id` figure dans ce bloc.

### Lot 13 : « Proposer un tarif »
1. **`chat/page.tsx:824` (condition d'affichage du bouton).** Ajouter `&& !tx.price_confirmed`, conformément à CLAUDE.md : le bouton n'apparaît que tant qu'aucun devis n'est accepté.
2. **`chat/page.tsx` (rendu du devis, boutons « Refaire une proposition » / « Accepter » d'une offre `pending`, vers les lignes 744-755).** Si `tx.price_confirmed`, afficher « Tarif déjà validé : proposition sans effet » au lieu des boutons. Garder le trigger de base tel quel.
3. **`chat/page.tsx:826`.**
   - Ouvrir avec `setNewAmount('')`.
   - Sur l'input Montant (ligne 646), ajouter un `placeholder` : le budget du client (`req.budget_min_cents`–`req.budget_max_cents`) s'il existe, sinon le prix de base. Par exemple « Budget du client : 30–40 € ».
4. **Formulaire (après la ligne 667, avant le bouton).**
   - Ajouter une ligne de récapitulatif calculée avec `getRates()` (ou le ratio `seller_fee_cents/subtotal_cents` déjà utilisé ligne 736). Forfait : « Le client paie X € · Vous percevez Y € ». Forfait avec heures : ajouter « N h incluses puis Z €/h ». Horaire : « estimation ».
   - Message bloquant si Heures incluses est rempli sans tarif horaire (aujourd'hui elles sont jetées, ligne 236).
5. **`proposeOffer` (ligne 221).** Si `req.budget_max_cents` existe et que `cents > 3 × budget_max_cents` (ou plus de 3 fois le prix de base sans budget), demander `confirm('Vous proposez X €, soit plus de 3 fois le budget du client. Envoyer quand même ?')`.

### Lot 1 et 13 : ancien devis après une réservation par `mission/new`
**`src/app/mission/new/page.tsx`, dans `submit()` après la création de la transaction (après la ligne 194).**
- Chercher les transactions du client avec ce pro en `status = 'pending'` et `price_confirmed = false`.
- Pour chacune :
  - passer ses messages `kind = 'offer'` et `offer_status = 'pending'` à `declined` (le client en a le droit, comme dans `declineOffer`) ;
  - insérer un message système « Proposition remplacée par la réservation du <date> » (`systemSender`).
- Variante plus simple : afficher sur `mission/new` un avertissement « Vous avez une conversation en cours avec ce prestataire », avec un lien vers elle.

### Lot 12 : adresse du profil
**`src/app/client/profil/page.tsx:55`.**
- Refuser l'enregistrement d'une adresse vide quand le profil en avait une : `if (profile?.address && !f.address.trim()) { setEditErr('L’adresse ne peut pas être effacée, modifiez-la.'); return }`.
- Ou bien garder l'ancienne : `address: f.address.trim() || profile?.address || null`.
- Rien d'autre à faire pour le lot 12 : la réservation sans adresse est déjà bloquée.

### Lot 15 : fiche du prestataire
1. **`src/app/pro/[id]/page.tsx:109`.** Remplacer `description: pro.bio || null` par `description: null`, puisque la bio est déjà dans « À propos ».
2. **`pro/[id]/page.tsx:224-229`.** Un seul bouton collant « Réserver · prix ». « Contacter » passe en lien secondaire, ou en icône dans l'en-tête. Garder la redirection vers `/auth/login?next=` pour un visiteur non connecté (ligne 50).
3. **`src/components/DemoShell.tsx:270-280`.** Dans l'aperçu, ajouter « précédent / suivant » dans la liste filtrée courante, plus un glisser horizontal.

### Lot 10 (pluriels), admin seulement
**`public/admin.html:3682`.** Remplacer `k.terminees + ' missions'` par `k.terminees + (k.terminees > 1 ? ' missions' : ' mission')`. En profiter pour renommer « Réalisé » en « Facturé » (contre-audit admin, P2 n° 17).

## Conséquences pour le plan de refonte
- **Lot 12** : réduit à l'effacement de l'adresse dans le profil. Le blocage de la réservation existe déjà.
- **Lot 13** : confirmé. Il faut y ajouter le bouton sur une mission à prix figé, et le devis resté « Accepter » que la base refuse.
- **Lot 14** : à trancher par l'audit arrivée/départ.
- **Lot 15** : confirmé (description en double, aperçu sans précédent et suivant). La mauvaise prestation ouverte par « Réserver » n'est pas reproduite.
- **Lot 16** : confirmé. Il faut y ajouter `openConversation`, qui rouvre une mission confirmée.
