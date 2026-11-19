# Audit ergonomie mesuré — 19/11/2026 (remesure indépendante)

Production nexto-eta.vercel.app, déploiement du commit 17050fe vérifié en ligne avant la mesure (Vercel « READY ») :
plus aucun « 400 POST /rpc/presence_state » sur `/map` (compte client). Téléphone 390×844 tactile (Playwright,
`isMobile`, `hasTouch`), comptes audit client et pro. Même méthode et même grille que le 18/11 : appuis comptés
depuis l'écran d'accueil de chaque espace (carte pour le client, carte des demandes ou Mon entreprise pour le pro), avec
défilements, saisies, fenêtres non sollicitées, cibles < 44 px et erreurs console relevés à chaque appui.
Scripts : `scratchpad/e2e/ergo2/` (non versionnés).

**Grille 10/10** : action fréquente ≤ 3 appuis, réserver ≤ 6, aucune hésitation, aucun bouton < 44 px, aucune fenêtre
non sollicitée, aucune erreur console, attente < 1 s une fois la carte affichée.

Cette fois toutes les tâches ont été menées jusqu'au bout, y compris le process de commande complet en « client absent »
(une mission QA ergo2 de bout en bout : proposition → acceptation → RDV → présence → Je pars → démarche client absent →
confirmation client → code de fin → facture → avis → litige).

## Tableau

| Tâche | Appuis 18/11 | Appuis 19/11 (+ saisies) | Note /10 | Ce qui empêche 10 |
|---|---|---|---|---|
| **Client** — se connecter | 1 + 2 | 1 + 2 · carte utile 1,5 s | 8 | Encart « Où êtes-vous ? » encore affiché à l'ouverture sur un appareil neuf (alors que l'adresse du profil se géocode : la demande QA a été placée à Grasse) ; il masque le haut de la carte |
| Trouver un pro de ménage et voir sa fiche | 3 | 3 (puce ou « Afficher la liste », ligne, Voir le profil) | 7 | Fiche affichée en 1,9-2,9 s ; épingles 30×30, puces 40 px, « Fermer l'aperçu » 34×34, retour de la fiche 34×34 ; la 1re ligne de la liste est sous la barre du bas tant qu'on n'a pas tapé « Afficher la liste » |
| Réserver | 6 depuis la fiche (9 depuis la carte) | **5** depuis la fiche (**8** depuis la carte) | 7 | Fenêtre « Paiement par virement / J'ai compris, réserver » = 1 appui de plus ; « Confirmer la réservation » sous le pli (défilement) ; créneaux 83×42 ; pas de « Réserver » dans l'aperçu de la carte (passage obligé par la fiche) |
| Déposer une demande | 4 + 1 (6 si adresse non reconnue) | **3 + 1** (Déposer, Ménage, Publier) | 8 | Formulaire de 2 527 px, « Publier » sous le pli ; « ← Retour » 58×20, puces/durées 40 px, −/+ 40×40 ; le bandeau d'installation surgit juste après |
| Comparer et accepter une proposition | 5 + RDV | **4** (Agenda → Mes demandes → Accepter ce prestataire → confirmation) **+ 3** pour le RDV = 7 | 6 | Confirmation par `window.confirm()` natif ; RDV dans une 2e étape (jour, heure, « Confirmer le rendez-vous » recouvert par la barre du bas) ; créneaux 78×42. **Défaut** : la demande reste « open » après acceptation (et même après la fin de mission) : elle reste dans « Demandes autour de vous » des pros |
| Répondre « sur place / absent » | non mesuré | 1 juste après la réservation (écran Commande validée) ; 3 depuis la carte (Agenda → Répondre → choix) ; changer d'avis : 2 (« Modifier · paiement » → choix) | 7 | « Répondre » de l'agenda ouvre d'abord une mission fictive du 3/11 restée « pending » (mission passée en tête) ; libellé « Modifier · paiement » pour changer sa présence (hésitation) |
| Client absent : confirmer l'arrivée du pro | non mesuré | 2 (Mission du jour dans la barre → Je confirme) | 8 | Rien sur la carte n'annonce la photo reçue (pas de bandeau, la pastille Messages seule) ; retour 34×34 et « Comment ça marche » 126×19 sur l'écran Mission du jour |
| Client : envoyer son code de fin | non mesuré | 2 (Mission du jour → Envoyer mon code de fin) | 8 | Même écran (retour 34×34, liens 19 px) ; aucune annonce sur la carte quand le pro demande le code |
| Écrire au prestataire | 3 + 1 | 3 + 1 | 6 | Liste des messages : « Chargement… » 3,3 s ; toutes les conversations s'appellent « Audit P. » sans titre de mission ; dans le chat « Annuler cette réservation » 143×17, « Demander l'attestation d'assurance » 258×34, « Mes codes QR (arrivée et fin) » 170×18 ; bandeau d'installation par-dessus la liste |
| Retrouver sa facture | 2 (liste) | 2 (liste), 3 jusqu'au document | 7 | Page facture 2,3 s ; retour 30×30 ; onglets « Prestation / Frais de service » 35 px |
| Laisser un avis | non atteint | **7 + 1** (Agenda → Terminées → Noter → ★ × 2 → Oui → Publier) | 6 | Étoiles 31×30 ; « Noter » sous le pli ; Terminées commence par des missions annulées à venir ; 1er « Noter » pas toujours la dernière mission (a ouvert une mission du 18/11 au 1er essai) ; bouton « Encore 3 réponses à donner » au lieu de « Publier » tant qu'il manque une note (hésitation) |
| Ouvrir un litige | ≈ 5 + 1 (estimé) | **5 + 1** (Agenda → Terminées → Signaler un problème → catégorie → Ouvrir le litige) | 7 | Catégories 37 px de haut, « Retour » 40×19 ; le volet passe sous la barre de saisie du chat ; page litige : retour 31×32, liens 19 px |
| **Pro** — se connecter | 1 + 2 | 1 + 2 · Mon entreprise utile 2,3-2,8 s | 7 | Atterrit sur Mon entreprise et non sur les demandes ; attente > 1 s |
| Voir les demandes autour de soi | 1 | 1 (0,5 s) | 8 | Plus de fenêtre. Liste repliée : la 4e demande est sous la barre du bas ; une demande déjà acceptée et terminée y figure encore (défaut ci-dessus) ; « Toutes les demandes » 159×36, « Espace client » 110×38 |
| Répondre à une demande avec un tarif | 5 + 1 | **3 + 0** (demande → Proposer mon tarif → Envoyer la proposition ; montant prérempli) | 8 | Défilement pour atteindre la demande ; dans le chat, réponses rapides 34 px et « Annuler cette demande » 131×17 |
| Accepter une réservation | 2 (rien à accepter) | 2 (rien à accepter) | 6 | Liste Messages 3,3 s, conversations sans titre ; réservation confirmée d'office, aucun « Accepter / Refuser » |
| Mission du jour + « Je pars » | 1 (agenda) | 1 (onglet Mission, le jour J) + 3 (Je pars, 10 min, Prévenir le client) | 8 | Retour 34×34 ; « Itinéraire » 55×19, « Comment ça marche » 126×19 ; « 10 min » 104×43 |
| Pro : démarche client absent | non mesuré | **5** (Démarche client absent → Partager ma position → Prendre la photo → déclencher → Envoyer la photo) ; 4 si le client a répondu « absent » | 7 | « Envoyer la photo » sous le pli ; si le client a dit « sur place », la démarche est cachée derrière un lien « Le client n'est pas là ? » |
| Pro : code de fin | non mesuré | 3 pour demander (Mission → Fin à distance → Demander) + 1 saisie + 1 (Clôturer) | 7 | Le champ du code et « Clôturer » sont sous le pli (y = 839 et 895) ; 5 appuis au total en plus de l'attente du client |
| Arrivée / fin sur place (QR) | — | pro 2 (Mission → Scanner), client 1 (Mission du jour affiche le QR) — d'après les écrans relevés, scénario A rejoué le 19/11 par parcours.mjs | 9 | Retour 34×34 |
| Ajouter une prestation (Mes tarifs) | 4 + 2 | 5 + 2 (Entreprise → Mes tarifs → Ajouter → Autre → Enregistrer) | 7 | « Enregistrer » sous le pli ; puces 37 px ; champs 41-43 px ; « Masquer de ma fiche » 123×18 ; bandeau d'installation sur Mon entreprise |
| Déposer une pièce | 4 | 4 (Entreprise → Mes pièces → Fichier → choix) | 8 | Boutons désormais à 44 px. La rangée Mes pièces est sous le pli de Mon entreprise (défilement) |
| Retrouver ses revenus | 2 | 2 | 6 | « Chargement… » 3,1 s ; rangée sous le pli ; champ et « Enregistrer » 42 px sur la page |
| Agenda pro | 1 | 1 | 7 | « Chargement… » 2,4 s ; Précédent/Suivant 38×32, Jour/Semaine/Mois 31 px |
| Passer en espace client et revenir | 2 | 2 | 8 | « Espace client » 110×38 / « Espace prestataire » 147×38 ; le bandeau d'installation réapparaît des deux côtés |

**Progrès depuis le 18/11** : réserver 6 → 5 (fiche), déposer une demande 4+1 → 3+1, répondre à une demande 5+1 → 3+0,
accepter une proposition 5 → 4, avis et litige désormais atteignables depuis Terminées, Mes pièces à 44 px, fenêtre
de position plus bloquante, **zéro erreur console ou réseau** sur toutes les sessions mesurées (contre une dizaine de
404/400 par page le 18/11). Le process de commande (présence, client absent, code de fin) tient en 1 à 3 appuis par
étape et par partie.

**Pas encore 10** : aucune tâche n'atteint 10. Les trois blocages transversaux : attentes de 2 à 3,3 s sur les listes
(messages, agenda, revenus, facture, fiche, Mon entreprise), cibles < 44 px restantes (menu, retours, liens texte
d'annulation, étoiles, créneaux, puces), et deux fenêtres non sollicitées (bandeau d'installation, encart de position).

## Fenêtres non sollicitées (relevé)
- Encart « Où êtes-vous ? » sur `/map` (client) à la 1re ouverture et après certains rechargements ; non bloquant mais
  masque le haut de la carte. Le pro ne l'a plus.
- Bandeau « Installer le raccourci PING » après la 1re action réussie : il s'affiche ensuite sur **chaque** écran
  (Messages, Agenda, Mon entreprise, carte pro, bascule d'espace) tant qu'il n'est pas fermé ; boutons « Comment faire »
  89×32 et « C'est déjà installé » 199×32.
- Fenêtre « Paiement par virement — rien n'est débité » entre « Confirmer la réservation » et la réservation.
- `window.confirm()` natif pour accepter une proposition (Mes demandes).
- Bulle verte « Laisser un commentaire » 221×52 posée sur la fiche, le formulaire de demande et la carte pro.

## Attentes mesurées (après la carte)
Carte client : liste 1,5 s, 1re épingle 1,55 s après la connexion. Puis : fiche 1,9-2,9 s ; Messages 3,3 s ; Agenda
2,3-2,4 s ; facture 2,3 s ; Mon entreprise 2,3-2,8 s ; Revenus 3,1 s. Les appuis eux-mêmes répondent en 0,5-0,6 s.
JavaScript transféré sur `/map` : 539 Ko compressés (inchangé).

## Cibles < 44 px restantes
Menu 34×34 (toutes les pages) ; icône Messages de l'en-tête 38×38 ; « Devenir prestataire » 151×38, « Espace client »
110×38 ; épingles 30×30 ; zoom et recentrer 40×40 ; puces de service 40 px (carte, demande), 37 px (tarifs, litige) ;
« Fermer l'aperçu » 34×34 ; retours 34×34 (fiche, Mission du jour), 30×30 (facture), 31×32 (litige), « ← Retour » 58×20
(demande), « Retour » 40×19 (formulaire de litige) ; créneaux 83×42 / 78×42 ; chat : « Annuler cette réservation »
143×17, « Annuler (frais applicables) » 149×17, « Annuler cette demande » 131×17, « Mes codes QR (arrivée et fin) »
170×18, « Demander l'attestation d'assurance » 258×34, « Récapitulatif de la mission » 328×40, « Voir les factures »
328×38, réponses rapides et étiquettes d'avis client 34 px, étoiles 31×30, pourboires 82×40 ; Mission du jour :
« Itinéraire » 55×19, « Comment ça marche » 126×19, « Noter le client » 85×19, « Commission à virer à PING » 161×19 ;
Messages : « Trier par… » 29 px ; Agenda calendrier : Précédent/Suivant 38×32, Jour/Semaine/Mois 31 px ; Tarifs :
« Masquer de ma fiche » 123×18 ; Revenus : champ et « Enregistrer » 42 px ; bandeau d'installation 32 px.

## Défauts trouvés en route
1. **Demande acceptée jamais fermée** : `acceptOfferMessage` (`src/lib/offers.ts`) ne passe pas `requests.status` à
   `matched`. La demande QA ergo2 est restée « open » après l'acceptation puis la fin de mission, et visible des pros
   dans « Demandes autour de vous ».
2. **Agenda client, « En cours »** : une mission fictive du 3/11 encore « pending » (date passée) apparaît en tête avec
   « Répondre » ; le 1er « Répondre » ouvre donc la mauvaise mission (pendant la mesure, cela a posé « absent » sur
   cette mission fictive 452286d0 — la présence ne peut plus être remise à vide depuis l'API).
3. **Terminées** : tri qui met les missions annulées à venir en tête ; le 1er « Noter » n'est pas forcément la dernière
   mission terminée.

## Corrections pour atteindre 10 partout

| # | Fichier | Changement | Gain |
|---|---|---|---|
| 1 | `src/lib/offers.ts` (+ `src/app/client/demandes/page.tsx`, chat) | À l'acceptation, passer la demande liée en `matched` (ou via RPC SECURITY DEFINER si la RLS l'empêche) | Plus de demande fantôme côté pro (hésitation, réponses perdues) |
| 2 | `src/app/client/demandes/page.tsx` | Remplacer `confirm()` par une confirmation dans la carte (« Accepter à 90 € ? » + bouton) **et** y joindre le choix du créneau (jour + heure) pour que l'acceptation fixe aussi le RDV | Accepter + RDV : 7 → 4 appuis, plus de fenêtre native |
| 3 | `src/app/messages/page.tsx`, `src/app/agenda/page.tsx`, `src/app/pro/revenus/page.tsx`, `src/app/pro/dashboard/page.tsx`, `src/app/mission/[id]/facture/page.tsx`, `src/app/pro/[id]/page.tsx` | Une seule requête par écran (RPC qui renvoie liste + contrepartie + non-lus + titre) au lieu de requêtes en chaîne ; afficher la dernière liste connue (sessionStorage) pendant le rechargement ; précharger Messages/Agenda depuis la barre du bas (`router.prefetch`) | Attente 2-3,3 s → < 1 s sur 7 écrans |
| 4 | `src/components/NavDrawer.tsx` (bouton Menu), en-têtes des pages (`DemoShell.tsx`, `pro/[id]`, `mission/[id]/jour`, `mission/[id]/facture`, `litiges/[id]`, `client/demandes/new`) | Menu, retours et icône Messages de l'en-tête à 44×44 (zone tactile, l'icône peut rester petite) ; « ← Retour » en vrai bouton 44 px | Supprime ~10 cibles < 44 px présentes sur toutes les pages |
| 5 | `src/app/mission/[id]/chat/page.tsx` | « Annuler… », « Mes codes QR (arrivée et fin) », « Demander l'attestation d'assurance », « Voir les factures », « Récapitulatif de la mission », réponses rapides et étiquettes : `minHeight: 44` ; annulation regroupée dans un menu « … » de l'en-tête plutôt qu'un lien de 17 px | Plus d'appui raté ni d'annulation touchée par erreur |
| 6 | `src/components/ReviewModal.tsx`, `src/components/ClientReviewModal.tsx` | Étoiles 44×44 ; une seule note obligatoire (la 2e facultative) ou la 2e préremplie sur la 1re ; bouton toujours libellé « Publier mon avis » (grisé avec l'aide « il manque : … ») | Avis 7 → 5 appuis, plus d'hésitation |
| 7 | `src/app/agenda/page.tsx` | « En cours » : exclure ou reléguer les missions `pending` à date passée ; trier par date de RDV la plus proche. « Terminées » : missions effectuées les plus récentes d'abord, annulées en bas ; « Noter » et « Signaler un problème » sur la 1re ligne visible sans défiler | Avis et litige : 1 défilement en moins, plus de mauvaise mission ouverte |
| 8 | `src/components/InstallPrompt.tsx` | Afficher le bandeau une seule fois (après la 1re action réussie), le masquer définitivement dès qu'il a été vu 2 fois ou qu'on change d'écran, et jamais sur Messages, Agenda, Mon entreprise ; boutons à 44 px | Plus de fenêtre non sollicitée sur 5 écrans |
| 9 | `src/components/LocationAsk.tsx`, `src/lib/location.ts` | Côté client, utiliser l'adresse du profil géocodée (comme pour la demande) ou la dernière position connue ; ne montrer l'encart qu'au tap sur « Recentrer » | Plus de fenêtre au démarrage de la carte |
| 10 | `src/app/mission/new/page.tsx`, `src/components/PaymentPendingModal.tsx` | Remplacer la fenêtre « Paiement par virement » par une ligne d'information au-dessus du bouton ; bouton « Confirmer la réservation » collant au-dessus de la barre du bas ; créneaux à 44 px | Réserver 5 → 4 depuis la fiche, 8 → 7 depuis la carte |
| 11 | `src/components/MapSheet.tsx` (aperçu de la carte), `src/app/map/*` | Ajouter « Réserver · 100 € » dans l'aperçu (à côté de Contacter) ; « Fermer l'aperçu » 44 px ; zone tactile des épingles 44 px | Réserver depuis la carte 8 → 5 (cible ≤ 6 tenue) |
| 12 | `src/app/mission/[id]/chat/page.tsx` (billet), `src/components/presence/PresenceChoice.tsx` | Libellé « Changer ma réponse » (au lieu de « Modifier · paiement ») qui bascule sur place/absent sur place, sans passer par `/commande` | Changer sa présence 2 → 1, plus d'hésitation |
| 13 | `src/components/presence/AbsentProcess.tsx`, `src/app/mission/[id]/jour/page.tsx` | Bouton d'action principal collant en bas (« Envoyer la photo », « Clôturer avec le code de fin ») ; champ du code en haut de l'étape ; demande du code de fin proposée directement quand le client est déclaré absent (sans « Fin à distance ») ; liens « Itinéraire », « Comment ça marche », « Noter le client » à 44 px | Code de fin pro 5 → 3 appuis, plus de défilement |
| 14 | `src/components/BottomTabBar.tsx` / carte client | Pastille sur l'onglet Mission du jour quand une action du client est attendue (photo à confirmer, code de fin demandé) | Le client sait qu'il doit agir sans ouvrir Messages |
| 15 | `src/app/messages/page.tsx` | Titre ou service + date de la mission sous le nom de l'interlocuteur ; boutons de tri 44 px | Plus d'hésitation entre 20 « Audit P. » |
| 16 | `src/app/pro/dashboard/page.tsx` | Remonter « Mes pièces » et « Mes revenus » dans les raccourcis du haut (à côté de Ma fiche publique / Mes tarifs) ; après connexion pro, atterrir sur la carte des demandes | Pièces et revenus sans défilement ; demandes à 0 appui après connexion |
| 17 | `src/app/pro/tarifs/page.tsx`, `src/app/pro/carte/page.tsx` | « Enregistrer » collant ; puces et « Masquer de ma fiche » à 44 px ; « Toutes les demandes », « Espace client » à 44 px ; liste des demandes dépliée à mi-hauteur | Tarif 5+2 sans défilement ; demandes visibles sans défiler |
| 18 | `src/app/client/demandes/new/page.tsx` | « Publier mon annonce » collant au-dessus de la barre du bas ; puces/durées/−+ à 44 px ; sections avancées (foyer, linge, CESU) repliées | Formulaire sans défilement obligatoire |
| 19 | `src/components/FeedbackBubble.tsx` | Bulle repliée (52×52) par défaut, jamais dépliée sur une fiche, un formulaire ou la carte pro | Plus de recouvrement de contenu |
| 20 | `src/app/mission/[id]/chat/page.tsx` (formulaire de litige), `src/app/litiges/[id]/page.tsx` | Catégories à 44 px, « Retour » 44 px, volet au-dessus de la barre de saisie ; liens « Voir la mission / Factures » en boutons 44 px | Litige sans cible < 44 px |

Avec 1 à 20 appliqués : action fréquente ≤ 3 appuis partout sauf avis (5) et litige (5, saisie comprise), réserver 4-5,
aucune fenêtre non sollicitée, aucune cible < 44 px relevée, attente < 1 s si le point 3 tient ses promesses (à remesurer).

## Données créées pendant la mesure
- Annulées : réservation 7229bcb7 (21/11), demande « QA ergo2 — ménage 2 h » (f309c400) ; prestation « QA ergo2 prestation » supprimée.
- **Non annulables depuis l'app** (à nettoyer en SQL si besoin, comptes audit uniquement) : mission cab4b074 terminée
  (90 €, 3 factures, preuves client absent + code de fin) ; litige ce9d254f ouvert sur cette mission ; avis f54823c9
  (cab4b074) et 2414b231 (posé par erreur sur la mission audit 0670b243 du 18/11) ; message « QA ergo2 : bonjour » ;
  présence « absent » posée par erreur sur la mission **fictive** 452286d0 (3/11) — l'API refuse de la remettre à vide.
- Pièces : aucun fichier envoyé (mesure arrêtée au sélecteur de fichier).
