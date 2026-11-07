# Audit 10/10 PING : prompt complété (version à valider par Romain)

Base : le prompt d'audit fourni le 07/11/2026. Ce fichier ajoute le contexte rempli et les compléments proposés.
Rien n'est lancé tant que Romain n'a pas validé (règle « Avant de lancer, on fait le point »).

## Contexte (rempli)
- **Application** : PING, place de marché de services de proximité (ménage, repassage, nettoyage), Côte d'Azur. Prod https://nexto-eta.vercel.app, dépôt `3opconsult-cyber/nexto`, Supabase `wmiawwaxwlvascyflpba`.
- **Profils** : visiteur (plaquette `/bienvenue`, `/plaquettes`, animations), particulier (client), prestataire (pro particulier ou entreprise), compte double (bascule particulier/pro), administrateur (`/admin`).
- **Promesse** : trouver un prestataire disponible près de chez soi, avec présélection, QR avant/après, chat, facture automatique et suivi en cas de litige.
- **Supports de référence** : `public/app.html` (`/demo`), `public/admin.html`, `brand/` (logo, tagline « rencontre de proximité »), `public/plaquettes.html`, `public/bienvenue.html`, animations `/animation-client` et `/animation-prestataire`, `CLAUDE.md`, `docs/audit-marketing-2026-10-31.md`.
- **Charte à conserver** : logo, tagline, design system `src/app/ping-ui.css` (teal #12B39C, navy #123644, or, Quicksand + Inter). Décision Romain 07/11 : le design graphique est validé.
- **Comptes de test** : comptes jetables `qa+<nom>@…` à créer (inscription réelle). Comptes `audit.pro.claude@ping-demo.invalid` et `audit.client.claude@ping-demo.invalid` (voir CLAUDE.md). Les prestataires fictifs 1 à 19 ne se connectent pas. Le compte administrateur est celui de Romain : son mot de passe n'est jamais écrit dans le dépôt.
- **Interdits de vocabulaire (à vérifier par recherche, 0 occurrence)** : « certifié », « garanti » (sauf « profil vérifié par PING » pour un profil dont les pièces sont validées), emoji colorés, noms de marques tierces dans le marketing (Airbnb, Uber, Booking, Wecasa…), « bientôt » pour le séquestre dans les supports marketing.
- **Règles métier** : mono-produit (ménage, repassage, nettoyage, vitres en base) ; commission réglable dans `app_settings` (8 % client + 17 % prestataire au 26/10) ; règle suprême du tarif (prix fixé au paramétrage, seul un litige le rouvre) ; heure entamée, heure due (seuil réglable) ; 3 factures ; adresse visible du prestataire seulement quand la mission est confirmée et payée ; pas de GPS sauf « client absent » ; statuts transaction `pending`, `arrived`, `completed` ; paiement en ligne éteint (virement SEPA sur facture) ; l'app n'est pas visitable sans compte.

## Compléments proposés au prompt
1. **Parcours d'inscription** : axe à part entière (particulier, prestataire, compte double, e-mail de confirmation, mot de passe oublié, retour `?next=`). Romain demande de l'améliorer.
2. **Sécurité et vie privée** : droits RLS par table, accès aux pièces d'identité, IBAN, adresses, journal de connexion (`login_log`). Contrôle en lecture seule.
3. **Mobile réel** : mesures Playwright à 390×844 et 360×800, plus un contrôle humain sur iPhone Safari et en application installée (Playwright ne reproduit pas ce mode). Bandeau/volets qui s'ouvrent et se ferment, carte, clavier, zones sûres.
4. **E-mails** : délivrabilité des mails de confirmation et de réinitialisation (l'envoi a déjà échoué le 03/11 : limite du service d'envoi intégré de Supabase).
5. **PWA** : installation, mode plein écran, invite d'installation, cache du service worker.
6. **États à tester par profil** : compte neuf sans données, compte avec données, compte sans profil prestataire, compte avec les deux profils.
7. **Seuils mesurables du 10/10** : CLS ≤ 0,1 (0,01 est irréaliste avec une carte Leaflet), cibles tactiles ≥ 44 px, contraste AA 4,5:1, première image utile ≤ 2,5 s sur mobile 4G simulé, 0 erreur console, 0 contrôle sans effet.
8. **Prévisualisations** : les prévisualisations Vercel de PR sont derrière l'authentification Vercel (cause de l'abandon du flux PR le 17/09). Les « scénarios verts sur la prévisualisation » sont donc remplacés par : construction locale + scénarios Playwright contre la base de production avec comptes `qa+`, puis scénarios rejoués en production après fusion.

## Points à trancher avant de lancer
- Quelle règle prime : `CLAUDE.md` (pousser directement sur `main`, valider après) ou ce prompt (une PR à la fois, production intouchable sans phrase d'autorisation) ?
- La Phase 2 (maquette complète) est-elle nécessaire, puisque le design est validé ? Proposition : maquette limitée au parcours d'inscription et aux volets/cartes.
- Autorisation écrite pour créer des comptes jetables `qa+` en production (écriture en base).
- Périmètre du premier lot : Phase 1 seule (audit en lecture seule, un agent par profil), puis point avec Romain.
