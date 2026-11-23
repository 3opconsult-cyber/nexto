# Carnet de demandes de Romain (créé le 23/11/2026, tenu par l'agent principal)
Une ligne par demande : id | demande | statut (faite / partielle / attend Romain / bloquée / en cours) | preuve ou raison | date. Le gardien-fidelite compare ce carnet à la production.
| id | demande | statut | preuve ou raison | date |
|---|---|---|---|---|
| D-01 | Carte « type Waze », gratuite | partielle | variante en ligne sur `/map?carte=waze` (cfef3bb), défaut inchangé tant que Romain n'a pas choisi | 22/11 |
| D-02 | Process de commande : QR sur place / client absent (géoloc + photo + code), bouton d'accès rapide | partielle | ETAT.md l.18-19 : A 35/35, B 41/42 (resélection à rejouer, non revérifié) ; les chiffres 34/34 et 42/42 de la ligne d'origine ne figurent dans aucun document du dépôt | 19-22/11 |
| D-03 | Réservation à accepter / refuser ; une expirée disparaît (agenda, carte) | faite | 052-053 collés, tests 24/24 | 20/11 |
| D-04 | Refus ou expiration payée : remboursement automatique | partielle | code prêt, séquestre éteint (aucun PSP branché) | 20/11 |
| D-05 | Litige : paiement bloqué, arrangement, intervention et Décision PING | partielle | arrangement testé en vrai ; Décision PING non jouée (compte admin) | 20/11 |
| D-06 | 24 h pour déclarer un incident, ensuite paiement libéré | faite | 055 vérifié (litige refusé après 24 h) | 20/11 |
| D-07 | Annulations par palier ; après l'arrivée : frais totaux + alerte antifraude | faite | 056/060 collés, annulations 37/37, essai réel 97,20 € | 20-21/11 |
| D-08 | Zone d'intervention 2 km, 12 h, consentement | faite | 058 collé, pieces-position 11/11 | 20/11 |
| D-09 | Pièces refusées / expirées, alerte à PING Admin | partielle | code et 057 collés ; pastille admin non vue (pas de compte admin) | 20/11 |
| D-10 | Prestataire absent, report, clôture sur preuve | partielle | règles en base testées ; absence réelle et clôture sur preuve non rejouées | 20/11 |
| D-11 | Scénarios client / prestataire / admin en frise | partielle | https://claude.ai/artifact/TNac2HsQWUGDRwtqCjbFG6 (version 2) : preuve hors dépôt, non relue par le gardien | 20-21/11 |
| D-12 | Prompt maître v3 : mémoire, agents, contrôles, critiques | partielle | phases 1 à 3 faites ; 061 à coller ; workflow GitHub exécuté | 21/11 |
| D-13 | Alertes admin lisibles, chat en direct | attend Romain | code en ligne (b4c6437), SQL 062 à coller après 061 | 22/11 |
| D-14 | Bon de commande ouvert depuis le chat | partielle | « Voir la commande » en production, `/commande` à actions (04e7109) ; écritures non testées | 22/11 |
| D-15 | Animations plus lentes et courtes, voix off | partielle | 3 vidéos courtes en ligne (1db5f89) ; voix non fournie (décision Romain) | 22/11 |
| D-16 | Grille tarifaire : ajouter, modifier, supprimer | faite | recette du 22/11 : OUI (4 appuis ajout, 3 retrait) | 22/11 |
| D-17 | Annonce du client : critères simples, modifiable | partielle | un seul écran, 3 appuis ; pas de « Modifier » | 22/11 |
| D-18 | E-mails (expiration, alertes, litiges) | attend Romain | Resend, clé service Supabase, CRON_SECRET non posés (non vérifié) | 20/11 |
| D-19 | Séquestre fonctionnel | bloquée | aucun prestataire de paiement choisi, jamais essayé | 29/10 |
| D-20 | Gardien de fidélité (cet agent) | en cours | PR en brouillon, non fusionnée | 23/11 |
| D-21 | 5 à 10 minutes après la validation d'arrivée (délai à fixer ; question posée à Romain) | attend Romain | aucune trace dans le code ni dans A-TRANCHER.md (recherche 23/11) ; réponse non reçue | 22-23/11 |
| D-22 | E-mail quasi immédiat pour une proposition de report | partielle | type `reschedule_proposed` écrit (`src/lib/notifyServer.ts:41`) ; envoi réel dépend de Resend non posé (D-18) ; délai non mesuré | 22/11 |
| D-23 | Envoi immédiat des alertes (admin et parties) | partielle | audit du 22/11 : seules les pièces et les contrôles rouges déclenchent un e-mail à PING ; annulation après arrivée, absence, litige, virement non reçu : ni pastille ni e-mail ; 062 non collée (D-13) | 22/11 |
| D-24 | Test du GPS et du mode hors connexion | partielle | position d'intervention testée en base seulement (`pieces-position.mjs` 11/11) ; aucun test sur appareil ni hors connexion dans `scripts/e2e/` ; `src/` ne contient pas de gestion hors connexion trouvée | 22/11 |
| D-25 | Afficher les frais de service sur la carte (prix prestataire + 8 %) | attend Romain | revue du 23/11 §5 « Important » : la carte et la fiche ne disent rien des frais ; non fait, décision de présentation attendue | 23/11 |
| D-26 | Voix off des animations | partielle | voir D-15 : voix testée gratuitement (`docs/animations-nouvelles-2026-11-22.md` l.187), non fournie ; ligne doublon, fusionner avec D-15 | 22/11 |
