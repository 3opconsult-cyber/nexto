# Audit v5 : parcours client et admin (maquette `public/maquette.html`)

Auditeur : client-admin, le 17/11/2026. Lecture seule : aucun fichier existant modifié.
Méthode : Playwright sur `file:///home/user/nexto/public/maquette.html?r=<aléa>#client|#admin|#public`, en mobile 390x844 (hasTouch, isMobile) et en 1440x900. Gestes au doigt envoyés par CDP `Input.dispatchTouchEvent`. Scripts dans `/tmp/claude-0/-home-user-nexto/423f808d-6c68-5b55-942e-00e7e2289be0/scratchpad/e2e/client-admin/` (`probe.mjs`, `probe2.mjs`, `probe3.mjs`, `touch.mjs`, `signup.mjs`, `p4.mjs`, `caps.mjs`). Code lu : `docs/audit-2026-11-07/maquette-artefact/index.html`.
Aucune erreur JavaScript (`pageerror`) dans aucun parcours.

## Verdict

La maquette se manipule bien au doigt : pincement, glisser, volet, précédent/suivant et inscription fonctionnent. Le catalogue admin se répercute aussi partout où il le doit. En revanche, **la fiabilité de l'information ne tient pas** : l'état est global (`S.mission`, `S.chat`, `S.offers`, `INV0`, `REQS`, `PEOPLE`, `FEED`). Dès qu'on sort du chemin prévu (deuxième prestataire, deuxième demande, annulation, litige, taux modifié), un écran affiche une autre personne, un autre montant ou un statut faux. Les phrases qui annoncent une action (« annulée sans frais », « badge sur la fiche », « s'appliquent aux prochaines réservations », « dossier clos ») ne correspondent pas à ce qui se passe ensuite.
**Elle n'est pas présentable comme référence de validation tant qu'il n'y a pas un modèle « mission » indexé par identifiant (prestataire, client, adresse, statut, taux figé, facture, litige) lu par tous les écrans.**

| Critère | Note /10 | Pourquoi, en une ligne |
|---|---|---|
| Simplicité | 6 | Inscription en 4 écrans et une action par étape de mission ; mais deux boutons « demande » sur la carte et une bascule qui change d'identité. |
| Compréhension (5 s) | 5 | Les pictogrammes Ménage (crayon) et Repassage (appareil photo) se lisent mal ; « Ménage + Vitres » laisse croire à un prestataire qui fait les deux. |
| Fluidité | 6 | Les gestes marchent, mais l'épingle choisie passe sous les boutons de zoom et le bouton « Demander » cache des épingles. |
| Fiabilité des informations | 2 | 15 P0 : mauvais interlocuteur, facture d'un autre client, frais et statuts faux. |
| Cohérence | 3 | Les données ne concordent pas entre l'admin, l'espace client et l'espace prestataire (annonces, personnes, litiges, virements, taux). |
| Design | 6 | Mobile propre et sobre ; l'admin à 1440 px reste un téléphone de 275 px avec du texte d'environ 8 px. |

Total : **15 P0, 21 P1, 11 P2**.

## Captures

- `captures/v5-client-admin-01.png` : aperçu de Karim B. L'épingle choisie est cachée sous le bouton « + », et l'épingle « Ma position » la chevauche.
- `captures/v5-client-admin-02.png` : sélection « Ménage + Vitres », 4 résultats dont aucun ne fait les deux. Le bouton « Demander » cache l'épingle de Sophie.
- `captures/v5-client-admin-03.png` : « Écrire » depuis la fiche de Karim B. ouvre la conversation d'Amélie R.
- `captures/v5-client-admin-04.png` : annulation alors que le prestataire est « en route ». Le message dit « sans frais » et la mission reste « Confirmée ».
- `captures/v5-client-admin-05.png` : dans le compte de Marie, facture FACT-2026-0031 avec « Client : Nadia K. ».
- `captures/v5-client-admin-06.png` : ménage à l'heure, « 4 h facturées » alors que la facture fait 22,00 €.
- `captures/v5-client-admin-07.png` : admin à 1440x900, dossier clos mais toujours « 1 litige ouvert » ; téléphone de 275 px.
- `captures/v5-client-admin-08.png` : taux client passé à 10 % dans l'admin, la réservation affiche toujours 8 % et 5,28 €.

## Défauts

Notation : « clics » désigne des sélecteurs `data-a` de la maquette.

### P0 : information fausse, mauvaise personne ou statut faux

1. **Compteurs du sélecteur de services faux.** `#client`, appui sur `picker`. Constat : « Tous les services 6 prestataires » et « Ménage 4 », alors que la carte affiche « 5 prestataires près de vous » et 3 en ménage (Nina T., « nouveau », est masquée). Correctif : dans `SC.map`, calculer `n` sur `visPros()` (après le filtre `nouveau` et « Disponible maintenant »), pas sur `PROS`.
2. **« Écrire » depuis une fiche ouvre la conversation d'un autre prestataire.** `sel:1` → `pro:1` (Karim B.) → `go:chat`. L'en-tête affiche « Amélie R. » (capture 03). Correctif : `SC.procard`, `data-a="chatw:<id du prestataire>"` ; dans `SC.chat`, prendre l'interlocuteur dans l'argument et ne jamais se rabattre sur `S.mission.pro`.
3. **Toutes les conversations partagent les mêmes messages et les mêmes devis.** `tab:messages` → `chatw:1` (Karim, repassage) : on y lit « Voici mon tarif : ménage 3 h, 66 € » et un devis d'Amélie à accepter. Correctif : remplacer `S.chat` et `S.offers` par `S.threads[idInterlocuteur] = {msgs, offers, rdv}`.
4. **Annulation tardive : montant annoncé contredit et mission non annulée.** Prestataire `adv` (en route) → client `go:cancel`. L'écran annonce « 15 % (9,90 €) », le message de confirmation dit « Mission annulée sans frais », et la carte reste « Confirmée » dans « En cours » (capture 04). Correctif : dans `ACT.cxgo`, lire `late` avant `S.mission.step=0`. Ajouter un statut `Annulée` à `MS` et à `SC.missions` (onglet Terminées), et retirer la mission de l'agenda.
5. **Durée facturée sans rapport avec la facture.** Réserver « Ménage à l'heure » (`bsvc:1`), puis côté prestataire `adv`, `qrdone` ×2. Constat : « Durée réelle : 3 h 20, 4 h facturées », mais la facture FACT-2026-0050 fait 22,00 € (1 h) (capture 06). Pour un forfait, la même phrase « 4 h facturées » contredit la règle « forfait jamais ajusté ». Correctif : dans `SC.mission`, calculer la durée et `billedHours()` depuis l'objet mission. Afficher la ligne seulement en horaire ou en forfait avec heures en plus, et faire produire le montant par `INVS()` (heures × taux).
6. **Facture d'un autre client visible dans le compte de Marie.** `tab:profile` → `mtabgo:fact` → `inv:1` : FACT-2026-0031 « Client : Nadia K. » (capture 05). L'onglet Terminées dit pourtant « Repassage avec Karim B. » pour Marie. Correctif : `INV0[1][6]` doit valoir « Marie D. » ou ne pas figurer chez Marie. Filtrer `INVS()` par client (rôle client) ou par émetteur (rôle prestataire).
7. **Un avis donné depuis n'importe quelle facture vise Amélie et fait passer à « Facturée » une mission qui n'a pas commencé.** `inv:1` (Karim) → `go:review` : « Comment s'est passée la mission avec Amélie R. ? ». Après `reviewgo`, la mission « Demain 10 h » passe à l'étape 4 « Facturée » sans être passée par En route, Sur place ou Terminée. Correctif : passer l'identifiant de la mission à `review` (`go:review:<idMission>`). `reviewgo` ne doit jamais toucher `S.mission.step`.
8. **Autre adresse ignorée ou affichée à tort.** (a) Dans `book` : `addr` puis une saisie dans `#bk_addr`, puis `book`. Le suivi indique « adresse confirmée » et le prestataire voit « 12 rue de la Paix ». (b) Dans la conversation : `rdva:autre` puis `rdvgo` (statut à valider). La frise affiche « adresse confirmée » et le suivi du prestataire montre l'adresse du profil en entier. Correctif : stocker `mission.address` et `mission.addressStatus`, et faire lire ces champs par `SC.mission` (côté prestataire, `maskAddress` tant que ce n'est pas `ok`). Faire lire `#bk_addr` par `ACT.book`.
9. **Accepter une proposition efface toutes les demandes, et les propositions ne correspondent pas à la demande.** `reqnew` (Ménage + Vitres + Repassage) → `reqgo` → `go:props` → `accept:1`. Résultat : « Aucune demande en ligne », la nouvelle demande est perdue. Les propositions sont toujours Karim B. (repassage seulement) à 36 € et Inès D. à 40 €. Correctif : `ACT.accept` retire seulement la demande concernée (`props:<idDemande>`) ; `SC.props` filtre les propositions par demande et par service.
10. **« Signaler un problème » ouvre un autre litige et perd la réclamation.** Mission « Ménage 3 h » → `go:dnew` → « Prix contesté », 20 € → `dgo`. On arrive sur « Vitres, 12 oct., 30 € réclamés ». Correctif : `ACT.dgo` crée `S.disputes.push({mission, motif, montant, photos})` et `SC.dispute` affiche ce dossier.
11. **Un litige clos reste « ouvert » partout.** Admin `a_disp` → `go:dispute` → `dclose`. L'accueil admin affiche encore « 1 litige ouvert » (capture 07) et le client voit toujours « Litige ouvert · réponse sous 48 h ». Correctif : calculer les compteurs de `SC.a_home`, `SC.a_disp` et `SC.missions` (onglet Terminées) à partir de `S.disputes`.
12. **Taux de commission réglé dans l'admin sans effet.** `a_money` → `rate2:rc:1` ×2, soit 10 %. La réservation affiche toujours « frais de service 5,28 €, 8 % » (capture 08), et le chat aussi. Correctif : remplacer les `.08` et `.17` en dur (`SC.book`, `SC.chat`, `SC.offer`, `SC.invoice`, `SC.pay`) par `getRates()` = `S.rc`/`S.rp`. Figer le taux dans la mission à la confirmation.
13. **Virements : statuts faux et frais jamais demandés au client.** L'admin affiche « PING-C-0042 Marie D. · Annoncé » avant toute action du client. Le client ne voit nulle part ses 5,28 € de frais à régler. « J'ai fait le virement » (`vir`) ne change rien dans l'admin. « À régler » reste « FACT-2026-0042 » même quand FACT-2026-0050 existe. Correctif : une table `S.transfers` par facture (FACT, PING-C, PING-V) avec les statuts à payer, annoncé et reçu, lue par `SC.pay`, `SC.invoice` et `SC.a_money`.
14. **Date de rendez-vous jamais choisie.** Dans `book`, aucun créneau n'est présélectionné et « Confirmer la réservation » reste actif. La mission prend « Demain 10 h », qui ne figure pas parmi les créneaux proposés (Lun. 9 h, …). Après `accept`, la mission devient « Jeudi 9 h », sans choix non plus. Correctif : désactiver `book` tant que `S.bookWhen` est vide. Pour `accept`, faire passer le client par « Fixez le rendez-vous ».
15. **Les avis affichent tous 5 étoiles.** Fiche d'Inès D. (note 4,6) ou de Karim B. : chaque avis porte `aria-label="5 sur 5"`. C'est le défaut déjà corrigé en production le 17/09. Correctif : dans `SC.procard`, `p.com` doit contenir `{n, txt}` et afficher `stars(c.n)`.

### P1

16. **« Ménage + Vitres » se comporte comme un « ou ».** `svc:menage` + `svc:vitres` : 4 résultats, dont aucun ne fait les deux (capture 02). Le libellé « + » et la phrase de la demande (« un seul prestataire peut tout faire ») font attendre un « et ». Correctif : dans `selOk`, utiliser `S.fsel.every(k=>keys.includes(k))`. Si la liste est vide, proposer « Voir ceux qui font l'un ou l'autre ».
17. **Frais d'un tarif horaire calculés sur une heure.** `bsvc:1` affiche « Prix figé : 22 € / heure + frais de service 1,76 € ». Correctif : afficher « 8 % du total, soit 1,76 € par heure » ou une estimation sur la durée prévue (`SC.book`).
18. **Demande détaillée appauvrie.** `reqgo` ne garde ni la surface, ni l'adresse, ni l'urgence, ni le budget. Le sous-titre de « Mes demandes » affiche seulement le premier service (« Ménage · en ligne ») et un numéro de téléphone passe dans « Précisions ». Correctif : `ACT.reqgo` stocke tout l'objet `S.newReq` et refuse téléphone et e-mail (même expression régulière que `/client/demandes/new`).
19. **Une nouvelle demande n'apparaît pas côté prestataire.** Après `reqgo`, `#prestataire` montre toujours les 4 demandes de `REQS`. Correctif : ajouter les demandes du client à `REQS` (avec position floutée).
20. **Une mission terminée reste dans « En cours ».** Après l'avis, l'onglet Terminées ne la contient pas, et « En cours » l'affiche avec l'étiquette « Facturée ». Correctif : dans `SC.missions`, répartir les missions selon le statut (étape ≥ 3, onglet Terminées).
21. **L'étape « Facturée » n'est atteinte qu'en laissant un avis.** La facture existe dès l'étape 3 (`INVS`). Correctif : passer à l'étape 4 au scan de fin (`qrdone` quand l'étape vaut 2).
22. **Compteurs du profil figés.** « Mes factures : 2 factures » alors qu'il y en a 3 ; « Profil complet à 50 %, 2 / 4 » ne dit pas quelles sont les 4 étapes. Correctif : utiliser `INVS().length` et une liste visible des 4 éléments (`SC.profile`).
23. **Factures identiques d'un prestataire à l'autre.** Même SIRET « 123 456 789 00012 » et même IBAN « …0189 » pour Amélie et Karim, alors que la fiche de Karim n'a pas de SIRET. Correctif : ajouter `siret` et `iban` à `PROS`. Pour un pro « particulier », émettre un « récapitulatif » sans SIRET (`SC.invoice`, `SC.pdf`).
24. **Vocabulaire de séquestre dans un modèle de virement direct.** « Le versement est bloqué tant que le dossier est ouvert » (`dnew`, `dispute`, `a_disp`) et « Dossier clos. Le versement est débloqué » (`dclose`) : PING ne détient pas le prix de la prestation. Correctif : « La facture reste en attente de règlement tant que le dossier est ouvert ».
25. **Fil du litige illisible pour l'admin.** Les bulles ne disent pas qui parle. Le message de médiation de l'admin a le même style que « D'accord pour jeudi » de Marie. L'échéance « sous 48 h » date du 12 oct. Correctif : afficher l'auteur et l'heure sur chaque bulle (`kind` client, prestataire ou médiation) et une échéance datée (`SC.dispute`).
26. **Pièces à valider sans contrôle possible.** Valider « Hugo P. · Pièce d'identité » annonce « le badge apparaît sur la fiche publique », mais Hugo n'a aucune fiche (absent de `PROS`). Aucun lien vers le profil ni vers la fiche, et aucune comparaison du nom de la pièce avec celui du compte. Correctif : dans `SC.a_docs`, ajouter « Voir la fiche » (`pro:<id>`) et le nom du compte à côté de l'aperçu. Mettre Hugo et Théo dans `PROS` (fiche « en contrôle »).
27. **Données de l'admin sans rapport avec les espaces client et prestataire.** Amélie R. (celle qu'on « voit comme ») est absente de « Personnes ». Hugo P. est compté « 1 en cours » et Marie « 0 en cours », alors que la seule mission en cours est entre Marie et Amélie. L'annonce de Marie est « Ménage après déménagement » dans l'admin et « Repassage chaque semaine » chez elle. L'accueil affiche toujours « 1 mission en cours (66 €) », même après une annulation ou un tarif à 55 €. Correctif : dériver `PEOPLE`, `SC.a_ann` et les chiffres de `SC.a_home` des mêmes objets que les espaces client et prestataire.
28. **« Voir comme » n'est pas en lecture seule.** Depuis `asview:client`, l'admin peut réserver, annoncer un virement ou publier un avis au nom de Marie. Les actions ne vérifient jamais `S.asAdmin`. Correctif : dans le gestionnaire de clics, bloquer toute action d'écriture quand `S.asAdmin` est vrai (message « lecture seule »).
29. **Admin illisible sur ordinateur.** À 1440x900, l'admin reste un téléphone de 275x612 px, avec un texte d'environ 8 px (capture 07). Correctif : mise en page bureau pour `#admin` (barre latérale et tableau) au-delà de 1000 px.
30. **La bascule « Prestataire » transforme Marie en Amélie R.** `tab:profile` → `role:pro`. On arrive « Disponible » sur « Demandes autour de vous », avec la fiche d'Amélie (42 avis), sans aucune création d'activité. Correctif : la première bascule d'un compte sans activité ouvre `pwiz`.
31. **Catalogue : service activé vide et accueil figé.** Activer « Petits travaux » ou « Garde d'enfants » les rend visibles tout de suite dans la carte, le sélecteur et la demande, avec « Aucun pour l'instant ». La phrase d'accueil reste « Ménage, repassage, vitres, fin de chantier ». Correctif : dans `SC.welcome`, générer la phrase depuis `SVCS`. Dans `caton`, avertir quand le service n'a aucun prestataire (« visible, 0 prestataire »).
32. **Pictogrammes trompeurs.** Ménage s'affiche avec un crayon (`I.s_menage`) et Repassage avec un appareil photo (`I.s_repassage`), visibles dans les captures 01 et 02. Correctif : un balai ou un seau pour le ménage, un fer à repasser pour le repassage.
33. **« Choisir une ville plutôt » ne demande aucune ville.** Dans `locperm`, les deux boutons appellent `locok`. Correctif : ouvrir un champ ville (comme `zonesheet` côté prestataire).
34. **Connexion sans rien vérifier.** `login` → `loginok` avec des champs vides mène à la carte client, y compris pour un prestataire. Correctif : valider les champs dans `ACT.loginok` et ouvrir le dernier espace utilisé (`ping_mode`).
35. **Épingle et carte cachées par les commandes.** L'épingle choisie passe sous « + » (capture 01) et le bouton « Demander » cache l'épingle de Sophie (capture 02). Correctif : dans `ACT.sel`, recentrer l'épingle choisie au-dessus de l'aperçu. Faire passer « Demander » dans le volet ou dans la barre du bas (`OPT.nav==='4'`).
36. **Promesses générales sur les vérifications.** L'accueil en 3 écrans dit « Identité et assurances vérifiées par PING » pour tous, alors que certains profils n'ont que le téléphone. « Téléphone confirmé par SMS » est affiché alors qu'aucun SMS n'est branché. Correctif : « Pièces contrôlées par PING quand le badge est affiché » (`ONB[2]`) et « Téléphone renseigné » (`VLAB.tel`).

### P2

37. Le choix « Vitres » sort de l'écran dans la rangée des services (largeur 867 px pour 390 px visibles) : on ne voit pas tout ce qui est sélectionné. Correctif : faire passer les choix actifs en tête de `.chips`.
38. La carte porte deux boutons de demande (« Demander » et « Déposer une demande ») ; « Demander » réutilise le pictogramme `ping` de « Disponible maintenant ». Correctif : un seul bouton avec un pictogramme dédié.
39. L'onglet « Agenda » ouvre une page titrée « Missions », et l'onglet Agenda reste allumé sur l'onglet Factures. Correctif : titre `hd()` selon l'onglet.
40. Un message de confirmation reste affiché après un changement d'espace (« Dossier clos » sur l'écran de réservation, capture 08). Correctif : vider `#toastbox` dans `showView`.
41. « Pièces » (nombre de pièces du logement) entre en collision avec « pièces » (documents) dans `reqnew`. Correctif : « Nombre de pièces ».
42. Coquilles : « Amélie R.. » (`SC.dnew`), « aujourd'hui 2026 » (facture), `<p>` mal fermé dans `SC.reqnew`.
43. Un profil « nouveau » sans avis afficherait « ☆☆☆☆☆ 0 (0 avis) » dans l'aperçu (`previewPro` si `OPT.vis==='des'`). Correctif : « Nouveau, pas encore d'avis ».
44. La carte peut glisser sans limite, jusqu'à disparaître. Correctif : borner `S.mx` et `S.my` dans `bindMap`.
45. Retours des testeurs : aucune action possible (traité, répondre, écran concerné). Correctif : statut et lien vers l'écran.
46. Admin : la vignette « Admin, Piloter » affiche seulement un message, et une flèche retour apparaît sur l'accueil de l'admin. Correctif : vignette active non cliquable, `hist` vidé sur `tab:a_home`.
47. Inscription : pas de bouton pour afficher le mot de passe (`#su_pw`).

## Vérifié et supposé

**Vérifié en exécution** (scripts ci-dessus) : défauts 1 à 22, 24, 26 à 35, 37 à 40, et les captures 01 à 08.
- Pincement : l'échelle passe de 0,8 à 2,4 puis à 0,6.
- Glisser à un doigt : déplacement de +100 px.
- Volet tiré vers le haut : il passe à « full ».
- Fiche prestataire glissée vers la gauche : on passe au prestataire suivant (1 → 2).
- « Recentrer » : il remet l'échelle à 0,8. Un appui moins de 100 ms après un glisser est ignoré par Chromium : c'est un artefact du test, pas un défaut.
- Inscription client : 13 appuis jusqu'à la carte, en comptant 2 erreurs volontaires. Les messages d'erreur sont clairs et l'e-mail est conservé.
- Catalogue : un service ajouté puis activé apparaît bien dans la carte, le sélecteur, la demande et la carte du prestataire.

**Supposé (lu dans le code, non exécuté)** :
- 23 : SIRET et IBAN en dur dans `SC.invoice` et `SC.pdf`.
- 25 : style des bulles du litige.
- 28 : aucune vérification de `S.asAdmin` dans `ACT`.
- 36 : textes `ONB` et `VLAB`.
- 41 à 47.
