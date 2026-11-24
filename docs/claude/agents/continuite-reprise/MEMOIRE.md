# Mémoire continuite-reprise (vérifié le 21/11/2026)
## État de production
- Vercel projet `nexto` (équipe nextoping) : production = commit 9b4ffc5 = tête de `main` (21/11/2026). Aucune étiquette `prod-*` n'existe encore.
- Migrations appliquées et vérifiées jusqu'à 060 (053-060 les 20-21/11). Romain colle le SQL : `supabase/a_coller/` (ordre dans son README).
- Base : projet `wmiawwaxwlvascyflpba` (eu-west-3). L'autre projet `ahtdevozpbeargnmvzcn` n'est PAS PING (un collage y a déjà eu lieu).
## Retour arrière
- Code : `git revert` ciblé (`-m 1` pour une fusion). Jamais de réécriture d'historique. Étiquette `prod-AAAA-MM-JJ` après chaque mise en ligne vérifiée.
- Déploiement : Vercel « Rollback » sur un déploiement READY ; ne défait pas la base.
- Base : retours arrière de 052 à 060 NON écrits (PLAN-DE-REPRISE §3). Fonctions : `create or replace` de la version précédente. Colonnes et tables : on ne supprime pas, on désactive.
- Sauvegardes Supabase : fréquence et rétention non vérifiées (Romain, tableau de bord).
## Dépendances entre migrations (extrait de `supabase/a_coller/README.md`)
- 048 juste après 038 (réécrit 5 fonctions de 038) ; 052 après 051, 045, 048 (réécrit `book_service`, `unread_counts` ; recoller si 038 ou 048 recollées).
- 053, 054, 055 après 052 et 040 ; 056 après 052, 054, 055 ; 059 après 025, 040, 054 ; 059b après 021 ; 060 après 056 ; 057 après 042 ; 058 indépendante.
- Déployer l'application AVANT de coller ; l'application détecte chaque migration (sondes) et garde l'ancien comportement sinon.
## Pièges de continuité
- Le workflow `db-migrate.yml` était destructeur (DROP SCHEMA) : neutralisé, ne jamais réactiver.
- Les crons pg_cron sont créés par les migrations « si l'extension est là » : à confirmer en base.
- Les données fictives et de test : nettoyage seulement avec accord (`supabase/a_coller/nettoyage_donnees_fictives.sql` contient des suppressions).
## Journal
- 324 commits du 16/09 au 21/11/2026 ; pics : 03/11 (37), 18/11 (56), 20/11 (35). JOURNAL.md : une ligne par jour.
## Alerte
- Format en 4 lignes ; toute fuite de données personnelles : prévenir Romain immédiatement (obligations de notification : [à compléter]).

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- L'étiquette prod-2026-11-21 existe seulement en local : le push d'un tag est refusé (403) ; la créer via GitHub > Releases sur le commit 9b4ffc5 ou proposer une branche de repère.
- Retours arrière des migrations 052 à 062 : toujours « [à compléter] » dans PLAN-DE-REPRISE.md (A-009) ; des fonctions sont réécrites plusieurs fois (unread_counts, mark_overdue_transfers, enforce_incident_window) : recoller une ancienne migration ramène une ancienne version.
- `.claude/worktrees/` est ignoré par git ; il occupe ~13 Go en local (copies de travail des agents) : sans effet sur le dépôt.
- Ordre de collage des SQL : voir supabase/a_coller/README.md ; 061 puis 062 attendent Romain au 23/11.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : tout retour arrière passe par un commit de revert sur main, jamais de réécriture d'historique ; les migrations sont rejouables ; consigner chaque régression dans docs/claude/REGRESSIONS.md le jour même.
