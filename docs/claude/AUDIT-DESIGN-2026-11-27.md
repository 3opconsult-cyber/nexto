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
