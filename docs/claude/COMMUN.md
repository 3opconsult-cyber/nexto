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

## État (27/11/2026)
- Audit d'homogénéité fait sur le code (pas de capture) : `AUDIT-DESIGN-2026-11-27.md`.
- Particulier et prestataire : base commune (`ping-ui.css`, `.card`, bouton 44 px). Admin : style à part (`admin.html` + pages `/admin/*` sans `NavDrawer`).
- Trois palettes : marque (`brand/tokens.css`) et admin gardent #0C8F7E / #6E8592 ; l'application est passée à #0B8374 / #4E6470.
- Couleurs en dur massives dans `src` ; 5 rouges d'erreur ; 2 boutons Retour (`BackHeader`, `RetourLink`).
- Rien modifié dans le style. En attente : choix de la palette unique et propriétaire de `brand/tokens.css` (question à Romain).

## À faire et notes
Voir `A-FAIRE.md`, sections Design.
