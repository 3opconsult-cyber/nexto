# Profil Particulier (client) (créé le 25/11/2026)
Session « PING · Particulier ». Zone de code : `src/app/map`, `src/app/client`, `src/app/mission` (côté acheteur), `src/app/agenda`, `src/app/messages`, `src/components/DemoShell.tsx`, `FindSheet`, `MapSheet`.

## Ce qui est propre
Carte centrale (Waze, feuille repliable), « Trouver un prestataire » en 4 appuis, réservation en étapes, annonce, agenda (jour cliquable, Terminées), messages, favoris, avis, parrainage (compteurs), profil et adresse de référence.

## Règles
Annulation en 3 paliers ; réservation à accepter par le prestataire ; client ne pose jamais l'arrivée ; GPS seulement pour centrer la carte. Détail : `REGLES-METIER.md` (sections Réservation, Langage).

## Argent
Renvoi : `REGLES-METIER.md` (Prix et facturation) ; factures reçues : `RUBRIQUE-FACTURATION.md`. Rien recopié.

## Code
`src/lib/location.ts`, `booking.ts`, `cancellation.ts`, `agenda*.ts`, `messagesList.ts`. Tests : `scripts/e2e/parcours-rapide.mjs`, `reservation-etapes.mjs`, `agenda-historique.mjs`, `carte-identite.mjs`.

## Si ton sujet touche une rubrique
| Sujet | Rubrique |
|---|---|
| style, espacement, boutons | Design (COMMUN.md) |
| facture reçue, résumé annuel | Facturation |
| règle d'annulation, de litige | Règles métier |
| table, RLS, SQL | Données SQL |
| texte public, vidéo | Prospection et communication |

## À faire et notes
Voir `A-FAIRE.md`, section Particulier.
