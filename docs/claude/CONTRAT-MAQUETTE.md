# Contrat de fidélité maquette / application (créé le 23/11/2026, première passe)
Ce fichier dit, ligne par ligne, si l'application reproduit la maquette. Il est lu par le gardien de fidélité (`.claude/agents/gardien-fidelite.md`) et avant tout chantier de design.
Maquette : `docs/maquette/maquette-ping-v11.html` (18/11/2026) ; lignes sources : `docs/maquette/data.js` (A01 à A43 = onglet Audit, Q001 à Q205 = Contrôle qualité, numérotés dans l'ordre du fichier) + écrans de la liste « Aller directement à un écran ».
Les statuts de `data.js` (18/11) NE sont PAS recopiés : chaque ligne a été relue dans `src/` et `public/` au commit b4c6437 ; la production est le commit 4d87563 (déploiement READY lu dans l'API Vercel le 23/11 par l'agent principal, égal à la tête de main ; écart avec b4c6437 : documentation seulement). Deuxième passe du 23/11 : échantillon de 41 lignes « OK (code) » recontrôlé, 7 références corrigées, 2 statuts retirés, 1 VOULU repassé en MANQUE.
Un texte est copié du code, jamais retapé ; une ligne ne passe à OK qu'avec une preuve en production (texte, classe CSS ou mesure) ; sinon « OK (code) » + fichier:ligne.
Un écart n'est VOULU que si Romain l'a décidé (date et source citées) ; un écart non décidé est MANQUE. Mise à jour : le gardien et l'agent principal, après chaque mise en production.

## Légende des statuts (seuls autorisés)
- **OK** : en ligne, preuve donnée (texte ou classe trouvée dans un fichier de production, ou mesure).
- **OK (code)** : présent dans le code au commit b4c6437 (fichier:ligne dans le fichier de détail) ; texte ou fonction trouvé, rendu en production non vu.
- **MANQUE** : la maquette montre un élément que l'application n'a pas ou fait autrement, sans décision de Romain.
- **VOULU** : écart décidé par Romain, décision citée (voir la section en bas).
- **NON VÉRIFIÉ** : preuve impossible pour l'instant, raison écrite dans la note (compte administrateur, base, mesure à faire).

## Décompte au 24/11/2026 matin, quatrième passe visuelle (212 lignes)
Production : déploiement GitHub du commit b3a7e24 (« success » le 24/11 à 00:07 UTC, égal à la tête de main). Écrans comparés à 390x844, maquette (file://, `showView` / `jump`, inchangée) contre production (Playwright, comptes `audit.*@ping-demo.invalid`, lecture seule) ; captures `*-6.png` dans `docs/maquette-ecarts-2026-11-23/`.
| Profil | OK | OK (code) | MANQUE | VOULU | NON VÉRIFIÉ | Total |
|---|---|---|---|---|---|---|
| Site public | 6 | 8 | 0 | 0 | 1 | 15 |
| Particulier | 41 | 39 | 4 | 8 | 4 | 96 |
| Prestataire | 11 | 41 | 8 | 3 | 2 | 65 |
| Administration | 0 | 27 | 2 | 2 | 5 | 36 |
| **Total** | 58 | 115 | 14 | 13 | 12 | 212 |
Fidélité : 58 lignes OK sur 212 (27,4 %), contre 37 sur 201 (18,4 %) à la passe 3 ; 173 sur 212 (81,6 %) avec « OK (code) » ; parmi les 72 lignes tranchées en production (OK ou MANQUE), 58 OK (81 %). 13 VOULU hors calcul d'écart. Changements : 10 lignes MANQUE passées OK (contraste du bouton #0B8374 mesuré, accueil, connexion, réservation en 5 étapes, Paiements client avec pourboires, facture à défilement unique, Messages client et pro, pièces client, Paiements pro), 6 lignes OK (code) passées OK, 10 lignes ajoutées (Commandes en cours côté client et pro, Trouver un prestataire en 4 appuis, Mon annonce, calendrier avec réservations en attente, IBAN, 4 écarts de lecture aérée / cibles / calendrier), 1 VOULU ajouté (Mon profil derrière « Voir plus »).
Non prouvable sans écriture ni compte : IBAN affiché avec « Modifier », variante « Récapitulatif » de la facture, dernier appui « Réserver » du parcours Trouver un prestataire, envoi d'une pièce, tout l'admin.

## Décompte au 23/11/2026 soir, troisième passe visuelle (201 lignes)
Production du 23/11 soir (alignement maquette, refonte de la carte, simplification des comptes) : 15 écrans + Messages (client et pro), Mes pièces (client et pro), Mon entreprise, Paiements pro, Mon profil client, comparés à 390x844 (captures `*-3.png`).
| Profil | OK | OK (code) | MANQUE | VOULU | NON VÉRIFIÉ | Total |
|---|---|---|---|---|---|---|
| Site public | 4 | 8 | 2 | 0 | 1 | 15 |
| Particulier | 30 | 42 | 9 | 7 | 4 | 92 |
| Prestataire | 3 | 44 | 7 | 3 | 1 | 58 |
| Administration | 0 | 27 | 2 | 2 | 5 | 36 |
| **Total** | 37 | 121 | 20 | 12 | 11 | 201 |
Fidélité : 37 lignes OK sur 201 (18,4 %) ; 158 sur 201 (78,6 %) en comptant « OK (code) » ; parmi les 57 lignes tranchées en production (OK ou MANQUE), 37 OK (65 %). Les 12 VOULU sont des écarts décidés, hors calcul d'écart.
Avant (passe visuelle du matin, 192 lignes) : OK 32, OK (code) 122, MANQUE 20, VOULU 9, NON VÉRIFIÉ 9. Changements du soir : VOULU +2 nets (carte centrale : fond/Waze, zoom, puces) ; OK +5 (Vitres retirée des puces, en-tête Réservation, Mes factures, médiation, bandeau de la conversation) ; ligne Vitres repassée de VOULU à OK ; 8 lignes ajoutées (Messages x3, Mes pièces x2, Paiements pro, Accueil admin, Mission du jour pro).
Décision de Romain du 23/11 (message sur la carte centrale) : voir la section VOULU.

Passe visuelle du 23/11 : 15 écrans comparés à 390x844, maquette (file://, `showView` / `jump`) contre production (Playwright, comptes de test `.invalid`, lecture seule). Captures `maquette-<écran>.png` et `app-<écran>.png` dans `docs/maquette-ecarts-2026-11-23/`. 10 lignes nouvelles (écarts vus), 32 lignes passées à OK (nom de capture en note), 2 lignes passées de OK (code) à MANQUE (contraste du bouton, « Mes opérations »).
Non montrable avec les comptes de test : mission « Pas encore l'heure », facture « Récapitulatif » (particulier sans SIRET), IBAN et « Copier » (le prestataire de test n'a pas d'IBAN), « Il vous reste… » côté pro, état « Serez-vous sur place ? » non répondu (mission déjà en cours).
Avant la passe visuelle : OK 0, OK (code) 156, MANQUE 8, VOULU 9, NON VÉRIFIÉ 9 (182 lignes).

Avant la deuxième passe : OK (code) 158, MANQUE 7, VOULU 10, NON VÉRIFIÉ 7. Aucune ligne n'est « OK » : la production n'a pas pu être lue (voir « Limites de la preuve »). Les 248 lignes de `data.js` sont regroupées en lignes d'élément (doublons Audit / Contrôle qualité fusionnés, identifiants A / Q rappelés dans chaque note) ; aucune ligne de `data.js` n'est omise.

## Fichiers de détail (tableau : Écran ou onglet | Élément | Statut | Note)
- `CONTRAT-MAQUETTE-public.md` : site public, inscription, connexion, CGU, page introuvable.
- `CONTRAT-MAQUETTE-client.md` et `CONTRAT-MAQUETTE-client-2.md` : particulier (carte, menu, demande, réservation, mission, puis messages, facture, litige, profil, design).
- `CONTRAT-MAQUETTE-prestataire.md` : prestataire.
- `CONTRAT-MAQUETTE-admin.md` : administration (`public/admin.html`, `/admin/*`).

## Limites de la preuve (23/11/2026)
- (Passe 1, obsolète depuis la passe visuelle : Playwright atteint la production ; curl reste bloqué.) Production injoignable depuis l'environnement de cette passe : `curl` sur toutes les pages de nexto-eta.vercel.app répond 403 (en-tête `x-vercel-mitigated: deny`, pare-feu Vercel), même `/robots.txt`. Aucun contournement tenté. Commit de production non vérifié par moi ; repris de l'agent principal (b4c6437).
- Donc aucune preuve « texte trouvé dans un fichier de production » ni mesure en navigateur. Tout est lu dans le dépôt ; une mesure (cibles 44 px, hauteurs d'en-tête, boutons recouverts) reste NON VÉRIFIÉ.
- L'administration n'est lisible que par un compte administrateur, que cet agent n'a pas : tout ce qui dépend de données lues par l'admin est NON VÉRIFIÉ ; structure et textes de `public/admin.html` prouvés par le code seulement.
- « OK (code) » vérifie la présence du texte ou de la fonction (grep sur une ligne qui n'est pas un commentaire), pas qu'elle s'affiche au bon endroit ni avec les bonnes données. À rejouer en production dès que le pare-feu laisse passer le gardien.

## VOULU : écarts décidés par Romain
| Écart avec la maquette | Décision (date, source) | Détail |
|---|---|---|
| Vitres absent du catalogue proposé ; fin de chantier et remise en état hors catalogue ; mono-produit ménage / repassage / nettoyage | HISTORIQUE.md l.47 (mono-produit) et l.622 (décision 07/11, services extensibles par catalogue) ; A-TRANCHER n | client, prestataire, admin |
| Séquestre écrit mais éteint ; virement SEPA d'abord | A-TRANCHER b et d ; HISTORIQUE.md l.567 (« Virement SEPA, 31/10 : décision Romain, virement d'abord, séquestre en suspens ») ; DEMANDES.md D-19 (aucun prestataire de paiement choisi). L.336 citée avant est fausse : elle dit l'inverse (A-TRANCHER d) | client, admin |
| Carte mobile = objet central, style Waze : UNE ligne en haut (menu + filtre/zone), feuille du bas à 3 états réduite par défaut ; donc logo, cloche, puces de service, zoom + / − et bulle de commentaire du haut de carte de la maquette VOULUS absents du premier écran mobile (puces dans la feuille, filtre dans le menu / la feuille) | Romain, 23/11, message sur la carte centrale | client (Carte), prestataire (Demandes autour de moi) |
| Carte du particulier : parcours « Trouver un prestataire » en 4 appuis, résultat « Le meilleur choix pour vous » (maquette : liste puis fiche) | Romain, 23/11 (« c'est l'Uber, c'est la simplicité ») | client (Carte) |
| Lecture AÉRÉE : moins de cadres, plus d'espace, texte >= 15 px ; hub de Mon profil réduit à Mes demandes / Paiements puis « Voir plus » | Romain, 24/11, message « la lecture aérée demandée » (la cible >= 15 px n'est PAS atteinte partout : voir les lignes MANQUE « Lecture aérée ») | client |
| Menu à 4 entrées ; pas de bouton central « Demander » ; entrée « Mission » conservée les jours de mission | Romain 30/10 (HISTORIQUE.md l.36) ; « Navigation validée » 18/11 (l.629) ; A-TRANCHER r | client, prestataire |
| « Profil vérifié par PING » seulement si pièces validées (maquette : « contrôlée par PING ») | Exception 03/11 (HISTORIQUE.md l.71) ; A-TRANCHER e ; jamais « certifié » ni « garanti » | client |
| Annulation : 3 paliers et frais totaux après l'arrivée (maquette : 15 % après « en route ») | Romain 20/11 (HISTORIQUE.md l.662-663 et l.679) ; A-TRANCHER a ; DEMANDES.md D-07 | client |

Écarts cités dans la consigne mais NON retenus comme VOULU : « annonce non modifiable » (DEMANDES.md D-17 dit que Romain veut « modifiable », aucune décision contraire trouvée : ligne MANQUE) ; « nouveau prestataire réservable » (la maquette le montre aussi : OK (code)).

## MANQUE ouverts au 24/11/2026 matin (14 lignes ; ordre de correction proposé)
1. Lecture aérée, espace prestataire : texte sous 15 px presque partout (Paiements 295 éléments sur 305, Mes pièces 68 sur 76, Mon annonce 79 sur 105, Agenda 47 sur 55) (prestataire)
2. Lecture aérée, particulier : écrans non repris (agenda 46, chat 78, fiche prestataire 111, déposer une demande 86, mes demandes 574) et pastilles / horaires de 10,5 à 14 px sur les écrans repris (client)
3. Mon annonce : 20 cibles tactiles sous 44 px (puces de points forts 35 px, rayons 38 px, trois liens 19-20 px) (prestataire)
4. Calendrier pro du jour : 9 billets simultanés tronqués, pas de regroupement (prestataire)
5. Mes pièces pro : pas d'écran « Cadrez le document en entier » (le client l'a) (prestataire)
6. Mon entreprise pro : ordre des blocs de la maquette (jauge Mon annonce, fiche, « Ma fiche publique » / « Mes tarifs », alerte litige, « Il vous reste 2 éléments ») (prestataire)
7. Mon profil client : barre « Profil complet : 3 sur 4 », ville, flèche retour (client-2)
8. Agenda client : « N missions dans votre espace particulier » (l'app dit « 144 missions »), sous-texte « Échéance dépassée » (client)
9. Fiche à compléter : « Modifier » une annonce de demande (client), création de l'activité en 4 étapes, avertissements « Je pars », rayon 40 m du client absent, « Voir comme » admin, export CSV admin
Fermés depuis la passe 3 : contraste du bouton (#0B8374 en production), Paiements client, Messages (client et pro), réservation en 5 étapes, facture à défilement unique, Paiements pro, pièces client, accueil, connexion.

## Rappels
Aucun emoji, jamais « certifié » ni « garanti » ; aucune donnée inventée. Les écrans de `docs/maquette/` n'ont pas été modifiés. Autres écarts de forme (rayon d'arrivée 300 m, assistant de création en 5 ou 7 étapes, pourboires) : voir les lignes MANQUE.
