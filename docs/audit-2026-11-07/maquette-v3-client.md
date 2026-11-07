# Audit maquette v3 — périmètre « client » (#public + #client)

Auditeur : client · 07/11/2026 · fichier audité : `public/maquette.html` (identique à `maquette-artefact/index.html` + `data.js`, vérifié).
Méthode : Playwright (Chromium) en 390×844 (tactile, isMobile, DPR 2) et 1440×900, thèmes clair et sombre ; parcours bout en bout scriptés, glisser réel au doigt (CDP `Input.dispatchTouchEvent`) et à la souris, mesures DOM (cibles, débordements, contraste WCAG calculé). Scripts : `/tmp/claude-0/-home-user-nexto/423f808d-6c68-5b55-942e-00e7e2289be0/scratchpad/e2e/client/v3/`.

## Verdict

La structure est enfin bonne (carte + sélecteur, volet, « Déposer une demande » partout, Missions/Factures, bascule), mais la maquette ment dès qu'on va au bout d'un parcours : quel que soit le prestataire réservé, la mission, la conversation et toutes les factures sont celles d'« Amélie R., ménage 3 h, 66 € », les saisies s'effacent et le retour ramène aux formulaires déjà validés. Romain le verra en deux minutes.

## Notes /10

| Axe | Note | Raison principale |
|---|---|---|
| Simplicité | 7 | 5 onglets clairs, un écran par tâche ; sélecteur de service en double (liste + pastilles). |
| Compréhension | 5 | Statuts de mission dans le mauvais ordre, factures et noms incohérents, « vérifié » mal employé. |
| Fluidité | 5 | Saisies effacées, retour vers des formulaires validés, glisser de la fiche inopérant au doigt. |
| Ergonomie | 5 | Boutons de carte sous la barre de recherche en volet haut, téléphone hors écran en 390 et en 1440×900, pastilles à 40 px. |
| Design | 7 | Cohérent, sombre soigné ; blanc sur turquoise à 2,64:1 sur tous les boutons principaux. |
| Fonctionnel | 4 | 6 culs-de-sac (toasts), litige sans réponse possible, adresse jamais saisie, données jamais reliées entre écrans. |

## Demandes de Romain (périmètre : 1, 2, 4, 6, 7, 8, 9)

| # | Demande | Statut | Preuve |
|---|---|---|---|
| 1 | Retour arrière partout | **KO** | Flèche présente sur les écrans empilés, mais : aucune flèche sur la carte client ni sur la carte pro même avec un historique (Profil › Prestataire › carte pro : `hist=2`, pas de flèche) ; après « Confirmer la réservation », « Publier ma demande », « Publier mon avis », le retour rouvre le formulaire validé (réservation : retour → « Réserver Karim B. », re-confirmable) ; défilement non restauré ; saisies perdues (voir P0-3). |
| 2 | Factures visibles et faciles à trouver | **OK pour l'accès, KO pour le contenu** | 4 accès : Missions › Factures, Profil › Mes factures (2 factures), Terminées › « facture disponible », Suivi étape 4. Mais les 2 lignes (Ménage 66 €, Repassage 36 €) et « Repassage avec Karim B. » ouvrent toutes FACT-2026-0042 Amélie R. 66 € (capture 05). |
| 4 | Basculer client / prestataire | **Partiel** | Sélecteur Particulier/Prestataire en haut du profil : OK. Sur la carte : bouton icône seule (flèches, sans texte, `aria-label` uniquement). Depuis le profil, la bascule envoie sur la carte pro et non sur le profil pro ; la carte pro n'a pas de retour. |
| 6 | Volet qui remonte et redescend toujours | **Partiel** | Toucher : demi → plein → réduit → demi, OK. Glisser la poignée de 300 px : OK. Mais un glisser de 60 à 120 px vers le haut ne fait rien (aimantation au cran le plus proche, pas au sens du geste) ; glisser la liste elle-même ne déplace pas le volet ; volet plein : les boutons de zoom remontent sous la recherche (haut à −35 px, « + » hors écran, « − » sur la recherche, « recentrer » sur les pastilles) (capture 02). |
| 7 | Voir tout de suite où déposer une demande | **OK** (réserve) | Bouton plein « + Déposer une demande » en tête du volet + « Demander » au centre de la barre. Réserve : à 390 px de large, le téléphone commence à y = 417 et la barre du bas à y = 1154 (hors écran, capture 01) ; en 1440×900 la barre du bas est aussi sous la ligne de flottaison (capture 08). |
| 8 | Choisir le service en haut de la carte | **OK** (réserve) | « Tous les services ▾ » ouvre « Quel service ? » : Tous (5), Ménage (3), Repassage (3), Vitres (1), Fin de chantier (2), Autre service (0) ; le filtre agit (3 épingles). Réserves : doublon avec la rangée de pastilles ; la pastille choisie est coupée hors écran à droite (capture 08) ; les compteurs ignorent « Disponible maintenant ». |
| 9 | Pictogrammes homogènes et identiques à l'app | **OK** (remarques) | Tracés `map`, `msg`, `ag`, `prof`, `ent` identiques à `BottomTabBar.tsx` ; `tag`, `history`, `alert`, `card`, `id`, `eye`, `help`, `list`, `lock`, `swap` identiques à `Hub.tsx` ; `doc` et `heart` repris de `NavDrawer.tsx` (l'app a deux versions, Hub diffère). Écarts mineurs : `stroke-linecap:round` partout (la barre de l'app est en bout carré), 20 px contre 21 px ; le sélecteur de service met le même pictogramme `tag` devant chaque service ; aucun emoji (caractères hors ASCII : – — … € − ≈ ★ ☆). |

## Défauts

### P0 — bloquants (à corriger avant de montrer)

1. **La réservation et l'acceptation ignorent le prestataire choisi.** `#client` › épingle Karim B. › Réserver › Confirmer → Missions affiche « Ménage avec Amélie R. · 66 € » ; idem après « Accepter » Inès D. (40 €) dans Propositions ; la conversation ouverte depuis la fiche de Karim s'intitule « Amélie R. » ; le Suivi dit « Amélie R. · Nice » (captures 03, 04). Correctif : stocker la mission courante (`S.mission = {pro, svc, prix, quand}`) dans `ACT.book` / `ACT.accept` et la lire dans `SC.missions`, `SC.mission`, `SC.chat`, `SC.invoice` au lieu des chaînes en dur.
2. **Toutes les factures sont la même.** Missions › Factures › « Repassage · 36,00 € » ouvre FACT-2026-0042 « Amélie R., Ménage 3 h, 66,00 € » ; même chose depuis Terminées › « Repassage avec Karim B. » (capture 05). Correctif : passer l'identifiant (`data-a="inv:0042"`) et rendre `SC.invoice(arg)` depuis un tableau `INVOICES`.
3. **Les saisies s'effacent.** `paint()` réécrit tout `#view` : (a) Inscription : remplir e-mail et mot de passe puis toucher « conditions générales » vide les deux champs, alors que le message dit « votre saisie reste en place » (capture 06) ; (b) Déposer une demande : « Précisions » et « Budget » remis à zéro dès qu'on touche « Cette semaine » ou « C'est urgent » ; (c) Avis : le commentaire disparaît quand on touche une étoile ; (d) le minuteur du toast relance `paint()` 2,6 s plus tard et efface le message en cours de frappe dans la conversation (mesuré : texte présent à 0,6 s, vide à 2,9 s ; l'envoi répond ensuite « Écrivez un message »). Correctif : afficher le toast hors de `#view` (élément fixe dans `#screen`) et sauvegarder la valeur des champs dans `S` sur `input` (comme `siret_in` dans `bindDyn`) avant chaque `paint()`.
4. **Le retour ramène aux formulaires déjà validés.** Confirmer une réservation → Missions → Retour → « Réserver Karim B. » re-confirmable ; Publier une demande → Retour → formulaire rempli ; Publier mon avis → Retour → « Votre avis ». Correctif : dans `ACT.book`, `ACT.reqgo`, `ACT.accept`, `ACT.reviewgo`, remplacer l'écran du formulaire dans l'historique (`S.hist` tronqué jusqu'à la racine de l'onglet) au lieu de `nav()` qui empile.

### P1 — gêne forte

5. **Ordre de la mission faux.** Suivi › « Voir le QR d'arrivée » › « Le prestataire a scanné » → statut « En route » (au lieu de « Sur place »), puis le bouton client « Suivre : le prestataire est en route » fait passer à « Sur place » : c'est le client qui pose l'arrivée, contraire à la règle. Correctif : `primary()` client = étape 0 « Suivre le départ » (sans action), étape 1 « Montrer le QR d'arrivée » → `qrdone` passe à 2 ; aucun bouton client qui appelle `adv`.
6. **La mission terminée ne sort jamais de « En cours ».** Après l'avis : statut « Facturée » mais toujours dans En cours, absente de Terminées, toujours « Demain 10 h », et le bouton principal repropose « Laisser un avis ». Correctif : à l'étape 4, déplacer la mission dans la liste `past` de `SC.missions` et remplacer l'action par « Voir la facture ».
7. **Litige : mauvais dossier et aucune réponse possible.** Suivi de la mission (ménage) › Signaler → ouvre « Vitres, 12 oct. », un autre litige ; l'écran Litige n'a ni champ de réponse ni bouton d'envoi (seulement « Ajouter une photo », toast) ; « Réponse attendue sous 48 h » sur un litige du 12 octobre ; « le versement est bloqué » contredit la facture « à régler par virement au prestataire ». Correctif : « Signaler » ouvre un formulaire (motif, montant, photo) lié à la mission courante, le dossier reçoit la zone de saisie de `SC.chat`, et le texte devient « vous n'avez rien à régler tant que le litige est ouvert ».
8. **Propositions fictives sur toute demande.** Déposer « Vitres » › Publier › toucher la nouvelle demande (« 0 proposition ») → « Propositions reçues » montre Karim B. 36 € et Inès D. 40 € (Karim ne fait que du repassage) (capture 07) ; « Accepter » vide toutes les demandes (`S.myReqs=[]`). Correctif : `go:props` avec l'index de la demande, état vide « Aucune proposition pour l'instant » si `props===0`, et `accept` ne retire que la demande concernée.
9. **Réservation identique pour tous et prix ambigu.** Chez Karim B. (repassage, 18 €/h), « 1. Prestation » propose « Ménage 3 h 66 € / Ménage à l'heure 22 €/h » ; « Prix figé : 66 €, frais de service PING inclus (8 %) » contredit la facture (66,00 € + document séparé 5,28 €) ; « Je confirme cette adresse » est inerte (aucun `data-a`) et on ne peut pas en choisir une autre ; l'adresse « de votre profil » n'a jamais été demandée à l'inscription. Correctif : options tirées des services du prestataire, ligne « 66 € + 5,28 € de frais de service = 71,28 € », pastille « Autre adresse » qui ouvre un champ, et saisie d'adresse au premier passage si le profil n'en a pas.
10. **Volet de la carte.** Voir demande 6 : un glisser court vers le haut ne remonte pas, la liste ne se glisse pas, volet plein → boutons de zoom sous la recherche (capture 02). Correctif : dans `gr.onpointerup`, choisir le cran suivant dans le sens du geste dès 30 px ; poser les gestionnaires sur `#sheet` (hors `.in` défilant non en haut) ; `bottom` des `.fabs` = `min(SH[S.sheet]+14, hauteur_vue − 180)` ou masquer les boutons en volet plein.
11. **Fiche prestataire : le glisser annoncé ne marche pas au doigt, et suivant ignore le filtre.** Au doigt : `pointerdown` puis `pointercancel`, `S.proIdx` inchangé (touch-action `auto` sur `#swp`) ; à la souris ça marche. Filtre Repassage › Karim « 2 / 5 » › Suivant → Sophie L. (Vitres, Fin de chantier). Correctif : `touch-action: pan-y` sur `#swp` ; `prev`/`next` et le compteur « n / N » parcourent `visPros()`.
12. **Retour absent sur les cartes.** `SC.map` et `SC.pmap` n'appellent pas `hd()` : après Profil › Prestataire, impossible de revenir au profil ; inversement les racines d'onglet (Missions, Messages, Profil) affichent une flèche qui renvoie à l'onglet précédent. Correctif : petit bouton retour en haut à gauche de la carte quand `canBack()` ; pas de flèche sur une racine d'onglet atteinte par la barre du bas (`ACT.tab` remet `S.hist=[]`).
13. **Le téléphone est hors écran.** 390×844 : en-tête et 9 pastilles occupent 405 px, téléphone de y = 417 à 1221, barre du bas à 1154 (capture 01). 1440×900 : barre du bas sous la ligne de flottaison (capture 08), `fit()` ignore la hauteur de l'en-tête. Correctif : en ≤ 820 px, replier description et pastilles dans un menu et donner au téléphone `100dvh` ; dans `fit()`, `s = (innerHeight − hauteur de .head − 30) / 844`.
14. **Culs-de-sac.** Messages › Karim B. → toast « Conversation avec Karim B. » ; Profil › Mes favoris, Paiements, Mon compte, Aide → toasts ; Facture › Télécharger le PDF → toast. Correctif : ouvrir `SC.chat` avec l'interlocuteur en argument et créer des écrans minimaux (liste de favoris, « Virement sur facture, IBAN donné après la mission », formulaire de compte).
15. **Contraste des boutons principaux : 2,64:1.** Blanc sur `#12B39C` (« Créer mon compte », « Déposer une demande », « Réserver », « Accepter », bulle « moi »…) dans les deux thèmes, libellé d'onglet actif turquoise sur blanc 2,64:1, liens `--tealD` sur fond `--paper` 3,68:1. La maquette utilise pourtant `--onteal` (#05302A) pour les pastilles de navigation. Correctif : `.btn{color:var(--onteal)}` (ou fond `--tealD` en clair) et onglet actif en `--tealD`.
16. **« Vérifié » mal employé.** Fiche : « Téléphone vérifié » (l'app n'a aucun envoi de SMS), « SIRET vérifié (annuaire des entreprises) » (contrôle automatique, pas une pièce validée par un admin) ; liste et propositions : « Identité vérifiée » sans « par PING ». Correctif : `VLAB.tel = 'Téléphone renseigné'`, `VLAB.siret = 'SIRET trouvé dans l'annuaire des entreprises'`, et « Identité vérifiée par PING » partout.
17. **Bascule de profil peu visible.** Sur la carte, bouton icône seule (deux flèches) ; depuis le profil, on arrive sur la carte pro et pas sur le profil pro. Correctif : libellé texte « Espace pro » sur le bouton de la carte ; `ACT.role` conserve l'onglet (profil → `pprofile`, carte → `pmap`).

### P2 — finition

18. Volet à mi-hauteur (état initial) : l'épingle d'Inès D. (bas à 431 px) est cachée sous le volet (haut à 357 px) ; l'épingle de Julien M. touche le bouton « + ». Correctif : recadrer `maplayer` sur la zone visible au-dessus du volet.
19. « − » sans effet au départ (`zoom` minimum 1) ; « recentrer » ne fait que remettre le zoom. Correctif : zoom de départ 1,3 ou griser « − » à 1.
20. Toutes les notes 4,6 à 4,9 affichent ★★★★★ (`Math.round`), et chaque avis affiche 5 étoiles (`stars(5)`). Correctif : demi-étoiles ou note seule, étoiles par avis tirées des données.
21. Cibles sous 44 px : pastilles de service, de date et onglets de Missions (40 px), bascule Particulier/Prestataire (40 px), interrupteur « C'est urgent » (50×30), liens « conditions générales » (18 px), « Mot de passe oublié ? » (20 px), « Proposer un autre tarif » (20 px). Correctif : `.chip`, `.seg button` à `min-height:44px`, liens texte avec `padding:12px 0`.
22. Sélecteur en double (liste « Quel service ? » et rangée de pastilles) ; la pastille active sort de l'écran. Correctif : garder la liste en haut, ne laisser que « Disponible maintenant » en pastille, ou faire défiler la pastille active en vue (`scrollIntoView({inline:'center'})`).
23. Écrans publics : bande blanche vide de 66 px en bas (`.tabbar{display:flex}` l'emporte sur l'attribut `hidden`). Correctif : `.tabbar[hidden]{display:none}`.
24. Les toasts survivent à la navigation (« Un lien de réinitialisation… » affiché sur la page 404). Correctif : vider `S.toast` dans `nav()` et `back()`.
25. Inscription et connexion acceptent des champs vides ; aucun écran « vérifiez votre boîte mail » (présent dans l'app). Correctif : contrôle minimal et écran de confirmation avant la carte.
26. Vocabulaire non homogène : Client / Particulier ; Demander / Déposer une demande / Publier ma demande ; Signaler / Litige ; le bandeau « Voir le QR » ouvre le Suivi, pas le QR ; « 0 propositions ». Correctif : un mot par notion (Particulier, Déposer une demande, Signaler un problème), bandeau `go:qr`, accord du pluriel.
27. Jauge du profil : « 75 %, 3 / 4 » dès que la pièce est « En contrôle », sans lister les 4 éléments. Correctif : compter seulement les éléments validés et afficher la liste.
28. « J'ai déjà un compte » › Se connecter mène toujours à la carte client, la pastille du haut reste « Site public ». Correctif : `loginok` appelle `showView('client', true)`.
29. Déposer une demande : ni adresse ni heure précise (seulement « Aujourd'hui / Demain / Cette semaine »), alors que le prestataire voit « à 7,3 km ». Correctif : ligne « Adresse : celle du profil (modifier) » et choix d'un créneau.

## Bilan

4 P0 · 13 P1 · 12 P2.

## Captures

- `captures/v3-client-01.png` : 390×844 au chargement, téléphone sous la ligne de flottaison.
- `captures/v3-client-02.png` : volet plein, boutons de zoom sous la recherche.
- `captures/v3-client-03.png` : réservation chez Karim B. (repassage) proposant « Ménage 3 h, 66 € ».
- `captures/v3-client-04.png` : après réservation de Karim B., Missions affiche Amélie R.
- `captures/v3-client-05.png` : la facture « Repassage 36 € » ouvre FACT-2026-0042 Amélie R. 66 €.
- `captures/v3-client-06.png` : inscription vidée par « conditions générales », toast « votre saisie reste en place ».
- `captures/v3-client-07.png` : demande « 0 proposition » affichant deux propositions.
- `captures/v3-client-08.png` : 1440×900 sombre, filtre Repassage : pastille active coupée, épingle d'Inès sous le volet, barre du bas hors écran.

## Addendum — copie de travail modifiée pendant l'audit (16 h 49)

Les tests ci-dessus portent sur la v3 du commit `4499d71`. Pendant l'audit, `index.html`, `data.js` et `public/maquette.html` ont été modifiés (non commités, pas par cet auditeur). Contre-vérification sur la nouvelle copie :
- **P0-1, P0-3 et P0-4 se reproduisent toujours** (réservation de Karim B. → « Ménage avec Amélie R. », message effacé 2,9 s après un toast, commentaire d'avis effacé par une étoile, retour → « Votre avis »).
- P2-23 corrigé (`[hidden]{display:none!important}`).
- **Régression demande 7** : le bouton central de la barre client s'appelle désormais « PING » (icône d'ondes) au lieu de « Demander ». Un nouvel utilisateur ne peut pas deviner qu'il sert à déposer une demande. Correctif : garder le libellé « Demander » sous le bouton.
- **Régression demande 9** : `prof`, `doc`, `tag`, `alert`, `card`, `pin`, `id`, `eye`, `eyeoff`, `help`, `chart`, `check`, `pencil`, `home` ont été redessinés et ne reprennent plus les tracés de `BottomTabBar.tsx` / `Hub.tsx` (par exemple `prof` : cercle r=3 au lieu de r=4 ; `tag` : contour à 5 points au lieu de celui de Hub) ; `msg` reprend la version de `NavDrawer.tsx`, différente de celle de la barre du bas de l'app. Le commentaire « mêmes tracés que l'app » est donc devenu faux. Correctif : revenir aux chemins de `Hub.tsx` / `BottomTabBar.tsx`, ou mettre à jour l'app avec les mêmes chemins, mais pas un troisième jeu.
