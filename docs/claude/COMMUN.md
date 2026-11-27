# Commun : Design, règles communes, circuits (créé le 25/11/2026)
Propriétaire du style commun : la session « PING · Design ». Les autres entrées ne modifient ni `ping-ui.css`, ni `aere.css`, ni les composants partagés.

## Ce qui est propre
- Ergonomie, UX, UI, fluidité, nombre de clics, animations, fidélité à la maquette `docs/maquette/maquette-ping-v11.html` (référence, décision 23/11).
- Lecture aérée = espacement, pas moins de mots (`REGRESSIONS.md`). Cible tactile >= 44 px. Pas de `confirm()`.

## Règles
- Maquette = référence ; l'agent `gardien-fidelite` mesure l'écart, il ne code pas. Contrats : `CONTRAT-MAQUETTE*.md`.
- Style : `src/app/ping-ui.css`, `aere.css`, `aere-pro.css` ; `ping-legacy.css` à retirer.
- Menu à 4 entrées, jamais une de plus ; le reste = lignes Hub (`src/components/Hub.tsx`).
- Bascule de mode (particulier / prestataire) uniquement depuis le menu.

## Argent
Renvoi : `REGLES-METIER.md` (sections « Prix et facturation » et « Litige, argent »). Aucun chiffre ni taux recopié ici.

## Code
Composants partagés : `DesktopShell.tsx`, `NavDrawer.tsx`, `BottomTabBar.tsx`, `Hub.tsx`, `LiveMap.tsx`, `MapSheet`, `Modal`, `SessionBadge.tsx`. Avant toute modification : chercher leurs utilisateurs.

## Circuits (qui crée, qui valide, qui consomme)
| Objet | Crée | Valide | Consomme |
|---|---|---|---|
| Demande / réservation | particulier | prestataire (acceptation) | agenda des deux |
| Tarif | prestataire | particulier (accord) | facturation |
| Facture et commissions | base (`generate_invoices`) | personne (automatique) | les deux, chacun sa commission |
| Pièces | prestataire | admin PING | carte, badge « vérifié par PING » |
| Litige | l'une des parties | admin PING (Décision) | les deux, paiement bloqué |
| Support visuel | création-matériel | Romain | prospection |

## État (27/11/2026, fin de bloc)
- Palette unique (celle de l'application) partout : vert foncé #0B8374, gris #4E6470, trait #E7EDEB, rouge #B3402F. `brand/tokens.css` aligné (Design tient les couleurs ; Prospection les supports). MP4 et PDF non régénérés.
- Admin (`admin.html`) : boutons 15 px / 44 px vert foncé, logo PING (anneaux) au lieu de l'avion. Non vu connecté (pas de compte admin de test).
- Audit de bout en bout en production (scripts `audit-design.mjs`, `audit-fiche.mjs`) : toutes les pages s'ouvrent à 390 et 1 280 px, rien de caché sous la barre du bas, carte -> épingle -> fiche -> réservation bons. Détail : `AUDIT-DESIGN-2026-11-27.md`.
- Corrigé : « Mission du jour » (lecture limitée aux missions récentes, `todayMission.ts`), liens Retour 44 px, petits textes Litiges / Parrainage, en-tête de carte identique client / pro au bureau.
- Non-régression 27/11 après-midi : 8 verts sur 9, A 34/34, B 42/42. Rouge restant : agenda « À accepter » faute de réservation en attente dans les comptes de test (donnée, pas écran).
- Reste : couleurs en dur -> variables, carte commune, ★ ✓ ✕ en SVG, petits textes de `ping-ui.css`, pages `landing-*.html` (Prospection).

## À faire et notes
Voir `A-FAIRE.md`, sections Design.
