# Allègement des écrans chargés : mesures avant / après (23/11/2026)

Méthode : Playwright mobile 390x844 tactile, deviceScaleFactor 1, comptes audit client et pro. Avant = production
(nexto-eta.vercel.app). Après = build local de cette branche (`npm start`, même base de données). Captures et mesures brutes :
`docs/audit-2026-11-23/` (`*-avant.png`, `*-apres.png`, `mesures-avant.json`, `mesures-apres.json`).
Définitions : mots / boutons = éléments visibles au premier écran (sans défiler) ; mots page = tout le texte de la page ;
hauteur = hauteur de défilement en px ; cibles < 44 = éléments interactifs de la page ; recouvrements = éléments du premier écran
dont le centre est couvert par un autre (mesure grossière : la barre du bas fixe compte). Temps utile = moment où 90 % du texte final est là.

## Écrans mesurés (avant, production)
| Écran | mots 1er écran | boutons 1er écran | mots page | hauteur | cibles < 44 | requêtes (6 s) | temps utile |
|---|---|---|---|---|---|---|---|
| Commande client | 133 | 7 | 229 | 1684 | 0 | 111 | 2,1 s |
| Commande pro | 132 | 6 | 183 | 1351 | 0 | 113 | 2,0 s |
| Mission du jour client / pro | 77 / 113 | 11 / 8 | non relevé / 171 | 1172 / 1456 | 0 / 0 | 112 / 112 | 1,8 / 2,3 s |
| Chat client / pro | 151 / 137 | 11 / 10 | 322 / 305 | 2396 / 2029 | 1 / 3 | 128 / 129 | 1,7 / 2,2 s |
| Agenda client / pro | 149 / 137 | 18 / 16 | 392 / 342 | 2622 / 2395 | 0 | 101 / 104 | 2,4 / 2,7 s |
| Mon entreprise (pro) | 88 | 15 | 370 | 3138 | 0 | 116 | 2,3 s |
| Carte client / pro | 72 / 115 | 30 / 26 | 151 / 139 | 844 | 3 / 3 (mentions de la carte, 11 px) | 153 / 139 | 2,9 / 2,5 s |
| Fiche prestataire | 165 | 11 | 402 | 2423 | 0 | 109 | 1,7 s |
| Réservation | 153 | 41 | 328 | 1672 | 0 | 107 | 1,1 s |
| Facture client / pro | 152 / 145 | 10 / 9 | 301 / non relevé | 1993 / 1713 | 0 | 106 / 109 | 2,8 / 2,6 s |

## Corrections (6 sur 8 permises) et gains
| # | Correction | Avant | Après |
|---|---|---|---|
| 1 | Agenda : au plus 2 litiges en tête, le reste derrière « Voir les N autres litiges » (44 px) | client : 392 mots page, 2622 px, 149 mots 1er écran | 240 mots, 2012 px, 103 mots (pro : 342 -> 216 mots, 2395 -> 1868 px, 137 -> 97) |
| 2 | Réservation : les horaires déjà passés du jour ne s'affichent plus (au lieu de grisés) | 41 boutons, 12 recouvrements, 328 mots, 1672 px | 32 boutons, 3 recouvrements, 298 mots, 1572 px (dépend de l'heure : mesuré à 13 h) |
| 3 | Commande : ligne « Prestation » (déjà dans l'en-tête), phrase « prix figé » (déjà dans la pastille « Tarif validé · prix figé ») et note « Adresse de votre profil » retirées | client 229 mots, 1684 px ; pro 183 mots, 1351 px | client 206 mots, 1561 px ; pro 164 mots, 1250 px |
| 4 | Fiche prestataire : un seul « Réserver » quand il n'y a qu'une prestation à prix fixe (celui de la barre du bas, avec le prix) | 11 boutons | 10 boutons |
| 5 | Cibles tactiles 44 px : « Afficher mon QR d'arrivée », « Scanner le QR du client », « Le client n'est pas là », « Itinéraire Google Maps » | chat : 1 + 3 cibles < 44 px (35 à 42) | 0 |
| 6 | (inclus dans 1) bouton d'expansion à 44 px, état conservé jusqu'au changement de page | | |

Aucune règle, prix, texte juridique, mention de facture, adresse ou consentement GPS touché. Les litiges masqués restent un appui plus loin.

## Non obtenu / non prouvé
- Requêtes réseau : aucune réduction. Chaque écran fait 100 à 150 requêtes (dont 13 à 21 sur `transactions`, 7 à 12 sur `provider_profiles`) ;
  une part vient du préchargement volontaire de `TabPrefetch` (écrans voisins lus d'avance). Seuls 7 doublons exacts sur 56 appels Supabase
  (commande) : un partage global de requêtes rapporterait peu et touche tous les écrans, non fait.
- Temps utile : les différences avant (prod) / après (local) ne sont pas comparables (pas de latence Vercel en local).
- Non allégés faute de preuve sûre : facture (mentions légales), Mon entreprise (le bloc profil répète les lignes Hub Mes tarifs / Mes pièces / Mes revenus
  et « Mon annonce » : à trancher avec Romain), carte (mentions OpenFreeMap 11 px : obligation d'attribution), bandeau rouge « Votre prestataire est arrivé »
  qui recouvre le bas des écrans d'une autre mission du jour.
- Après = build local avec la clé publique du projet passée en variable d'environnement au build ; rendu non validé sur Vercel avant déploiement.
- Rejoué en local : agenda (2 -> 10 litiges au clic), réservation (créneau choisi, « Confirmer la réservation » actif, rien envoyé), fiche (Réserver mène à /mission/new), commande, chat, jour.
