# Audit de qualité des animations PING (22/11/2026)

Demande de Romain (22/11/2026) : « les vidéos vont trop vite ». Audit chiffré fait comme par un auditeur indépendant : un humain doit pouvoir LIRE et COMPRENDRE chaque écran. Rien n'est inventé : tout ce qui suit est mesuré dans les pages publiées (`public/animation*.html`) ou dans leurs sources (`brand/anim*/`) ; ce qui n'a pas pu être mesuré est écrit « non vérifié ». Rédigé le 22/11/2026, sans accès à la base ni à la production.

## 1. Résultat en une table

| Animation | Durée actuelle (1x / 0,85x) | Durée nécessaire (même matière) | Scènes rouges (0,85x / 1x) | Verdict | Raison |
|---|---|---|---|---|---|
| Animation explicative `/animation` | 41,9 s / 49,3 s | 66,7 s | 6/11 / 7/11 | **ralentir** | 6 scènes sur 11 sous le seuil (7 en MP4). Les légendes de 2 lignes sont bonnes (5 à 10 mots, 3 à 4,8 s) ; ce sont les écrans « Un message, un tarif », « En toute confiance » (5 pastilles) et la signature qui vont trop vite. Contient aussi « bientôt » et « Crédit d'impôt immédiat » (avance immédiate éteinte) et une phrase finale différente de la signature officielle : à corriger avant tout nouvel usage. |
| Animation prestataires `/animation-pro` | 55,0 s / 64,7 s | 74,4 s | 6/14 / 9/14 | **ralentir** | 6 scènes sur 14 sous le seuil (9 en MP4), surtout les écrans de 1,8 à 2,4 s (« Une demande vous plaît ? », « Un scan à l'arrivée ») et la signature. Les légendes à 5 s sont bonnes. Rythme à corriger scène par scène, structure à garder. Le public prestataire n'a pas de vidéo courte équivalente pour « Mon entreprise » : la garder comme vidéo détaillée. |
| Je m'inscris `/animation-inscription` | 40,0 s / 47,1 s | 85,5 s | 15/15 / 15/15 | **refaire** | 15 scènes sur 15 sous le seuil, aucune scène à plus de 2,7 s pour 4 à 12 mots. Il faudrait 85 s pour la même matière (40 s aujourd'hui) : ce n'est plus une vidéo courte. Refaire en deux tutoriels (client, prestataire) de 8 à 10 écrans chacun, ou la remplacer par les écrans réels de l'inscription (l'inscription elle-même est déjà pas à pas). |
| PING pour les particuliers `/animation-client` | 34,7 s / 40,8 s | 67,7 s | 8/9 / 9/9 | **refaire** | 8 scènes sur 9 sous le seuil, dont 4 écrans « argument » de 1,6 à 2,1 s avec 13 à 21 mots en 9,9 px et des pastilles de 7,4 px. Remplacée par la vidéo courte client (/animation-courte-client), mêmes visuels. |
| PING pour les prestataires `/animation-prestataire` | 44,6 s / 52,5 s | 93,8 s | 11/12 / 12/12 | **refaire** | 11 scènes sur 12 sous le seuil ; 163 mots en 45 s ; il faudrait 94 s pour la même matière. Remplacée par la vidéo courte prestataire (/animation-courte-prestataire). |
| Tuto Après la commande `/animation-tuto` | 37,0 s / 43,5 s | 46,3 s | 2/8 / 5/8 | **ralentir** | Seulement 2 scènes sur 8 sous le seuil à 0,85x (5 en MP4) : l'écran « Exemple, au tarif horaire » (carte de 13 mots + 12 chaînes d'interface, 5,8 s à 1x) et la signature. Légendes de 5 à 9 mots, 3,5 à 5 s : bon format. À garder en ralentissant ces 2 écrans. |
| Tuto Vous ne serez pas là ? `/animation-tuto-absent` | 30,4 s / 35,8 s | 48,5 s | 7/9 / 9/9 | **ralentir** | 7 scènes sur 9 sous le seuil, mais de peu (légendes de 6 à 9 mots en 2,7 à 3,6 s, requis 3,4 à 4,6 s) ; la signature (18 mots en 1,6 s) est le vrai problème. Ajouter environ 0,8 s par écran et allonger la fin. |
| PING en 1 minute `/animation-ping (redirigée)` | 69,5 s / 81,8 s | 134,1 s | 14/14 / 14/14 | **supprimer (après accord)** | 14 scènes sur 14 sous le seuil, 234 mots en 70 s, il faudrait 134 s. Surtout : /animation-ping est déjà redirigée vers /animation-client (next.config.js), la page n'est donc plus atteignable, et /aide pointe encore dessus (rubrique « Agenda », ?scene=4) : le lien affiche en réalité la vidéo client, scène 4. À supprimer avec l'accord de Romain, après avoir repointé /aide. |

Lecture : « rouge » = le texte complet n'est pas affiché assez longtemps pour être lu (voir méthode). Les MP4 existants (`ping-animation.mp4`, `-pro`, `-inscription`, `-ping`) sont enregistrés à 1x (`#record` force la vitesse 1 : `brand/anim/record.js`, `player.js`) : ils sont donc PLUS rapides que les pages (0,85x par défaut). Les MP4 des animations client et prestataire n'existent pas.

Constat transversal, mesuré : sur l'ensemble des 8 animations, 1 005 mots de message en 353 s (page /animation-ping comprise) à 1x. La cause principale n'est pas la vitesse de défilement mais la **densité** : des écrans de 6 à 21 mots affichés 1,6 à 4 s, plus une interface dessinée dont la plupart des textes (6,5 à 10 px sur un lecteur de 345 px) ne sont pas lisibles sur téléphone.

## 2. Méthode et repères

**Mesure.** Chaque page est ouverte dans Chromium (Playwright) en 390 × 844 (lecteur de 345 px de large, soit 0,64 pixel écran par unité du dessin 540 × 960). Le temps est avancé de 0,1 s en 0,1 s avec `PING_ANIM.seek(t)` (rendu déterministe) et tous les éléments `<text>` du dessin sont relevés avec leur opacité effective (produit des opacités des parents), leur taille réelle en pixels écran et leur couleur. Un texte est « visible » à partir de 50 % d'opacité. Les textes sont regroupés en écrans de lecture (textes qui se recouvrent dans le temps). Précision : 0,1 s. Les durées « à 0,85x » sont les durées à 1x divisées par 0,85 (le lecteur ralentit seulement le temps de lecture).

**Ce qui compte comme message à lire** : légendes, titres, accroches, arguments, signature, QR et adresse. **Ce qui est classé « interface dessinée »** : les textes du téléphone dessiné (boutons, messages du chat, agenda, formulaires). Ils sont comptés à part (colonne « Interface ») car ils illustrent sans être à lire ; ils concurrencent toutefois la légende (un écran avec 20 à 70 chaînes d'interface n'a pas « un seul message »).

**Seuil de lecture retenu** (à justifier) :
- Repère donné par Romain/mission : 2 à 3 mots par seconde, plus 1 s pour repérer le texte. Formule appliquée : *lecture requise = 1 s + max(mots ÷ 2,5 ; signes ÷ 17)*. Le second terme reprend la règle de sous-titrage (signes par seconde).
- Source vérifiée le 22/11/2026 : guide de style de sous-titrage de Netflix (partnerhelp.netflixstudios.com, « Timed Text Style Guide ») : jusqu'à 20 signes par seconde pour un programme adulte, 42 signes par ligne, 2 lignes au plus. J'ai retenu 17 signes/s par prudence : c'est la valeur que je connais pour le français, mais je ne l'ai pas retrouvée sur la page consultée : **non vérifié**. Autres repères admis, non rouverts aujourd'hui : BBC Subtitle Guidelines (160 à 180 mots/minute, soit 2,7 à 3 mots/s, pour de l'oral sous-titré) ; WCAG 2.2 critère 2.2.2 (contenu animé de plus de 5 s : pause possible), 1.2.2 (sous-titres des médias préenregistrés), 2.2.1 (durée réglable).
- Contraste : WCAG 2.2 critère 1.4.3, vérifié le 22/11/2026 (w3.org) : 4,5:1 pour le texte normal, 3:1 pour le grand texte (18 pt, soit environ 24 px, ou 14 pt gras, soit environ 18,5 px).
- Taille sur mobile : planchers admis par les guides des plateformes (11 pt pour Apple, 12 sp pour Material), **non revérifiés aujourd'hui**. J'utilise 12 px comme plancher pour un texte à lire et 16 px pour le message principal.
- Un seuil unique est volontairement sévère : le public est froid (pas d'habitude de l'application) et regarde souvent sans le son.

**Limites** : la précision est de 0,1 s ; les fondus de 0,3 s sont comptés comme visibles à partir de 50 % ; les lignes d'un même écran apparaissent l'une après l'autre (0,35 à 0,4 s d'écart), « texte complet » est donc compté à partir de l'apparition de la dernière ligne ; les chaînes de l'interface en cours de frappe (champs de formulaire) comptent plusieurs fois (comptage indicatif) ; le contraste est calculé sur la couleur de remplissage et le fond déduit de la source (carte blanche ou fond navy #123644), pas sur des pixels ; la lecture réelle par des personnes (test utilisateur) n'a **pas** été faite : non vérifié.

## 3. Vérifications transversales

| Point | Constat | Détail |
|---|---|---|
| Taille du texte sur mobile | **Insuffisant pour l'interface, correct pour les légendes** | Lecteur de 345 px à 390 px de large. Légendes 17,3 à 17,9 px, accroches et arguments 19,8 à 25 px : corrects. Sous-lignes des arguments 9,9 px et pastilles 7,4 px : sous le plancher de 12 px. Interface dessinée : 6,5 à 10 px (jusqu'à 4,7 px mesuré) : décorative, pas lisible. Signature : ligne officielle « client-prestataire, en proximité · Côte d'Azur » à 10,2 px, URL 10 à 12 px. |
| Contraste | **Conforme pour les messages, à surveiller pour l'interface** | Messages : 5,9:1 (sous-lignes #9DB4BC sur navy) à 12,8:1 (#123644 sur blanc) : au-dessus de 4,5:1. Interface dessinée : 1 à 25 chaînes selon la vidéo en gris (#6E8592 et voisins) sous 4,5:1 sur fond blanc (approximation). Quelques textes sans couleur d'attribut (hérités) : contraste **non vérifié** (ex. 3 puces « Zéro paperasse » de /animation-inscription). |
| Un seul message par écran | **Non tenu dans la plupart des vidéos** | Les écrans « argument » cumulent titre, sous-ligne et parfois 5 pastilles ; les écrans à téléphone cumulent la légende et 10 à 70 chaînes d'interface visibles (colonne « Interface »). |
| Transitions | **Rapides par endroits** | Fondus de légende de 0,3 s, entrée du téléphone en 0,4 à 0,7 s, glissement d'écran 0,4 s (valeurs lues dans le code : `win()` 0,3 s, `appear` 0,4 s). Écart mesuré entre deux légendes : 0,1 à 1,5 s. Dans /animation, la légende « Avis, pourboire, facture » réapparaît 0,1 s à 37,7 s (mesure à 0,1 s, **non vérifié à l'œil**). |
| Logo et phrase finale | **Logo présent partout ; phrase finale officielle seulement dans 2 vidéos** | « PING, l'application de rencontre client-prestataire, en proximité · Côte d'Azur » : présente dans /animation-client et /animation-prestataire. Absente de /animation (« Et si ce que vous cherchez était juste à côté ? »), /animation-pro (« Devenir prestataire »), /animation-inscription (« Rejoindre PING »), tutos (« Après la commande, tout est tracé. », « La position ne sert qu'à valider l'arrivée. ») et /animation-ping (« PING en 1 minute. »). Signatures différentes = marque moins mémorisable. |
| Accessibilité | **Insuffisant** | Aucun sous-titre ni transcription (le message n'existe que comme texte animé dans un dessin SVG, avec une seule phrase `aria-label` pour toute la vidéo) ; aucune voix ; vitesse non réglable par le visiteur (le sélecteur n'existe qu'avec `?admin=1`) ; pause et barre de position présentes (bien) ; `prefers-reduced-motion` respecté (lecture non automatique). WCAG 1.2.2 (sous-titres) non satisfait. |
| Langage (règle PING) | **2 écarts à traiter** | « Des profils vérifiés par PING » (/animation-client) et « Profil vérifié par PING » (/animation-prestataire) sont affirmés pour tous alors que la règle impose « vérifié par PING » seulement si les pièces sont validées (nouveau prestataire réservable tout de suite, badge « pièces en cours de contrôle »). /animation affiche « Crédit d'impôt immédiat · Ne payez que 50 % · bientôt » (avance immédiate éteinte). Aucun « certifié » ni « garanti » trouvé ; aucun emoji ; aucune marque tierce dans les textes mesurés. |
| Séquestre | **Contradiction connue** | « Paiement sous séquestre » est montré actif (décision de Romain du 03/11) alors que le paiement en ligne est éteint (A-TRANCHER d). |

## 4. Détail par animation

Colonnes : « Mots » et « Lignes » = texte du message (hors interface) ; « Texte complet visible » = durée pendant laquelle toutes les lignes de l'écran sont visibles en même temps, à 0,85x ; « Lecture requise » = 1 s + max(mots/2,5 ; signes/17) ; « Scène nécessaire » = max(durée actuelle, lecture requise + 0,9 s de transitions) ; « Interface » = nombre maximal de chaînes du téléphone dessiné visibles pendant l'écran. **ROUGE** : texte complet visible moins longtemps que la lecture requise à la vitesse par défaut ; « ROUGE à 1x (MP4) » : seulement sous le seuil dans le MP4 enregistré à 1x.

### Animation explicative (`/animation`) : verdict **ralentir**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | La question | 0,0 | 4,1 / 4,8 | 9 | 2 | 4,7 | 1,9 | 4,6 | 5,5 | 17,9 | 0 | ROUGE à 1x (MP4) |
| 2 | L'écho PING | 4,1 | 4,1 / 4,8 | 7 | 2 | 4,5 | 1,6 | 3,8 | 4,7 | 17,9 | 4 | ok |
| 3 | Les demandes arrivent | 8,2 | 4,2 / 4,9 | 6 | 2 | 4,6 | 1,3 | 3,4 | 4,3 | 17,9 | 11 | ok |
| 4 | Le chat | 12,4 | 3,1 / 3,6 | 7 | 3 | 1,6 | 4,2 | 3,8 | 4,7 | 17,9 | 19 | **ROUGE** |
| 5 | Réservation instantanée | 15,5 | 3,0 / 3,5 | 6 | 2 | 3,2 | 1,9 | 3,4 | 4,3 | 17,9 | 28 | **ROUGE** |
| 6 | L'agenda | 18,5 | 2,9 / 3,4 | 6 | 2 | 3,1 | 2,0 | 3,4 | 4,3 | 17,9 | 26 | **ROUGE** |
| 7 | Arrivée enregistrée | 21,4 | 4,3 / 5,1 | 7 | 2 | 4,7 | 1,5 | 3,8 | 4,7 | 17,9 | 16 | ok |
| 8 | Départ enregistré | 25,7 | 3,4 / 4,0 | 8 | 2 | 3,6 | 2,2 | 4,2 | 5,1 | 17,9 | 9 | **ROUGE** |
| 9 | Avis, pourboire, facture | 29,1 | 4,1 / 4,8 | 5 | 2 | 4,7 | 1,1 | 3,4 | 4,3 | 17,9 | 7 | ok |
| 10 | En toute confiance | 33,2 | 4,7 / 5,5 | 15 | 5 | 0,1 | n.m. | 9,4 | 10,3 | 16,0 | 18 | **ROUGE** |
| 11 | Signature | 37,9 | 4,0 / 4,7 | 25 | 7 | 0,1 | n.m. | 13,6 | 14,5 | 8,6 | 7 | **ROUGE** |

Durée actuelle : **41,9 s à 1x**, **49,3 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **66,7 s** (1x). Scènes rouges : 6/11 à 0,85x, 7/11 à 1x.

### Animation prestataires (`/animation-pro`) : verdict **ralentir**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accroche | 0,0 | 3,4 / 4,0 | 10 | 4 | 1,9 | 5,3 | 5,4 | 6,3 | 9,0 | 3 | **ROUGE** |
| 2 | Vos prix | 3,4 | 5,2 / 6,1 | 10 | 2 | 5,9 | 1,7 | 5,0 | 5,9 | 17,3 | 18 | ok |
| 3 | Vos disponibilités | 8,6 | 5,4 / 6,4 | 7 | 2 | 6,0 | 1,2 | 3,8 | 5,4 | 17,3 | 70 | ok |
| 4 | Disponible | 14,0 | 3,6 / 4,2 | 8 | 2 | 3,9 | 2,1 | 4,2 | 5,1 | 17,3 | 69 | **ROUGE** |
| 5 | Les demandes arrivent | 17,6 | 2,7 / 3,2 | 7 | 2 | 2,8 | 2,5 | 3,8 | 4,7 | 17,3 | 27 | **ROUGE** |
| 6 | Répondre à une demande | 20,3 | 2,1 / 2,5 | 8 | 2 | 2,1 | 3,8 | 4,2 | 5,1 | 17,3 | 38 | **ROUGE** |
| 7 | Proposer son prix | 22,4 | 4,1 / 4,8 | 7 | 2 | 4,5 | 1,6 | 3,8 | 4,7 | 17,3 | 37 | ok |
| 8 | L'adresse transmise | 26,5 | 3,9 / 4,6 | 6 | 2 | 4,2 | 1,4 | 3,8 | 4,7 | 17,3 | 41 | ROUGE à 1x (MP4) |
| 9 | QR d'arrivée et de fin | 30,4 | 2,6 / 3,1 | 9 | 2 | 2,7 | 3,3 | 4,6 | 5,5 | 17,3 | 47 | **ROUGE** |
| 10 | Durée réelle | 33,0 | 3,6 / 4,2 | 5 | 2 | 3,9 | 1,3 | 3,0 | 3,9 | 17,3 | 29 | ok |
| 11 | Facture automatique | 36,6 | 4,6 / 5,4 | 8 | 2 | 5,1 | 1,6 | 4,2 | 5,1 | 17,3 | 45 | ok |
| 12 | Avis croisés | 41,2 | 4,6 / 5,4 | 10 | 2 | 5,1 | 2,0 | 5,0 | 5,9 | 17,3 | 51 | ROUGE à 1x (MP4) |
| 13 | Mon entreprise | 45,8 | 4,4 / 5,2 | 7 | 2 | 4,8 | 1,5 | 4,1 | 5,0 | 17,3 | 44 | ROUGE à 1x (MP4) |
| 14 | Devenir prestataire | 50,2 | 4,8 / 5,6 | 7 | 4 | 2,8 | 2,5 | 6,2 | 7,1 | 10,9 | 33 | **ROUGE** |

Durée actuelle : **55,0 s à 1x**, **64,7 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **74,4 s** (1x). Scènes rouges : 6/14 à 0,85x, 9/14 à 1x.

### Je m'inscris (`/animation-inscription`) : verdict **refaire**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accroche | 0,0 | 2,6 / 3,1 | 12 | 4 | 1,2 | 10,2 | 5,8 | 6,7 | 9,0 | 3 | **ROUGE** |
| 2 | Ouvrir le lien | 2,6 | 2,2 / 2,6 | 6 | 2 | 2,2 | 2,7 | 3,5 | 4,4 | 17,3 | 5 | **ROUGE** |
| 3 | Vos informations | 4,8 | 3,0 / 3,5 | 7 | 2 | 3,2 | 2,2 | 3,8 | 4,7 | 17,3 | 20 | **ROUGE** |
| 4 | Finaliser | 7,8 | 2,4 / 2,8 | 11 | 2 | 2,5 | 4,5 | 5,4 | 6,3 | 17,3 | 31 | **ROUGE** |
| 5 | Confirmer son e-mail | 10,2 | 2,0 / 2,4 | 9 | 2 | 2,0 | 4,5 | 4,6 | 5,5 | 17,3 | 26 | **ROUGE** |
| 6 | Bienvenue | 12,2 | 2,8 / 3,3 | 10 | 2 | 2,9 | 3,4 | 5,0 | 5,9 | 17,3 | 30 | **ROUGE** |
| 7 | Première demande | 15,0 | 4,2 / 4,9 | 15 | 6 | 1,6 | 4,9 | 8,4 | 9,3 | 9,0 | 23 | **ROUGE** |
| 8 | Prestataire : votre métier | 19,2 | 2,0 / 2,4 | 4 | 2 | 2,0 | 2,0 | 3,2 | 4,1 | 17,3 | 20 | **ROUGE** |
| 9 | Vos tarifs | 21,2 | 2,2 / 2,6 | 10 | 2 | 2,2 | 4,5 | 5,0 | 5,9 | 17,3 | 27 | **ROUGE** |
| 10 | Entreprise et zone | 23,4 | 2,4 / 2,8 | 9 | 2 | 2,5 | 3,6 | 4,6 | 5,5 | 17,3 | 33 | **ROUGE** |
| 11 | Accepter les CGV | 25,8 | 2,0 / 2,4 | 8 | 2 | 2,0 | 4,0 | 4,2 | 5,1 | 17,3 | 27 | **ROUGE** |
| 12 | Vos pièces | 27,8 | 2,0 / 2,4 | 9 | 2 | 2,0 | 4,5 | 4,6 | 5,5 | 17,3 | 26 | **ROUGE** |
| 13 | Dossier enregistré | 29,8 | 2,4 / 2,8 | 7 | 2 | 2,5 | 2,8 | 3,8 | 4,7 | 17,3 | 27 | **ROUGE** |
| 14 | En ligne | 32,2 | 2,6 / 3,1 | 9 | 2 | 2,7 | 3,3 | 4,6 | 5,5 | 17,3 | 31 | **ROUGE** |
| 15 | Rejoindre PING | 34,8 | 5,2 / 6,1 | 7 | 3 | 2,9 | 2,4 | 5,4 | 6,3 | 12,2 | 18 | **ROUGE** |

Durée actuelle : **40,0 s à 1x**, **47,1 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **85,5 s** (1x). Scènes rouges : 15/15 à 0,85x, 15/15 à 1x.

### PING pour les particuliers (`/animation-client`) : verdict **refaire**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accroche | 0,0 | 4,6 / 5,4 | 11 | 3 | 1,9 | 5,8 | 5,4 | 6,3 | 19,8 | 4 | **ROUGE** |
| 2 | La carte | 4,6 | 3,2 / 3,8 | 6 | 2 | 3,3 | 1,8 | 3,6 | 4,5 | 17,3 | 11 | **ROUGE** |
| 3 | Vous choisissez votre prestataire | 7,8 | 3,2 / 3,8 | 4 | 2 | 3,4 | 1,2 | 3,0 | 3,9 | 17,3 | 11 | ROUGE à 1x (MP4) |
| 4 | Des profils détaillés | 11,0 | 3,0 / 3,5 | 13 | 4 | 2,5 | 5,3 | 6,2 | 7,1 | 9,9 | 19 | **ROUGE** |
| 5 | Le chat, le prix et le paiement | 14,0 | 6,4 / 7,5 | 21 | 4 | 2,0 | 5,5 | 10,4 | 11,3 | 17,3 | 24 | **ROUGE** |
| 6 | QR de sécurité : arrivée et départ | 20,4 | 3,0 / 3,5 | 19 | 4 | 1,9 | 10,1 | 8,6 | 9,5 | 9,9 | 11 | **ROUGE** |
| 7 | Vous notez votre prestataire | 23,4 | 3,0 / 3,5 | 13 | 4 | 1,9 | 6,9 | 6,2 | 7,1 | 9,9 | 11 | **ROUGE** |
| 8 | Un service litige | 26,4 | 3,0 / 3,5 | 16 | 4 | 2,4 | 6,8 | 7,4 | 8,3 | 9,9 | 11 | **ROUGE** |
| 9 | Final | 29,4 | 5,3 / 6,2 | 14 | 4 | 3,6 | 3,8 | 8,8 | 9,7 | 10,2 | 11 | **ROUGE** |

Durée actuelle : **34,7 s à 1x**, **40,8 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **67,7 s** (1x). Scènes rouges : 8/9 à 0,85x, 9/9 à 1x.

### PING pour les prestataires (`/animation-prestataire`) : verdict **refaire**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accroche | 0,0 | 4,7 / 5,5 | 10 | 3 | 1,9 | 5,3 | 5,0 | 5,9 | 19,8 | 4 | **ROUGE** |
| 2 | Mes tarifs | 4,7 | 4,2 / 4,9 | 8 | 2 | 4,6 | 1,7 | 4,2 | 5,1 | 17,3 | 31 | ROUGE à 1x (MP4) |
| 3 | Mes disponibilités | 8,9 | 4,4 / 5,2 | 9 | 4 | 2,2 | 2,7 | 6,3 | 7,2 | 17,3 | 69 | **ROUGE** |
| 4 | Demandes autour de moi | 13,3 | 5,0 / 5,9 | 14 | 4 | 2,2 | 2,7 | 8,0 | 8,9 | 17,3 | 9 | **ROUGE** |
| 5 | Ajoutez vos pièces | 18,3 | 3,0 / 3,5 | 18 | 4 | 2,4 | 7,6 | 8,2 | 9,1 | 9,9 | 20 | **ROUGE** |
| 6 | PING vous rend visible | 21,3 | 3,0 / 3,5 | 18 | 4 | 2,4 | 7,6 | 8,2 | 9,1 | 9,9 | 12 | **ROUGE** |
| 7 | Facture automatisée, plus de productivité | 24,3 | 3,0 / 3,5 | 13 | 4 | 2,4 | 5,5 | 6,7 | 7,6 | 9,9 | 12 | **ROUGE** |
| 8 | QR de sécurité : l’heure fait foi | 27,3 | 3,0 / 3,5 | 19 | 4 | 1,9 | 10,1 | 8,6 | 9,5 | 9,9 | 12 | **ROUGE** |
| 9 | Prestataires et clients se notent | 30,3 | 3,0 / 3,5 | 11 | 3 | 2,4 | 4,7 | 5,4 | 6,3 | 9,9 | 12 | **ROUGE** |
| 10 | Service litige | 33,3 | 3,0 / 3,5 | 15 | 4 | 1,9 | 8,0 | 7,0 | 7,9 | 9,9 | 12 | **ROUGE** |
| 11 | Paiement sécurisé sous séquestre | 36,3 | 3,0 / 3,5 | 14 | 4 | 1,9 | 7,4 | 6,6 | 7,5 | 9,9 | 12 | **ROUGE** |
| 12 | Final | 39,3 | 5,3 / 6,2 | 14 | 4 | 3,6 | 3,8 | 8,9 | 9,8 | 10,2 | 12 | **ROUGE** |

Durée actuelle : **44,6 s à 1x**, **52,5 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **93,8 s** (1x). Scènes rouges : 11/12 à 0,85x, 12/12 à 1x.

### Tuto Après la commande (`/animation-tuto`) : verdict **ralentir**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | La commande est passée | 0,0 | 5,0 / 5,9 | 8 | 2 | 5,8 | 1,4 | 4,2 | 5,1 | 17,9 | 0 | ok |
| 2 | Le client présente son QR | 5,0 | 4,2 / 4,9 | 5 | 2 | 4,6 | 1,1 | 3,0 | 4,2 | 17,9 | 4 | ok |
| 3 | Arrivée enregistrée | 9,2 | 3,8 / 4,5 | 6 | 2 | 4,1 | 1,5 | 3,5 | 4,4 | 17,9 | 7 | ROUGE à 1x (MP4) |
| 4 | Intervention | 13,0 | 3,8 / 4,5 | 9 | 2 | 4,1 | 2,2 | 4,6 | 5,5 | 17,9 | 6 | **ROUGE** |
| 5 | Départ enregistré | 16,8 | 4,1 / 4,8 | 8 | 2 | 4,5 | 1,8 | 4,2 | 5,1 | 17,9 | 7 | ROUGE à 1x (MP4) |
| 6 | Heure entamée, heure due | 20,9 | 6,1 / 7,2 | 13 | 3 | 6,8 | 1,9 | 6,2 | 7,1 | 16,0 | 12 | ROUGE à 1x (MP4) |
| 7 | Facture, avis, pourboire | 27,0 | 5,5 / 6,5 | 6 | 2 | 6,1 | 1,0 | 3,8 | 5,5 | 17,9 | 7 | ok |
| 8 | Signature | 32,5 | 4,5 / 5,3 | 16 | 5 | 2,6 | 6,2 | 8,5 | 9,4 | 8,6 | 0 | **ROUGE** |

Durée actuelle : **37,0 s à 1x**, **43,5 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **46,3 s** (1x). Scènes rouges : 2/8 à 0,85x, 5/8 à 1x.

### Tuto Vous ne serez pas là ? (`/animation-tuto-absent`) : verdict **ralentir**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Vous ne serez pas là ? | 0,0 | 3,4 / 4,0 | 8 | 2 | 3,9 | 2,1 | 4,2 | 5,1 | 17,9 | 0 | **ROUGE** |
| 2 | Un QR unique | 3,4 | 3,8 / 4,5 | 7 | 2 | 4,1 | 1,7 | 3,8 | 4,7 | 17,9 | 8 | ROUGE à 1x (MP4) |
| 3 | Laissé sur place | 7,2 | 3,0 / 3,5 | 6 | 2 | 3,2 | 1,9 | 3,4 | 4,3 | 17,9 | 0 | **ROUGE** |
| 4 | Arrivée enregistrée | 10,2 | 3,0 / 3,5 | 6 | 2 | 3,2 | 1,9 | 3,5 | 4,4 | 17,9 | 7 | **ROUGE** |
| 5 | Sans QR : la position | 13,2 | 3,3 / 3,9 | 8 | 2 | 3,5 | 2,3 | 4,2 | 5,1 | 17,9 | 11 | **ROUGE** |
| 6 | L'adresse est comparée | 16,5 | 3,0 / 3,5 | 8 | 2 | 3,2 | 2,5 | 4,2 | 5,1 | 17,9 | 10 | **ROUGE** |
| 7 | Un code unique | 19,5 | 3,0 / 3,5 | 9 | 2 | 3,2 | 2,8 | 4,6 | 5,5 | 17,9 | 7 | **ROUGE** |
| 8 | Le code est saisi | 22,5 | 3,9 / 4,6 | 7 | 2 | 4,2 | 1,7 | 3,8 | 4,7 | 17,9 | 14 | ROUGE à 1x (MP4) |
| 9 | Signature | 26,4 | 4,0 / 4,7 | 18 | 5 | 1,9 | 9,6 | 8,6 | 9,5 | 8,6 | 0 | **ROUGE** |

Durée actuelle : **30,4 s à 1x**, **35,8 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **48,5 s** (1x). Scènes rouges : 7/9 à 0,85x, 9/9 à 1x.

### PING en 1 minute (`/animation-ping (redirigée)`) : verdict **supprimer (après accord)**

| # | Scène | Début (1x) | Durée 1x / 0,85x | Mots | Lignes | Texte complet visible (0,85x) | Mots/s (0,85x) | Lecture requise | Scène nécessaire | Texte mini (px) | Interface (chaînes) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accroche | 0,0 | 4,6 / 5,4 | 11 | 3 | 1,9 | 5,8 | 5,4 | 6,3 | 19,8 | 4 | **ROUGE** |
| 2 | La carte | 4,6 | 6,2 / 7,3 | 15 | 4 | 3,2 | 2,8 | 8,0 | 8,9 | 17,3 | 20 | **ROUGE** |
| 3 | Le chat et le prix | 10,8 | 4,0 / 4,7 | 9 | 2 | 4,4 | 2,1 | 4,6 | 5,5 | 17,3 | 35 | **ROUGE** |
| 4 | Agenda et facture | 14,8 | 5,4 / 6,4 | 12 | 4 | 2,7 | 2,4 | 6,9 | 7,8 | 17,3 | 43 | **ROUGE** |
| 5 | Je cherche un prestataire | 20,2 | 10,6 / 12,5 | 41 | 12 | 1,8 | 7,9 | 21,4 | 22,3 | 9,0 | 37 | **ROUGE** |
| 6 | Je suis prestataire | 30,8 | 12,4 / 14,6 | 33 | 12 | 1,6 | 7,3 | 20,4 | 21,3 | 9,0 | 71 | **ROUGE** |
| 7 | Moins de factures, plus de services | 43,2 | 3,0 / 3,5 | 15 | 3 | 2,4 | 6,4 | 7,0 | 7,9 | 9,9 | 17 | **ROUGE** |
| 8 | Moins de paperasse, plus de travail | 46,2 | 3,0 / 3,5 | 13 | 4 | 2,4 | 5,5 | 6,7 | 7,6 | 9,9 | 17 | **ROUGE** |
| 9 | Moins d’administratif, plus de productif | 49,2 | 3,0 / 3,5 | 12 | 3 | 2,4 | 5,1 | 5,8 | 6,7 | 9,9 | 17 | **ROUGE** |
| 10 | QR de sécurité : l’heure fait foi | 52,2 | 3,0 / 3,5 | 19 | 4 | 1,9 | 10,1 | 8,6 | 9,5 | 9,9 | 17 | **ROUGE** |
| 11 | Prestataires et clients se notent | 55,2 | 3,0 / 3,5 | 11 | 3 | 2,4 | 4,7 | 5,4 | 6,3 | 9,9 | 17 | **ROUGE** |
| 12 | Service litige | 58,2 | 3,0 / 3,5 | 15 | 4 | 1,9 | 8,0 | 7,0 | 7,9 | 9,9 | 17 | **ROUGE** |
| 13 | Paiement sécurisé sous séquestre | 61,2 | 3,0 / 3,5 | 14 | 4 | 1,9 | 7,4 | 6,6 | 7,5 | 9,9 | 17 | **ROUGE** |
| 14 | Final | 64,2 | 5,3 / 6,2 | 14 | 4 | 3,8 | 3,7 | 7,7 | 8,6 | 10,2 | 17 | **ROUGE** |

Durée actuelle : **69,5 s à 1x**, **81,8 s à la vitesse par défaut (0,85x)**. Durée nécessaire pour la même matière : **134,1 s** (1x). Scènes rouges : 14/14 à 0,85x, 14/14 à 1x.

## 5. Ce que l'audit conclut

1. **Le défaut principal est la densité de texte par écran**, pas seulement la vitesse : 6 à 21 mots sur 1,6 à 4 s. Ralentir tout à 0,75x ne suffirait pas (il faudrait multiplier la durée par 1,25 à 2,1 selon la vidéo, voir « durée nécessaire »).
2. **Une idée par écran, 4 mots de titre, 2,5 s minimum** : c'est la règle retenue pour les nouvelles vidéos (document `docs/animations-nouvelles-2026-11-22.md`).
3. **Un seul son pour tous** : une voix off qui explique l'objectif, et des sous-titres, résolvent à la fois la lecture et l'accessibilité (WCAG 1.2.2).
4. **Une signature unique** : la phrase officielle devrait terminer toutes les vidéos qu'on garde.
5. **Les MP4 existants sont plus rapides que les pages** (1x contre 0,85x) : ne plus les publier tels quels.

## 6. Les nouvelles vidéos, mesurées avec la même méthode

Mêmes outils, même taille d'écran ; vitesse par défaut 1x (voir `docs/animations-nouvelles-2026-11-22.md` pour les scénarios). Ici « Mots » = titre (4 au plus) ; les sous-titres (texte de la voix) sont évalués à part, par la règle de sous-titrage (signes par seconde et 2 lignes de 36 signes au plus).

| Vidéo | Durée | Plans | Titres rouges (1x) | Plus petit titre (px) | Sous-titres (px) | Verdict de la méthode |
|---|---|---|---|---|---|---|
| PING en 20 secondes `/animation-courte` | 20,0 s | 5 | 1/5 (Final) | 19,8 | 14,1 | titres conformes ; seule la signature reste sous le seuil (voir ci-dessous) |
| Courte client `/animation-courte-client` | 35,0 s | 8 | 1/8 (Final) | 19,8 | 14,1 | titres conformes ; seule la signature reste sous le seuil (voir ci-dessous) |
| Courte prestataire `/animation-courte-prestataire` | 34,8 s | 8 | 1/8 (Final) | 19,8 | 14,1 | titres conformes ; seule la signature reste sous le seuil (voir ci-dessous) |

**Signature (scène finale identique à l'existante)** : 14 mots/133 signes (phrase officielle, « Scannez pour vous inscrire », URL) affichés complets 2,8 à 3,2 s : sous le seuil strict (lecture requise 8,8 s) mais c'est un bloc de marque connu et la voix off prononce un autre message pendant ce temps. Si Romain veut tenir le seuil, il faut soit allonger l'écran final à 6 s, soit raccourcir la ligne : décision à prendre (non fait, la consigne était de garder la conclusion identique).

Mesures complémentaires des nouvelles pages (Chromium 390 × 844) : aucune erreur JavaScript, pas de débordement horizontal, captures de contrôle dans `docs/audit-2026-11-22/` (début, milieu, fin).

## 7. Non vérifié

- Compréhension réelle par des personnes (aucun test utilisateur) ; qualité d'écoute de la voix ; rendu sur de vrais téléphones (seulement Chromium de bureau en 390 × 844) ; seuil de 17 signes/s en français (source consultée donne 20) ; planchers Apple/Material ; contraste des textes sans couleur d'attribut ; réapparition de 0,1 s de la légende à 37,7 s dans /animation.
- Rien n'a été supprimé ni modifié dans les anciennes animations (les 3 petits ajouts au lecteur partagé sont facultatifs et n'agissent pas sans configuration : vitesse par défaut, voix).
