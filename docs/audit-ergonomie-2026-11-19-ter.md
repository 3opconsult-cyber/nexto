# Audit ergonomie mesuré — 19/11/2026 (ter, après 96d7278)

Remesure indépendante, production nexto-eta.vercel.app, faite entre 00 h 20 et 00 h 50 (heure de Paris) le 20/11.
Déploiement de 96d7278 attendu (statut GitHub/Vercel passé de « pending » à « success ») puis vérifié en ligne :
l'annulation dans le chat se confirme dans le menu « … » (« Garder » / « Confirmer l'annulation », aucun `window.confirm`),
et la carte pro affiche « Recherche des demandes autour de vous… » 24 ms après la redirection, puis la liste.

Même méthode et même grille que `audit-ergonomie-2026-11-19-bis.md` : Playwright 390×844 tactile (`isMobile`, `hasTouch`),
comptes audit client et pro, appuis comptés depuis l'écran d'accueil de chaque espace, défilements, fenêtres non sollicitées,
cibles < 44 px et erreurs console relevés à chaque appui. Scripts : `scratchpad/e2e/ergo4/` (non versionnés, repris de
`ergo3/` + `e.mjs` pour la contre-proposition acceptée par le prestataire et `f.mjs` pour la zone « Confirmer »).
**Temps à froid** = premier affichage de l'écran dans un nouveau contexte navigateur, juste après la connexion ;
**second passage** = même écran rouvert dans le même contexte.

**Grille 10/10** : action fréquente ≤ 3 appuis, réserver ≤ 6, aucune hésitation, aucun bouton < 44 px, aucune fenêtre
non sollicitée, aucune erreur console, attente < 1 s une fois la carte affichée.

Process de commande mené de bout en bout dans les deux cas :
- **réservation directe** depuis l'aperçu de la carte (créneau → Commande validée → sur place → changement pour absent →
  message → annulation depuis le chat, confirmée dans le menu) ;
- **demande publiée** « QA ergo4 — ménage 2 h » → tarif du pro (100 € prérempli) → acceptation client avec RDV prérempli →
  « absent » → Mission du jour → Je pars → démarche client absent → confirmation client (bandeau) → demande du code de fin →
  code envoyé (bandeau client) → **bandeau pro « Code de fin reçu : clôturez la mission »** → clôture → **bandeau
  « Notez Audit P. · mission terminée »** → avis → litige ;
- **contre-proposition acceptée par le prestataire** : demande « QA ergo4 — contre-offre » → tarif du pro 100 € → le client
  refait une proposition à 90 € → le pro accepte dans le chat.

**Migration 051 : appliquée.** `match_request_on_accept` répond (plus de PGRST202). Après l'acceptation **par le pro** de la
contre-offre à 90 €, la transaction a `price_confirmed = true` et la demande est passée `matched` ; elle a disparu de la carte
du pro (2 occurrences avant, 0 après) et de `requests_nearby`. Côté client, l'acceptation ferme toujours la demande (`matched`).

**Zéro erreur console ou réseau** (10 scripts, client et pro). **Aucune fenêtre non sollicitée** (l'aperçu du prestataire
s'ouvre au toucher de sa ligne, c'est l'effet attendu). **Aucune boîte native** (`confirm`/`alert`) sur tout le parcours.

## Tableau

| Tâche | Appuis (bis) | Appuis maintenant (+ saisies) | Attente à froid | Second passage | Note /10 | Ce qui empêche 10 |
|---|---|---|---|---|---|---|
| **Client** — se connecter | 1 + 2 | 1 + 2 | liste de la carte 1,3 s (0,6-0,8 s sur d'autres essais) | 0,5-0,7 s | 9 | Liste > 1 s au premier essai après connexion |
| Trouver un pro de ménage et voir sa fiche | 3 | 3 (puce, ligne, Voir le profil) | fiche 1,8-2,1 s | 0,16-0,18 s | 8 | Fiche à froid ≈ 2 s ; le volet replié ne montre qu'une ligne (le 2e prestataire demande un défilement). Épingles désormais 44 px |
| Réserver | 4 (carte) / 3 (fiche) | **4 depuis la carte** (ligne, Réserver · 100 €, heure, Confirmer) ; jour présélectionné | appuis 0,25-0,57 s | idem | 9 | Présélection du soir (« Auj. » épuisé) non vérifiable à 00 h 20 (code lu, pas mesuré) ; défilement du volet si le prestataire n'est pas 1er |
| Déposer une demande | 3 + 1 | 3 + 1 (Déposer, Ménage, Publier) | 0,85 s | 0,85 s | 10 | — (bouton 48 px, Publier collant) |
| Comparer et accepter une proposition (+ RDV) | 6 | **4** (Agenda, Mes demandes, Accepter ce prestataire, Confirmer · 100 €) ; RDV prérempli | Mes demandes 1,3 s (navigation) ; 1,6-2,2 s (lien direct) | 0,1-0,15 s | 8 | Mes demandes à froid > 1 s ; **« Confirmer · 100 € » collé à sa carte : quand la carte n'est pas en haut, il tombe sous la barre du bas (y = 816, recouvert par « Agenda ») → 1 défilement** |
| Demande fermée après l'accord | client OK, pro non (051 absente) | **client et pro OK** | — | — | 10 | — (051 appliquée : `matched` et disparue des demandes autour de soi) |
| Répondre « sur place / absent » | 1 ; changer 1 | 1 ; changer 1 | 0,54 s | idem | 10 | — |
| Client absent : confirmer l'arrivée | 2 | 2 (bandeau « Votre prestataire est arrivé : confirmez » → Je confirme) | 0,58 s | idem | 10 | — |
| Client : envoyer son code de fin | 2 | 2 (bandeau → Envoyer mon code de fin) | 0,57 s | idem | 10 | — |
| Écrire au prestataire | 3 + 1 | 3 + 1 | liste 0,2-0,34 s | 0,19-0,3 s | 10 | — (champ « Rechercher » ≈ 42 px, non utilisé dans la tâche) |
| Annuler une réservation (chat) | 2 + `confirm()` | **3** (… → Annuler cette réservation → Confirmer l'annulation), sans boîte native | 0,54 s | idem | 10 | — |
| Retrouver sa facture | 3 | 3 (Agenda, Factures, facture) | facture 0,2-0,47 s (préchargée) ; Agenda 1,3-2,1 s | 0,18-0,6 s | 9 | Agenda client à froid 1,3-2,1 s (la facture elle-même est instantanée) |
| Laisser un avis | 5 + 1 | **3 + 1** (bandeau « Notez Audit P. », ★, Publier mon avis) | 0,57 s | idem | 10 | — (bandeau 322×48 + « Plus tard » 44×48, au-dessus de la barre) |
| Ouvrir un litige | 5 + 1 | 5 + 1 (Agenda, Terminées, Signaler un problème, motif, Ouvrir le litige) | 0,54 s | idem | 10 | — (« Retour » 44 px ; action rare) |
| **Pro** — se connecter | 1 + 2 · liste 3,6-4 s | 1 + 2 · atterrit sur la carte des demandes, « Recherche des demandes… » à 24 ms | liste remplie à **2,5 s** | 0,25-0,47 s | 8 | Premier affichage de la liste 2,5 s (plus de faux « 0 demande », mais toujours > 1 s) |
| Voir les demandes autour de soi | 0 | 0 (atterrissage) | 2,5 s (froid, juste après connexion) ; 0,39-0,46 s si l'écran est rouvert | 0,3-0,37 s | 8 | Même attente à froid |
| Répondre à une demande avec un tarif | 3 + 0 | 3 + 0 (demande, Proposer mon tarif, Envoyer ; 100 € prérempli) | 0,58 s | idem | 10 | — (réponses rapides et « Modifier ma proposition » à 44 px) |
| **Accepter une contre-proposition du client** | non mesuré | 3 (Messages, conversation, Accepter) | Messages pro 1,4 s | 0,15-0,19 s | 9 | Messages pro à froid 1,4 s |
| Accepter une réservation | 2 (rien à accepter) | 2 (rien à accepter) | Messages 1,4 s froid | 0,15-0,19 s | 8 | Réservation confirmée d'office, pas d'« Accepter / Refuser » (décision produit) ; Messages pro à froid 1,4 s |
| Mission du jour + « Je pars » | 1 + 3 | 1 + 3 (Mission, Je pars, 10 min, Prévenir le client) | 0,57 s | idem | 9 | 4 appuis pour une action quotidienne (durée à choisir à chaque fois) ; durées désormais 44 px |
| Pro : démarche client absent | 4 | 4 (Partager ma position, photo ×2, Envoyer la photo) | 0,54 s | idem | 10 | — |
| Pro : code de fin | 2 + (Mission + saisie + Clôturer) | 2 pour demander ; puis **bandeau « Code de fin reçu : clôturez la mission » → saisie → Clôturer** (2 + 1) | 0,57 s | idem | 10 | — (champ 358×48 à y = 668, « Clôturer » à y = 722 : au-dessus de la barre) |
| Arrivée / fin sur place (QR) | non remesuré | non remesuré (code inchangé) | — | — | 9 | — |
| Ajouter une prestation (Mes tarifs) | 5 + 2 | 5 + 2 (Entreprise, Mes tarifs, Ajouter, Autre, Enregistrer) | Mon entreprise 0,3-0,39 s | 0,23-0,24 s | 9 | 5 appuis (action rare) |
| Déposer une pièce | 4 | 4 (Entreprise, Mes pièces, Fichier, choix) | 0,53 s | idem | 10 | — |
| Retrouver ses revenus | 2 | 2 | 0,14-0,28 s (préchargés) | 0,11-0,14 s | 10 | — |
| Agenda pro | 1 | 1 | 0,15-0,58 s | 0,15-0,22 s | 10 | — (calendrier : Précédent/Suivant 44×44, Aujourd'hui 94×44, Jour/Semaine/Mois 44 px) |
| Passer en espace client et revenir | 2 | 2 | 0,57 s | idem | 10 | — |

**Progrès depuis le bis** : 18 tâches à 10 (9 au bis) ; avis 5 → 3 appuis (bandeau « Notez ») ; accepter + RDV 6 → 4
(RDV prérempli) ; code de fin pro guidé par bandeau, champ visible ; 051 appliquée (demande fermée quel que soit celui qui
accepte) ; plus aucun `confirm()` ; plus aucune cible < 44 px relevée sur les parcours (épingles, durées, calendrier, chat,
litige) ; carte pro, Mon entreprise, revenus et facture < 0,5 s une fois en cache.

**Pas encore 10** : premiers affichages à froid encore > 1 s (carte des demandes pro 2,5 s, fiche prestataire 1,8-2,1 s,
Agenda client 1,3-2,1 s, Mes demandes 1,3-2,2 s, Messages pro 1,4 s) ; « Confirmer · prix » de Mes demandes sous la barre
quand la carte n'est pas en haut ; « Je pars » en 4 appuis ; décision produit sur l'acceptation des réservations.

## Corrections restantes

| # | Fichier | Changement |
|---|---|---|
| 1 | `src/app/client/demandes/page.tsx` | Au toucher de « Accepter ce prestataire », faire défiler la zone de confirmation dans la vue (`scrollIntoView({block:'end'})` avec marge `--tabbar-h`). Aujourd'hui la barre collante ne monte pas au-dessus du haut de sa carte : relevée à y = 816 sous l'onglet « Agenda » quand la demande n'est pas la première de la liste |
| 2 | `src/app/auth/login/page.tsx` + `src/lib/screenCache.ts` | Lancer `requests_nearby` (pro) et la liste de la carte (client) dès la connexion réussie, avant la redirection, et garder la dernière liste en `sessionStorage` par utilisateur : carte des demandes pro 2,5 s → < 1 s à froid |
| 3 | `src/components/TabPrefetch.tsx` | Précharger aussi Agenda (client et pro), Messages (pro) et Mes demandes (client) juste après la connexion : 1,3-2,2 s → < 1 s à froid |
| 4 | `src/components/DemoShell.tsx` / `src/app/pro/[id]/page.tsx` | Précharger la fiche du prestataire à l'ouverture de son aperçu sur la carte (profil, avis, services) : fiche 1,8-2,1 s → < 1 s |
| 5 | `src/components/DepartureBar.tsx` / `src/app/mission/[id]/jour/page.tsx` | Présélectionner la dernière durée choisie (ou 10 min) pour que « Je pars » → « Prévenir le client » suffise : 4 → 3 appuis |
| 6 | `src/app/messages/page.tsx` (l. 107) | Champ « Rechercher » à `minHeight: 44` (≈ 42 px) |
| 7 | décision Romain | Réservation reçue : garder la confirmation d'office ou ajouter « Accepter / Refuser » |
| 8 | à vérifier en soirée | Non mesurables à 00 h 20 : présélection du premier jour qui a encore un créneau (DayTimePicker) et onglet Mission pour un RDV à 00 h 05 vu à 23 h 59 (code lu, conforme) |

## Données créées pendant la mesure (comptes audit uniquement)
- **Annulées / supprimées** : réservation 6e090463 (20/11 08 h 00) annulée depuis le chat, avec le message « QA ergo4 : bonjour » ;
  mission de la contre-offre 3667bd6f (90 €, prix validé) annulée depuis le chat ; demande « QA ergo4 — sonde confirmer »
  (b012878a) annulée et sa proposition 0a6a9d47 annulée ; prestation « QA ergo4 prestation » supprimée.
- **Restent** (non annulables depuis l'app ni par l'API des comptes) : demande « QA ergo4 — ménage 2 h » (b7eef47f, `matched`) et
  sa mission 07769414 terminée (100 €, 3 factures, preuves client absent + code de fin) ; demande « QA ergo4 — contre-offre »
  (d8f028c1, `matched`, mission annulée) ; avis 86f42e59 (5★, « QA ergo4 : test », suppression refusée par la RLS) ;
  litige 0b11d8c9 **ouvert** (clôture refusée au client : à clore depuis l'admin ou en SQL).
