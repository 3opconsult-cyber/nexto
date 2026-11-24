# Registre des régressions et quasi-régressions (créé le 24/11/2026)
Chaque ligne : ce qui est arrivé | cause | garde-fou à appliquer. LECTURE OBLIGATOIRE par tout agent avant de modifier un écran, un composant partagé ou un script de test.

## Règles d'or (Romain, 24/11 : « obligation systématique, amélioration, on doit arrêter les régressions »)
1. Avant de toucher un fichier : lister qui d'autre l'utilise (`grep -rn "NomDuComposant" src`) et le dire dans le rapport. Un composant partagé (Calendar, BottomTabBar, DocCaptureSheet, DayTimePicker, MapSheet, LiveMap, FindSheet, Hub) change pour TOUS les écrans qui l'importent : mesurer chacun.
2. Après chaque lot : `scripts/e2e/non-regression.sh` doit être vert (parcours rapide, étapes de réservation, facture, écrans prestataire, erreurs d'inscription ; A et B en journée). Un test rouge n'est jamais « du bruit » : le rejouer seul une fois, comparer au code précédent, puis corriger.
3. Après un changement de libellé, d'étape ou de structure : mettre à jour les scripts de test qui le citent EN MÊME TEMPS (comptes-ui avait une inscription à l'étape 2 quand elle passait à 3).
4. Ne jamais retirer une phrase de règle métier d'un écran (prix figé, seul un litige le rouvre, annulation en 3 paliers, consentement GPS) sans la remettre ailleurs au même niveau de visibilité.
5. « Fait » = vu sur une capture de la production ou mesuré. « Le build compile » ne prouve rien du rendu. Regarder les captures une par une.
6. Aucune compaction sous prétexte de « moins de mots » : la lecture aérée se mesure en espace (>= 20 px entre blocs), texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran.
7. Ne pas modifier le même fichier que le chantier d'un autre agent ; si c'est inévitable, limiter le changement à un bloc isolé et le signaler.
8. Tester en journée à Paris (avant 17 h) et attendre la fin du déploiement (commit lu dans Vercel) avant de lancer A et B ; un déploiement pendant un test invalide le test.

## Registre
| Date | Régression ou quasi-régression | Cause | Garde-fou |
|---|---|---|---|
| 23/11 | « Mission introuvable » à la moindre coupure réseau | une erreur de lecture traitée comme « absente » | distinguer erreur et absence ; test hors ligne (hors-ligne.mjs) |
| 23/11 | Bandeau de mission recouvrait « Contacter », « Envoyer », « Réserver » | bandeau fixe sans réserve d'espace | variable --banner-h dans la barre du bas ; mesurer avec parcours rapide |
| 23/11 | Contraste « corrigé » sur une variable seulement (#0C8F7E en dur à ~280 endroits) | correctif partiel annoncé comme complet | `grep` de toutes les occurrences ; mesure du contraste en production |
| 23/11 | Carte vide sur iPhone : fond sans routes ni épingles | « load » du fond ≠ tuiles dessinées ; recadrage sur la position au zoom de quartier | contrôle de rendu (queryRenderedFeatures), rechargement du style, repli OpenStreetMap ; les 3 plus proches toujours cadrés |
| 23/11 | « Zoom libre » : recadrage automatique supprimé sans remplacement | épingles hors écran | recadrage à l'ouverture et à « Recentrer » seulement |
| 23/11 | Point « Vous êtes ici » faux sur iPhone | relevé sans haute précision, libellé trompeur | relevé précis affiné, libellé honnête (approximative, adresse du profil, ville choisie) |
| 23/11 | Phrase « prix figé, seul un litige peut le rouvrir » retirée par un agent | compaction | rétablie ; règle d'or 4 |
| 23/11 | Parcours A/B rouges le soir ou pendant un déploiement | créneau du lendemain ; déploiement en cours | règle d'or 8 |
| 24/11 | Écrans « tassés » au lieu d'aérés | critère mesuré en mots et en boutons | règle d'or 6 ; mesure-aere.mjs |
| 24/11 | Deux agents modifient agenda/page.tsx (conflit de fusion) | fichier partagé particulier / prestataire | règle d'or 7 |
| 24/11 | Test comptes-ui obsolète après l'inscription en 3 étapes | script non mis à jour | règle d'or 3 ; inscription-erreurs.mjs |
| 24/11 | Profil : bloc collé au suivant, texte 14 px après fusion | fusion de deux chantiers sans remesure | remesurer après chaque fusion (mesure-aere.mjs) |
| 24/11 | Test local instable alors que la production passe | environnement local | la production en journée est la mesure de référence |
