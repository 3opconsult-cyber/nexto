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
| Menu à 4 entrées ; pas de bouton central « Demander » ; entrée « Mission » conservée les jours de mission | Romain 30/10 (HISTORIQUE.md l.36) ; « Navigation validée » 18/11 (l.629) ; A-TRANCHER r | client, prestataire |
| « Profil vérifié par PING » seulement si pièces validées (maquette : « contrôlée par PING ») | Exception 03/11 (HISTORIQUE.md l.71) ; A-TRANCHER e ; jamais « certifié » ni « garanti » | client |
| Annulation : 3 paliers et frais totaux après l'arrivée (maquette : 15 % après « en route ») | Romain 20/11 (HISTORIQUE.md l.662-663 et l.679) ; A-TRANCHER a ; DEMANDES.md D-07 | client |

Écarts cités dans la consigne mais NON retenus comme VOULU : « annonce non modifiable » (DEMANDES.md D-17 dit que Romain veut « modifiable », aucune décision contraire trouvée : ligne MANQUE) ; « nouveau prestataire réservable » (la maquette le montre aussi : OK (code)).

## MANQUE ouverts au 23/11/2026 soir (20 lignes ; ordre = ordre de correction proposé, détail dans les fichiers de profil)
1. Paiements client : l'écran « Paiements » de la maquette (À régler, Réglé, pourboires) n'existe pas ; la ligne « Paiements · Virement sur facture » du profil n'ouvre rien (client-2)
2. Messages (liste, client et pro) : filtres « Tous / Non lus », bandeau de décompte, flèche retour, aperçu du dernier message (client-2, prestataire)
3. Réservation : 5 étapes numérotées, choix « Fréquence » (client)
4. Mon profil client : barre « Profil complet : 3 sur 4 », flèche retour (client-2)
5. Facture : un seul défilement au lieu d'onglets (client-2)
6. Paiements pro : écran « Comment vous êtes payé », IBAN affiché + « Modifier », « Commissions à régler » ; en production : « Mes versements » avec champs IBAN (prestataire)
7. Mon entreprise pro : ordre des blocs, boutons « + » du cadre, texte de jauge (prestataire)
8. Mes pièces (client et pro) : écran de prise de vue « Cadrez le document en entier » (client-2, prestataire)
9. Agenda client : un seul bandeau litige, flèche retour (client)
10. Contraste du bouton principal #0C8F7E (4,0:1) contre #0B8374 (client)
Autres : accueil /bienvenue (logo « ping », accroche), connexion (logo « ping »), « Modifier » une annonce, création de l'activité en 4 étapes, avertissements « Je pars », rayon 40 m du client absent, « Voir comme », export CSV admin.

## Rappels
Aucun emoji, jamais « certifié » ni « garanti » ; aucune donnée inventée. Les écrans de `docs/maquette/` n'ont pas été modifiés. Autres écarts de forme (rayon d'arrivée 300 m, assistant de création en 5 ou 7 étapes, pourboires) : voir les lignes MANQUE.
