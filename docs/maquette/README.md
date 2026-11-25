# Maquettes de référence de PING (rangées dans le dépôt le 23/11/2026)
Une maquette qui n'est pas dans le dépôt n'existe pas pour les agents. Celles-ci sont la référence du gardien de fidélité (`.claude/agents/gardien-fidelite.md`) et du contrat `docs/claude/CONTRAT-MAQUETTE.md`.

| Fichier | Rôle | Origine et date |
|---|---|---|
| `maquette-ping-v11.html` | Maquette navigable complète : Site public, Client, Prestataire, Admin ; thème clair et sombre ; onglets Audit et Contrôle qualité | copie exacte de `public/maquette.html` (publiée sur nexto-eta.vercel.app/maquette), version « Process, paiement et validation commande », 18/11/2026 |
| `data.js` | Données de l'onglet Audit : une ligne par élément `[titre, profil, écran, statut, priorité, problème et proposition, preuve en production]` (statuts fait / incomplet / absent) | source de la maquette : `docs/audit-2026-11-07/maquette-artefact/data.js` |
| `../audit-2026-11-07/maquette-artefact/` | Sources de fabrication (`index.html`, `build.sh`) et page publiée sous forme d'artefact (https://claude.ai/artifact/3fLDdSn5c5U17mMEyyS5fU) | 07-19/11/2026 |

Références secondaires (déjà dans le dépôt, ne pas copier) : `public/app.html` (`/demo`, prototype de 44 écrans à données fictives) ; `public/admin.html` (`/admin`) ; vidéos et plaquettes de `public/`.

Lire la maquette : ouvrir `maquette-ping-v11.html` dans un navigateur ; le sélecteur de profil est en haut ; « Aller directement à un écran » liste les écrans. Pour les agents : lire `data.js` (une ligne = un élément à contrôler) puis les écrans dans le HTML.
Règle : toute nouvelle maquette ou version est copiée ici avec sa date avant d'être utilisée comme référence ; l'ancienne reste tant que le contrat la cite.
| `maquette-annonce-v13.html` (+ .png) | Proposition 26/11 : carte à deux repères, résumé et fiche du pro, chat relié à la commande, litige en note (7 écrans). Charte de l'app, améliorations en cadre doré | non validée par Romain ; remplace v12 |
| `maquette-annonce-v12.html` | Première proposition 26/11, charte non conforme | remplacée par v13, gardée |
| `maquette-annonce-v14.html` (+ .png) | Version allégée 26/11 : carte avec PING, résumé, fiche, chat, litige en 2 écrans, facture, reçu | non validée par Romain ; remplace v13 (gardée) |

