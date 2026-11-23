# Refonte ergonomie des comptes : mesures avant / après (23/11/2026)

Méthode : `scripts/e2e/mesure-comptes.mjs` (Playwright 390x844 tactile, comptes audit, lecture seule). Avant = build local de `main`,
après = build local de cette branche, même base. Captures et JSON : `docs/refonte-comptes-2026-11-23/`.
Mots / boutons « page » = tout l'écran (écran visible compris) ; « 1er écran » = sans défiler. Rendu non validé sur Vercel.

| Écran | mots page | boutons page | hauteur px | mots 1er écran | boutons 1er écran |
|---|---|---|---|---|---|
| Mon profil (client) | 173 -> 111 (-36 %) | 21 -> 17 (-19 %) | 964 (écran à défilement interne) | 119 -> 102 | 15 -> 17 |
| Agenda client | 306 -> 278 (-9 %) | 37 -> 35 | 2473 -> 2305 | 122 -> 122 | 20 -> 20 |
| Messages client | 3515 -> 367 (-90 %) | 123 -> 20 (-84 %) | 11681 -> 1295 | 297 -> 297 | 18 -> 18 |
| Commande, Mission du jour, Réservation (client) | inchangés | inchangés | inchangés | inchangés | inchangés |
| Mon entreprise (pro) | 373 -> 238 (-36 %) | 41 -> 28 (-32 %) | 3139 -> 2252 (-28 %) | 86 -> 84 | 17 -> 14 (-18 %) |
| Agenda pro | 279 -> 253 (-9 %) | 31 -> 30 | 2329 -> 2161 | 114 -> 114 | 18 -> 18 |
| Messages pro | 3332 -> 370 (-89 %) | 116 -> 19 (-84 %) | 11113 -> 1323 | 249 -> 249 | 16 -> 16 |
| Mes pièces (pro) | 269 -> 196 (-27 %) | 41 -> 24 (-41 %) | 2863 -> 1819 (-36 %) | 105 -> 109 | 17 -> 15 |
| Revenus, Mes tarifs, Disponibilités | inchangés | inchangés | inchangés | inchangés | inchangés |
| Mon annonce | 312 -> 312 | 37 | 2722 -> 2746 | 107 | 15 |

Objectif -30 % de mots et boutons au PREMIER écran : non atteint (le premier écran est surtout l'en-tête et la carte d'identité de l'écran).
Atteint sur la page entière pour Mon entreprise, Messages, Mes pièces (mots) ; Mon profil (mots).

## Changements
- Mon entreprise : grille de 4 raccourcis (Mes tarifs, Mes pièces, Mes revenus, Ma fiche) réduite à « Ma fiche publique » ; bouton « Modifier mes informations »
  retiré (la ligne « Coordonnées » mène au même écran) ; ligne « Mon annonce » du Hub retirée (la carte du haut y mène) ; bloc « Il vous reste n éléments »
  masqué quand l'alerte « Mes pièces : à mettre à jour » est déjà là (même destination) ; « Paiements et fiscalité » et « Plus » derrière « Voir plus » (1 appui) ;
  phrase de la carte annonce raccourcie ; cible du logo 36 -> 44 px. Chaque accès reste atteignable une fois.
- Mon profil : ville « non renseignée » et barre « Profil complet » masquées quand tout est fait ; « Paiements » et « Plus » derrière « Voir plus » ;
  bascule « Espace prestataire / Devenir prestataire » remontée dans « Mon compte » ; sous-titres raccourcis.
- Messages : 8 conversations les plus récentes, bouton « Voir les N autres conversations » ; recherche = toute la liste ; boutons de tri visibles au-delà de 6 conversations.
- Agenda : « À venir » limité à 2, bouton « Voir les N autres rendez-vous » (Aujourd'hui et litiges inchangés).
- Mes pièces : « Ajouter une pièce » (Photo / Fichier) replié quand la rubrique a déjà une pièce ou est facultative ; en-tête raccourci (le texte « jamais par les clients » devient « par vous et l'équipe PING seulement »).
- Mon annonce : cibles 44 px (« Compléter », retour, Modifier / Aperçu).
- Réservation : texte « d&apos;arrivée » affiché tel quel corrigé (« d’arrivée »).

## Appuis par tâche (comptés dans le code, non chronométrés)
| Tâche | Appuis |
|---|---|
| Client : trouver et réserver | Carte, fiche, Réserver, créneau, Confirmer : inchangé (carte et fiche hors périmètre) |
| Pro : voir l'agenda du jour | 1 (onglet Agenda) ; Mission du jour 2 |
| Pro : répondre à une demande | via Demandes (carte, hors périmètre) |
| Pro : atteindre Paiements / fiscalité | 1 -> 2 (Voir plus) |
| Client : Mes factures | 1 -> 2 (Voir plus) |

## Admin (public/admin.html) : non prouvable en rendu
Le compte audit n'a pas d'accès admin et la page exige une vraie session (`getUser`) : aucun rendu. Preuve par la structure (script de comptage sur `#s_overview`) :
le bloc « À traiter » (ids `ovDocsL`, `ovDisputes2L`, `ovPayAlertL`, déjà alimentés par la page) est déplacé en tête, renommé « À traiter maintenant » ; « Derniers inscrits » remonté avant la carte.
| Mesure avant la ligne « pièces » | avant | après |
|---|---|---|
| éléments cliquables | 22 | 0 |
| mots | 148 | 5 |
| balises div/button/table | 54 | 5 |
| éléments cliquables avant « Derniers inscrits » | 28 | 25 |
Équilibre des `<div>` vérifié (1375 / 1375 avant et après). Aucun compteur ajouté, aucune requête nouvelle, aucun accès retiré. Utilisateurs, documents, litiges, paiements, commission : non modifiés (non mesurés).

## Non fait
Commande, Mission du jour, Réservation, Revenus, Tarifs, Disponibilités : déjà allégés le 23/11 ou sans doublon sûr à retirer. Premier écran : -30 % non atteint.
Mon annonce : 21 cibles < 44 px (pastilles de choix), non traitées. Pages admin autres que l'accueil : non touchées.
