# Audit GPS et hors connexion (23/11/2026, avant les premiers testeurs)
Méthode : lecture du code (dépôt, tête locale e7482eb ; commit réellement en production : non vérifié aujourd'hui, dernier relevé 9b4ffc5 le 21/11) et essais Playwright (Chromium, écran 390 x 844, géolocalisation et coupure réseau simulées) sur https://nexto-eta.vercel.app avec les comptes audit `.invalid`. Aucune modification de code. Aucun téléphone réel : ce qui en dépend est marqué « non vérifié ».
Données créées (toutes « QA hors-ligne 23-11 », à nettoyer avec l'accord de Romain) : missions 964e1abc-74a1-4928-bb32-93c64df33885 (arrivée envoyée, non confirmée), 2ceadfb1-b0ee-4b0f-9aa1-e8b8037558de (terminée, 2 messages « QA hors-ligne 23-11 message 2 » en doublon voulu), aaeaf280-767a-41d5-b30f-ab7a6eef5f5f (en route), 16022a49-2314-4a44-9312-0fb9bd61787c (conversation de devis), réservation acceptée sur la 1re. Photos de test dans le bucket `presence-photos` : 3 sous 964e1abc, 2 sous 2ceadfb1 (dont 3 orphelines, jamais rattachées à un message). Consentement « position d'intervention » du compte pro : accordé puis retiré (état initial rétabli), zone arrêtée.

## 1. Réponse courte aux trois questions de Romain
1. GPS opératif ? Oui quand la permission est accordée et la page en HTTPS (HTTP est redirigé en 308 vers HTTPS, vérifié). Distance comparée par le serveur : 300 m + marge de précision plafonnée à 100 m. Essais : bonne position acceptée, Nice refusée, refus de permission signalé.
2. Plus de connexion ? Rien n'est enregistré, rien n'est renvoyé tout seul. Le message dit « vérifiez votre connexion » (sauf plusieurs écrans qui affichent « Failed to fetch » brut). Pire : l'écran « Mission du jour » (celui de l'arrivée) affiche « Mission introuvable pour ce compte » en moins de 5 s de coupure et ne revient pas seul : la position et la photo en cours sont perdues.
3. Donnée enregistrée au préalable ? Non. Position, photo, durée d'arrivée choisie, texte du message, brouillon d'annonce, devis en cours ne vivent que dans la mémoire de la page. Aucune infrastructure hors ligne : pas de service worker (`serviceWorker` absent de src/ et public/), pas d'IndexedDB, caches vides (relevé navigateur : 0 service worker, 0 base, 0 cache). Seuls `localStorage` (mode, choix de ville `ping_loc`, brouillon d'inscription pro) et `sessionStorage` (`ping_sc_*`, copie de lecture 30 min) existent. Ce qui est enregistré d'avance : l'adresse et ses coordonnées de la mission (à la prise de rendez-vous), donc la comparaison de distance n'a pas besoin du réseau côté téléphone mais côté serveur oui.

## 2. Qui décide de l'heure
- Arrivée et fin validées : le SERVEUR (`now()` dans `_presence_apply`, 038 et 048 ; `arrived_at` = heure d'envoi de la demande, `requested_at`). Essai : photo choisie à 09:03:36 UTC, envoyée à 09:04:28 ; message au client « Photo d'arrivée du prestataire, 10:04 » (heure de Paris) = heure d'envoi, pas de prise de vue. L'écran du pro écrit « Photo prise à hh:mm » alors que c'est l'heure d'envoi.
- « Je pars » : le TÉLÉPHONE (`new Date().toISOString()` dans DepartureBar ; relevé en base avec millisecondes, ex. 08:55:34.085). Il sert au compte à rebours et à l'ordre des étapes, pas à la facture.
- Conséquence d'une coupure : l'heure enregistrée est celle du retour de connexion. Arrivée tardive : durée facturée plus courte (le prestataire y perd, `_presence_window` ne signale que > 3 h de retard). Fin tardive : durée plus longue, le client paie plus (heure entamée, dépassement du forfait) : risque de litige. La confirmation d'arrivée par le client expire 3 h après l'envoi (fin : 48 h) ; un envoi différé tombe dans cette fenêtre.

## 3. Endroits où l'application lit la position
| Endroit (code) | Permission | Refus / indisponible | Précision, délai |
|---|---|---|---|
| Arrivée client absent : `getPositionOnce` (presence.ts) dans AbsentProcess et RemotePresence | Après consentement et clic « partager ma position » | Même message pour refus, délai et position indisponible : « Position indisponible : autorisez la localisation… » (essais T1, T2) | Haute précision, délai 10 s, aucun repli ; précision affichée « ± x m » ; AUCUN seuil de précision refusé |
| Distance : `judgeProximity` (arrival.ts) via /api/arrival | idem | Distance > 300 m + min(précision, 100 m) : refus « position éloignée » (422, essais Nice, 1 km avec précision 5000 m) ; 380 m avec précision 150 m : acceptée (378 m affichée) | Adresse sans coordonnées : géocodage serveur (Nominatim) ; sans résultat : « non vérifiable », arrivée possible |
| Base (038/048) | Reçoit lat, lng, distance et statut calculés par la route | Lecture de code : la base ne recalcule pas la distance (`p_geo_status` fourni par l'appelant) ; la fenêtre horaire est seule vérifiée. Non testé : appel direct de la RPC | Position déclarative, falsifiable (fausse position) |
| Zone « Je suis en intervention ici » (LiveZoneCard, liveZone.ts `devicePosition`) | Consentement puis lecture unique | Refus : message « Position refusée ou indisponible… », mais le consentement reste enregistré (essai Z1) | Basse précision, délai 12 s, cache 60 s ; aucune vérification de vraisemblance (Nice acceptée, précision 3000 m) ; la base arrondit à une grille de 0,018 degré (~2 km) |
| Carte client/pro (location.ts `readPositionOnce`, LocationAsk, carteLoaders, proNearby) | Seulement si déjà accordée ou après encart explicatif | Repli sur ville choisie ou adresse du profil (lecture de code, non rejoué) | Délai 5 à 8 s |
| « Je pars » (DepartureBar) | Aucune : pas de GPS, distance entre adresse du profil du pro et adresse du RDV | sans objet | ETA minimale calculée depuis des coordonnées déjà en base |
| Scan QR / code | Aucune position lue. `getOneShotPosition` (geo.ts) n'est appelée nulle part (code mort, son commentaire annonce à tort une position au scan) | sans objet | sans objet |
| Géocodage d'adresse (geocode.ts, Nominatim public) : annonce, RDV, onboarding, /api/arrival | Aucune | Échec = null (voir §5 annonce) | Service public à débit limité : risque au lancement, non vérifié |
- HTTP simple : l'API de géolocalisation exige HTTPS (documentation MDN) ; la production redirige HTTP vers HTTPS (308 relevé). Un test hors HTTPS : sans objet.
- iPhone Safari et Chrome Android : NON VÉRIFIÉ (pas d'appareil). Ce que le code garantit : mêmes appels et mêmes messages. Ce que la documentation indique sans preuve ici : invite par site, refus mémorisé, GPS intérieur lent. Le refus et le délai sont indiscernables pour l'utilisateur, donc l'aide ne dit pas où réactiver la localisation.

## 4. Résultats des essais Playwright (production)
| Essai | Résultat observé |
|---|---|
| T1 permission refusée | Message « Position indisponible : autorisez la localisation… », rien envoyé |
| T2 permission accordée, aucune position | Même message après 10 s (13 s mesurées) |
| T3 position à Nice | Relevée (± 15 m), photo ENVOYÉE au stockage, puis « position éloignée » ; photo orpheline |
| T4 1 km, précision 5000 m | Refusée (marge plafonnée à 100 m) ; 2e photo orpheline |
| T4b 380 m, précision 150 m | Acceptée, arrivée envoyée au client |
| Z1 zone, permission refusée | Message d'erreur ; consentement quand même enregistré |
| Z2 zone, Nice, précision 3000 m | Acceptée, secteur flouté, expire +12 h |
| Z3 zone, arrêt hors ligne | « TypeError: Failed to fetch » brut ; l'interrupteur reste actif : le pro reste visible (jusqu'à 12 h ou fin de mission) |
| Z4 zone, envoi coupé | « Failed to fetch » brut, zone non activée, consentement gardé |

## 5. Hors connexion : moment par moment
Gravité : H haute, M moyenne, B basse. « Gardée » = conservée côté téléphone ou serveur.
| Moment | Ce qui se passe hors connexion (essai sauf mention) | Gardée | Risque | Gravité |
|---|---|---|---|---|
| Écran « Mission du jour » ouvert, coupure de 5 s ou plus | « Mission introuvable pour ce compte » (le code traite l'échec de lecture comme « absent », `setMissing(true)` jamais remis à faux) ; position, photo et choix perdus ; pas de retour seul | Non | Prestataire : preuve perdue sur le palier ; litige : arrivée tardive | H |
| Envoi photo + position (clic hors ligne) | « Photo non envoyée : vérifiez votre connexion et réessayez » ; photo et position restent à l'écran tant que la page n'est pas démontée (< 5 s) | Mémoire seulement | Client : prévenu tard ; facture : arrivée tardive | H |
| Retour de connexion après envoi raté | Aucun renvoi automatique ; la page a changé (ligne 1) : il faut tout refaire (photo, position) ; l'heure devient celle du nouvel envoi | Non | Facture plus courte, contestation | H |
| Photo envoyée, appel /api/arrival coupé | « Réseau indisponible, réessayez » ; photo déjà au stockage ; nouvel essai = 2e photo ; 1 orpheline (relevé : 2 photos pour 1 message) | Photo orpheline (stockage) | Fichiers de personnes inutiles ; réponse perdue après traitement : non vérifié | M |
| « Je pars » | Modale fermée, « Départ non enregistré — vérifiez votre connexion » ; ETA choisi perdu ; aucun renvoi. Sans départ, l'arrivée est refusée (409) | Non | Client : pas de compte à rebours | B |
| Scan du code d'arrivée (sur place) | « Failed to fetch » brut, champ du code vidé, mission inchangée | Non | Prestataire : retape le code | M |
| Scan QR de fin (`/scan/complete`) | La page ne s'ouvre pas (ERR_INTERNET_DISCONNECTED), pas de service worker, page d'erreur du navigateur ; rien d'enregistré | Non | Fin tardive : durée plus longue, client facturé plus | H |
| Fin client absent : demande ou saisie du code | « Failed to fetch » brut ; code gardé dans le champ tant que la page vit ; mission inchangée ; fin = heure du retour | Mémoire seulement | Idem fin tardive | H |
| Message du chat | Bandeau « Message non envoyé… » 4 s, texte gardé dans le champ (mémoire), pas de renvoi auto ; si le serveur a reçu mais la réponse est perdue : DOUBLON au renvoi (2 messages identiques relevés) | Mémoire | Client/prestataire : doublon ou oubli | M |
| « Accepter » une réservation | « Failed to fetch » brut, rien enregistré, bouton réutilisable, pas de renvoi auto ; délai de réponse 24 h ou 2 h inchangé | Non | Réservation expirée si pas revu | M |
| Proposer un tarif (devis) | « Proposition non envoyée — réessayez » 4 s, champs gardés en mémoire ; photo jointe : échec silencieux, l'envoi continue sans photo (lecture de code) | Mémoire | Prix : photo manquante | B |
| Annonce | Pas de brouillon (rechargement = champs vides) ; publier hors ligne : modale trompeuse « PING a besoin de sa position… » car le géocodage échoue | Non | Client perd sa saisie | M |
| Zone « en intervention ici » | voir §4 : arrêt impossible hors ligne | Non | Le pro reste visible | M |
| Connexion très lente ou en coupure en plein envoi | Aucun délai d'attente dans le code (pas d'annulation) : non rejoué | Non vérifié | Bouton bloqué possible | non vérifié |

## 6. Cinq corrections proposées, classées
1. (Additif, urgent) « Mission du jour » : ne jamais traiter une erreur réseau comme « introuvable » ; garder l'écran, afficher un bandeau « Pas de connexion, nouvelle tentative », réessayer seul. Tests avant : Playwright coupure 20 s avec photo choisie (page intacte, retour de connexion sans perte) ; /jour d'une vraie mission absente toujours « introuvable ». Retour arrière : annuler le commit.
2. (Décision de Romain : comportement existant) Conserver la preuve localement (photo, position, heure de prise en IndexedDB) et la renvoyer à la reconnexion ; message « Pas de connexion, votre preuve est gardée » ; envoyer l'heure de prise comme donnée en plus (colonne additive, migration rejouable à coller) et l'afficher à côté de l'heure de réception ; le serveur garde sa propre heure comme référence. Tests avant : envoi différé de 20 min (heure affichée des deux), double envoi (une seule arrivée), photo ni perdue ni doublée. Retour arrière : désactiver la file locale par variable, la colonne reste inoffensive.
3. (Additif) Messages : remplacer « Failed to fetch » par une phrase claire, séparer refus de permission, délai et position indisponible, expliquer où réactiver la localisation (iPhone, Android), bannière hors ligne globale, durée d'affichage des erreurs plus longue. Tests avant : captures de chaque écran d'erreur, absence de texte anglais.
4. (Additif) Position : essai haute précision puis repli basse précision avec `maximumAge`, bouton « réessayer », affichage de la précision ; ne pas téléverser la photo avant la vérification de distance (aucune photo orpheline sur refus). Tests avant : T1 à T4b rejoués, aucun fichier ajouté au stockage sur refus.
5. (Additif, plus large) Idempotence et reprise : identifiant de message unique contre le doublon du chat, « Arrêter » de la zone gardé en attente et durée serveur courte, brouillon d'annonce en `localStorage`, page de scan de fin ouverte en cache (service worker minimal) ; nettoyage des photos orphelines seulement avec accord écrit. Tests avant : doublon chat rejoué (1 message), annonce rechargée (champs conservés). Retour arrière : retirer le service worker (désinscription livrée avec lui).

## 7. Non prouvable sans téléphone réel
iPhone Safari et Chrome Android : invites de permission, mémorisation d'un refus, précision réelle à l'intérieur, suspension de la page en arrière-plan (perte possible des envois en cours), passage Wi-Fi vers 4G, appareil photo `capture`, lecture du QR par l'appareil photo, mode application installée. Autres non vérifiés : réponse perdue après traitement pour l'arrivée (seule la photo a été coupée avant la route), pages `/commande` et `/qrcodes` hors ligne, connexion très lente, limite d'usage de Nominatim sous charge, en-tête de production sur la géolocalisation (le navigateur de test l'a autorisée).
