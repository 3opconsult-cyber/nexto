# Contre-audit v6 — Admin et onglets d'analyse (17/11/2026)

Tests Playwright sur public/maquette.html (390×844, 1280×900). 0 erreur JS.

## P0
1. Admin : grande partie de l'admin réel absente de la maquette, sans mention dans Audit/QC : Transactions (liste missions, sous-total, frais, commission), registre Documents et factures (horodaté, 10 ans, export), Conformité (échéances pièces, alerte 45 j, expiration RC Pro), Signalements, Paiements (état PSP, pare-feu commissions, suspension/levée, alertes, plafond impayés, saisie IBAN PING), Carte en direct, Prospection/CRM, Communication (/bienvenue, plaquettes, animations), Visites (/l/), Parcours, fiche utilisateur + e-mail. Attendu : repris, ou mentionné explicitement « reste à l'identique dans le code ».
2. « Signaler » dans une conversation : toast seulement, aucune file Signalements côté admin.

## P1
3. Menu > Support PING (client et pro) : affiche « Choisissez ce qui s'est passé », aucun écran. Cause : ACT.dgo défini deux fois (la version litige écrase la version menu).
4. « Voir comme » : depuis le panneau « Aller à », Création de l'activité / Profil envoyé créent un 13e compte et un 9e prestataire (visibles carte client et Personnes).
5. Accueil admin « Inclure les fictifs » : tuile Annonces 16 (dont 11 fictives) mais liste de 5 ; autres chiffres ne bougent pas.
6. Litige > Geste 30 € : pas de confirmation, montant fixe, deux messages identiques si répété, clôture « non retenu » possible après geste, facture FACT-2026-0031 reste 90 € À payer sans avoir ni dette, texte « retenus sur le prochain versement » faux avec virement direct, carte clos dit encore « tant que le dossier est ouvert ».
7. Catalogue : doublon « Ménage » accepté ; pas de modification/suppression ; masquer Ménage sans avertissement (Nina disparaît, 2 demandes ménage disparaissent) ; « Pièces demandées » inutilisé (seul Bâtiment a un effet). Attendu : refus doublons, modifier, avertir de l'impact, pièces du service dans l'inscription et Mes pièces.
8. Réglage des taux : appliqué à chaque +/−, sans Enregistrer ni confirmation, pas de décimales, pas de total, pas d'historique ; seuil 0-30 par 5 au lieu de 0-59. Attendu : même saisie que /admin/commission.
9. Virements : pas de statut en retard, échéance 15 j, dette, suspension ; IBAN PING affiché « FR76 … 7781 » chez le pro alors qu'il est vide en réalité et qu'aucun écran admin ne permet de le saisir.
10. QC faux : « Réponse à une demande : Contacter ouvre la conversation » (par défaut seul « Proposer mon tarif » : régression vs prod) ; « Boutons » (point 3) ; « Admin chiffres » (point 5) ; « Voir comme lecture seule » partiel (point 4) ; lignes Police Quicksand prod dépassées (corrigée commit 4cf6605).

## P2
11. Derniers inscrits : 4 premiers comptes au lieu des plus récents ; heure = dernière connexion.
12. Personnes/Annonces : rangées inertes ; Voir comme limité à Amélie et Marie ; chiffres incohérents (Amélie 1 achevée / 42 avis ; Inès 0 / 33).
13. Pièces : « Nom lu sur la pièce » suggère une lecture automatique ; pas de date d'expiration à la validation ; après refus la fiche de Nina dit « Réservable après contrôle » ; « Profil envoyé » dit « en contrôle » alors que la ligne dit « À ajouter ».
14. Litiges : dossier initial déjà « Échéance dépassée » non signalé à l'accueil ; « Clos le » recalculé à chaque affichage.
15. 1280 px : barre latérale 5 entrées, Commissions/Catalogue/Retours seulement depuis l'Accueil.
16. Service activé avec 0 prestataire annoncé dans la phrase d'accueil.
17. « Réalisé » inclut factures à payer et en litige : dire « Facturé ».
18. Propositions gardées en localStorage même après ?r= : prévoir « Revenir aux recommandations ».

## Ce qui marche
3 vignettes ; boutons de l'app bloqués en Voir comme ; validation/refus pièces avec effet des deux côtés ; taux figés et seuil corrects ; chiffres accueil exacts fictifs masqués ; médiation ; nouveau service propagé partout ; 198 « Voir » corrects ; Propositions change le comportement ; 0 mot interdit ; pas de débordement 390 px.
