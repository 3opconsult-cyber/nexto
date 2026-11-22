# Nouvelles animations courtes (22/11/2026)

Suite à l'audit (`docs/audit-animations-2026-11-22.md`) : trois vidéos verticales beaucoup plus courtes, une idée par écran, 4 mots de titre au plus, au moins 2,5 s de titre lisible, sous-titres = texte de la voix off, vitesse 1x, mêmes visuels, même logo, même conclusion. Fil conducteur de Romain (22/11/2026) respecté dans l'ordre : question, découverte en quelques clics, commande et paiement, arrivée, départ, notation, vérification, sécurité, services, inscription, « ils sont juste à côté ».

| Vidéo | Page | Durée | Plans | Voix (fichier à déposer) |
|---|---|---|---|---|
| A. « PING en 20 secondes » (teaser général) | `/animation-courte` | 20,0 s | 5 | `public/brand/files/voix-courte.mp3` |
| B. Vidéo client (« PING côté client, en bref ») | `/animation-courte-client` | 35,0 s | 8 | `public/brand/files/voix-courte-client.mp3` |
| C. Vidéo prestataire (« PING côté prestataire, en bref ») | `/animation-courte-prestataire` | 34,8 s | 8 | `public/brand/files/voix-courte-prestataire.mp3` |

## À lire d'abord : deux points à décider

1. **Séquestre (contradiction connue, A-TRANCHER d).** Comme dans les animations actuelles (décision de Romain du 03/11), le paiement est présenté « sous séquestre » (voix et sous-titres des plans « Prix validé » côté client, « Vous êtes payé » côté prestataire, et « Vous commandez » dans le teaser). Or le séquestre n'est PAS actif dans l'application : le paiement en ligne est éteint, le règlement se fait par virement sur facture. À réaligner avant tout lancement public : soit activer le séquestre, soit changer ces 3 phrases (« Prix validé d'avance, règlement par virement sur facture »). Les phrases concernées sont dans `brand/anim-courte/scenarios.py` (champ `v`), puis `python3 brand/anim-courte/build.py`.
2. **Services cités dans le fil conducteur.** Romain a écrit « ménage, repassage, nettoyage, fin de chantier, remise en état ». Le catalogue réel ne propose aujourd'hui que ménage, repassage et nettoyage (vitres en base, non proposé) ; les services sont extensibles par données (A-TRANCHER n). Je n'ai affiché que les trois services réels (titre du plan « carte » : « Ménage, repassage, nettoyage »). « Fin de chantier » et « remise en état » sont à ajouter seulement quand ils existent dans l'application : il suffira de changer le titre du plan et la voix.

## Règles tenues

- Une idée par écran ; titre de 4 mots au plus (contrôlé par `scenarios.py`, la fabrication échoue sinon) ; plan de 3,6 s au moins ; titre lisible au moins 2,5 s (mesuré, voir audit § 6).
- Voix off : vouvoiement, 2 à 2,6 mots par seconde, ne lit pas le titre, explique l'objectif et le bénéfice. Sous-titres : le texte de la voix, 2 lignes de 36 signes au plus, moins de 17 signes par seconde (contrôlé).
- Langage déclaratif : « pièces d'identité et assurance renseignées, contrôlées par PING » ; jamais « certifié », « garanti » ni « vérifié » pour un profil non validé. Pas d'emoji, aucune marque tierce.
- Scène finale identique à l'existante : logo, « PING, l'application de rencontre client-prestataire, en proximité · Côte d'Azur », QR (/l/ins côté client et teaser, /l/insp côté prestataire) et bouton « Je m'inscris » (deux boutons « Je suis client » / « Je suis prestataire » pour le teaser) sur la page web.
- Le téléphone dessiné garde ses petits textes d'interface (visuels réutilisés tels quels) : le message passe par le titre (20 à 24 px) et le sous-titre (14 px).

## A. « PING en 20 secondes » (teaser général) : 20,0 s

Page : `/animation-courte` ; voix : `voix-courte.mp3`. Le teaser général : la question, la carte, le prix et le paiement, l'arrivée et le départ, puis l'inscription. 20 secondes, vertical, sous-titré. La voix off se joue quand le fichier voix-courte.mp3 existe.

| Début-fin | Plan | Visuel (scènes existantes) | Titre à l'écran (mots) | Voix off et sous-titre | Mots voix / mots par s |
|---|---|---|---|---|---|
| 0,0 - 4,0 | Accroche | Fond navy, logo PING et écho radar (accroche d'origine) : Logo PING et son écho radar, la question « Juste à côté ? ». | Juste / à côté ? (3) | « PING. Et si c’était juste à côté ? » (voix de 0,3 s à 3,8 s) | 7 / 2,1 |
| 4,0 - 7,8 | La carte | Téléphone, scène d'origine 4,0 à 7,8 s du temps source (Les prestataires disponibles autour de vous, sur la carte.) | Ménage, repassage, / nettoyage (3) | « Découvrez votre futur prestataire en quelques clics. » (voix de 4,3 s à 7,5 s) | 7 / 2,2 |
| 7,8 - 11,4 | Vous commandez | Téléphone, scène d'origine 10,8 à 14,6 s du temps source (Le chat : le prix proposé puis validé, le rendez-vous fixé.) | Vous commandez (2) | « Prix validé, paiement sous séquestre. » (voix de 8,2 s à 11,2 s) | 5 / 1,7 |
| 11,4 - 15,6 | Arrivée, départ | Téléphone, scène d'origine 21,1 à 23,4 s du temps source (Le QR code à l'arrivée puis au départ.) | Arrivée, départ, / notation (3) | « Arrivée, départ, profils contrôlés : tout est tracé. » (voix de 11,8 s à 15,4 s) | 7 / 1,9 |
| 15,6 - 20,0 | Final | Scène finale d'origine : logo, phrase officielle, QR, bouton : Logo PING, « PING, l'application de rencontre client-prestataire, en proximité · Côte d'Azur », QR /l/ins et deux boutons (page web seulement). | (signature d'origine) (0) | « Client ou prestataire, ils sont juste à côté. » (voix de 16,1 s à 19,9 s) | 8 / 2,1 |

### Minutage seconde par seconde

| Seconde | Plan | Titre | Voix et sous-titre | Mouvement |
|---|---|---|---|---|
| 0-1 s | Accroche | titre en fondu | voix et sous-titre en cours | logo apparaît, rayonnement radar |
| 1-2 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 2-3 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 3-4 s | Accroche | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 4-5 s | La carte | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 5-6 s | La carte | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 6-7 s | La carte | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 7-8 s | La carte | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 7-8 s | Vous commandez | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 8-9 s | Vous commandez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 9-10 s | Vous commandez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 10-11 s | Vous commandez | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 11-12 s | Arrivée, départ | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 12-13 s | Arrivée, départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 13-14 s | Arrivée, départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 14-15 s | Arrivée, départ | titre en fondu | voix et sous-titre en cours | animation de l'écran d'origine |
| 15-16 s | Arrivée, départ | titre en fondu | silence | fondu vers le plan suivant |
| 15-16 s | Final | texte d'origine | voix et sous-titre en cours | logo, phrase officielle, QR |
| 16-17 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 17-18 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 18-19 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 19-20 s | Final | texte d'origine | voix et sous-titre en cours | animation de l'écran d'origine |

## B. Vidéo client (« PING côté client, en bref ») : 35,0 s

Page : `/animation-courte-client` ; voix : `voix-courte-client.mp3`. La vidéo courte à envoyer à un particulier : la question, la carte, le choix, les profils contrôlés, le prix et le paiement, le QR d'arrivée et de départ, la note, puis l'inscription. 34 secondes, vertical, sous-titré.

| Début-fin | Plan | Visuel (scènes existantes) | Titre à l'écran (mots) | Voix off et sous-titre | Mots voix / mots par s |
|---|---|---|---|---|---|
| 0,0 - 4,8 | Accroche | Fond navy, logo PING et écho radar (accroche d'origine) : Logo PING et son écho radar. | Prestataire / juste à côté ? (4) | « Et si ce que vous cherchez se trouvait juste à côté ? » (voix de 0,3 s à 4,5 s) | 11 / 2,6 |
| 4,8 - 9,0 | La carte | Téléphone, scène d'origine 4,0 à 7,8 s du temps source (Les prestataires disponibles autour de vous.) | Ménage, repassage, / nettoyage (3) | « Les prestataires disponibles près de chez vous. » (voix de 5,1 s à 8,8 s) | 7 / 1,9 |
| 9,0 - 12,6 | Vous choisissez | Téléphone, scène d'origine 27,4 à 30,9 s du temps source (Le service choisi, la fiche du prestataire, « Contacter ».) | Vous choisissez (2) | « Vous comparez les profils, puis vous choisissez. » (voix de 9,3 s à 12,3 s) | 7 / 2,3 |
| 12,6 - 17,2 | Profils contrôlés | Écran navy, pictogramme « shield » (écran d'argument d'origine) | Profils / contrôlés (2) | « Pièces d’identité et assurance renseignées, contrôlées par PING. » (voix de 12,9 s à 16,9 s) | 8 / 2,0 |
| 17,2 - 22,0 | Prix et paiement | Téléphone, scène d'origine 10,8 à 14,8 s du temps source (Le chat : prix validé ; paiement sous séquestre (à réaligner, A-TRANCHER d).) | Prix validé / d’avance (3) | « Le paiement reste sous séquestre jusqu’à la fin de la mission. » (voix de 17,6 s à 21,8 s) | 11 / 2,6 |
| 22,0 - 26,2 | Arrivée et départ | Téléphone, scène d'origine 21,1 à 23,4 s du temps source (Le QR code à l'arrivée et au départ.) | Arrivée et départ (3) | « Un QR code enregistre l’arrivée et le départ. » (voix de 22,4 s à 25,9 s) | 8 / 2,2 |
| 26,2 - 30,4 | Vous notez | Écran navy, pictogramme « star » (écran d'argument d'origine) | Vous notez (2) | « Après la mission, donnez votre avis en quelques clics. » (voix de 26,6 s à 30,1 s) | 9 / 2,5 |
| 30,4 - 35,0 | Final | Scène finale d'origine : logo, phrase officielle, QR, bouton : Logo PING, phrase finale, QR /l/ins et bouton « Je m'inscris » (page web seulement). | (signature d'origine) (0) | « Trouvez-les sur PING : ils sont juste à côté. » (voix de 30,9 s à 34,9 s) | 8 / 2,0 |

### Minutage seconde par seconde

| Seconde | Plan | Titre | Voix et sous-titre | Mouvement |
|---|---|---|---|---|
| 0-1 s | Accroche | titre en fondu | voix et sous-titre en cours | logo apparaît, rayonnement radar |
| 1-2 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 2-3 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 3-4 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 4-5 s | Accroche | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 4-5 s | La carte | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 5-6 s | La carte | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 6-7 s | La carte | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 7-8 s | La carte | titre en fondu | voix et sous-titre en cours | animation de l'écran d'origine |
| 8-9 s | La carte | titre en fondu | silence | fondu vers le plan suivant |
| 9-10 s | Vous choisissez | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 10-11 s | Vous choisissez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 11-12 s | Vous choisissez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 12-13 s | Vous choisissez | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 12-13 s | Profils contrôlés | titre en fondu | voix et sous-titre en cours | pictogramme, titre en deux temps |
| 13-14 s | Profils contrôlés | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 14-15 s | Profils contrôlés | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 15-16 s | Profils contrôlés | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 16-17 s | Profils contrôlés | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 17-18 s | Prix et paiement | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 18-19 s | Prix et paiement | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 19-20 s | Prix et paiement | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 20-21 s | Prix et paiement | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 21-22 s | Prix et paiement | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 22-23 s | Arrivée et départ | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 23-24 s | Arrivée et départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 24-25 s | Arrivée et départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 25-26 s | Arrivée et départ | titre en fondu | voix et sous-titre en cours | animation de l'écran d'origine |
| 26-27 s | Arrivée et départ | titre en fondu | silence | fondu vers le plan suivant |
| 26-27 s | Vous notez | titre en fondu | voix et sous-titre en cours | pictogramme, titre en deux temps |
| 27-28 s | Vous notez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 28-29 s | Vous notez | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 29-30 s | Vous notez | titre en fondu | voix et sous-titre en cours | animation de l'écran d'origine |
| 30-31 s | Vous notez | titre en fondu | silence | fondu vers le plan suivant |
| 30-31 s | Final | texte d'origine | voix et sous-titre en cours | logo, phrase officielle, QR |
| 31-32 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 32-33 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 33-34 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 34-35 s | Final | texte d'origine | voix et sous-titre en cours | animation de l'écran d'origine |

## C. Vidéo prestataire (« PING côté prestataire, en bref ») : 34,8 s

Page : `/animation-courte-prestataire` ; voix : `voix-courte-prestataire.mp3`. La vidéo courte à envoyer à un prestataire : la question, les demandes autour de vous, les tarifs, le bouton Disponible, les pièces, le QR, la facture et le paiement, puis l'inscription. 34 secondes, vertical, sous-titré.

| Début-fin | Plan | Visuel (scènes existantes) | Titre à l'écran (mots) | Voix off et sous-titre | Mots voix / mots par s |
|---|---|---|---|---|---|
| 0,0 - 4,8 | Accroche | Fond navy, logo PING et écho radar (accroche d'origine) : Logo PING et son écho radar. | Clients / juste à côté ? (4) | « Et si vos prochains clients se trouvaient juste à côté ? » (voix de 0,3 s à 4,5 s) | 10 / 2,4 |
| 4,8 - 9,2 | Demandes autour de vous | Téléphone, scène d'origine 8,2 à 10,8 s du temps source (La carte des demandes ouvertes, les urgentes en orange.) | Demandes / autour de vous (4) | « Les clients proches de vous vous écrivent directement. » (voix de 5,1 s à 8,9 s) | 8 / 2,1 |
| 9,2 - 13,2 | Vos tarifs | Téléphone, scène d'origine 35,0 à 38,8 s du temps source (Un prix par service : forfait, horaire, ou les deux.) | Vous fixez / vos tarifs (4) | « Forfait ou horaire, le prix est validé d’avance. » (voix de 9,5 s à 12,9 s) | 8 / 2,4 |
| 13,2 - 17,2 | Disponible | Téléphone, scène d'origine 41,5 à 45,5 s du temps source (Le bouton Disponible et l'écho radar.) | Passez / Disponible (2) | « Un bouton, et vous apparaissez sur la carte. » (voix de 13,5 s à 16,9 s) | 8 / 2,4 |
| 17,2 - 21,8 | Vos pièces | Écran navy, pictogramme « shield » (écran d'argument d'origine) | Ajoutez / vos pièces (3) | « Pièces d’identité et assurance renseignées, contrôlées par PING. » (voix de 17,6 s à 21,5 s) | 8 / 2,0 |
| 21,8 - 25,6 | Arrivée et départ | Téléphone, scène d'origine 21,1 à 23,4 s du temps source (Le scan du QR code du client.) | Vos heures / enregistrées (3) | « Un QR code enregistre l’arrivée et le départ. » (voix de 22,1 s à 25,3 s) | 8 / 2,5 |
| 25,6 - 30,0 | Vous êtes payé | Écran navy, pictogramme « lock » (écran d'argument d'origine) | Vous êtes payé (3) | « La facture se crée seule, paiement sous séquestre. » (voix de 25,9 s à 29,8 s) | 8 / 2,1 |
| 30,0 - 34,8 | Final | Scène finale d'origine : logo, phrase officielle, QR, bouton : Logo PING, phrase finale, QR /l/insp et bouton « Je m'inscris » (page web seulement). | (signature d'origine) (0) | « Prestataire, inscrivez-vous : vos clients sont juste à côté. » (voix de 30,5 s à 34,7 s) | 8 / 1,9 |

### Minutage seconde par seconde

| Seconde | Plan | Titre | Voix et sous-titre | Mouvement |
|---|---|---|---|---|
| 0-1 s | Accroche | titre en fondu | voix et sous-titre en cours | logo apparaît, rayonnement radar |
| 1-2 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 2-3 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 3-4 s | Accroche | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 4-5 s | Accroche | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 4-5 s | Demandes autour de vous | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 5-6 s | Demandes autour de vous | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 6-7 s | Demandes autour de vous | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 7-8 s | Demandes autour de vous | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 8-9 s | Demandes autour de vous | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 9-10 s | Vos tarifs | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 10-11 s | Vos tarifs | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 11-12 s | Vos tarifs | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 12-13 s | Vos tarifs | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 13-14 s | Disponible | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 14-15 s | Disponible | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 15-16 s | Disponible | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 16-17 s | Disponible | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 17-18 s | Vos pièces | titre en fondu | voix et sous-titre en cours | pictogramme, titre en deux temps |
| 18-19 s | Vos pièces | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 19-20 s | Vos pièces | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 20-21 s | Vos pièces | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 21-22 s | Vos pièces | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 21-22 s | Arrivée et départ | titre en fondu | voix et sous-titre en cours | téléphone et écran d'origine entrent |
| 22-23 s | Arrivée et départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 23-24 s | Arrivée et départ | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 24-25 s | Arrivée et départ | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 25-26 s | Vous êtes payé | titre en fondu | voix et sous-titre en cours | pictogramme, titre en deux temps |
| 26-27 s | Vous êtes payé | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 27-28 s | Vous êtes payé | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 28-29 s | Vous êtes payé | titre visible | voix + sous-titre | animation de l'écran d'origine |
| 29-30 s | Vous êtes payé | titre en fondu | voix et sous-titre en cours | fondu vers le plan suivant |
| 30-31 s | Final | texte d'origine | voix et sous-titre en cours | logo, phrase officielle, QR |
| 31-32 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 32-33 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 33-34 s | Final | texte d'origine | voix + sous-titre | animation de l'écran d'origine |
| 34-35 s | Final | texte d'origine | voix et sous-titre en cours | animation de l'écran d'origine |

## Fabrication (ce qui est dans le dépôt)

- Sources : `brand/anim-courte/scenarios.py` (textes, durées, plans : source unique), `parts/e_courte.js` (mise en scène), `build.py` (réutilise `brand/anim-presentation/parts/` : mêmes scènes dessinées, polices et logo ; lecteur partagé `brand/anim/player.*`). Régénérer : `python3 brand/anim-courte/build.py`.
- Pages : `public/animation-courte.html`, `animation-courte-client.html`, `animation-courte-prestataire.html` ; adresses `/animation-courte`, `/animation-courte-client`, `/animation-courte-prestataire` (rewrites et en-têtes no-cache dans `next.config.js`, comme les autres). Anciennes pages inchangées et toujours servies.
- Ajoutées à `/aide` (3 rubriques « en bref », `src/lib/aide.ts`) et à l'admin « Supports & visuels » (3 lignes « Nouveau (22/11) », aperçu et ouverture). Les anciennes restent accessibles.
- Sous-titres : `brand/anim-courte/voix/voix-courte*.srt` (minutage exact, pour un montage ou un enregistrement) ; transcription sous le lecteur ; `aria-label` = voix complète.
- Lecteur : vitesse 1x par défaut (option `speed` du lecteur partagé), voix jouée seulement si le fichier existe, sinon muet et sous-titré. Essai de la voix de l'appareil : `?voix=nav`. Pas de MP4 produit.

## Voix off : ce qui est faisable gratuitement (testé le 22/11/2026)

| Option | Résultat | Qualité | Réserves |
|---|---|---|---|
| 1. Dans ce bac à sable : espeak-ng | Non installable (paquet introuvable dans les dépôts accessibles) ; non testé. | Voix de type robot (qualité annoncée très faible pour un usage commercial, connaissance générale non revérifiée). | À écarter. |
| 1. Dans ce bac à sable : Piper (voix française « siwis », moyenne qualité) | **Installé et testé** : le paquet `piper-tts` s'installe, le modèle `fr_FR-siwis-medium` (63 Mo) se télécharge depuis Hugging Face ; les 21 phrases des 3 scénarios sont synthétisées en moins d'une minute, hors ligne, gratuitement. Un script (`brand/anim-courte/voix/fabriquer_voix_piper.py`) les cale sur le minutage et fabrique les 3 mp3 (essai fait hors dépôt). Durée des fichiers mesurée : au premier essai 18 phrases sur 21 tenaient dans leur fenêtre, les 3 autres dépassaient de 0,01 à 0,15 s ; après allongement de 5 plans (de 0,2 à 0,6 s), les 21 phrases tiennent (mesure de la durée, pas d'écoute). | **Non écoutée** (aucune écoute possible ici). Qualité annoncée : « medium », 22,05 kHz, une seule voix féminine ; voix neuronale généralement bien plus naturelle que espeak-ng, mais ton chaleureux et prononciation de « PING » **non vérifiés**. | Licence du jeu de données CC-BY 4.0 (fiche du modèle consultée le 22/11/2026) : citer l'auteur de la voix si publiée ; avis juridique de Romain à prendre. Aucun fichier audio n'est livré dans le dépôt : une voix synthétique ne se publie qu'après écoute humaine. |
| 2. API Web Speech du navigateur (repli) | Implémentée dans le lecteur, **désactivée par défaut** : `?voix=nav` ajoute un bouton « Son » qui lit chaque phrase à son instant. Test dans ce bac : la page charge sans erreur et le bouton apparaît ; **aucune voix française n'existe ici** (0 voix), donc la lecture elle-même est non vérifiée. | Variable selon l'appareil (voix du système : correcte sur iPhone récent et Android, médiocre sur d'autres). Calage approximatif (pas de synchronisation fine). | Convient pour une démonstration, pas pour diffuser. |
| 3. Enregistrement par un humain | Procédure ci-dessous. Les `.srt` donnent le minutage exact, le script est dans les tableaux ci-dessus. | La meilleure (ton chaleureux, prononciation de PING). Gratuit avec un téléphone et un coin calme. | Demande 20 à 30 minutes. |
| 4. Service externe | **Aucun service cité** : je n'en ai vérifié aucun (offres gratuites, conditions et prix à contrôler le jour de l'usage). | Non vérifié | Non vérifié |

### Procédure en 5 étapes pour obtenir la voix (Romain)

1. Ouvrir `/animation-courte-client?admin=1` (ou les deux autres) : la liste de gauche donne chaque scène ; les tableaux ci-dessus donnent la phrase de chaque plan. Les fichiers `brand/anim-courte/voix/*.srt` donnent le minutage exact.
2. Se faire enregistrer (ou s'enregistrer) avec l'application Dictaphone d'un téléphone, dans un endroit calme, en lisant UNE phrase à la fois, sourire dans la voix, vouvoiement, environ 2 mots par seconde. Une phrase par fichier de préférence : c'est plus simple à caler. Prononcer « PING » comme « pigne ».
3. Caler : dans un outil de montage gratuit (CapCut, DaVinci Resolve, Audacity), poser chaque phrase à l'instant « voix de ... s » du tableau ; exporter un seul mp3 de la durée de la vidéo (20, 35 ou 35 s). Variante sans montage : demander à Claude de lancer `fabriquer_voix_piper.py` pour un essai gratuit avec la voix de synthèse, puis écouter.
4. Nommer exactement `voix-courte.mp3`, `voix-courte-client.mp3`, `voix-courte-prestataire.mp3` et les ranger dans `public/brand/files/` du dépôt (ou les donner à Claude pour qu'il les y range).
5. Publier (poussée sur `main`) puis ouvrir la page : un bouton « Son activé » apparaît à côté de « Lecture ». Écouter une fois en entier avec les sous-titres ; en cas de décalage, redonner le fichier ou ajuster le montage. Sans fichier, la page reste muette et sous-titrée.

## Non vérifié

- Aucune écoute de voix ; aucune lecture par de vraies personnes ; rendu mobile réel (mesures faites dans Chromium 390 × 844) ; lecture audio sur iPhone (autoplay restreint : le son démarre après un toucher sur « Son » ou « Lecture ») ; voix de l'appareil (aucune voix française ici) ; MP4 non produits ; compatibilité du lecteur dans l'iframe de `/aide` (même code que les autres, non ouvert en production).
- Production : rien n'est publié (commits locaux sur la branche, pas de poussée).
