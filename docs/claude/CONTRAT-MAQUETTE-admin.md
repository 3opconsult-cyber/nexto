# Contrat maquette / application : Administration (public/admin.html et /admin/*) (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Accès | /admin servi par rewrite vers public/admin.html ; accès par compte is_admin | OK (code) | next.config.js:38 ; Invariant 18 ; redirection vers la connexion prouvée par le code seulement |
| Barre latérale | Rubriques : Marketplace, Communication, Finances, Contrôle ; une page par rubrique | OK (code) | public/admin.html:490 ; Q157 Q083 ; barre complète à 1 280 px non mesurée |
| Accueil | Réel par défaut, derniers inscrits, pipeline, retours | OK (code) | public/admin.html:550 ; A21 Q067 Q114 ; chiffres lus en base : NON VÉRIFIÉ (pas de compte admin) |
| Accueil | Chiffres fictifs marqués sur les vraies données | NON VÉRIFIÉ | Dépend des données lues par l'admin ; pas de compte admin pour le vérifier. Q038 |
| Accueil | Pastille admin d'alertes d'argent et de litige (062) | NON VÉRIFIÉ | Code dans src/lib/adminAlerts.ts (b4c6437) ; D-13 attend Romain : SQL 062 à coller après 061 ; non vu en production |
| Carte en direct | Prestataires disponibles, hors ligne, demandes ouvertes (carte réelle) | OK (code) | public/admin.html:3605 ; A30 |
| Utilisateurs | Liste, échappement systématique esc() des noms | OK (code) | public/admin.html:1498 ; Q070 ; lot 2 b2a6eb5 |
| Fiche utilisateur | Activité, pièces, e-mail | OK (code) | public/admin.html:1731 ; A35 |
| Fiche utilisateur | « Voir comme » en lecture seule | MANQUE | Libellé absent de public/admin.html (« Voir comme un client » n'existe que dans /pro/annonce). A35 Q114 |
| Annonces | Activité et annonces | OK (code) | public/admin.html:474 ; maquette « Annonces » |
| Transactions | Liste : date, statut, sous-total, frais client, commission, total | OK (code) | public/admin.html:2375 ; A25 |
| Pièces | Aperçu de la pièce, comparaison du nom, confirmation, badge allumé à la validation | OK (code) | public/admin.html:1006 ; A20 Q066 Q163 |
| Pièces | Refus avec motif ; plus récents d'abord | OK (code) | public/admin.html:4910 ; Q035 Q163 |
| Conformité | Échéances des pièces, alerte à 45 jours, expiration saisie à la validation | OK (code) | public/admin.html:1691 ; A27 Q163 ; HISTORIQUE.md l.648 |
| Documents et factures | Registre des factures lu dans la table invoices | OK (code) | public/admin.html:3763 ; A26 Q071 ; lot 19 |
| Documents et factures | Export CSV du registre horodaté | MANQUE | Aucun export CSV dans public/admin.html (recherche « csv » vide). A26 |
| Commissions | Taux lus dans l'admin, figés à la confirmation ; décimales, total en direct | OK (code) | public/admin.html:4265 ; Q099 Q161 ; /admin/commission (getRates) |
| Commissions | Heure entamée : seuil 0 à 59 min, historique, confirmation | OK (code) | src/app/admin/commission/page.tsx:137 ; Q161 ; invariant 2 et 4 |
| Paiements | Paiement en ligne éteint, IBAN de PING (vide par défaut), pare-feu des commissions | OK (code) | src/app/admin/paiements/page.tsx:18 ; A29 Q037 Q162 ; virements : annoncé / reçu |
| Paiements | Échéance 15 jours, retard, dette, suspension automatique et levée | OK (code) | src/app/admin/paiements/page.tsx:17 ; Q162 ; src/lib/payments/firewall.ts ; échéance de 15 jours non retrouvée dans le texte |
| Paiements | Séquestre actif | VOULU | Écrit mais ÉTEINT (A-TRANCHER b et d ; DEMANDES D-19) |
| Litiges | Liste cliquable vers le dossier /litiges/… ; paiement bloqué pendant un litige | OK (code) | public/admin.html:1021 ; A22 Q068 Q111 |
| Litiges | Décision PING (montant saisi, confirmé, avoir, un seul geste) | OK (code) | public/admin.html:4774 ; Q036 Q159 ; D-05 non jouée (pas de compte admin) |
| Annulations | Rubrique Annulations, prestataires qui annulent | OK (code) | public/admin.html:1040 ; D-07 ; alerte cancel_after_arrival |
| Signalements | File alimentée par la conversation ; classer, avertir, bloquer | OK (code) | public/admin.html:5022 ; A28 Q158 |
| Retours testeurs | Entrée dédiée, retours des testeurs | OK (code) | src/app/admin/retours/page.tsx:37 ; A23 Q069 Q012 |
| Catalogue des services | Ajouter un service (créé masqué), doublons refusés, impact annoncé avant de masquer | OK (code) | public/admin.html:1097 ; A01 Q020 Q118 Q160 ; décision 07/11 (HISTORIQUE.md l.622) |
| Catalogue des services | « Éligible CESU préfinancé et crédit d'impôt » par service | OK (code) | public/admin.html:5244 ; Q193 |
| Catalogue des services | Services proposés au-delà de ménage, repassage, nettoyage | VOULU | Mono-produit au lancement (HISTORIQUE.md l.47 ; A-TRANCHER n) ; Vitres en base non proposé, fin de chantier et remise en état absents du catalogue |
| Prospection | Prospects (CRM), campagnes et QR, partenaires ; exemples gardés | OK (code) | public/admin.html:1139 ; A31 Q072 ; exemples marqués gardés : décision 18/11 (HISTORIQUE.md l.630) |
| Supports et visuels | /bienvenue, plaquettes, animations avec leurs liens | OK (code) | public/admin.html:685 ; A32 |
| Visites (/l/) | Liens courts, visites, inscriptions | OK (code) | src/app/admin/visites/page.tsx:26 ; A33 Q072 |
| Parcours | Entonnoir de l'inscription à l'avis | OK (code) | src/app/admin/parcours/page.tsx:21 ; A34 |
| Droits (RLS) | Règles d'accès litiges, profils ; RLS invoices | NON VÉRIFIÉ | Contrôle en base impossible (accès Supabase refusé) ; A-TRANCHER h ; Q074 |
| Données lues par l'admin | Toute valeur affichée dépendant de la base (comptes, factures, litiges) | NON VÉRIFIÉ | Aucun compte administrateur disponible pour cet agent |
| Accueil admin | Tableau de bord administrateur | NON VÉRIFIÉ | Compte administrateur indisponible (règle : aucun compte admin de test) : capture maquette seule (maquette-admin-accueil-3.png) |
