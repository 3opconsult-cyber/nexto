# Profil Prestataire (pro) (créé le 25/11/2026)
Session « PING · Prestataire ». Zone de code : `src/app/pro`, côté vendeur de `src/app/mission`, `src/components/ProMonthBlock.tsx`, `OrdersInProgress.tsx`, `MonAnnonceCard.tsx`, `VisibilitySwitch.tsx`.

## Ce qui est propre
Demandes autour de moi, bouton PING, Mon entreprise, annonce, tarifs (forfait / horaire / devis), disponibilités, pièces, visibilité Visible / Masqué, « Je pars », QR, « Je suis en intervention ici », revenus, paiements (IBAN).

## Règles
Adresse du client seulement mission confirmée ET payée ; seul le prestataire pose l'arrivée ; nouveau prestataire réservable tout de suite ; PING = mise en relation. Détail : `REGLES-METIER.md`.

## Argent
Renvoi : `REGLES-METIER.md` (Prix et facturation, Litige) ; sa facture et sa commission : `RUBRIQUE-FACTURATION.md`.

## Code
`src/lib/pricing.ts`, `billing.ts`, `presence.ts`, `arrival.ts`, `liveZone.ts`, `proNearby.ts`, `services.ts`. Tests : `prestataire-ecrans.mjs`, `parcours.mjs` (B).

## Si ton sujet touche une rubrique
Même tableau que `PROFIL-PARTICULIER.md` (Design, Facturation, Règles métier, Données SQL, Prospection et communication).

## État au 26/11/2026
Audit annonce / carte fait : `AUDIT-ANNONCE-CARTE.md`. Maquette v13 (charte de l'app, remplace v12) : `docs/maquette/maquette-annonce-v13.html` (+ .png), en attente d'accord de Romain. Décisions à prendre : A-TRANCHER u, p, q. Aucun code touché. Prochain pas Prestataire : filtre sur l'annonce, parcours de publication en 3 étapes, suppression de l'annonce. Bloquant côté Données SQL : flou 50 m (position exacte exposée).

## À faire et notes
Voir `A-FAIRE.md`, section Prestataire.
