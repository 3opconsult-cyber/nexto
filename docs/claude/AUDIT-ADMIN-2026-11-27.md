# Audit admin du 27/11/2026 (lecture du code + rendu local, rien testé en production)
Sans compte admin de test ni accès à la base : tout est « non vérifié en production ».

## Sécurité
| # | Gravité | Constat | Preuve | Correction |
|---|---|---|---|---|
| S1 | critique, à confirmer en base | Un compte peut supprimer puis recréer sa ligne `profiles` avec `is_admin = true` : le verrou ne couvre que les modifications | `001_initial_schema.sql:301`, `002_admin_access_and_security_fix.sql:62-78` | Verrou BEFORE INSERT + retirer création/suppression de profil au rôle connecté |
| S2 | important, à confirmer en base | `admin_get_email`, `admin_pipeline` absentes du dépôt : contrôle `is_admin()` non prouvé | `admin.html:3708, 3848, 3928` | Les exporter, vérifier, ajouter au dépôt |
| S3 | important, à confirmer en base | Chat Support : `sender_is_admin` écrit par le client, aucune règle dans le dépôt | `src/app/support/page.tsx:63-64` | Verrou en base |
| S4 | important | Clé de secours dans l'URL et dans un cookie de 30 jours sans `secure` | `src/middleware.ts:53-60` | La retirer |
| S5 | important | Code chargé depuis esm.sh et cdnjs sans contrôle d'intégrité | `admin.html:12-13, 3394` | Servir depuis le dépôt ou SRI + CSP |
| S6 | important | Adresses de clients envoyées à Nominatim, puis écriture dans `requests` à l'ouverture de l'accueil | `admin.html:3651-3665` | Calcul côté serveur au dépôt de la demande |
| S7 | mineur | `/admin/visites` lit téléphone et adresse sans besoin ; refus `/admin` montre l'e-mail admin ; `toast()` en HTML brut | `visites/page.tsx:38`, `middleware.ts:67`, `admin.html:2500` | Retirer / message générique / `textContent` |
Correct : RPC admin du dépôt contrôlées par `is_admin()`, écritures admin couvertes par RLS, aucun secret, aucun export.

## Fonctions
| # | Constat | Preuve |
|---|---|---|
| F1 | « Envoyer un e-mail » (prospection) affiche « E-mail envoyé » sans rien envoyer | `admin.html:1461, 2426` |
| F2 | Compteurs de la carte d'accueil -> liste et fiches fictives, boutons Valider/Radier sans effet | `admin.html:550-551, 2924-2944, 1717-1718, 1602` |
| F3 | Erreurs de lecture muettes (0 € ou liste vide) et lectures sans limite (totaux tronqués au-delà du plafond) | `admin.html:4470-4482` |
| F4 | Commission, IBAN de PING, remboursement et retenue : sans confirmation | `admin/commission/page.tsx:54-84`, `admin/paiements/page.tsx:62-73`, `litiges/[id]/page.tsx:164-181` |
| F5 | Décision PING : « parties prévenues » affiché même si l'e-mail n'est pas parti ; deux écrans, deux messages ; jamais jouée | `admin.html:4792-4801` |
| F6 | Dépôt SQL incomplet (tables et RPC de base absentes) | voir S2 |
| F7 | Campagnes en dur, statuts partenaires/prospects non enregistrés | `admin.html:2649-2661, 2806-2814, 4169` |
| F8 | Chargements pouvant rester bloqués | `admin.html:3411-3412`, `admin/paiements/page.tsx:171-172` |
| F9 | Parcours et Visites hors menu, Paiements sans retour, nouveaux onglets, retours testeurs à trois endroits | `admin.html:898-906, 1097` |
Solides dans le code : validation des pièces, catalogue, signalements, rapprochement des virements, contrôles de nuit, conversations.

## Téléphone (390 px) et cartes
- Aucun débordement horizontal ; barre du bas à 5 entrées (76x51) ; champs à 16 px ; manifeste d'installation correct.
- Liens d'action minuscules (« Voir » 24x15 ; 82 cibles < 32 px dans Supports) : `admin.html:118`.
- Pages React admin : champs 12,5 à 15 px (zoom iPhone), boutons d'argent ~28 px : `paiements/page.tsx:29, 90`, `commission/page.tsx:119-163`.
- Bande grise à gauche (ombre du tiroir, `admin.html:394`) ; notes en contraste 2,5 (`:160`) ; titre vide sur Supports (`:1513`) ; lignes de menu 38 px.
- Carte admin différente de l'app : Leaflet CDN + tuiles OSM brutes, sans attribution (`admin.html:3625-3626`), pastilles 14 px, zoom fixe 13 sans cadrage (`:3623-3632`). Les trois cartes de l'app (client, prestataire, adresse) sont un seul composant `LiveMap`.
- L'admin ne voit pas : demandes ouvertes, zones « en intervention ici », prestataires hors ligne.
- Corrigé le 27/11 : bouton Hub qui recouvrait « Accueil ».
Captures : locales seulement (non conservées dans le dépôt).
