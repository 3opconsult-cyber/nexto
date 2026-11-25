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

## État au 26/11/2026 (fin du bloc 2)
Maquette v14 validée par Romain (`docs/maquette/maquette-annonce-v14.html`). Audit : `AUDIT-ANNONCE-CARTE.md`.
**Bloc 1, poussé (non vérifié en production) :** carte vers `providers_nearby_public` avec repli ; filtre téléphone/e-mail/chiffres sur l'annonce ; facture « Reçu », indemnité 40 € aux seuls clients professionnels, lignes HT/TVA si `legal.tva_taux`, référence au pied.
**SQL écrit, à coller par Romain :** 064 (flou 50 m) puis 065 (numéros continus, références, CRM) : `supabase/a_coller/README.md` lignes 19 et 20. Non touchées.
**Bloc 2, fait dans le code, tsc et build verts, NON vérifié en production (poussé de nuit, test de jour à jouer) :**
1. Résumé d'épingle (aperçu mobile) : une ligne d'identité, trois repères (identité, assurance, CESU), un seul bouton fort « Réserver · prix », lien « Voir la fiche ». « Contacter » passe sur la fiche (reste visible dans l'aperçu si le pro est hors ligne). Fiche `/pro/[id]` : les lignes « Vérifications » deviennent un seul bloc « Repères » (identité, assurance, SIRET, Urssaf, CESU, crédit d'impôt si n° SAP, « Sans TVA » / « TVA applicable ») + phrase sur l'adresse. Aucune migration nécessaire : la fiche lit déjà `provider_profiles` ; la carte lit en plus `vat_status` et `sap_number` (`fetchProviderFlags`, repli si colonnes absentes). Le panneau ordinateur de la carte garde ses lignes « Vérifications » (non changé).
2. Bandeau « Ouvrir la commande » (`ChatOrderStrip.tsx`) sous l'en-tête du chat, des deux côtés, vers `/mission/[id]/commande` ; ambre « Litige en cours » si un litige est ouvert (lecture seule).
**Reste (bloc 3, dans cet ordre) :** (3) litige : contre-offre, annuler son litige, demande de règlement 24 h avec refus motivé : BLOQUÉ tant que Romain n'a pas validé A-TRANCHER v ; (4) parcours de publication en 3 étapes ; (5) supprimer son annonce (confirmation, sans toucher missions ni factures) ; (6) taux de TVA du prestataire assujetti : exige une migration neuve (colonne `vat_rate` sur `provider_profiles` + recopie dans `legal.tva_taux` par `invoice_pro_tax_status`, 039), à écrire en 066 et à faire coller par Romain, puis le champ dans l'onboarding. GPS à « Je pars » (A-TRANCHER u) : non décidé, non codé.
**À rejouer demain de jour :** `scripts/e2e/non-regression.sh` après déploiement (aperçu de carte, fiche, chat des deux côtés).
**Environnement :** `node_modules` était un lien vers lui-même (suivi par git) ; `npm ci` l'a remplacé par un vrai dossier. Cette suppression n'est PAS commitée.

## Bilan du profil prestataire au 26/11/2026 (lu dans le code, non vérifié en production)
**Pièces, en place :** pièce d'identité, assurance RC Pro, justificatif SIRET/Kbis, diplôme (facultatif), SAP, RIB (`src/lib/documents.ts`). Fichiers dans le bucket privé `documents` (lisible par le propriétaire et l'admin). Statut par pièce (en contrôle, valide, refusée avec motif), date de fin de validité, alertes d'expiration et de refus (`pieces.ts`), alerte admin (057). Mise à jour par le pro depuis « Mes pièces ». Le numéro de la carte d'identité n'est pas stocké, seulement la photo : voulu (RGPD).
**IBAN :** saisi et contrôlé (format) dans `provider_private` (025), pour les virements ; il sert au séquestre plus tard.
**Pour valider le prestataire côté PING (hors paiement) il reste :** (1) filtre sur l'annonce, parcours en 3 étapes, suppression d'annonce (cette session, après accord sur la maquette v14) ; (2) flou de 50 m de la position, urgent (Données SQL, A-TRANCHER w) ; (3) pastille admin des pièces refusées non vue (D-09) et Décision PING non jouée (D-05), côté Admin ; (4) absence réelle et clôture sur preuve non rejouées (D-10) ; (5) GPS précis iPhone, Masquer en écriture réelle (non vérifié).
**Manque connu, deux sujets confiés à la session « PING · Paiement et médiation » :** moyen de paiement (prestataire de paiement non choisi, séquestre éteint) et médiateur.

## À faire et notes
Voir `A-FAIRE.md`, section Prestataire.
