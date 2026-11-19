# Audit ergonomie mesuré — 19/11/2026 (bis, après ef33202)

Production nexto-eta.vercel.app. Déploiement de ef33202 attendu (statut GitHub/Vercel « success ») puis vérifié en ligne :
l'aperçu d'un prestataire sur `/map` affiche « Réserver · 100 € » et aucune fenêtre « Paiement par virement » n'apparaît
après « Confirmer » (on arrive directement sur « Commande validée »). Même méthode et même grille que
`audit-ergonomie-2026-11-19.md` : Playwright 390×844 tactile (`isMobile`, `hasTouch`), comptes audit client et pro, appuis
comptés depuis l'écran d'accueil de chaque espace, défilements, fenêtres non sollicitées, cibles < 44 px et erreurs console
relevés à chaque appui. Scripts : `scratchpad/e2e/ergo3/` (non versionnés). Mesure faite vers minuit (heure de Paris).

**Grille 10/10** : action fréquente ≤ 3 appuis, réserver ≤ 6, aucune hésitation, aucun bouton < 44 px, aucune fenêtre
non sollicitée, aucune erreur console, attente < 1 s une fois la carte affichée.

Process de commande mené de bout en bout dans les deux cas :
- **réservation directe** depuis l'aperçu de la carte (créneau → Commande validée → présence → changement de réponse →
  message → annulation depuis le chat) ;
- **demande publiée** « QA ergo3 — ménage 2 h » → tarif du pro → acceptation client avec RDV → « absent » → Je pars →
  démarche client absent → confirmation client (bandeau) → demande du code de fin → code envoyé (bandeau) → clôture →
  facture → avis → litige.

**Zéro erreur console ou réseau** sur toutes les sessions (8 scripts, client et pro). Aucune fenêtre non sollicitée relevée
(plus d'encart « Où êtes-vous ? », plus de bandeau d'installation, plus de fenêtre de paiement, plus de `confirm()` pour
accepter une proposition).

## Tableau

| Tâche | Appuis 19/11 matin | Appuis maintenant (+ saisies) | Attente | Note /10 | Ce qui empêche 10 |
|---|---|---|---|---|---|
| **Client** — se connecter | 1 + 2 | 1 + 2 | liste de la carte 0,8-1,7 s | 9 | Liste parfois > 1 s (1,7 s au 2e passage) ; plus aucun encart de position |
| Trouver un pro de ménage et voir sa fiche | 3 | 3 (puce, ligne, Voir le profil et les avis) | appuis 0,6 s ; fiche 0,6-1,8 s (1,6 s à froid) | 8 | Épingles 30×30 ; la 1re ligne de la liste est sous la barre du bas (défilement) ; fiche > 1 s à froid |
| Réserver | 5 (fiche) / 8 (carte) | **4 depuis la carte** (ligne ou épingle, Réserver · 100 €, heure, Confirmer · 108 €) ; 3 depuis la fiche ; **+1 le soir** (jour) | 0,3-0,7 s | 9 | Le soir, « Auj. » reste présélectionné alors que tous ses créneaux sont passés : un appui « jour » de plus ; épingle 30×30 / ligne sous la barre |
| Déposer une demande | 3 + 1 | 3 + 1 (Déposer, Ménage, Publier) | 0,9 s | 9 | « Déposer une demande » 210×43 sur la carte ; formulaire encore long (2 350 px) mais Publier collant |
| Comparer et accepter une proposition (+ RDV) | 4 + 3 = 7 | **6** (Agenda, Mes demandes, Accepter ce prestataire, jour, heure, Confirmer · 100 €) | Mes demandes 3,5-4,3 s | 7 | Liste Mes demandes lente ; RDV pas prérempli quand la demande n'a pas de date ; « Confirmer · 100 € » sous le pli (défilement). Plus de `confirm()` natif |
| Demande fermée après l'accord | défaut | **corrigé côté client** : demande passée `matched` à l'acceptation client, disparue de « Demandes autour de vous » (ni QA ergo3 ni QA ergo2 listées) | — | 9 | Acceptation **par le pro** d'une contre-offre : 051 non appliquée (RPC `match_request_on_accept` absente, PGRST202), la demande resterait ouverte (code lu, non cliqué) |
| Répondre « sur place / absent » | 1 (après résa) ; changer 2 | 1 ; **changer : 1** (l'autre choix reste affiché) | 0,5 s | 10 | — |
| Client absent : confirmer l'arrivée | 2 | 2 (bandeau « Votre prestataire est arrivé : confirmez » → Je confirme) | 0,6 s | 10 | — (bandeau sur la carte, au-dessus de la barre) |
| Client : envoyer son code de fin | 2 | 2 (bandeau « Votre prestataire demande votre code de fin » → Envoyer) | 0,6 s | 10 | — |
| Écrire au prestataire | 3 + 1 | 3 + 1 | liste 0,2-0,45 s | 10 | — (titre et date de mission sous chaque nom, chat à 44 px) |
| Annuler une réservation (chat) | non mesuré | 2 (… → Annuler cette réservation) + `confirm()` natif | 0,5 s | 7 | Confirmation par `window.confirm()` natif |
| Retrouver sa facture | 3 | 3 (Agenda, Factures, facture) | 0,2-0,6 s chaude ; **2,4 s à froid** | 8 | Facture ouverte par lien direct : 2,4 s |
| Laisser un avis | 7 + 1 | **5 + 1** (Agenda, Terminées, Noter, ★, Publier mon avis) | 0,5 s | 9 | 5 appuis ; la bonne mission est en tête de Terminées ; étoiles 44 px ; rien ne propose « Noter » depuis la carte après la fin |
| Ouvrir un litige | 5 + 1 | 5 + 1 (Agenda, Terminées, Signaler un problème, motif, Ouvrir le litige) | 0,5 s | 9 | « Retour » du volet 40×19 |
| **Pro** — se connecter | 1 + 2 · Mon entreprise 2,3-2,8 s | 1 + 2 · **atterrit sur la carte des demandes** | demandes affichées 3,6-4,0 s | 7 | Liste des demandes « 0 demande » pendant ~3,5 s puis remplie |
| Voir les demandes autour de soi | 1 | **0** (atterrissage) | 3,6-3,9 s | 7 | Même attente ; épingles 30×30 ; bulle de commentaire posée sur la carte (y = 313) |
| Répondre à une demande avec un tarif | 3 + 0 | 3 + 0 (demande, Proposer mon tarif, Envoyer ; 100 € prérempli) | 0,6 s | 8 | Chat : réponses rapides 34 px, « Modifier ma proposition » 284×39 |
| Accepter une réservation | 2 (rien à accepter) | 2 (rien à accepter) | Messages 0,2 s | 8 | Réservation confirmée d'office, pas d'« Accepter / Refuser » (décision produit à trancher) |
| Mission du jour + « Je pars » | 1 + 3 | 1 + 3 (Mission, Je pars, 10 min, Prévenir le client) | 0,5 s | 8 | Durées 104×43 ; onglet Mission absent de la carte pro pour un RDV à 00 h 05 vu à 23 h 59 (fenêtre « même jour ») |
| Pro : démarche client absent | 5 (4 si absent) | **4** (Partager ma position, photo ×2, Envoyer la photo collant) | 0,5 s | 10 | — |
| Pro : code de fin | 3 + 1 + 1 | 2 pour demander (Mission, Demander le code de fin) puis Mission + saisie + Clôturer collant | 0,5 s | 8 | En rouvrant l'écran après réception du code, le champ « 000000 » est **sous la barre du bas** (y = 813) ; aucun bandeau « code reçu » vu sur la carte pro |
| Arrivée / fin sur place (QR) | 2 / 1 | non remesuré (pas de changement de code) | — | 9 | — |
| Ajouter une prestation (Mes tarifs) | 5 + 2 | 5 + 2 (Entreprise, Mes tarifs, Ajouter, Autre, Enregistrer collant) | Mon entreprise 0,25 s chaude, 1,8 s froide | 9 | 5 appuis ; Mon entreprise à froid 1,8 s ; aucune cible < 44 px |
| Déposer une pièce | 4 | 4 (Entreprise, Mes pièces en raccourci, Fichier, choix) | 0,5 s | 10 | — |
| Retrouver ses revenus | 2 | 2 (raccourci en haut) | 1,1-1,2 s froide, 0,2 s chaude | 9 | Revenus à froid > 1 s |
| Agenda pro | 1 | 1 | 0,2-0,7 s | 8 | Calendrier : Précédent/Suivant 38×32, Aujourd'hui 94×32, Jour/Semaine/Mois 31 px |
| Passer en espace client et revenir | 2 | 2 | 0,6 s | 10 | — (boutons 44 px, aucun bandeau) |

**Progrès depuis ce matin** : 9 tâches à 10 (aucune ce matin) ; réserver depuis la carte 8 → 4 ; accepter + RDV 7 → 6 ;
avis 7 → 5 ; changer sa présence 2 → 1 ; démarche absent 5 → 4 ; pro atterrit sur les demandes ; zéro fenêtre non
sollicitée ; Messages, agenda, Mon entreprise et revenus < 1 s une fois en cache ; bandeaux d'action client sur la carte.

**Pas encore 10** : deux écrans lents (carte des demandes pro 3,6-4 s, Mes demandes client 3,5-4,3 s), quelques
cibles < 44 px résiduelles (épingles, durées « Je pars », calendrier, réponses rapides, Retour du litige), un `confirm()`
natif (annulation), le champ du code de fin sous la barre, et 051 à appliquer.

## Cibles < 44 px restantes
Épingles de carte 30×30 (client et pro) ; « Déposer une demande » 210×43 (carte) ; « Je pars » : durées 104×43 ;
calendrier : Précédent/Suivant 38×32, Aujourd'hui 94×32, Jour/Semaine/Mois 31 px ; chat pro : réponses rapides 34 px,
« Modifier ma proposition » 284×39 ; volet litige : « Retour » 40×19.

## Défauts trouvés en route
1. **Fenêtre « même jour » de la Mission du jour** (`src/lib/todayMission.ts`, `isTodayMission`) : un RDV à 00 h 05 n'est
   pas « du jour » à 23 h 59 (condition `sameDay`), l'onglet Mission manque jusqu'à l'heure du RDV.
2. **Champ du code de fin masqué** : écran Mission du jour pro, après réception du code, `input[placeholder=000000]` à
   y = 813 sous la barre du bas (le bouton « Clôturer » collant, lui, est visible).
3. **051 non appliquée** : `match_request_on_accept` introuvable (PGRST202). L'acceptation client ferme bien la demande
   sans 051 (constaté : `matched`) ; l'acceptation pro d'une contre-offre ne la fermera qu'avec 051.

## Dernières corrections pour 10 partout

| # | Fichier | Changement |
|---|---|---|
| 1 | `src/app/pro/carte/page.tsx` | Afficher la dernière liste connue (`src/lib/screenCache.ts`) dès l'ouverture et lancer `requests_nearby` en premier, en parallèle du reste (disponibilité, interventions) : 3,6-4 s → < 1 s |
| 2 | `src/app/client/demandes/page.tsx` | Même cache + requêtes parallèles (demandes, transactions, offres, noms en une vague) : 3,5-4,3 s → < 1 s |
| 3 | `src/components/TabPrefetch.tsx`, `src/app/mission/[id]/facture/page.tsx`, `src/app/pro/dashboard/page.tsx`, `src/app/pro/revenus/page.tsx` | Précharger Mon entreprise/Revenus côté pro et mettre la facture en cache par mission : 1,1-2,4 s à froid → < 1 s |
| 4 | `src/components/DayTimePicker.tsx` (+ grille de `src/app/mission/new/page.tsx`) | Présélectionner le premier jour qui a encore un créneau (pas « Auj. » quand tout est passé) ; dans Mes demandes, présélectionner aussi le 1er créneau libre pour que « Confirmer » soit actif d'emblée |
| 5 | `src/app/client/demandes/page.tsx` | Bouton « Confirmer · prix » collant au-dessus de la barre du bas (comme `mission/new`) : plus de défilement |
| 6 | `src/app/mission/[id]/chat/page.tsx` (l. ~450) | Remplacer `confirm(confirmMsg)` par une confirmation dans le menu « … » (« Confirmer l'annulation » / « Garder ») ; idem l. ~341 (prix > 2× la référence) |
| 7 | `src/lib/todayMission.ts` | `isTodayMission` : fenêtre glissante `diff <= 2 h` sans condition `sameDay` |
| 8 | `src/app/mission/[id]/jour/page.tsx` / `src/components/presence/AbsentProcess.tsx` | Champ du code de fin dans la zone collante, juste au-dessus de « Clôturer » (ou défilement automatique vers lui) ; bandeau « Code de fin reçu : clôturez » sur la carte pro (`BottomTabBar`, action `fin` côté prestataire) |
| 9 | `src/components/DepartureBar.tsx` / `src/app/mission/[id]/jour/page.tsx` | Durées « 5 … 45 min » à `minHeight: 44` |
| 10 | `src/components/calendar/Calendar.tsx` | Précédent/Suivant/Aujourd'hui et Jour/Semaine/Mois à 44 px de haut |
| 11 | `src/app/mission/[id]/chat/page.tsx` | Réponses rapides et « Modifier ma proposition » à `minHeight: 44` ; « Retour » du volet litige (l. 894 et 915) à `minHeight: 44` |
| 12 | `src/components/LiveMap.tsx`, `src/components/DemoShell.tsx` | Zone tactile des épingles 44 px (icône inchangée) ; « Déposer une demande » à 44 px ; liste repliée assez haute pour que la 1re ligne ne passe pas sous la barre |
| 13 | `supabase/a_coller/051_demande_fermee_a_l_accord.sql` | À coller dans Supabase (ferme la demande quand le pro accepte une contre-offre) |
| 14 | `src/components/BottomTabBar.tsx` (bandeau d'action client) | Après la fin, bandeau « Notez Audit P. » qui ouvre `chat?avis` : avis 5 → 3 appuis |
| 15 | décision Romain | Réservation reçue : garder la confirmation d'office ou ajouter « Accepter / Refuser » (vague 1 de l'audit démo du 28/10) |

## Données créées pendant la mesure
- Annulées / supprimées : réservation 3843cf76 (21/11) annulée depuis le chat ; prestation « QA ergo3 prestation »
  supprimée ; message « QA ergo3 : bonjour » (sur 3843cf76, annulée).
- **Restent** (comptes audit uniquement, non annulables depuis l'app ni par l'API des comptes) : demande « QA ergo3 —
  ménage 2 h » (540c3563, `matched`) et sa mission ef9d07aa terminée (100 €, 3 factures, preuves client absent + code de
  fin) ; avis 5f26c4c8 (5★, « QA ergo3 : test ») ; litige 9ab46fb6 **ouvert** (la RLS refuse désormais sa clôture par le
  client : à clore depuis l'admin ou en SQL).
