# Audit maquette v5 : parcours prestataire de bout en bout

Auditeur : « prestataire ». Date : 17/11/2026. Fichier testé : `public/maquette.html` en `file://`. Outil : Playwright, en 390x844 (tactile, isMobile, DPR 2) et en 1440x900. Code lu : `docs/audit-2026-11-07/maquette-artefact/index.html`.

Scripts rejouables : `/tmp/claude-0/-home-user-nexto/423f808d-6c68-5b55-942e-00e7e2289be0/scratchpad/e2e/prestataire/v5/` (`f1.mjs` à `f9.mjs`, `lib.mjs`). Chaque test part d'une page rechargée (`?r=<aléatoire>#ancre`).

Ce qui est « vérifié » a été rejoué au clic, avec le texte affiché relevé. Ce qui est « lu dans le code » n'a pas été déclenché à l'écran. Aucune erreur JavaScript, sauf celle du P0-7.

## Verdict

**Non validable en l'état pour un artisan.** L'ossature est la bonne : assistant en 4 étapes, Mes services, statuts par pièce, conversation avec devis, frise de mission, client absent, virement. Mais la fiabilité des informations ne tient pas dès qu'on sort du scénario prévu.

- **Les activités choisies ne servent à rien.** Choisir Vitres affiche des modèles de ménage. Ajouter un service de vitres ne rend pas le prestataire visible dans le filtre Vitres.
- **Modifier un service écrase un autre service.**
- **Les montants sont faux dès qu'on sort du forfait de 66 €** : tarif horaire, heure entamée, revenus, annulation tardive.
- **Une demande ouvre la conversation d'une autre mission et efface sa négociation.**
- **L'adresse non validée s'affiche en entier dans le suivi**, et c'est la mauvaise.
- **« Vérifiée par PING » est affiché** sur la pièce d'identité d'un compte créé il y a 10 secondes, qui n'a rien envoyé.

Décompte : **17 P0, 17 P1, 8 P2.**

## Notes /10

| Axe | Note | Raison principale |
|---|---|---|
| Simplicité | 5 | Inscription courte (4 étapes, 19 appuis). Mais le nom, le téléphone et l'adresse ne sont jamais demandés vraiment. « Mes services » est à 2 appuis. Répondre à une demande demande 5 appuis en mode « Contacter ». |
| Compréhension | 4 | Les onglets ne correspondent pas aux titres : « Entreprise » ouvre « Mon profil », « Agenda » ouvre « Missions ». « Vérifiée par PING » est collé sur « Compte créé ». Le statut Particulier est contredit par le SIRET et par la facture. |
| Fluidité | 4 | La photo de la pièce d'identité fait sortir de l'assistant. Le retour depuis « Profil envoyé » ramène à l'accueil public. Le message temporaire bloque le bouton retour pendant 2,6 s. |
| Fiabilité des informations | 2 | Facture d'un autre prestataire chez soi. Revenus faux. « 4 h facturées » sur un forfait. Prix horaire figé à « 60 € ». Annulation « sans frais » après l'annonce de 9,90 €. Même détail pour les 4 demandes. |
| Cohérence | 3 | Métiers de la fiche, carte, réservation et Mes services divergent. Un statut « Hors ligne » reste « Disponible » pour le client. Les commissions restent à 17 % quand l'admin passe à 22 %. |
| Design | 7 | Propre, pictogrammes homogènes, contraste correct, pas de débordement (scrollWidth = 390 et 1440). Le téléphone est réduit à 74 % sur 1440x900 (290 px de large). |

## Défauts

Notation : `#prestataire` › suite d'appuis. Les noms entre crochets sont les `data-a` du code.

### P0 : bloquant ou information fausse

**P0-1. Modifier un service affiche et enregistre les données d'un autre service.** *(vérifié, capture 01)*

- Écran : `#prestataire` › Entreprise › Mes services › crayon de « Ménage 3 h » › nom « Ménage 3 h (produits fournis) », 70 € › Enregistrer › crayon de « Panier de repassage ».
- Constat : le formulaire du panier affiche « Ménage 3 h (produits fournis) », 70 €, métier Ménage. « Enregistrer » sans rien toucher écrase le panier. Le service 4 devient un doublon du service 1, et le repassage disparaît.
- Cause : `paint()` réinjecte le cache `S.f[id]` (`se_n`, `se_p`, `se_s`) dans tout champ qui porte le même `id`, quel que soit l'écran.
- Correctif : vider `S.f` des champs de formulaire dans `nav()` (ou indexer le cache par écran : `S.f[n+'/'+id]`). Dans `ACT.svcedit`, `svcnew` et `svctpl`, poser `S.f.se_n`, `S.f.se_p` et `S.f.se_s` à partir de `S.edit`.

**P0-2. Les activités choisies dans l'assistant sont ignorées.** *(vérifié, capture 03)*

- Écran : `#public` › Je suis prestataire › compte › « j'ai cliqué sur le lien » › Particulier, Vitres seul (Ménage décoché) › Continuer › Continuer.
- Constat : l'étape 3 « Vos services » affiche Ménage 3 h, Ménage à l'heure et Grand ménage. Grand ménage est pourtant masqué. Le profil dit ensuite « Ménage, repassage · Nice ». `S.wzSvc` n'est lu nulle part.
- Correctif : à l'étape 3 de `SC.pwiz`, construire la liste depuis `TPL[k]` pour chaque `k` de `S.wzSvc`. Dans `ACT.wz`, remplacer `S.svcs` par ces modèles. L'en-tête de `SC.pprofile` doit lister les métiers de `S.svcs` visibles.

**P0-3. Les métiers publics sont figés : un service ajouté n'est pas trouvable.** *(vérifié)*

- Écran : Mes services › Ajouter › métier Vitres, « À la fenêtre », 8 € › Enregistrer. Puis bascule client › puce Vitres.
- Constat : le filtre Vitres affiche « 1 prestataire » (Sophie L.) et pas Amélie. L'aperçu d'Amélie montre Ménage et Repassage. Pourtant sa réservation propose « Vitres à la fenêtre ». Même chose pour « Nettoyage fin de chantier », présent dans Mes services mais absent de la fiche.
- Correctif : `liveV()` renvoie aussi `s: [...new Set(S.svcs.filter(x=>x.vis).map(x=>x.s))]`. Utiliser `lv.s` dans `visPros`/`selOk`, `pinPro`, `previewPro`, `SC.map` (liste) et `SC.procard`.

**P0-4. Le statut « Particulier » est contredit par le SIRET et par la facture.** *(vérifié)*

- Écran : assistant › Particulier › Publier › Mon profil, puis Agenda › Factures › FACT-2026-0042.
- Constat : le profil affiche « SIRET 123 456 789 00012 · Trouvé (annuaire) ». La facture affiche « Entrepreneur individuel · SIRET 123 456 789 00012 ». Le même SIRET figure sur la facture de Karim B. Un particulier non immatriculé doit recevoir un récapitulatif, pas une facture. Le SIRET saisi à l'étape 1 (`wz_siret`) n'est ni contrôlé ni conservé.
- Correctif : dans `ACT.wz`, poser `S.me.siret = S.wzSt==='part' ? 'na' : (14 chiffres valides ? 'ok' : 'none')`. Dans `SC.invoice` et `SC.pdf`, titrer « Récapitulatif » et retirer la ligne SIRET quand le statut est particulier. Prendre le SIRET propre à chaque prestataire (`PROS[i].siret`).

**P0-5. « Vérifiée par PING » est affiché sans aucun contrôle.** *(vérifié, capture 04)*

- Écran : fin de l'assistant (« Publier mon profil ») sans avoir envoyé de pièce.
- Constat : « Profil envoyé » affiche :
  - « Compte créé : Vérifiée par PING » ;
  - « Activité et services : Vérifiée par PING » ;
  - « Pièce d'identité : Vérifiée par PING » alors qu'aucune photo n'a été envoyée ;
  - « RC Pro : En contrôle » alors qu'aucune RC n'a été envoyée.

  Le même écran dit « vous apparaissez dès que PING a vérifié votre pièce ». La règle du CLAUDE.md (« vérifié par PING » seulement pour une pièce validée par un admin) est enfreinte.
- Correctif : un compte neuf part de `S.me={id:'none',rc:'none',urssaf:'none',…}`. Dans `SC.attente`, utiliser un libellé « Fait » pour le compte et l'activité, pas `stTag('ok')`. Dans `ACT.wz`, ne plus forcer `S.me.id` à `ok`.

**P0-6. Envoyer sa pièce d'identité fait sortir de l'assistant.** *(vérifié)*

- Écran : assistant étape 4 › Prendre ma pièce en photo › Prendre en photo › Envoyer pour contrôle › Terminé.
- Constat : on arrive sur « Mon profil ». L'étape 4 (CGV, « Publier mon profil ») n'est jamais terminée. Le retour mène ensuite à l'accueil public (« Je cherche un prestataire… »).
- Correctif : dans `ACT.doc`, mémoriser l'origine (`S.docTarget.from=cur()`). `ACT.iddone` revient à `pwiz` (avec `S.pwiz=3`) quand l'origine est l'assistant.

**P0-7. Réserver un prestataire sans service réservable plante la page.** *(vérifié)*

- Écran : Mes services › masquer Ménage 3 h, Ménage à l'heure et Panier (il reste « Sur devis ») › client › épingle Amélie › Réserver.
- Constat : erreur JS « Cannot read properties of undefined (reading '1') ». L'écran ne change pas. L'épingle affiche « Devis » et le bouton « Réserver » reste proposé.
- Correctif : dans `SC.book`, si `bookOpts(p)` est vide, afficher « Ce prestataire travaille sur devis » avec un bouton « Écrire ». Masquer « Réserver » dans `previewPro` et `SC.procard` dans ce cas.

**P0-8. Les unités panier, fenêtre et m² sont présentées comme un tarif horaire.** *(vérifié)*

- Écran : service « Vitres à la fenêtre » à 8 € › client › Réserver Amélie.
- Constat : la ligne affiche « Vitres à la fenêtre · Par heure · 8 € », puis « Prix figé : 8 € + frais de service 0,64 € ». Aucun nombre de fenêtres n'est demandé. `liveV().from` ignore ces unités.
- Correctif : dans `bookOpts`, afficher `UNITS[x.mode]` au lieu de `'Par heure'`. Ajouter un champ quantité (fenêtres, paniers, m²) dans `SC.book` et calculer total = quantité × prix. Prendre en compte ces modes dans `liveV()`.

**P0-9. Un tarif horaire devient un faux prix figé.** *(vérifié)*

- Écran 1 : client › Réserver Amélie › « Ménage à l'heure » › Confirmer. Résultat : `S.mission.p = 22`, et la mission puis la facture affichent 22 € pour une prestation de plusieurs heures.
- Écran 2 : pro › demande › Contacter › Proposer un tarif › « À l'heure ». Le champ reste prérempli à 66 (le forfait) et affiche « Vous percevez 164,34 € pour 3 h ». À 20 €/h, une fois accepté : « Prix figé 60 € ». La durée de 3 h est inventée (`offerBase`). Les frais de 8 % sont calculés sur un taux horaire (« 1,76 € »).
- Correctif : la mission garde `{mode, rate}`. Le total est calculé au scan de fin (`billedHours × rate`). Afficher « Vous percevez 16,60 € par heure » sans durée supposée. Remettre le prix par défaut à vide quand on change de mode (`ACT.ofm`).

**P0-10. Heure entamée appliquée à un forfait, et facture non recalculée.** *(vérifié, capture 06)*

- Écran : Agenda › En cours › mission › Je pars › Scanner (arrivée) › Scanner (fin).
- Constat : sur « Ménage 3 h, forfait 66 € », l'écran affiche « Durée réelle : 3 h 20 · 4 h facturées ». La facture reste à 66,00 €. Le forfait seul ne doit jamais être ajusté (CLAUDE.md). La durée « 3 h 20 » est écrite en dur. Pour « forfait + heures sup », la facture ignore le supplément (lu dans le code : `offerBase` renvoie `o.p`).
- Correctif : dans `SC.mission`, à `s===3`, brancher selon le mode. Forfait : « Forfait : prix inchangé ». Horaire ou forfait + heures sup : `S.mission.p` est recalculé et la facture porte la ligne « 4 h × 22 € ».

**P0-11. Factures et revenus d'un autre prestataire chez soi.** *(vérifié, capture 07)*

- Écran : Agenda › Factures › 2e ligne. Puis Entreprise › Mes revenus, et Relevé annuel.
- Constat : « Karim B. · FACT-2026-0031 · client Nadia K. » apparaît dans les factures d'Amélie. « Mes revenus » affiche « Perçu en novembre 84,66 € », soit (66 + 36) × 0,83, Karim compris, alors que les factures sont « À payer ». Après une 3e mission, les revenus disent toujours « 2 missions » alors que le relevé passe à 168 €. « Mes factures émises : 2 factures » reste figé.
- Correctif : dans `INVS()`, filtrer par vendeur en espace prestataire (`f[5]==='Amélie R.'`). `SC.revenus` doit calculer depuis cette liste et distinguer « Facturé » de « Reçu » (statut du virement). Le compteur de `SC.pprofile` doit être `INVS().length`.

**P0-12. Une seule conversation pour tout le monde : répondre à une demande écrase une négociation en cours.** *(vérifié)*

- Écran 1 : Demandes › « Repassage chaque semaine » › Contacter le client. Le chat s'intitule « Marie D. ». La négociation à 66 € en attente avec Marie (`S.offers`) est effacée.
- Écran 2 : avec l'option « Les deux » › Proposer directement un tarif › Envoyer. On arrive dans le chat de la mission de Marie, et son devis de 66 € passe automatiquement à « Refusé ».
- Constat : Messages › Nadia K. affiche le même fil et le même tarif. La liste Messages reste figée (« J'accepte le devis. »).
- Correctif : indexer les conversations par demande ou mission : `S.convs[id]={who, chat, offers}`. `SC.chat(a)` et `SC.messages` lisent `S.convs`. `ACT.pcontact` et `ACT.ofgo` créent ou complètent `S.convs['req'+S.reqIdx]` sans toucher aux autres.

**P0-13. Les 4 demandes ont le même détail.** *(vérifié)*

- Écran : Demandes › chaque demande.
- Constat : toutes affichent « Surface 65 m² · Pièces 3 · Fréquence Une fois · Foyer 2 personnes ». Or « Repassage chaque semaine » dit « Une fois », et « Vitres, maison 120 m² » dit « 65 m² ».
- Correctif : ajouter `m2`, `pieces`, `freq`, `foyer` et `pay` à chaque entrée de `REQS` et les afficher dans `SC.preq`.

**P0-14. Le suivi de mission montre une adresse fausse et non validée.** *(vérifié, capture 02)*

- Écran : client accepte le devis › Fixez le rendez-vous › Une autre adresse « 5 avenue des Fleurs » › Confirmer. Puis pro › Agenda › En cours › mission.
- Constat : le chat masque correctement l'adresse (« … avenue des Fleurs »). Mais le suivi affiche « Marie D. · 12 rue de la Paix, Nice » et « Prix figé 66 €, adresse confirmée ». C'est l'adresse du profil, pas celle de l'intervention, et elle n'est pas validée. Après un refus, c'est la même chose.
- Correctif : dans `SC.mission` (rôle pro), lire `S.rdv`. Si `a_valider` : afficher `S.rdv.masked` avec « Adresse à valider dans la conversation ». Si refusée : « Adresse refusée ». Si `ok` : `S.rdv.ad`. Rendre dynamique le sous-titre de l'étape 0.

**P0-15. « Hors ligne » n'a aucun effet côté client (régression d'un bug déjà corrigé en prod).** *(vérifié, capture 08)*

- Écran : Demandes › puce « Disponible » (passe à « Hors ligne ») › client › « Disponible maintenant ».
- Constat : Amélie reste listée « Disponible ». Elle apparaît dans le filtre « Disponible maintenant » (3 prestataires) et dans l'aperçu « Disponible maintenant ». Le CLAUDE.md cite exactement ce bug comme corrigé en prod.
- Correctif : `liveV()` renvoie `live:S.avail` pour `id===0`. Utiliser `lv.live` dans `visPros` (filtre `S.live`), `pinPro`, `previewPro` et la liste.

**P0-16. L'option « Après vérification de l'identité » ne s'applique pas au prestataire réel.** *(vérifié, capture 08)*

- Écran : `#propositions` (valeur par défaut `vis=apres`) › Entreprise › Pièce d'identité › Envoyer (statut « En contrôle ») › client.
- Constat : Amélie reste sur la carte, listée et réservable. Seule Nina T. (donnée fictive) est filtrée. L'écran « Profil envoyé » promet l'inverse.
- Correctif : dans `visPros`, pour `id===0`, exiger `S.me.id==='ok'` quand `OPT.vis==='apres'`. Sinon (`des`), afficher « Nouveau · pièce d'identité en contrôle » comme pour Nina.

**P0-17. Annulation tardive annoncée à 9,90 €, confirmée « sans frais », et la mission continue.** *(vérifié)*

- Écran : mission › Je pars › Annuler la mission (« frais de 15 % (9,90 €) ») › Confirmer.
- Constat : le message dit « Mission annulée sans frais ». La mission reste « Confirmée » avec « Je pars ».
- Cause : `ACT.cxgo` remet `step=0` avant de tester `step===1`.
- Correctif : calculer `const late=S.mission.step===1` avant de remettre l'étape à zéro. Poser un statut « Annulée » (`MS`) et masquer les actions de `SC.mission` et de la carte de Missions.

### P1 : gêne forte ou incohérence visible

**P1-1. Le message temporaire bloque les appuis en haut de l'écran pendant 2,6 s.** *(vérifié)*

- Constat : `elementFromPoint` sur le bouton retour renvoie `.toast`. Pendant ce temps, Playwright est bloqué sur le retour, la bascule et la zone (6 fois dans les parcours).
- Correctif : dans `.toast`, poser `top:auto; bottom:calc(64px + 12px); pointer-events:none`.

**P1-2. Les commissions sont écrites en dur.** *(vérifié)*

- Constat : l'admin passe le taux prestataire à 22 %, mais le chat affiche toujours « Vous percevez 54,78 € (après 17 %) ». Les valeurs `.17` et `.08` sont en dur dans `SC.chat`, `SC.offer`, `SC.invoice`, `SC.pay` et `SC.revenus`.
- Correctif : une fonction `rates()` qui lit `S.rc` et `S.rp`, figée sur la mission à l'acceptation (`S.mission.rates`).

**P1-3. Le motif de refus d'une pièce n'est jamais montré au prestataire.** *(vérifié)*

- Constat : l'admin refuse la RC Pro pour « Document expiré ». Côté prestataire, la ligne repasse à « À ajouter » sans motif.
- Correctif : dans `ACT.docko`, stocker `S.me[k+'_motif']`. Dans `vrow`, afficher le statut rouge « Refusée : document expiré » avec « Renvoyer ».

**P1-4. Une attestation URSSAF validée n'apparaît nulle part sur la fiche.** *(vérifié)*

- Constat : le profil promet pourtant « plus il y en a, plus vous apparaissez en tête ».
- Correctif : ajouter `VLAB.urssaf` (« Attestation URSSAF fournie, contrôlée par PING ») et `'urssaf'` dans le filtre de `liveV()`.

**P1-5. Assurance dommages-ouvrage proposée au prestataire et affichée « vérifiée par PING » sur la fiche d'une pro du ménage.** *(vérifié, capture 05)*

- Constat : la dommages-ouvrage est souscrite par le maître d'ouvrage (le client), pas par l'artisan. La décennale est proposée à tous les prestataires.
- Correctif : retirer la ligne `do` de `SC.pprofile`, de `VLAB` et de `waitDocs`. N'afficher la décennale que si un service visible a `catOf(s).dom==='Bâtiment'`.

**P1-6. Les créneaux de réservation ignorent « Mes disponibilités ».** *(vérifié)*

- Constat : avec lundi et jeudi fermés, la réservation propose toujours Lun. 9 h, Lun. 14 h, Jeu. 9 h et Jeu. 14 h. Aucun créneau n'est présélectionné, et la réservation part sur « Demain 10 h », qui n'est pas proposé.
- Correctif : générer les créneaux de `SC.book` depuis `S.dispo` pour `id===0`. Bloquer « Confirmer » tant qu'aucun créneau n'est choisi.

**P1-7. L'agenda ignore la date réelle du rendez-vous.** *(vérifié)*

- Constat : avec un rendez-vous jeudi 9 h, l'agenda affiche « Mar 10 · 10 h ». La vue jour côté pro affiche le nom du prestataire lui-même (« Amélie R. ») au lieu du client.
- Correctif : dans `SC.agenda`, placer la mission d'après `S.mission.when` et afficher l'interlocuteur selon `S.role`.

**P1-8. Une demande publiée par le client n'arrive pas chez le prestataire.** *(vérifié)*

- Constat : on publie une demande Vitres, mais la carte pro reste à « 4 demandes ».
- Correctif : dans `ACT.reqgo`, faire `REQS.push({...})` avec les champs du formulaire.

**P1-9. En mode « Contacter » (recommandé), aucune trace dans « Propositions envoyées ».** *(vérifié)*

- Constat : `ofgo` exige `preq` dans la pile, qui n'y est plus après `pcontact`.
- Correctif : dans `pcontact`, poser `S.sent.push({req:S.reqIdx, st:'conversation ouverte'})`, puis mettre à jour l'entrée au premier tarif envoyé.

**P1-10. Une adresse refusée mène à une impasse côté client.** *(vérifié)*

- Constat : le client lit « Adresse refusée : proposez-en une autre » sous « Rendez-vous confirmé », sans champ pour en saisir une autre.
- Correctif : dans `ACT.adko`, remettre la carte « Fixez le rendez-vous » (`S.rdv=null`, `S.rdvAd='autre'`) avec le motif.

**P1-11. Le nom de la mission est forcé à « Ménage 3 h » ou « Ménage à l'heure ».** *(vérifié)*

- Constat : un devis horaire sur « Repassage chaque semaine » devient « Ménage à l'heure ».
- Correctif : dans `ACT.oacc`, prendre le titre et le service de la demande liée à la conversation.

**P1-12. L'identité du prestataire n'est jamais demandée.** *(vérifié)*

- Constat : ni nom, ni raison sociale, ni photo. Le compte neuf devient « Amélie R. ★ 4,9 (42 avis) ». Le téléphone vide est accepté, alors qu'il est obligatoire selon le CLAUDE.md du 02/11. « Mon adresse : 12 rue de la Paix, Nice » est l'adresse de la cliente Marie D.
- Correctif : étape 1 « Nom » (ou rempli par le SIRET). Étape 2 : contrôle du téléphone (`/^0[67]\d{8}$/` après suppression des espaces) et champ d'adresse propre. Un compte neuf part de 0 avis.

**P1-13. Le retour après l'inscription ramène à l'accueil public.** *(vérifié)*

- Constat : depuis « Profil envoyé » ou « Mon profil », le retour affiche « Je cherche un prestataire / Je suis prestataire », comme si on était déconnecté.
- Correctif : dans `ACT.mailok` et `ACT.wz`, vider `S.hist` à l'entrée dans l'espace connecté. La pile de « Profil envoyé » devient `['pmap','attente']`.

**P1-14. « Ma fiche publique » permet de se réserver soi-même et de feuilleter les concurrents.** *(vérifié)*

- Constat : Réserver sur sa propre fiche bascule en particulier et crée une mission avec soi-même, ce qu'interdit la contrainte `transactions_buyer_ne_seller`. « Suivant » affiche « 2 / 6 Karim B. ».
- Correctif : dans `SC.procard`, en mode aperçu (`S.role==='pro' && S.proIdx===0`), masquer Précédent/Suivant et la barre Écrire/Réserver. Afficher « Aperçu : ce que voient les clients ».

**P1-15. Le prestataire ne peut pas noter « Virement reçu ».** *(vérifié)*

- Constat : la facture reste « À payer » pour toujours, alors que le CLAUDE.md (31/10) dit : « le pro note reçu SA prestation ».
- Correctif : bouton « J'ai reçu le virement » dans `SC.invoice` (rôle pro), qui alimente le « Reçu » de `SC.revenus`.

**P1-16. Les mots changent d'un écran à l'autre.** *(vérifié)*

- Constat :
  - l'onglet « Entreprise » ouvre « Mon profil » (le CLAUDE.md dit « Mon entreprise ») ;
  - l'onglet « Agenda » ouvre « Missions » et s'ouvre toujours sur la vue Agenda, jamais sur « En cours » ;
  - l'onglet « Demandes » ouvre une carte sans titre ;
  - « Mes versements » côté pro, « Paiements » côté client ;
  - « Commission de service PING » sur la facture, « commission » dans les CGV ;
  - la note est écrite « 4.9 » sur la fiche et « 4,9 » ailleurs.
- Correctif : titres de `hd()` alignés sur `TABS` (« Mon entreprise », « Agenda »). Dans `ACT.tab`, ouvrir sur `cours` s'il y a une mission aujourd'hui. Dans `SC.procard`, écrire `String(p.r).replace('.',',')`.

**P1-17. La fiche publique ne montre pas le catalogue.** *(vérifié)*

- Constat : la rubrique Tarifs se limite à « À partir de 22 €/h ». Les forfaits ne se découvrent qu'au moment de « Réserver », et les services sur devis restent invisibles.
- Correctif : dans la carte Tarifs de `SC.procard`, lister `S.svcs.filter(x=>x.vis)` avec `modeLabel(x)`.

### P2 : finition

**P2-1. Validation « client absent » trop permissive.** *(vérifié pour le code ; lu dans le code pour la photo)*

- Constat : le code « 000000 » est accepté. La frise affiche « Arrivée validée par QR » même après un code. « Prendre la photo et valider » valide sans photo.
- Correctif : comparer le code à celui de la mission, afficher le mode réel d'arrivée, et ajouter l'étape photo.

**P2-2. « Noter le client » reste affiché après la note.** *(vérifié)*

- Constat : on peut noter le client plusieurs fois. Aucune trace de la note privée.
- Correctif : poser `S.crDone` et masquer le bouton.

**P2-3. La carte pro montre des demandes hors de ses métiers.** *(vérifié)*

- Constat : les demandes « Fin de chantier » apparaissent par défaut chez une pro du ménage.
- Correctif : filtre par défaut sur les métiers de `S.svcs`.

**P2-4. Le prix « 22,50 » est tronqué à 22 sans avertissement.** *(vérifié)*

- Correctif : dans `readEdit`, utiliser `parseFloat(v.replace(',','.'))`.

**P2-5. Le téléphone est trop petit sur 1440x900.** *(vérifié)*

- Constat : téléphone affiché à 74 % (290 px), texte autour de 10 px.
- Correctif : dans `fit()`, réduire l'en-tête ou plafonner à `s>=.85`.

**P2-6. L'étape « Facturée » n'arrive qu'après l'avis du client.** *(lu dans le code)*

- Constat : `reviewgo` pose `step=4`, alors que la facture existe dès « Terminée ».
- Correctif : passer à l'étape 4 dans `qrdone` à la fin.

**P2-7. Le champ IBAN est prérempli avec des puces modifiables.** *(lu dans le code)*

- Constat : le champ contient « FR76 •••• … » : enregistrer sauve les puces.
- Correctif : afficher l'IBAN masqué en texte, avec un bouton « Modifier » qui ouvre un champ vide et vérifie le format.

**P2-8. Envoyer une qualification ramène au profil sans signaler l'ajout.** *(vérifié)*

- Constat : retour au profil sans repère, alors que la nouvelle ligne « RGE » est en bas de la page.
- Correctif : faire défiler jusqu'à la ligne et afficher le message « RGE : en contrôle ».

## Les trois propositions (`#propositions`), du point de vue d'un prestataire

| Proposition | Mesure | La plus simple pour un prestataire |
|---|---|---|
| Barre du bas | 4 entrées : Demandes · Messages · Agenda · Entreprise ; Mes services à 2 appuis (Entreprise › Mes services) ; mission du jour à 2 appuis (Agenda › tuile). 5 entrées : Demandes · Missions · Services · Messages · Entreprise, 78 px chacune ; Mes services à 1 appui. | **4 entrées.** Un artisan modifie ses services rarement, mais il répond aux demandes et aux messages tous les jours. Condition : « Agenda » doit s'ouvrir sur la mission du jour (P1-16), sinon il faut un appui de plus. |
| Visibilité d'un nouveau prestataire | Aucune des deux options ne s'applique au prestataire réel (P0-16). « Dès l'inscription » : aucune attente, la mention « Nouveau » suffit. « Après vérification » : un état d'attente de 24 h à comprendre. | Pour le prestataire, **« dès l'inscription »** est la plus simple (il reçoit des demandes tout de suite). Pour la confiance, je garde « après vérification » pour **être réservable**, tout en étant visible plus tôt en « Nouveau · pièce d'identité en contrôle ». |
| Réponse à une demande | « Contacter » : 5 appuis (Demande › Contacter › Proposer un tarif › mode › Envoyer), sans trace dans Missions (P1-9). « Tarif direct » : 3 appuis (Demande › Proposer mon tarif, prérempli au budget › Envoyer), avec trace « Propositions envoyées ». « Les deux » : deux boutons, donc un choix de plus. | **Tarif direct** (3 appuis, prix prérempli, trace visible). La conversation reste ouverte derrière pour les questions et la contre-proposition, donc la règle du tarif est respectée. Les trois options ouvrent aujourd'hui la mauvaise conversation (P0-12) : à corriger d'abord. |

## Captures

1. `captures/v5-prestataire-01-modifier-panier-affiche-autre-service.png` (P0-1)
2. `captures/v5-prestataire-02-suivi-adresse-non-validee.png` (P0-14)
3. `captures/v5-prestataire-03-assistant-vitres-choisi-menage-affiche.png` (P0-2)
4. `captures/v5-prestataire-04-profil-envoye-tout-verifie-par-ping.png` (P0-5)
5. `captures/v5-prestataire-05-fiche-dommages-ouvrage-urssaf-absente.png` (P1-4, P1-5)
6. `captures/v5-prestataire-06-forfait-66-4h-facturees.png` (P0-10)
7. `captures/v5-prestataire-07-facture-autre-prestataire-chez-le-pro.png` (P0-11)
8. `captures/v5-prestataire-08-client-voit-amelie-disponible-hors-ligne-id-en-controle.png` (P0-15, P0-16)
