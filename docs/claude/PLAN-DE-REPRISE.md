# Plan de reprise (créé le 21/11/2026, à tester par Romain avant d'y compter)
Principe : revenir en arrière par une action ciblée et réversible. Jamais de réécriture d'historique (`reset --hard`, `push --force`, `rebase` publié).

## 1. Code (GitHub)
- Retour d'un commit fautif : `git revert <commit>` puis livraison normale (tsc, build). Un commit de fusion : `git revert -m 1 <commit>`.
- Étiquettes de production `prod-AAAA-MM-JJ` posées après chaque mise en ligne vérifiée. Aucune n'existe au 21/11/2026 ; première proposée : `prod-2026-11-21` sur 9b4ffc5 (accord de Romain).
- Retour vers une étiquette : créer une branche depuis l'étiquette et comparer, puis annuler les commits fautifs un par un.
- Dernier état sain connu : production du 21/11/2026 = 9b4ffc5 (tests e2e du jour, voir ETAT.md).

## 2. Déploiement (Vercel, projet `nexto`)
- « Rollback » (instant) sur un déploiement `READY` précédent depuis le tableau de bord Vercel, ou outil de rollback du connecteur Vercel avec accord de Romain.
- Un rollback Vercel ne défait PAS la base : si une migration a changé le comportement, voir §3 avant de revenir.
- Le déploiement suivant sur `main` repromeut le dernier commit : après un rollback, corriger `main` (revert) pour ne pas redéployer le défaut.

## 3. Base (Supabase `wmiawwaxwlvascyflpba`)
- Chaque migration doit avoir un retour arrière écrit. Statut au 21/11/2026 : retours arrière pour 052 à 060 NON écrits.
  À compléter migration par migration SANS exécuter (accord de Romain pour tout collage) :

| Migration | Apporte | Retour arrière |
|---|---|---|
| 052 | Réservation à accepter, `accept_booking`, `refuse_booking`, pg_cron 10 min | [à compléter] |
| 053 | Droit clé service sur `expire_pending_bookings`, `booking_ended_unnotified` | [à compléter] |
| 054 | Litige : décision PING, paiement bloqué, `money_*` | [à compléter] |
| 055 | Délai d'incident 24 h (`trg_enforce_incident_window`) | [à compléter] |
| 056 | Annulations en paliers, absence, report, clôture sur preuve, `mission_cancellations` | [à compléter] |
| 057 | Alertes admin sur pièces, `expire_documents`, pg_cron | [à compléter] |
| 058 | Position d'intervention (`provider_live_zone`, RPC) | [à compléter] |
| 059 | Virement non reçu (colonnes, RPC, verrou) | [à compléter] |
| 059b | Miroir du litige dans le chat | [à compléter] |
| 060 | Correctif `cancel_booking` (variable `v_kind`) | [à compléter] (revenir à 056 ré-ouvre le défaut) |

- Règle : les fonctions se rétablissent par `create or replace` de la version précédente (dans `supabase/migrations/`) ; les colonnes et tables ajoutées ne se suppriment pas (suppression = accord de Romain) ; on désactive plutôt (réglage, drapeau).
- Sauvegardes Supabase : fréquence, rétention et restauration à un instant donné [à vérifier par Romain dans le tableau de bord Supabase]. Non vérifié.
- Avant tout collage risqué : copie des lignes touchées dans une table de sauvegarde (modèle : `_sauvegarde_missions_test_30_10`), avec accord.

## 4. Secrets : où les refaire
Variables Vercel (clé service Supabase, `CRON_SECRET`, Resend, PSP, Urssaf, `ADMIN_FALLBACK_KEY`) ; Supabase Auth (Site URL, Redirect URLs) ;
secrets du dépôt GitHub pour `deploy.yml` [à compléter]. Liste détaillée sans valeurs : ACCES.md. Fuite suspectée : changer la clé chez son fournisseur puis dans Vercel, redéployer.

## 5. Incident : procédure
1. Constater (symptôme, écran, heure) ; ne rien supprimer. 2. Lire `get_runtime_errors` Vercel et les journaux Supabase.
3. Limiter : drapeau ou réglage coupé (`PAYMENT_RELEASE_MODE=manuel`, `NEXT_PUBLIC_AVANCE_IMMEDIATE` retiré, commission, cron), sinon rollback Vercel.
4. Corriger par un revert ciblé ; rejouer les tests concernés (CONTROLES.md). 5. Écrire la ligne dans ERREURS.md et JOURNAL.md.
6. Alerte à Romain en 4 lignes (problème + gravité / cause / solution ou fait avec preuve / décision attendue).
Données personnelles exposées : prévenir Romain immédiatement ; obligations de notification (CNIL, 72 h) à décider avec lui : [à compléter].
