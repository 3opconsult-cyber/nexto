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
- Palette unique décidée (Romain, 27/11) : celle de l'application. Vert foncé #0B8374, gris #4E6470, trait #E7EDEB, un seul rouge d'erreur #B3402F (5 teintes avant). Appliquée dans `src`, `admin.html`, `app.html`, `client.html`, `brand/tokens.css`, sources `brand/` et pages générées (animations, plaquettes, e-mails). Les MP4 et PDF ne sont pas régénérés.
- `brand/tokens.css` suit désormais la palette de l'application ; propriétaire : Design (couleurs), Prospection (supports qui l'utilisent).
- Admin (`admin.html`) : boutons vert foncé, 15 px, 44 px minimum. Pages `/admin/*` toujours sans `NavDrawer`.
- `RetourLink` (lien contextuel « Retour à mon annonce ») : 15 px, même flèche que `BackHeader`. Ce ne sont pas deux boutons pour la même chose.
- Reste : couleurs écrites en dur (≈ 1 200) à passer en variables, cartes faites à la main (angles 10 à 18 px), ★ ✓ ✕ en texte, petits textes de `ping-ui.css`. La maquette `docs/maquette/` garde l'ancienne palette (référence, non modifiée).
- Audit : `AUDIT-DESIGN-2026-11-27.md`.

## À faire et notes
Voir `A-FAIRE.md`, sections Design.
