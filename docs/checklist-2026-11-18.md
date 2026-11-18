# Check-list PING — 18/11/2026

Légende : [x] fait et vérifié · [~] en cours · [ ] à faire · [S] attend l'accès Supabase · [R] attend une décision de Romain

## Maquette (claude.ai/artifact/3fLDdSn5c5U17mMEyyS5fU)
- [x] Maquette v7 : design de l'app, carte au doigt, multi-activités, 3 profils + admin, onglets d'analyse
- [x] Audits sévères v5 (prestataire, client, admin) puis contre-audits v6, tous les défauts corrigés (154 rejeux verts)
- [x] Couleurs de carte alignées sur l'animation
- [x] Republier la maquette (après la carte de l'app)
- [x] Maquette complète arrivée → départ → facturation, client et prestataire (après l'audit en cours)

## Application en production
- [x] Police Quicksand chargée (titres)
- [x] Carte client multi-activités, zoom au doigt vérifié sur la prod
- [x] Hub admin 3 vignettes (Admin, Prestataire, Client), vérifié sur la prod
- [x] Textes CESU préfinancé, espèces retirées
- [x] Fond de carte aux couleurs de l'animation (carte vectorielle gratuite)
- [x] Audit arrivée/départ : QR sur place, GPS + code à distance, bouton d'accès rapide (barre et billet), facture
- [x] Lot 1 : quels défauts de la maquette existent aussi dans l'app
- [x] Lot 2 : admin, échappement HTML
- [x] Lot 3 : connexion vers le bon espace, ?next= respecté
- [x] Lot 4 : facture prestataire sans logo PING
- [x] Lot 5 : inscription prestataire, compte d'abord, brouillon gardé, « Plus tard »
- [x] Lot 6 : inscription sans perte de saisie
- [x] Lot 7 : vraie page « introuvable »
- [x] Lot 10 : textes (séquestre, pluriels)
- [x] Lot 11 : invitation à installer en bandeau compact
- [x] Lot 8 : carte client mobile (fiche fermable, volet 3 positions) — après le fond de carte
- [x] Lot 9 : carte pro (demandes visibles dès l'ouverture, filtre métiers, « Hors ligne ») — après le fond de carte
- [x] Lots 12 à 16 : adresse obligatoire, proposition de tarif, jour du RDV, fiche prestataire, conversations vides — selon le lot 1
- [x] Lots 17 à 19 : admin recherche/tri, litiges/pièces/retours, chiffres et liens vrais — après le lot 2
- [x] Corrections arrivée/départ et bouton d'accès rapide — après l'audit
- [S] Lot 20 : activités du prestataire (fonction prête : supabase/a_coller/provider_services_public.sql)
- [S] Lots 21 à 27 : « vérifié par PING », pièces (refus, expiration), masquer un service, signalements, droits en base, catalogue de services en données, pièces par service
- [S] Comptes de test qa.… (supabase/a_coller/comptes_qa.sql)
- [S] Faille avance immédiate (le pro peut marquer « payée ») — avant toute activation
- [R] Lots 28 à 33 : agenda à onglets, bouton central « Demander », frise de suivi, accessibilité (couleur des boutons), visibilité d'un nouveau prestataire, geste commercial et avoir
- [R] CESU : chaque prestataire gère son crédit d'impôt (recommandé) ou PING intermédiaire Urssaf
- [R] Libellé unique de la bascule de mode
- [R] Anciens liens inconnus : page « introuvable » (choix par défaut) ou renvoi vers l'accueil
- [R] Wero : à demander à Stripe (séquestre et commission)

## Mise à jour 18/11 après-midi
- [x] Tous les lots sans base (1 à 19) en ligne et vérifiés sur la prod (factures 20/20, séparation 26/26, carte PING, admin).
- [x] App arrivée/départ en ligne (bouton Mission, écran Mission du jour, lecteur QR intégré, plus de GPS aux scans) ; [S] la sécurisation en base (migration 038 prête : supabase/a_coller/038_arrivee_depart_securise.sql).
- [R] Garder l'entrée « Mission » du menu latéral (visible seulement les jours de mission) ?
- [R] Campagnes et prospects d'exemple de l'admin : garder ou supprimer ?
