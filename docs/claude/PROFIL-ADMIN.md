# Profil Admin (PING) (créé le 25/11/2026)
Session « PING · Admin ». Zone de code : `public/admin.html` (servi sur `/admin`), `src/app/admin` (commission, paiements, parcours, retours, visites), `src/app/litiges`, `src/app/api/admin`.

## État au 25/11/2026 : Hub (`/hub`)
- `src/app/hub/page.tsx` : vignettes Admin, Client test, Prestataire test, Carte ; invitation (Particulier ou pro -> `/essai`, ou inscription directe particulier / pro) avec WhatsApp (`whatsappUrl`), Partager, Copier ; animations et supports.
- Comptes de test : adresse pré-remplie (`/auth/login?email=`), aucun mot de passe dans le code. Déjà connecté avec cette adresse : accès direct ; sinon déconnexion puis connexion. Aucun compte admin créé : « Admin » demande le vrai compte.
- Bouton rond « Hub » : `src/components/HubReturn.tsx` (layout) et script en fin de `public/admin.html`. Visible seulement si le Hub a été ouvert sur l'appareil (`localStorage ping_hub`), réglable dans le Hub.
- Vérifié en local : `tsc`, `build`, capture 390 px, pré-remplissage de l'adresse. NON vérifié : en production, connexion réelle, WhatsApp, bouton Hub dans l'admin.

## Audit du 27/11/2026
Voir `AUDIT-ADMIN-2026-11-27.md` (sécurité S1 à S7, fonctions F1 à F9, téléphone, cartes). Rien corrigé sauf le bouton Hub. S1 (promotion admin) à confirmer en base en premier.

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
