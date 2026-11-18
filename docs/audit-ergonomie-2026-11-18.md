# Audit ergonomie mesuré — 18/11/2026

Production nexto-eta.vercel.app, téléphone 390×844 (tactile), Playwright, comptes audit client et pro.
Scripts : `scratchpad/e2e/ergo/` (non versionnés). Données créées (titres « QA ergo ») annulées ou supprimées à la fin :
2 missions annulées, 2 demandes annulées, 1 prestation supprimée. Seule trace restante : la pièce « passeport » du compte audit.pro a été remplacée (même statut « en cours »).

Appuis comptés depuis l'écran d'accueil de chaque espace (carte pour le client, Mon entreprise pour le pro), fenêtres de démarrage déjà fermées.
Temps = attente mesurée entre l'appui et l'écran utilisable. Cible : 3 appuis ou moins pour une action fréquente, 6 ou moins pour réserver.

## Tableau

| Tâche | Appuis | Saisies | Écrans | Attente max | Note /10 | Ce qui gêne |
|---|---|---|---|---|---|---|
| **Client** — se connecter | 1 | 2 | 2 | 2,2 s (carte utile 1,5 s après) | 8 | Puis 2 fenêtres d'emblée (voir plus bas) |
| Trouver un pro de ménage et voir sa fiche | 3 | 0 | 2 | 2,4 s (fiche) | 7 | Puce « Ménage » 35 px de haut ; liste déroulante de service ET puces : deux filtres pour la même chose |
| Réserver (depuis la fiche) | 6 (9 depuis la carte) | 0 | 3 | 4,4 s après « J'ai compris » | 5 | Case « Je confirme l'adresse » 18×18 px. Si on l'oublie : la fenêtre de paiement s'ouvre quand même, puis l'erreur s'affiche en bas, loin de la case (2 appuis perdus). Texte « comme chez Uber » |
| Déposer une demande | 4 + 1 saisie (6 si l'adresse n'est pas reconnue) | 1 | 2 | 0,9 s | 6 | Formulaire de 2 400 px de haut ; case adresse 18 px ; adresse du profil non reconnue → fenêtre « Choisir une ville » qui a placé l'annonce à Antibes au lieu de Grasse |
| Comparer et accepter une proposition | 5 (Profil → Mes demandes → carte → « Accepter ce prestataire » → Accepter dans le chat), + fixer le RDV | 0 | 3 | 2,8 s (liste) | 4 | Introuvable depuis la barre du bas ; « Accepter ce prestataire » ouvre le chat au lieu d'accepter ; l'en-tête du chat affiche encore 100 € « à valider » alors que l'offre est à 90 € |
| Écrire au prestataire | 3 | 1 | 3 | 0,7 s | 6 | 20 conversations toutes nommées « Audit P. » sans titre de mission ; bouton d'envoi sans libellé accessible ; bouton retour 27 px |
| Retrouver sa facture | 2 (Agenda → Factures) | 0 | 2 | 0,7 s | 8 | Rangée « Mes opérations » aussi dans Profil : deux chemins, deux présentations |
| Laisser un avis | non atteint en 3 appuis | — | — | — | 3 | Onglet « Terminées » : les missions ne sont pas des boutons (rien à toucher) ; l'avis passe par la facture ou le chat |
| Ouvrir un litige | ≈ 5 + 1 saisie (estimé) | 1 | 2 | — | 4 | Drapeau du chat (en-tête) petit et sans libellé ; à côté, « Demander l'attestation d'assurance » se touche par erreur (fait pendant le test) |
| **Pro** — se connecter | 1 | 2 | 2 | 2,8 s (Mon entreprise) | 8 | Atterrit sur Mon entreprise et non sur les demandes |
| Voir les demandes autour de soi | 1 | 0 | 2 | 0,8 s | 7 | Fenêtre « Où êtes-vous ? » à chaque nouvelle connexion ; tableau de bord dit « 5 (puis 6) demandes près de vous », la carte en montre 3 |
| Répondre à une demande avec un tarif | 5 + 1 saisie | 1 | 3 | 0,7 s | 4 | Les boutons « Contacter le client » / « Proposer mon tarif » sont **sous la barre du bas** : il faut « Agrandir » (1 appui caché). Montant non prérempli (« Prix de départ » en gris) : bouton grisé sans explication. Titre « Proposer un **nouveau** tarif » pour une première offre |
| Accepter une réservation | 2 pour la voir (Messages → conversation) ; rien à accepter | 0 | 3 | 0,7 s | 6 | Une réservation directe est confirmée d'office : pas d'« Accepter / Refuser » côté pro, contrairement à la demande |
| Voir sa mission du jour | 1 (Agenda) | 0 | 2 | 0,7 s | 8 | Pas d'onglet « Mission » chez le pro (le client en a un) |
| Ajouter une prestation (Mes tarifs) | 4 + 2 saisies | 2 | 2 | 0,7 s | 7 | Bulle « commentaire » posée sur le formulaire (masque « Nettoyage ») |
| Déposer une pièce | 4 (Entreprise → Mes pièces → Fichier → choix du fichier) | 0 | 2 | 0,7 s | 5 | Lien « Mes pièces » texte 20 px de haut en bas de page ; boutons Photo 76×31, Voir 24×18, Supprimer 20×20 ; badge « en cours de traitement » coupé |
| Retrouver ses revenus | 2 | 0 | 2 | > 1,5 s (« Chargement… ») | 6 | Lien « Revenus » 20 px de haut |
| Passer en espace client et revenir | 2 | 0 | 2 | 0,7 s | 9 | Bon : bouton en haut de la carte des deux côtés |

**Comparaison au 07/11** (13 appuis particulier depuis la plaquette, 30 et plus pour un prestataire, inscription comprise) : les parcours ne sont pas les mêmes, mais réserver passe à 9 appuis depuis la carte (cible 6), répondre à une demande à 5 + 1 saisie, accepter une proposition à 5 sans le rendez-vous. Le client et le pro tiennent la cible de 3 appuis pour messages, facture, agenda, demandes, bascule ; pas pour réserver, accepter une offre, avis, litige, pièces.

## Fenêtres au démarrage
- Client, première ouverture de `/map` : « Où êtes-vous ? » (fenêtre bloquante, croix 32×32) + bandeau « Installer le raccourci PING » (croix 34×34) = **2 appuis** avant d'agir ; la fenêtre bloque même le bouton « Déposer une demande ». Mémorisé ensuite sur le même téléphone.
- Pro : bandeau d'installation sur Mon entreprise, puis « Où êtes-vous ? » sur Demandes = **2 appuis**.
- Le bandeau d'installation réapparaît par-dessus les fiches et Mes demandes tant qu'il n'est pas fermé ; la bulle verte « Laisser un commentaire » recouvre aussi les formulaires et les cartes.

## Cibles tactiles < 44 px (relevé)
Menu 34×34 ; croix des fenêtres 32-34 ; retour du chat 27×27 ; « ← Retour » 58×20 ; puces de service 35 px de haut ; cases à cocher 18×18 (réservation, demande) ; créneaux horaires 83×42 ; « Annuler cette demande » 131×17 ; Mes pièces : Voir 24×18, Supprimer 20×20, Photo/Fichier 31 px ; liens Mon entreprise (« Mes pièces », « Revenus », « Modifier mes informations ») 18-20 px ; `/documents` retour 30×30 ; liens d'attribution de la carte 11 px.

## Poids et erreurs
- JavaScript transféré : **535 Ko** (compressé) sur `/map` et `/pro/carte`, 864-880 Ko au total ; première image 0,35-0,5 s, carte utilisable environ 1,5 s après la connexion.
- Erreurs à chaque page (la console en est pleine) : 404 `service_catalog`, `rpc/provider_docs_status`, `rpc/provider_docs_checked`, `rpc/presence_state`, `rpc/book_service`, `reports` ; 400 `services` (colonne `hidden`), `provider_profiles` (`accepts_cesu_prefinance`), `documents`. Le code de la refonte est en production sans ses migrations : badges de pièces, présence « en ligne », catalogue de services et signalement ne marchent pas (l'app se rabat sur l'ancien comportement).

## Les 10 améliorations qui gagnent le plus d'appuis
1. **Fenêtre de position : ne plus l'ouvrir d'office** ; bandeau discret dans la carte, ville déduite de l'adresse du profil. `src/components/LiveMap.tsx` (ou le composant « Où êtes-vous ? » de `/map` et `/pro/carte`). Gain : 1 appui par appareil, et plus de blocage de « Déposer une demande ».
2. **Bandeau d'installation : après la 1re action réussie**, jamais au premier écran ni par-dessus une fiche. Composant d'installation (layout). Gain : 1 appui + gêne visuelle.
3. **Boutons de la demande côté pro au-dessus de la barre du bas** (volet à mi-hauteur qui montre « Proposer mon tarif »). `src/app/pro/carte/page.tsx`. Gain : 1 appui caché sur chaque réponse.
4. **Montant prérempli** avec le prix du pro (et non un texte gris) et titre « Proposer un tarif ». `src/app/mission/[id]/chat/page.tsx`. Gain : 1 saisie, plus de bouton grisé incompris.
5. **Réservation : adresse du profil confirmée par défaut** (supprimer la case 18 px ; la confirmation vaut au bouton final) et valider avant d'ouvrir la fenêtre de paiement. `src/app/mission/new/page.tsx`, `src/components/AddressChoice.tsx`. Gain : 1 appui, 2 en cas d'oubli. Réserver passe à 5 depuis la fiche, 8 depuis la carte.
6. **« Accepter ce prestataire » accepte vraiment l'offre** (avec confirmation) au lieu d'ouvrir le chat ; l'en-tête du chat suit l'offre en cours. `src/app/client/demandes/page.tsx`, chat. Gain : 1-2 appuis.
7. **« Mes demandes » visible sans passer par Profil** (onglet de l'agenda ou carte sur `/map` quand une demande a une proposition). `src/app/agenda/page.tsx` ou `src/app/map/*`. Gain : 1-2 appuis.
8. **Avis et litige en un appui depuis la mission terminée** : rendre les lignes de l'onglet « Terminées » cliquables, avec « Noter » et « Signaler un problème » visibles ; drapeau du chat avec libellé. `src/app/agenda/page.tsx`, chat. Gain : 2-3 appuis chacun.
9. **Liens de Mon entreprise en vraies rangées de 48 px** (Mes pièces, Revenus) et boutons de Mes pièces à 44 px. `src/app/pro/dashboard/page.tsx`, `src/app/pro/documents/page.tsx`. Gain : moins d'appuis ratés.
10. **Appliquer les migrations de la refonte** (service_catalog, provider_docs_status/checked, presence_state, book_service, reports, colonnes `services.hidden`, `provider_profiles.accepts_cesu_prefinance`, `documents`) ou retirer les appels. `supabase/a_coller/`. Gain : moins d'attente et de requêtes en échec à chaque page, badges et signalement fonctionnels.

Autres corrections rapides : agrandir les cases à cocher, retour du chat et Menu à 44 px ; titre de mission dans la liste des messages ; bulle « Laisser un commentaire » masquée quand un volet ou un formulaire est ouvert ; compteur « demandes près de vous » du tableau de bord aligné sur la carte ; retirer « comme chez Uber ».
