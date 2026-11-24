# Mémoire critique-performance-donnees (vérifié le 21/11/2026)
## Mesures connues (audit du 21/11, local sauf mention)
- Chat : 63-103 -> 39-43 requêtes ; `/auth/v1/user` 7-9 -> 1 ; `presence_state` 13-19 -> 7 ; `unread_counts` 4-6 -> 2. Agenda 54-62 -> 29-35 ; Messages 48-57 -> 22-30 ; fiche pro 56 -> 25 ; /pro/paiements 53 -> 30.
- /pro/documents : 1,3-2,0 s avant le contenu. Délais mesurés en local : à remesurer en production.
## Causes déjà traitées
- `getUser` partagé 15 s dans le client Supabase ; lecture du chat en parallèle ; sondes de migration mémorisées ; chargeurs `src/lib/*Loaders.ts`, `screenCache.ts`, `loginWarm.ts`.
## Cause restante
- `presence_state` : 3 missions du jour candidates x 2 lectures ; il faut une RPC groupée (changement de base, migration à coller par Romain : AMELIORATIONS A-001).
## Qualité des données
- Données fictives (colonne `fictif`), prestataires Fictif 1-19, missions « QA ... », 4 demandes d'un vrai utilisateur : nettoyage = suppression, accord requis.
- Table `_sauvegarde_missions_test_30_10` (copie des 7 missions supprimées). Sauvegardes Supabase non vérifiées.
- Contrainte `transactions_buyer_ne_seller` validée ; `requests.description` NOT NULL.
## Critères
- Compter les requêtes par écran, repérer N+1 et lectures en série, RPC répétées, colonnes `select *`, index manquants (à confirmer par un plan d'exécution : non fait).
- Toute proposition donne la mesure avant, la mesure attendue après et la façon de la mesurer.
## Limites
- Aucun accès base en lecture dans cette passe : les index et volumes sont [à compléter].
## Format d'une proposition
- Une ligne : axe, proposition, preuve (fichier ou mesure), impact 1-5, effort 1-5, risque. Maximum 5 par passage.
- Lecture seule : ne rien écrire dans le code ni dans AMELIORATIONS.md ; l'agent principal décide et consigne.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Passe 1 (21/11) : A-030 à A-034 ; A-032 faite. Index inconnus (tables créées hors dépôt) : lire pg_indexes avant toute proposition ; chat 220 ko dont 65 propres ; presence_state ~7 appels au chargement.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : les requêtes réseau (100 à 150 par écran) viennent surtout du shell ; ne pas promettre un gain par écran sans mesure ; lire l'historique des mesures dans docs/refonte-*.
