# Contrôles automatiques : niveau 3 (alerte)

Rédigé le 21/11/2026. Il complète les deux premiers niveaux :

| Niveau | Où | Quand | Ce qu'il contrôle | Fichiers |
|---|---|---|---|---|
| 1 | Base de données (SQL, pg_cron) | chaque nuit, 3 h 17 UTC | droits, sécurité par ligne, cohérence métier, tâches planifiées, volume, dérive du schéma | `supabase/migrations/061_controles_nocturnes.sql`, `scripts/tests/controles-nuit/run.cjs` |
| 2 | Dépôt (GitHub Actions) | à chaque mise en ligne sur `main`, chaque lundi, à la demande | compilation, secrets, pages en ligne, poids, audit npm, tests unitaires, étiquette de version | `.github/workflows/controles.yml`, `scripts/controles/*.mjs` |
| 3 | Alerte | dès qu'un contrôle est rouge | prévenir Romain sans lui demander de regarder | ce document |

Aucun de ces contrôles n'utilise de modèle de langage : ce sont des requêtes SQL et des scripts, donc un coût en jetons nul.

## La limite, dite franchement

Une tâche planifiée Claude n'a pas d'identifiants administrateur, et elle ne doit pas en avoir. Elle ne peut donc pas lire la base à la place de PING : donner une clé administrateur (ou la clé service) à un agent qui tourne tout seul, c'est lui donner de quoi lire et modifier toutes les données personnelles, sans personne pour relire ce qu'il fait.

Conséquence : l'agent ne surveille pas la base. C'est la base qui se surveille elle-même (niveau 1, avec ses propres droits) et qui dépose le résultat là où PING regarde déjà : la file d'alertes de l'admin. Un agent, ou Romain, ne fait que lire ce résultat depuis l'admin, avec un compte administrateur connecté.

Ce que cela ne couvre pas, et qui reste à vérifier à la main :
- les sauvegardes (non vérifiables en SQL) : une ligne orange permanente rappelle à Romain de regarder Supabase, Database, Backups, puis de l'acquitter dans l'admin (valable 90 jours) ;
- ce qui ne se voit que dans un navigateur (le rendu des écrans) : les parcours `scripts/e2e/` et le contrôle de Romain sur la prod.

## Comment l'alerte arrive

1. **Pastille et tableau dans l'admin (déjà en place après la migration 061).** Chaque nuit, s'il y a du rouge ou de l'orange, la fonction pose une alerte `controle_nuit` dans `admin_notifications` (la file de la migration 057 : une seule alerte ouverte par jour). Le tableau « Contrôles de nuit » se lit dans l'admin, page Conformité : dernier passage, nombre de vert, orange et rouge, détail de chaque ligne, bouton « Accepter le schéma actuel ». Le rappel permanent de la sauvegarde ne déclenche pas d'alerte à lui seul.
2. **E-mail (dès que Resend est branché).** `sendControlAlert()` dans `src/lib/notifyServer.ts` envoie UN e-mail court, seulement s'il y a du rouge dans le dernier passage, une seule fois par alerte. Il est appelé par le cron existant `/api/bookings/expire` (5 h 43 UTC, après le passage de 3 h 17) et, à la demande, par la route `/api/controles/alerte` (protégée par `CRON_SECRET`, comme les autres crons). Sans clé Resend, sans clé service ou avant la migration : réponse `{ sent: false, reason: ... }`, rien ne casse.
3. **GitHub.** Le workflow `controles.yml` échoue (rouge dans l'onglet Actions, e-mail GitHub habituel) pour la compilation, un secret trouvé, une page principale en erreur. Le reste est un avertissement jaune.

À activer pour l'e-mail (déjà nécessaires aux autres e-mails) : `RESEND_API_KEY`, `NOTIFY_FROM` (domaine vérifié), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, et éventuellement `ADMIN_NOTIFY_EMAIL` (sinon info@opconsult.co).

## Ce que contient une alerte (4 lignes)

Chaque alerte, qu'elle soit lue dans l'admin ou reçue par e-mail, dit la même chose dans le même ordre :

1. **Problème et gravité** : ce qui ne va pas, en une phrase, avec la couleur (rouge : à traiter tout de suite ; orange : à regarder).
2. **Cause** : la ligne du contrôle qui l'a déclenchée (nom de table, nombre de cas, numéros de mission). Jamais de nom de personne, d'adresse, de message ou de contenu de pièce.
3. **Solution ou fait** : ce qui a été fait tout seul, ou la correction proposée (par exemple « retirer le droit de lecture de `profiles` pour anon »).
4. **Décision attendue** : ce que Romain doit trancher (corriger, ou accepter le changement comme voulu avec « Accepter le schéma actuel », ou acquitter la sauvegarde).

Exemple :

> 1. Problème : 1 contrôle en rouge (gravité haute).
> 2. Cause : Table de données personnelles accessible sans compte : documents.
> 3. Solution : retirer les droits de `anon` sur `documents` (REVOKE), puis relancer `select public.run_nightly_controls();`.
> 4. Décision attendue : confirmer le retrait ; si ce droit était voulu, l'ajouter à la liste blanche de la fonction.

## Réglages (en haut de `run_nightly_controls()`)

Seuils (taille de la base, lignes des journaux, âge d'une tâche planifiée, durée d'un litige ouvert) et listes blanches (tables lisibles sans compte, fonctions publiques, tâches attendues) sont écrits au début de la fonction. Les modifier = coller de nouveau la migration modifiée (elle est rejouable). Les premières nuits peuvent montrer de l'orange sur des listes blanches incomplètes : c'est voulu, la liste réelle de la production n'était pas lisible depuis le dépôt (voir `docs/droits-base-2026-11-18.md`).

## Limites connues de ce que Claude a pu vérifier

- Le SQL a été testé sur un PostgreSQL 16 local jetable, avec un schéma minimal et un faux pg_cron. Il n'a jamais tourné sur la vraie base Supabase : les noms de colonnes de `transactions`, `disputes`, `documents`, `invoices`, `transfer_payments` viennent des migrations du dépôt, pas d'une lecture de la base. Un nom faux donne une ligne orange « Contrôle impossible » avec le message, jamais un échec des autres contrôles.
- La première exécution réelle enregistre la référence du schéma sans la comparer : l'orange de dérive n'apparaît qu'à partir du deuxième passage.
- L'e-mail d'alerte n'a pas été envoyé pour de vrai (aucune clé Resend).
