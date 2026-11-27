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

## État (27/11/2026, fin de bloc, 15 h 30)
- Palette unique (celle de l'application) : vert foncé #0B8374, gris #4E6470, rouge #B3402F. Trait : #E7EDEB (léger) et #DCE5E3 (gardé exprès : `aere.css` grise les boutons qui le portent). `brand/tokens.css` aligné ; MP4 et PDF non régénérés.
- Admin : boutons 15 px / 44 px, logo PING. Non vu connecté (pas de compte admin de test).
- Tâches courantes en 1 ou 2 appuis (tableau dans `AUDIT-DESIGN-2026-11-27.md`) : profil client (Déposer une demande, Mes factures en tête), Mon entreprise (Mes services et tarifs, Mes factures, Coordonnées et statut en tête). « Mission du jour » corrigé (`todayMission.ts`).
- Non-régression 27/11, 15 h : 8 sur 9 verts, A 34/34, B 42/42 ; rouge restant = agenda « À accepter » faute de réservation en attente dans les comptes de test.
- 16 h : agenda -> date -> liste du jour avec « Conversation » et « QR et code » (mission du jour) ; carte Aujourd'hui avec « Conversation » ; Mon annonce sur une ligne d'en-tête ; doublon « Mon annonce » retiré ; « Confirmer » estompé avant l'heure. Non-régression : A 34/34, B 42/42, inscription verte rejouée seule, agenda « À accepter » toujours rouge (donnée).
- Reste (Design) : onglets de l'agenda sur 2 lignes côté pro, flèche Retour de l'agenda client seulement, Mon annonce et Mon entreprise encore longues, Coordonnées qui ouvre l'inscription, couleurs en dur -> variables, carte commune, ★ ✓ ✕ en SVG. Bouton PING pour le QR : proposition en attente de Romain.

## À faire et notes
Voir `A-FAIRE.md`, sections Design.
