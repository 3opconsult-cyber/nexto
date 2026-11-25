# Profil Admin (PING) (créé le 25/11/2026)
Session « PING · Admin ». Zone de code : `public/admin.html` (servi sur `/admin`), `src/app/admin` (commission, paiements, parcours, retours, visites), `src/app/litiges`, `src/app/api/admin`.

## Ce qui est propre
Décision PING sur un litige (curseur + champ), commission réglable, paiements et rapprochement des virements, validation des pièces, alertes, parcours et visites, prospection et campagnes (écrans de suivi).

## Règles
Accès = compte `is_admin` (clé de secours en variable Vercel). Aucun accès admin créé par Claude. Versement par le serveur ou un admin seulement. Jamais de remboursement à la main après versement.

## Argent
Renvoi : `REGLES-METIER.md` (Litige, argent) ; `RUBRIQUE-FACTURATION.md`.

## Code
`ping_decide_dispute` (054), `src/lib/dispute.ts`, `src/lib/adminAlerts.ts`, `src/lib/payments/`. Tests : e2e admin non rejoué faute de compte admin de test (non vérifié).

## Si ton sujet touche une rubrique
Facturation (rapprochement, IBAN PING) ; Données SQL (alertes, tables) ; Prospection et communication (écrans de suivi) ; Design (admin.html n'a pas `ping-ui.css`).

## À faire et notes
Voir `A-FAIRE.md`, section Admin.
