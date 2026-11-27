# Audit d'homogénéité du design (27/11/2026, session PING · Design)
Méthode : lecture du code et comptages (`grep`), sans capture de production. Tout ce qui suit est donc **non vérifié à l'écran**.

## Réponse courte
- Particulier et prestataire : même style de base (`ping-ui.css`, même carte `.card` 16 px, mêmes boutons 44 px). Homogène pour l'essentiel.
- Admin : **pas homogène**. `/admin` est une page à part (`public/admin.html`, 5 528 lignes) avec ses propres couleurs, ses propres boutons. Les pages `/admin/commission`, `/paiements`, `/parcours`, `/retours`, `/visites` ont un troisième style (styles écrits à la main, sans menu commun).
- Communication visuelle (vidéos, plaquettes, e-mails, affiches) : **n'est pas dans Design**. Elle est dans « PING · Prospection et communication » (`ROUTAGE.md`, agents creation-materiel et marketing-prospection). Design possède seulement le style de l'application.
- De bout en bout : **non**. Les jetons de marque (`brand/tokens.css`, qui se dit « source de vérité unique ») ne sont plus ceux de l'application.

## Incohérences trouvées (par gravité)
1. **Trois palettes au lieu d'une.**
   | Couleur | Marque (`brand/tokens.css`) | Application (`ping-ui.css`) | Admin (`admin.html`) |
   |---|---|---|---|
   | Vert foncé (boutons) | #0C8F7E | #0B8374 | #0C8F7E |
   | Gris du texte secondaire | #6E8592 | #4E6470 | #6E8592 |
   | Trait de bordure | #DCE5E3 | #E7EDEB | #E7EDEB |
   L'application a été foncée pour la lisibilité (23/11) ; la marque, l'admin, les animations et les prototypes ne l'ont pas été. Les vidéos et plaquettes montrent donc un vert différent de l'application.
2. **Boutons admin moins lisibles.** Admin : fond vert clair #12B39C avec texte blanc (contraste faible, environ 2,5 pour 1), texte 13,5 px, pas de hauteur minimale. Application : vert foncé, 15 px, 44 px minimum.
3. **Couleurs écrites en dur partout.** Dans `src`, environ 500 fois #123644, 450 fois #4E6470, 290 fois #0B8374 au lieu des variables. Restent 99 fois l'ancien gris #6E8592 (surtout `mission/[id]/chat`, `admin/parcours`, `pro/revenus`) et 5 fois l'ancien vert #0C8F7E (`FindSheet`, `MonAnnonceCard`, `pro/carte`, `DemoShell`). Cinq rouges différents pour « erreur » (#C0503A, #B3402F, #B2432E, #A8432F, #E5484D) et trois verts foncés (#0B8374, #097A6C, #0B6F63).
4. **Deux définitions de « danger ».** `globals.css` : corail #FF7A66 ; `ping-ui.css` : rouge #C0503A. Selon le fichier chargé, une erreur n'a pas la même couleur.
5. **Cartes : un modèle commun existe mais peu utilisé.** `.card` (fond blanc, trait, angle 16 px) est la même dans l'app, `client.html` et `app.html` ; l'admin a le même angle mais 18 px de marge intérieure. Dans les écrans React, les cartes sont presque toutes écrites à la main : angles 10, 11, 12, 14, 16, 18 px mélangés (prestataire : 29 fois 16, 27 fois 12, 10 fois 10). `AereRow` (ligne aérée) n'est utilisée que dans le profil particulier.
6. **Lien « Retour » différent.** `RetourLink` (lien contextuel « Retour à mon annonce ») avait 13 px, une flèche texte et un autre vert que `BackHeader`. Corrigé le 27/11 (ce ne sont pas deux boutons pour la même chose).
7. **Menu absent de l'admin React.** Les 19 écrans particulier/prestataire utilisent `NavDrawer` ; aucune page `/admin/*` ne l'utilise.
8. **Pictogrammes en caractères.** ★ ✓ ✕ écrits comme texte dans une vingtaine d'écrans (avis, chat, commande, litiges) et dans les animations. Ce ne sont pas des émojis en couleur, mais la règle demande des pictogrammes SVG (`PingIcons.tsx` existe déjà).
9. **Petits textes.** 73 tailles de 10 à 13 px dans `ping-ui.css` (héritées du prototype). La règle aérée demande 15 px pour le texte courant.
10. **Langage déclaratif : conforme.** Aucun « certifié » ni « garanti » en promesse trouvé (seulement « Garantie décennale », nom d'assurance, et des mentions « ne certifie pas »).

## Ce qu'il faudrait faire (proposition, rien n'est modifié)
1. Décider une seule palette (celle de l'application, plus lisible) et la reporter dans `brand/tokens.css`. Puis régénérer animations, plaquettes, e-mails (session Prospection).
2. Admin : reprendre les variables et le bouton de l'application dans `admin.html` (couleurs, 15 px, 44 px).
3. Remplacer les couleurs écrites en dur par les variables, en commençant par les anciens #6E8592 et #0C8F7E ; un seul rouge d'erreur.
4. Un composant carte commun (angle 16 px, marge 16 px) et un seul bouton Retour.
5. Capture de production des trois espaces à 390 px et au bureau pour confirmer à l'écran.

## Question pour Romain
Le fichier `brand/tokens.css` est-il possédé par Design (le style) ou par Prospection (les supports) ? Aujourd'hui personne ne le tient à jour avec l'application.

## Suite (27/11, accord de Romain)
Fait : points 1, 2, 4 et 6, et le rouge unique du point 3. Reste : couleurs en dur en variables, carte commune, pictogrammes SVG, petits textes. MP4 et PDF à régénérer (Prospection). La page `landing-pro` dit « Paiement sous séquestre » alors que le séquestre est éteint (A-TRANCHER d, Prospection).

## Audit de bout en bout en production (27/11, après-midi)
Scripts : `scripts/e2e/audit-design.mjs` (40 écrans × 390 px et 1 280 px, comptes audit) et `audit-fiche.mjs` (carte -> épingle -> fiche -> réserver).
- Toutes les pages s'ouvrent (aucune erreur, aucun défilement horizontal). Une erreur de chargement sur Disponibilités venait d'un déploiement en cours ; rejouée : bonne.
- Barre du bas : aucun bouton caché en fin de page (vérifié en descendant jusqu'en bas sur 9 écrans).
- Carte : 16 prestataires affichés près de Nice, épingle -> aperçu (nom, métiers, note, distance, prix, Réserver, Voir la fiche) -> fiche lisible (prestations et prix, règle du prix figé, statut et paiement, repères, avis) -> réservation avec prestations du pro, créneaux ouverts, adresse, paiement, prix.
- Parcours complet A et B (devis, accord, rendez-vous, commande dans le chat, Je pars, QR, fin, 3 factures, avis) : bon sauf le raccourci « Mission du jour ».
- Corrigé : « Mission du jour » absent quand le compte a plus de 30 missions anciennes restées ouvertes (`todayMission.ts`) ; liens Retour et « Parcourir la carte » à 44 px ; petits textes de Litiges et Parrainage ; logo répété sur la carte client au bureau ; cloche au lieu de Messages sur la carte pro ; logo de l'admin (avion -> anneaux PING).
- Non corrigé, à décider : pages d'accueil `landing-*.html` (liens du haut de 15 px, générées par `brand/`, session Prospection) ; attribution de la carte (petite, imposée par les licences) ; admin non testé connecté (pas de compte admin de test, règle 1).
- Test « agenda : réservation à accepter » : dépend d'une réservation en attente dans les comptes de test, il n'y en a plus ; ce n'est pas un défaut de l'écran.

## Audit sévère « simple, limpide, facile » (27/11, 15 h) — nombre d'appuis depuis l'écran d'accueil
Mesuré en production à 390 px (`scripts/e2e/audit-taches.mjs`), comptes audit.
| Tâche | Avant | Après correction | Reste à améliorer |
|---|---|---|---|
| Client : réserver | 5 (épingle, Réserver, jour, heure, Confirmer) | 5 | « Confirmer » visible avant le choix de l'heure |
| Client : ouvrir le chat | 2 (Messages, conversation) | 2 | — |
| Client : déposer une demande | 3 (Profil, Voir plus, Déposer) ou caché dans la liste de la carte | 2 (Profil, Déposer) | — |
| Client : factures | 3 (Profil, Voir plus, Mes factures) | 2 | — |
| Agenda (les deux) | 1 | 1 | — |
| QR / code d'arrivée, fin (les deux) | 1 (bouton Mission) ; absent côté pro avec beaucoup de missions anciennes | 1, corrigé | — |
| Pro : mon annonce | 2 | 2 | page de 3 675 px, deux en-têtes (Menu puis Retour), « Voir comme un client » et « Aperçu client » en double |
| Pro : ajouter / retirer un service | 3 (Entreprise, Mon annonce, Gérer mes tarifs) | 2 (Entreprise, Mes services et tarifs) | — |
| Pro : coordonnées et statut | 3 (derrière Voir plus) | 2 | ouvre le parcours d'inscription : trop lourd pour une modification |
| Pro : factures | 3 (derrière Voir plus) | 2 | — |

Autres défauts vus (non corrigés, à décider) :
1. « Mon entreprise » fait près de 3 écrans ; « Mon annonce » y figure deux fois (encart et ligne).
2. Profil client : « Ville non renseignée » mais « Profil complet : 4 sur 4 ».
3. Avatar du client corail, du pro vert : à unifier si ce n'est pas voulu.
4. Comptes de test encombrés (« Votre prestataire est arrivé : confirmez » permanent, 49 à 51 missions passées sans clôture) : gêne les mesures ; nettoyage sur accord (Données SQL).
5. Effet de bord corrigé : le remplacement de la bordure #DCE5E3 rendait blancs des boutons gris (règle `aere.css`) ; bordure d'origine rétablie (118 endroits). Deux teintes de trait restent donc voulues : #E7EDEB (léger) et #DCE5E3 (boutons gris des écrans aérés).

## Agenda, chat, QR (27/11, 16 h)
- Appui sur une date (vue Mois) : liste du jour, chaque mission avec « Conversation », « Facture » (si elle existe) et « Mission » ; la mission du jour montre « QR et code » à la place de « Mission ». Vu en production.
- Carte « Aujourd'hui » de l'onglet En cours : « Mission du jour » + « Conversation » (nouveau). Appui sur la carte : la conversation, comme avant.
- Appui sur un rendez-vous dans la vue Jour ou Semaine : la conversation.
- QR et code : bouton rond « Mission » au centre de la barre du bas (client et pro, même place), billet de mission dans le chat, et désormais l'agenda.
- Bouton PING de la carte : non doublé avec le QR (le bouton Mission occupe déjà la même fonction au même endroit pour les deux espaces) ; proposition à valider par Romain.
- Mon annonce : une seule ligne d'en-tête ; Mon entreprise : ligne « Mon annonce » en double retirée ; réservation : « Confirmer » estompé tant que l'heure n'est pas choisie.
- Reste : onglets de l'agenda sur 2 lignes côté pro (1 ligne côté client), flèche Retour présente côté client et absente côté pro ; « Coordonnées et statut » ouvre l'inscription.

## Étendre à d'autres métiers : analyse de structure (27/11, 17 h)
- Catalogue déjà en données (`service_catalog`, admin > Catalogue des services) : par métier, manières de tarifer (forfait, à l'heure, forfait + heures), CESU / crédit d'impôt, champs de la demande, pièces exigées. Ajouter un métier = une ligne, sans code.
- Prix, commission, facture, QR d'arrivée et de fin : indépendants du métier (même calcul pour tout forfait ou tarif horaire). Facturation identique.
- À adapter : familles (champ `domain` existe), pictogrammes, filtres de la carte en familles, crédit d'impôt seulement pour les services à la personne éligibles, pièces propres (décennale pour le bâtiment).
- Hors cadre : « serveur, job d'été » = salariat, pas prestation : à trancher avant (risque juridique).
- Maquette : https://claude.ai/artifact/Jt6pH946bhNcYGsdNhhGzk (familles -> métiers en choix multiple -> fiche multi-métiers, prix figé, pas de devis).
