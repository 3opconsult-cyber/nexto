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

## Passe 2 (23/11/2026, soir) : premier écran, admin, carte bureau
Méthode : `scripts/e2e/passe2.mjs` (390x844 tactile + 1000x800 et 1440x900, comptes audit, lecture seule). Avant = build local de `main` (port 3001), après = build
local de cette branche (port 3000), mesurés l'un après l'autre sur les mêmes données. Captures et JSON : `docs/refonte-comptes-2026-11-23/passe2/`.
Les données de l'audit ont bougé entre la passe 1 et la passe 2 (4 réservations à accepter apparues sur le compte pro) : les « avant » ci-dessous sont remesurés.

### Premier écran (sans défiler) et page entière
| Écran | mots 1er écran | boutons 1er écran | mots page | boutons page | hauteur page |
|---|---|---|---|---|---|
| Mon profil | 100 -> 30 (-70 %) | 14 -> 9 (-36 %) | 120 -> 30 | 15 -> 9 | 908 -> 908 |
| Agenda client | 104 -> 98 (-6 %) | 17 -> 13 (-24 %) | 429 -> 132 (-69 %) | 48 -> 17 (-65 %) | 3542 -> 1285 (-64 %) |
| Mon entreprise | 95 -> 104 (+9 %) | 15 -> 16 (+7 %) | 250 -> 136 (-46 %) | 29 -> 18 (-38 %) | 2352 -> 1274 (-46 %) |
| Agenda pro | 111 -> 109 (-2 %) | 17 -> 13 (-24 %) | 415 -> 124 (-70 %) | 47 -> 16 (-66 %) | 3510 -> 1240 (-65 %) |

Objectif -30 % mots ET boutons au premier écran : atteint pour Mon profil seulement. Raison mesurée : la barre du bas (5 boutons, 7 mots), le menu et l'interrupteur
« Visible sur la carte » font 7 des 14 boutons et ne sont pas dans le périmètre ; et plus l'écran est compact, plus de contenu entre dans les 844 px (Mon entreprise :
les alertes réservation et litige, avant sous la fiche de 314 px, sont maintenant visibles en tête, d'où +9 % de mots mais une action à faire d'abord).
Mesure ciblée de la zone que Romain a demandée (en-tête et carte d'identité, indépendante de ce qui suit) :
| Zone | avant | après |
|---|---|---|
| Mon profil : carte d'identité | 279 px, 35 mots | 133 px, 6 mots (-52 % hauteur, -83 % mots) |
| Mon entreprise : en-tête | 138 px | 68 px (-51 %) |
| Mon entreprise : carte d'identité | 314 px, 18 mots, 4 boutons | 57 px, 10 mots, 1 bouton (-82 % hauteur) |
| Agenda client : au-dessus des onglets | 224 px, 18 mots, 1 bouton | 126 px, 9 mots, 0 bouton (-44 % hauteur) |
| Agenda pro : au-dessus des onglets | 297 px, 29 mots, 1 bouton | 186 px, 18 mots, 0 bouton (-37 % hauteur) |

### Changements
- Mon entreprise : titre, menu et interrupteur sur une ligne ; ce qui attend une réponse d'abord (réservation à accepter, pièces à mettre à jour en un seul bouton, litige en une ligne) ;
  « Mon annonce » en une ligne avec la jauge ; la fiche (couverture, logo, statut juridique, Ma fiche publique, Mes tarifs) derrière un appui sur la ligne « nom + note, ou Nouveau »
  (la note ou « Nouveau, pas encore d'avis » reste visible) ; « Mon activité du mois » en une carte (4 chiffres + prochain rendez-vous) ; trois accès en tête (Agenda et disponibilités,
  Mes revenus, Mes pièces), le reste (Historique, Litiges, Opérations, Coordonnées, Paiements et fiscalité, Plus) derrière « Voir plus ». Chaque accès reste atteignable.
  Les rendez-vous du mois : la carte « Demandes près de vous » et la liste de 3 rendez-vous ne sont plus des boutons (premier onglet « Demandes » et onglet Agenda : un appui).
- Mon profil : une ligne nom + ville ; adresse, téléphone, e-mail et « Modifier mes informations » derrière un appui ; barre « Profil complet » seulement s'il manque quelque chose ;
  deux accès en tête (Mes demandes, Paiements avec « n à régler ») + « Pièce d'identité : à fournir » tant qu'elle manque ; Mes factures, réclamations, favoris, compte, aide derrière « Voir plus ».
  Flèche retour et « ← Carte » retirées (racine d'onglet : la barre du bas mène à la carte).
- Agenda (client et pro) : décompte des missions dans la barre de titre (plus de bandeau) ; bandeau litiges sur une ligne quand il y en a plusieurs ; bandeau « autre espace » raccourci ;
  « Mes demandes en ligne » en tête seulement s'il y a une proposition à examiner, sinon après les rendez-vous ; « Aujourd'hui » : cartes allégées (heure seule, bouton « Mission du jour » sur la première,
  2 au plus puis « Voir les N autres du jour ») : report, annulation et frise de suivi sont dans « Mission du jour » et la conversation ; « À venir » : report, annulation et frise derrière
  un bouton « Reporter, annuler, suivi » par carte. Réservation à accepter (BookingCard), litiges, onglets, Terminées, Factures : inchangés.
- Admin (`public/admin.html`) : barre de titre sur une seule ligne en mobile (menu, titre, loupe, Fictifs ; la recherche s'ouvre sur toute la largeur au toucher) ; « À traiter maintenant » : explications
  redondantes retirées (la ligne « litige » n'affiche son détail que s'il y a des échéances dépassées) ; trois profils Admin / Prestataire / Client sur une ligne de 44 px (infobulles) ; « Activité en cours » sans phrase d'aide ; indications statiques des 4 chiffres clés retirées (remplies par la page dès le chargement).
- Carte du particulier sur bureau : le parcours « Trouver un prestataire » (besoin, moment, meilleur choix + Réserver, Voir les autres) s'ouvre dans le panneau de droite (`FindSheet` mode `embedded`), la carte reste visible
  à gauche ; la fiche d'un prestataire cliqué sur la carte passe devant sans perdre l'étape ; mobile inchangé (feuille du bas). Parcours rapide mobile : 4 appuis, 0 KO (`parcours-rapide.mjs`).

### Admin : comptage dans le HTML (JavaScript coupé, `scripts/e2e/admin-structure.mjs`) : PAS un rendu réel
| Mesure (mobile 390 / bureau 1440) | avant | après |
|---|---|---|
| mots avant la carte « Derniers inscrits » | 112 / 112 | 55 / 55 (-51 %) |
| mots de l'écran | 94 / 134 | 52 / 94 |
| mots de la vue d'ensemble | 299 | 242 |
| éléments de la vue d'ensemble | 153 | 142 |
| hauteur avant « Derniers inscrits » | 1206 / 746 px | 949 / 642 px |
| hauteur de la barre de titre (mobile) | 113 px | 69 px (-39 %) |
| éléments cliquables avant « Derniers inscrits » | 15 / 14 | 15 / 15 (la loupe compte un clic de plus ; plus de contenu tient à l'écran) |
Aucun compte admin de test : rendu avec données, volet « Aperçu réel » et recherche ouverte : non vérifiés.

### Non vérifié / reste
- Rendu sur Vercel après déploiement ; tests A et B (créneau du jour non utilisé) ; admin avec session réelle ; recherche admin au toucher de la loupe (CSS `:focus-within`) vue seulement en HTML statique.
- Cibles < 44 px mesurées : 0 sur les 4 écrans mobiles. « Se déconnecter » (profil) reste un texte cliquable sans cadre.
- Le texte « Répondez dans le dossier pour que PING puisse trancher » n'est plus répété dans la ligne d'alerte litige de Mon entreprise (version compacte) ; il reste dans le dossier du litige.
