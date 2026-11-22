# Vérifications en production du 22/11/2026 (recette-tests)

Prod : https://nexto-eta.vercel.app, comptes audit `.invalid`, navigateur simulé (fuseau Paris). Captures : `docs/audit-2026-11-22/` (webp, 390 et 1280). Aucune modification de code, rien poussé.

## Tableau

| | Question | Réponse | Preuve |
|---|---|---|---|
| A | Chat entre les deux comptes | PARTIEL | Les deux accèdent au chat, le message de l'un arrive chez l'autre (après rechargement). Pas d'affichage en direct : 25 s sans recharger, ni l'expéditeur ni le destinataire ne voit le message. Pastille par conversation : oui (point rouge, aperçu en gras). Pastille de la barre du bas : saturée à « 9+ », non mesurable. Carte de commande : cliquable, mène à `/mission/[id]/commande`, mais on n'y modifie rien (lecture + choix « sur place / absent »). Reporter et Annuler sont sur la carte « Récapitulatif de la mission » du chat, pas sur la page commande. |
| B | Factures | OUI (sauf cas « particulier ») | `factures.mjs` 20/20. Mission du jour FACT-2026-00062 : prestation 90,00 € (en-tête « Audit Menage Pro », SIRET, EI), frais client PING-C 7,20 € (8 %), commission pro PING-V 15,30 € (17 %), pro perçoit 74,70 €. PDF reçus : 2370, 2258, 2369, 2267 octets, texte lu. Client : pas d'onglet Commission ; pro : pas d'onglet Frais. En-tête « particulier » (RECAP) : non vérifié en prod, aucun compte audit n'est prestataire particulier. |
| C | Grille tarifaire pro | OUI | Test réel « QA verif 22-11 repassage » : ajout 4 appuis + 1 saisie, 4 modes (forfait, à l'heure, forfait + heures sup., sur devis), modification 3 appuis, masquage 3 appuis, retrait 3 appuis avec fenêtre « Retirer cette prestation de votre catalogue ? ». Catalogue proposé : Ménage, Repassage, Nettoyage, Autre (pas Vitres). |
| D | Annonce du particulier | PARTIEL | Un seul écran, déposée en 3 appuis + 2 saisies (titre obligatoire, tout le reste facultatif). Visible chez le pro (carte, « à 106 m », position floutée 500 m, Proposer mon tarif / Contacter) seulement si le pro est à moins de 15 km. Modifier l'annonce : NON (seulement Annuler et Supprimer). |
| E | Deux univers séparés | OUI | `separation-espaces.mjs` 26/26. |
| F | Alertes d'argent admin | PARTIEL | Liste ci-dessous. Aucune ligne n'est lisible sans compte admin : rien n'a été vu côté admin. |
| G | Qui doit répondre | PARTIEL | Tableau ci-dessous, vérifié dans le code ; deux attentes sans délai ni explication. |

## A. Détail
- Mission d'essai : `6eb02a5e-5576-4d65-bc56-d419f4c6e96e` (annulée gratuitement en fin de test).
- Le message envoyé apparaît chez l'autre au rechargement. Le WebSocket Realtime s'ouvre ; aucune migration du dépôt n'ajoute `messages` à la publication `supabase_realtime` (cause probable, non vérifiée côté base).
- Chat client : carte « Récapitulatif de la mission » avec Reporter et Annuler (Reporter : grille de dates et règle des 24 h ; Annuler : « gratuit tant que le prestataire n'est pas parti »), choix de présence, lien « Récapitulatif du paiement » (client) / « Commande reçue » (pro).
- Le bon de commande en construction par un autre agent n'est pas jugé.

## B. Détail chiffré
Facture prestation 90,00 € ; frais de service client 7,20 € ; total payé 97,20 € ; commission pro 15,30 € ; net pro 74,70 €. Virement non encore noté (IBAN du prestataire non renseigné : message affiché). `parcours.mjs SCEN=A` : 18 OK, 3 KO, arrêt avant le scan. Cause : lancé à 19 h (Paris), le sélecteur n'offre que le lendemain 08 h, donc « Je pars » n'est pas ouvert (fenêtre de 2 h avant le RDV, `todayMission.ts`). Écart lié à l'heure, pas une régression prouvée. Les 3 documents du jour viennent du passage de 17 h 17 (parcours précédent, FACT-00062/00063).

## F. Alertes qui arrivent à l'administrateur (d'après le code)
| Alerte | Origine | Où l'admin la voit | Déclenchée en vrai |
|---|---|---|---|
| Pièce déposée à valider | 057, `admin_notifications` | Conformité (pastille) + accueil ; e-mail à ADMIN_NOTIFY_EMAIL | script du 21/11 (11/11), non rejoué, lignes non lisibles |
| Pièce qui expire | 057, `document_expiring` | Conformité, Échéances | non vérifié |
| Contrôle de nuit rouge/orange | 061, `controle_nuit` | Conformité, e-mail si rouge | non vérifié |
| Virement signalé non reçu / désaccord | 059, `payment_alerts` | `/admin/paiements` (libellés français) | script du 21/11 (13/13), non rejoué |
| Commission en retard, compte suspendu | 025, 054, 059 | `/admin/paiements` | non vérifié (cron) |
| Annulation après arrivée (`cancel_after_arrival`), annulation tardive aux frais (`late_cancellation_fees`), prestataire absent (`provider_no_show`), prestataire qui annule trop (`provider_cancellations`) | 056, 060 | `payment_alerts` ; `/admin/paiements` affiche le code brut, sans libellé français ; page Annulations pour les compteurs | script du 21/11 (37/37), non rejoué, lignes non lisibles |
| Litige ouvert, intervention de PING demandée | 054 | page Litiges + Conversations (filtres) ; pas de pastille ni d'e-mail | 24/24 le 21/11 ; non vérifié côté admin |
| Remboursement en ligne échoué (`refund_failed`), événement PSP non rattaché | code serveur | `/admin/paiements` | non vérifié (paiement en ligne éteint) |
Seules les pièces (et les contrôles rouges) déclenchent un e-mail à PING. Seules les pièces ont une pastille.

## G. Qui doit répondre
| Situation | Qui | Délai | Sans réponse | Écran |
|---|---|---|---|---|
| Réservation directe | prestataire | 24 h ou 2 h avant le RDV, au moins 30 min (052) | annulée, créneau libéré | explique (BookingCard) |
| Devis dans le chat | l'autre partie | aucun délai trouvé | reste en attente, rien ne l'expire | n'indique pas de délai |
| Report | l'autre partie | 24 h, au plus tard au RDV | RDV inchangé | explique |
| Adresse autre que celle du profil | prestataire | aucun délai trouvé (023) | reste « à valider », adresse non transmise | client : « en attente de validation », sans délai |
| Annulation par le client | personne | immédiat | sans objet | palier annoncé |
| Absence prestataire | client | après 30 min | le client déclare, annulation sans frais | indique l'heure |
| Présence du client | client | avant le jour | pro scanne le QR ; sinon clôture sur preuve | pro informé |
| Client muet à une étape | prestataire | 2 h | clôture sur preuve | explique |
| Fin de mission | client | fin fixée par PING après 24 h | incident possible 24 h après la fin | non testé |

## Manques par gravité
1. Chat non temps réel (A).
2. Alertes admin : libellés bruts, pas de pastille ni e-mail pour annulation après arrivée, prestataire absent, litige, virement non reçu (F).
3. Devis et adresse « à valider » sans délai ni sortie (G).
4. Annonce non modifiable (D).
5. Pastille de la barre du bas saturée à 9+ (A).
6. Vitres absent du catalogue de « Mes prestations » (C).
