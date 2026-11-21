# Accès de Claude et emplacement des secrets (vérifié le 21/11/2026)
Règle : on note OÙ est un secret, jamais sa valeur. Les mots de passe des comptes de test sont dans CLAUDE.md
historique, section « Comptes de test » : ne pas les recopier ailleurs.

## Ce que Claude peut faire
| Outil | Lecture | Écriture | Remarque |
|---|---|---|---|
| Vercel (projet `nexto`, équipe nextoping) | Oui : déploiements, journaux, variables (noms) | Rollback possible mais demander d'abord ; ne pas changer les variables sans accord | Production = commit 9b4ffc5 le 21/11 |
| GitHub (dépôt 3opconsult-cyber/nexto) via MCP | Oui | Branches et commits oui ; pousser sur `main` seulement sur demande explicite | Règle de travail #1 : voir A-TRANCHER.md (k) |
| Supabase `wmiawwaxwlvascyflpba` | Selon l'état du connecteur (non vérifié dans cette passe) | NON : connecteur d'écriture refusé ; Romain colle le SQL | Jamais d'écriture sur `ahtdevozpbeargnmvzcn` |
| Resend, Stripe, Mangopay, Lemonway, Urssaf | Aucun accès | Aucun | Écrits dans le code, ÉTEINTS |
| Navigateur de test (Playwright) sur la prod | Oui, comptes `.invalid` seulement | Crée des missions de test | Jamais de vrais comptes |
| Gmail, Calendar, Drive, Notion, Canva, Descript | Connecteurs présents | Aucun usage prévu pour PING sans demande de Romain | Aucun envoi sans accord |

## Ce que Claude ne fait pas sans accord
Supprimer des données, créer un compte administrateur, envoyer un e-mail ou un message externe, changer un prix, une
commission, un e-mail existant, l'authentification, le paiement, un texte juridique, réécrire l'historique Git.

## Où sont rangés les secrets (valeurs jamais lues ni copiées)
| Secret | Emplacement |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Variables Vercel (serveur). Pas encore posée : non vérifié |
| `CRON_SECRET` | Variables Vercel. Pas encore posée : non vérifié |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `ADMIN_NOTIFY_EMAIL` | Variables Vercel. Non posées : non vérifié |
| `ADMIN_FALLBACK_KEY` | Variable Vercel production (sensible) ; accès `/admin?key=...` ; la vraie protection = compte `is_admin` |
| `PAYMENT_PROVIDER` + clés du PSP choisi | Variables Vercel (en-tête de chaque adaptateur dans `src/lib/payments/`) |
| `URSSAF_CLIENT_ID`, `URSSAF_CLIENT_SECRET` (+ `URSSAF_API_BASE`, `URSSAF_TOKEN_URL`, `URSSAF_SCOPE`) | Variables Vercel |
| `NEXT_PUBLIC_AVANCE_IMMEDIATE` | Variable Vercel publique (drapeau, pas un secret) |
| `PAYMENT_RELEASE_MODE` | Variable Vercel (`manuel` coupe le versement automatique) |
| Clé publique Supabase (anon) | Variables Vercel `NEXT_PUBLIC_*` ; publique par construction |
| Mots de passe des comptes de test | CLAUDE.md historique, section « Comptes de test » (à sortir du dépôt : A-TRANCHER.md) |
| Authentification Supabase (Site URL, Redirect URLs) | Paramètres Supabase Auth : Site URL https://nexto-eta.vercel.app ; « Save changes » à vérifier |
| Mot de passe du compte admin de Romain | Chez Romain seulement |

## GitHub Actions existantes (`.github/workflows/`)
- `e2e-prod.yml` : tests de séparation et de factures chaque jour (05 h 17 UTC), sans secret.
- `deploy.yml` : déploiement Vercel sur push `main` (secrets du dépôt GitHub : noms [à compléter], non vérifiés).
- `db-migrate.yml` : neutralisé, ne jamais réactiver.
