# Audit 10/10 : synthèse de la phase 1 (07/11/2026, lecture seule)

Cinq rapports : visiteur-inscription, client, prestataire, admin, transversal (dans ce dossier, avec 60 captures).
Total : **8 P0, 36 P1, 78 P2**. Aucun code modifié, aucune donnée écrite, pendant l'audit.

## P0 (bloquants ou faux)
1. **Injection HTML dans l'admin** : noms d'inscrits, messages de support et motifs de litige sont insérés sans échappement dans `public/admin.html`. Établi par lecture du code, non exploité.
2. **Inscription prestataire depuis la plaquette** (`/l/insp`) : tout l'onboarding est rempli sans compte, puis `finish()` renvoie vers l'inscription et rien n'est conservé (lecture du code, dernière étape non exécutée).
3. **Admin : chiffres incohérents et fictifs mélangés** (Volume 5 418 € / Réalisé 0 €, « Clients inscrits 9 » pour 3 comptes réels, 210 documents aux numéros inventés contre 99 en base).
4. **Admin : campagnes et QR factices** (« 36 leads » codé en dur, QR vers `ping.app`, carte sans point).
5. **Admin : litiges et pièces sans suite** (sections vides, pas de visionneuse, validation sans confirmation, commentaires de la bulle verte sans entrée de menu).
6. **Admin : recherche, filtres, tri et compteurs sans effet** (`enhanceTable` fige les lignes avant l'arrivée des données).
7. **Admin : sans `?next=`, la connexion atterrit sur /map** (`.single()` sans filtre renvoie 406).
8. Les P0 admin 3 à 7 sont détaillés dans `admin.md`.

## Points forts (P1) les plus parlants
- Carte pro sans épingle (zoom quartier, demandes à 11-13 km). Régression due au recentrage du 07/11.
- Fiche prestataire de la carte mobile qui ne se ferme jamais ; bulle « Laisser un commentaire » sur le recentrage ; volet qui recouvre « Passer en pro » sur ordinateur.
- Facture de la prestation avec le logo PING (contraire à l'invariant).
- URL inconnues en 200 avec le prototype « démo » (`fallback` de `next.config.js`).
- Redirections de visiteur incohérentes (signup avec `next`, login sans `next`).
- Lien CGV ou confidentialité en étape 2 efface le formulaire d'inscription.
- Fenêtre « Installer le raccourci » plein écran sur mobile.
- Textes qui se contredisent : séquestre « Bientôt » (interdit), « commission retenue » alors que tout passe par virement.
- Accessibilité : pas de focus visible, libellés non reliés, zoom bloqué, contrastes sous 4,5:1, cibles sous 44 px.
- Sauts de mise en page : admin 0,36, aide 0,30, agenda 0,22.
- RLS à contrôler en base : `dispute_messages` sans RLS versionnée, policy `profile_public_read` jamais supprimée.

## À vérifier avant de corriger
Le P0 2 et le P0 1 viennent de la lecture du code. Les rejouer par un test avant de coder.
