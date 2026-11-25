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
Audit annonce / carte fait : `AUDIT-ANNONCE-CARTE.md`. Maquette v14, version allégée (remplace v13 et v12) : `docs/maquette/maquette-annonce-v14.html` (+ .png), en attente d'accord de Romain. Décisions à prendre : A-TRANCHER u, p, q. Aucun code touché. Prochain pas Prestataire : filtre sur l'annonce, parcours de publication en 3 étapes, suppression de l'annonce. Bloquant côté Données SQL : flou 50 m (position exacte exposée).

## Bilan du profil prestataire au 26/11/2026 (lu dans le code, non vérifié en production)
**Pièces, en place :** pièce d'identité, assurance RC Pro, justificatif SIRET/Kbis, diplôme (facultatif), SAP, RIB (`src/lib/documents.ts`). Fichiers dans le bucket privé `documents` (lisible par le propriétaire et l'admin). Statut par pièce (en contrôle, valide, refusée avec motif), date de fin de validité, alertes d'expiration et de refus (`pieces.ts`), alerte admin (057). Mise à jour par le pro depuis « Mes pièces ». Le numéro de la carte d'identité n'est pas stocké, seulement la photo : voulu (RGPD).
**IBAN :** saisi et contrôlé (format) dans `provider_private` (025), pour les virements ; il sert au séquestre plus tard.
**Pour valider le prestataire côté PING (hors paiement) il reste :** (1) filtre sur l'annonce, parcours en 3 étapes, suppression d'annonce (cette session, après accord sur la maquette v14) ; (2) flou de 50 m de la position, urgent (Données SQL, A-TRANCHER w) ; (3) pastille admin des pièces refusées non vue (D-09) et Décision PING non jouée (D-05), côté Admin ; (4) absence réelle et clôture sur preuve non rejouées (D-10) ; (5) GPS précis iPhone, Masquer en écriture réelle (non vérifié).
**Manque connu, deux sujets confiés à la session « PING · Paiement et médiation » :** moyen de paiement (prestataire de paiement non choisi, séquestre éteint) et médiateur.

## À faire et notes
Voir `A-FAIRE.md`, section Prestataire.
