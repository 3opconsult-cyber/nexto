# Carnet de demandes de Romain (créé le 23/11/2026, tenu par l'agent principal)
Une ligne par demande : id | demande | statut (faite / partielle / attend Romain / bloquée / en cours) | preuve ou raison | date. Le gardien-fidelite compare ce carnet à la production.
| id | demande | statut | preuve ou raison | date |
|---|---|---|---|---|
| D-01 | Carte « type Waze », gratuite | partielle | variante en ligne sur `/map?carte=waze` (cfef3bb), défaut inchangé tant que Romain n'a pas choisi | 22/11 |
| D-02 | Process de commande : QR sur place / client absent (géoloc + photo + code), bouton d'accès rapide | faite | parcours A 34/34, B 42/42 en production | 19-22/11 |
| D-03 | Réservation à accepter / refuser ; une expirée disparaît (agenda, carte) | faite | 052-053 collés, tests 24/24 | 20/11 |
| D-04 | Refus ou expiration payée : remboursement automatique | partielle | code prêt, séquestre éteint (aucun PSP branché) | 20/11 |
| D-05 | Litige : paiement bloqué, arrangement, intervention et Décision PING | partielle | arrangement testé en vrai ; Décision PING non jouée (compte admin) | 20/11 |
| D-06 | 24 h pour déclarer un incident, ensuite paiement libéré | faite | 055 vérifié (litige refusé après 24 h) | 20/11 |
| D-07 | Annulations par palier ; après l'arrivée : frais totaux + alerte antifraude | faite | 056/060 collés, annulations 37/37, essai réel 97,20 € | 20-21/11 |
| D-08 | Zone d'intervention 2 km, 12 h, consentement | faite | 058 collé, pieces-position 11/11 | 20/11 |
| D-09 | Pièces refusées / expirées, alerte à PING Admin | partielle | code et 057 collés ; pastille admin non vue (pas de compte admin) | 20/11 |
| D-10 | Prestataire absent, report, clôture sur preuve | partielle | règles en base testées ; absence réelle et clôture sur preuve non rejouées | 20/11 |
| D-11 | Scénarios client / prestataire / admin en frise | faite | https://claude.ai/artifact/TNac2HsQWUGDRwtqCjbFG6 (version 2) | 20-21/11 |
| D-12 | Prompt maître v3 : mémoire, agents, contrôles, critiques | partielle | phases 1 à 3 faites ; 061 à coller ; workflow GitHub exécuté | 21/11 |
| D-13 | Alertes admin lisibles, chat en direct | attend Romain | code en ligne (b4c6437), SQL 062 à coller après 061 | 22/11 |
| D-14 | Bon de commande ouvert depuis le chat | faite | « Voir la commande » en production, `/commande` à actions (04e7109) ; écritures non testées | 22/11 |
| D-15 | Animations plus lentes et courtes, voix off | partielle | 3 vidéos courtes en ligne (1db5f89) ; voix non fournie (décision Romain) | 22/11 |
| D-16 | Grille tarifaire : ajouter, modifier, supprimer | faite | recette du 22/11 : OUI (4 appuis ajout, 3 retrait) | 22/11 |
| D-17 | Annonce du client : critères simples, modifiable | partielle | un seul écran, 3 appuis ; pas de « Modifier » | 22/11 |
| D-18 | E-mails (expiration, alertes, litiges) | attend Romain | Resend, clé service Supabase, CRON_SECRET non posés (non vérifié) | 20/11 |
| D-19 | Séquestre fonctionnel | bloquée | aucun prestataire de paiement choisi, jamais essayé | 29/10 |
| D-20 | Gardien de fidélité (cet agent) | en cours | PR en brouillon, non fusionnée | 23/11 |
