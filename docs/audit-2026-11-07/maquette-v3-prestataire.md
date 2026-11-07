# Audit maquette v3 : espace prestataire (#prestataire)

Auditeur : « prestataire ». Date : 07/11/2026. Fichier testé : `public/maquette.html` en `file://`, avec Playwright, en 390x844 (tactile, isMobile, DPR 2) et en 1440x900, thèmes clair et sombre. Scripts rejouables : `/tmp/claude-0/-home-user-nexto/423f808d-6c68-5b55-942e-00e7e2289be0/scratchpad/e2e/prestataire/v3/` (`flows.mjs`, `ui.mjs`, `contrast.mjs`, `caps.mjs`, `hb.mjs`, `m.mjs`). Code source lu : `docs/audit-2026-11-07/maquette-artefact/index.html`. Aucune erreur JavaScript pendant les parcours.

## Verdict

En l'état, Romain ne peut pas valider l'espace prestataire. Le squelette est bon (Mes services, statuts par vérification, qualifications par domaine, volet qui monte et qui descend), mais quatre défauts le bloquent :
- la conversation est illisible côté prestataire ;
- la fiche publique affiche une RC Pro « vérifiée par PING » alors que le profil la dit « En contrôle » ;
- une proposition envoyée disparaît sans laisser de trace ;
- le retour arrière fait sortir de l'assistant de création.

## Notes /10

| Axe | Note | Raison principale |
|---|---|---|
| Simplicité | 6 | 5 onglets clairs. En revanche, le profil fait 1 859 px (2,5 écrans) et ne contient aucun résumé « ce qui vous manque ». |
| Compréhension | 5 | « Vérifiée par PING » est affiché sur le téléphone, l'e-mail et le SIRET. La fiche publique contredit le profil. Le noms et les chiffres changent d'un écran à l'autre. |
| Fluidité | 5 | Le retour sort de l'assistant. Une proposition envoyée ne laisse aucune trace. La qualification envoyée ramène au formulaire. Des messages temporaires couvrent la saisie. |
| Ergonomie | 6 | Volet correct. Des boutons de carte recouvrent la recherche quand le volet est en haut. Des cibles mesurent 38 à 40 px. Le contraste de l'onglet actif est de 2,0:1. |
| Design | 6 | Les couleurs sont cohérentes, sauf les boutons turquoise dans l'espace prestataire (envoi de pièce). Les bulles de chat sont cassées. |
| Fonctionnel | 4 | Masquer un service ne change rien pour le client. Les factures sont mal reliées. La zone ne filtre rien. Il manque l'étape SIRET et CGV dans l'assistant, ainsi que les disponibilités et les revenus. |

## Demandes de Romain (périmètre prestataire)

| # | Demande | Statut | Preuve |
|---|---|---|---|
| 1 | Retour arrière partout | **KO** | Le retour est présent sur les écrans secondaires. Mais : (a) dans l'assistant `pwiz`, à l'étape 3, « Retour » ramène à la carte, pas à l'étape 2 (`wiz.back` : titre absent, texte « Zone : 25 km… »). (b) Après l'envoi d'une qualification, « Terminé » renvoie au formulaire « Ajouter une qualification » et il faut un 2e retour (`qual.after.back`). (c) Après « Envoyer ma proposition », le retour rouvre le formulaire rempli : on peut envoyer deux fois. (d) Le retour système d'Android ou du navigateur fait quitter la maquette (`hb.mjs` : `about:blank`), car `showView` n'utilise que `history.replaceState`. |
| 3 | Ajouter, masquer, modifier un service | **Partiel** | Ajout (modèle « Vitres maison » → enregistré), œil (« 3 visibles, 2 masqués »), modification, suppression avec confirmation : tout fonctionne. Mais le service masqué reste proposé au client : Réserver → « Ménage 3 h 66 € » est toujours là après avoir masqué ce service (`caps.mjs`, options codées en dur dans `SC.book`). Autres défauts : la fiche publique n'affiche pas la liste des services, un prix de 0 € est accepté (« Forfait 0 € »), et l'onglet central « Services » n'est jamais en surbrillance. |
| 4 | Basculer client ↔ prestataire | **OK, avec réserves** | Le sélecteur en haut du profil et le bouton ⇆ sur la carte basculent bien et changent la barre du bas. Réserves : la bascule mène à la carte et non au profil équivalent ; le filtre de service est commun aux deux espaces (« Vitres » choisi côté pro → la carte client ne montre que Sophie L.) ; l'état d'envoi des pièces est commun aux deux espaces : envoyer la RC Pro côté pro fait passer l'identité de Marie D. (client) à « En contrôle (24 h) » et son profil à 75 % (`client.profile`). |
| 5 | Profil prestataire agréable, lisible, statuts clairs, assurances, qualifications (dont garde d'enfants) | **KO** | Ce qui est présent : les rubriques Identité et coordonnées, Entreprise, Assurances (RC Pro, décennale, dommages-ouvrage), Qualifications ; les domaines Bâtiment, Nettoyage, Garde d'enfants (CAP AEPE, auxiliaire de puériculture, PSC1, références) et Autre. Ce qui ne va pas : « Vérifiée par PING » sur Téléphone, E-mail et SIRET (règle de vocabulaire enfreinte, accord au féminin) ; la fiche publique affiche « RC Pro vérifiée par PING » alors que le profil dit « En contrôle » (capture 05 contre capture 04) ; aucune liste de ce qui manque ; la jauge compte la décennale pour une pro du ménage ; « À ajouter » et « Facultatif » ont le même gris ; les lignes de qualification ne sont pas cliquables (DIV) ; la photo et le texte « À propos » ne sont modifiables nulle part. |
| 6 | Volet de la carte : remonte et redescend toujours | **OK, avec réserves** | Glisser au doigt (pointer events) : 380 → 128 → 380 → 610, puis un petit glisser revient à 610 (`ui.mjs`). Toucher : 128 → 380 → 610 → 128. Glisser à la souris en 1440 : 380 → 128 → 380. Réserves : volet en haut, les boutons + / − / recentrer débordent par le haut (`fabTop -36 px`) et recouvrent la recherche et les filtres (capture 01). Le panneau Zone, une fois réduit, affiche « Afficher la liste ». Seule la poignée se glisse, pas le contenu. |
| 9 | Pictogrammes identiques à l'app | **Partiel** | Les tracés map, msg, ag, prof, ent, doc, tag, pin, id, eye, help, list, lock, euro, swap sont identiques à `BottomTabBar.tsx`, `NavDrawer.tsx` et `Hub.tsx`, avec un trait de 2. Écarts : le dernier onglet pro est « Profil » avec le pictogramme `prof`, alors que l'app a « Entreprise » avec `ent` (BottomTabBar l. 41) ; « Missions » reprend le pictogramme de l'Agenda de l'app pour une autre notion. L'app elle-même a deux tracés pour msg (NavDrawer et BottomTabBar), deux pour doc et deux pour heart (Hub et NavDrawer) : à trancher. |

## Défauts

### P0 : bloquants

1. **Conversation illisible côté prestataire.** `#prestataire` → Messages → Marie D.
   - Constat : les bulles du prestataire mesurent 32 px de large. Ce sont des pastilles turquoise positionnées en absolu, et le texte part en colonne (capture 02). Le même bug touche « D'accord pour jeudi » dans Litige, et les messages envoyés par le client.
   - Cause : la classe `.bubble.me` hérite de `.me`, qui est le point « ma position » de la carte (`width:30px; position:absolute`).
   - Correctif : renommer le point de carte en `.medot` (ou limiter la règle à `.map .me`) dans `index.html` l. 91 et dans `SC.map` / `SC.pmap`.
2. **La fiche publique affirme une vérification qui n'existe pas.** Profil → « Ma fiche publique ».
   - Constat : badge « RC Pro » et ligne « RC Pro vérifiée par PING », alors que le profil indique « En contrôle (24 h) » (captures 04 et 05). La fiche lit `PROS[0].v`, qui est statique, et ignore `S.me`.
   - Correctif : construire `verifBlock` de la fiche du prestataire connecté à partir de `S.me`, en ne gardant que les statuts `ok`.
3. **Vocabulaire « vérifié par PING » appliqué à tort.** Profil, rubriques Identité et coordonnées, et Entreprise.
   - Constat : Téléphone, E-mail et SIRET portent le badge « Vérifiée par PING » (au féminin pour des noms masculins). Ce ne sont pas des pièces validées par un administrateur : CLAUDE.md réserve cette mention aux `documents.status = valid`.
   - Correctif : remplacer l'unique `ST.ok` par un libellé par type :
     - « Confirmé par SMS » pour le téléphone ;
     - « Confirmé » pour l'e-mail ;
     - « Trouvé dans l'annuaire » pour le SIRET ;
     - « Vérifiée par PING » seulement pour les pièces, les assurances et les qualifications validées.
4. **La proposition envoyée disparaît.** Demandes → demande « Nettoyage fin de chantier » → tarif 200 → « Envoyer ma proposition ».
   - Constat : on arrive sur Missions › En cours, qui montre « Ménage chez Marie D. ». Aucune trace de la proposition, du prix saisi ni de la demande (`after.preqgo.trace = false`). Le champ prix n'est pas lu.
   - Correctif : dans `ACT.preqgo`, lire `#pr_price`, ajouter la proposition à `S.sent`, l'afficher dans un bloc « Propositions envoyées » de Missions › En cours, et ouvrir la conversation.
5. **Le retour sort de l'assistant de création.** Création de l'activité → Continuer ×2 → Retour.
   - Constat : on revient sur la carte au lieu de l'étape 2, car les étapes changent `S.pwiz` sans rien inscrire dans l'historique.
   - Correctif : dans `SC.pwiz`, faire revenir le bouton retour à `S.pwiz-1` tant que `S.pwiz>0`. Ajouter aussi un bouton « Précédent » à côté de « Continuer ».

### P1 : gêne forte

6. **Le masquage n'a aucun effet côté client.** Services → œil sur « Ménage 3 h » → Profil → Ma fiche publique → Réserver.
   - Constat : « Ménage 3 h 66 € » reste proposé. La fiche affiche « À partir de 24 €/h » alors que le service vaut « 22 € / heure ».
   - Correctif : générer les options de `SC.book` et le bloc « Tarifs » de la fiche à partir de `S.svcs.filter(x=>x.vis)`.
7. **Le prestataire peut se réserver lui-même.** Ma fiche publique.
   - Constat : on y trouve « Réserver », « Écrire » et « 1 / 5 » avec Précédent / Suivant, qui font défiler les autres prestataires.
   - Correctif : en mode aperçu (`pubcard`), remplacer la barre du bas par « Modifier mon profil » et masquer le compteur et la navigation entre prestataires.
8. **Messages incohérents.** Messages.
   - Constat : Marie D. a l'avatar « A » d'Amélie. Toucher « Nadia K. » affiche le message « Conversation avec Karim B. » et n'ouvre rien.
   - Correctif : dans `SC.messages`, choisir l'avatar et le nom selon le rôle, et faire ouvrir une vraie conversation par `go:chat` sur chaque ligne.
9. **Les messages temporaires couvrent la saisie.** Messages → Nadia K. → Marie D.
   - Constat : le message « Conversation avec Karim B. » recouvre le champ et le bouton Envoyer pendant 2,6 s. `elementFromPoint` sur le bouton Envoyer renvoie `toast`, et l'envoi échoue (capture 02).
   - Correctif : placer `.toast` en haut de l'écran (`top:12px`) ou au-dessus des barres collantes, et le rendre non bloquant (`pointer-events:none`).
10. **Mauvaise facture ouverte.** Missions › Factures › « Repassage · 36,00 € ».
    - Constat : c'est la facture FACT-2026-0042, « Ménage 3 h 66 € », qui s'ouvre (capture 06).
    - Correctif : passer le numéro à `go:invoice:<ref>` et l'afficher dans `SC.invoice`.
11. **Le statut de la mission ne suit pas.** Suivi de mission, de « Je pars » jusqu'à la facture.
    - Constat : la mission terminée reste dans « En cours » avec « Demain 10 h ». « Terminées » montre un litige « Vitres, 12 oct. » (entre Marie D. et Sophie L. selon l'admin) dans l'espace d'Amélie, qui ne fait pas les vitres. « Signaler » ouvre ce litige sans rapport.
    - Correctif : à l'étape 3 et au-delà, déplacer la carte dans « Terminées », et faire créer un nouveau signalement lié à la mission par `go:dispute`.
12. **La zone ne fonctionne pas.** Demandes → Zone.
    - Constat : taper « Cannes » puis toucher « 25 km » efface la ville (`zone.cityAfterChip` vide). Avec 5 km autour de Cannes, les 4 demandes à 7,3, 4,9, 11 et 2,9 km restent affichées. Le rayon s'applique avant « Valider », ce qui rend ce bouton inutile.
    - Correctif : lire `#zone_city` dans `ACT.zone` avant `paint()`, filtrer `REQS` par distance, et n'appliquer qu'à la validation.
13. **Qualification : parcours et lignes figées.** Profil → Ajouter une qualification → Garde d'enfants → CAP AEPE → Joindre → Envoyer → Terminé.
    - Constat :
      - « Terminé » ramène au formulaire.
      - Une qualification abandonnée (« Références de familles ») reste « À ajouter », sans aucune action possible.
      - L'organisme saisi (« GRETA ») n'est enregistré nulle part.
      - Le sous-titre est « Diplôme ou attestation » même pour des références.
    - Correctif :
      - dans `ACT.qualgo`, remplacer la pile par `['pprofile','idcap']` ;
      - rendre chaque ligne de qualification cliquable (envoyer, remplacer, supprimer) ;
      - enregistrer `org` ;
      - choisir le sous-titre selon le type.
14. **Une pièce validée peut être dégradée sans prévenir.** Profil → Pièce d'identité (déjà « Vérifiée par PING ») → photo → Envoyer.
    - Constat : la pièce repasse « En contrôle » sans avertissement. `S.idState` est partagé avec l'espace client (voir la demande 4).
    - Correctif : sur une ligne `ok`, ouvrir d'abord « Remplacer ma pièce vérifiée ? » avec confirmation, et garder un état d'envoi par document (`S.docState[k]`).
15. **On ne voit pas ce qui manque.** Profil.
    - Constat : la jauge « 5 vérifications sur 8 » compte la décennale (« Pour les travaux du bâtiment ») pour une pro du ménage et du repassage. Aucune liste « À faire ». « À ajouter » et « Facultatif » ont le même gris. Rien ne dit ce qui est obligatoire pour être visible. La page fait 1 859 px.
    - Correctif : en tête du profil, une carte « Il vous manque » avec les seules pièces requises par ses métiers (URSSAF), chacune avec son bouton. Décennale et dommages-ouvrage n'apparaissent que si le métier est « Fin de chantier ». Mettre « À ajouter » en orange.
16. **Rien n'est modifiable sur la présentation et l'activité.** Profil.
    - Constat :
      - la photo et le texte « À propos », visibles sur la fiche publique, ne se modifient nulle part ;
      - « Zone et disponibilités » ouvre la carte, avec l'onglet Profil allumé et sans le panneau zone ; les jours (« lun. au ven. ») ne se règlent pas ;
      - « Mes versements » n'affiche qu'un message temporaire ;
      - il n'y a pas de rubrique revenus (Hub de l'app : Prix et revenus).
    - Correctif : ajouter au profil une ligne « Ma présentation » (photo et texte), un écran « Disponibilités » (créneaux), une ligne « IBAN » consultable et un écran « Revenus ».
17. **Assistant : saisie perdue et étapes manquantes.** Création de l'activité.
    - Constat :
      - le téléphone saisi s'efface quand on touche un rayon (capture 08), et l'étape se valide avec un téléphone vide, alors qu'il est obligatoire ;
      - l'étape 3 ignore les métiers choisis : avec « Vitres » sans « Ménage », elle propose Ménage 3 h, Ménage à l'heure et Grand ménage, ce dernier étant pourtant masqué ;
      - il n'y a ni choix entre particulier et entreprise, ni SIRET, ni acceptation des CGV prestataires (`cgv_accepted_at` est obligatoire selon CLAUDE.md).
    - Correctif : enregistrer `wz_tel` à la saisie et bloquer « Continuer » s'il est vide ; générer les modèles depuis `S.wzSvc` ; ajouter une étape « Statut, SIRET et CGV ».
18. **Le scan QR ne ressemble pas à un scan.** Suivi de mission → « Scanner le QR à l'arrivée ».
    - Constat : le prestataire voit un QR code, celui que le client devrait montrer, puis valide lui-même avec « J'ai scanné le QR ».
    - Correctif : côté pro, `SC.qr` affiche un viseur caméra (comme `.cam` dans `idcap`), avec en secours le champ « Code à 6 chiffres ».
19. **Contrastes insuffisants.**
    - Constat :
      - thème clair : onglet pro actif en or sur blanc à 2,0:1 (Demandes, Missions, Profil), étoiles à 2,0:1, « Agrandir » à 4,0:1 en 13 px ;
      - les deux thèmes : bulle « moi » blanc sur turquoise à 2,64:1 ;
      - l'envoi de pièce et la fiche utilisent des boutons `.btn` turquoise à 2,64:1 dans l'espace or.
    - Correctif : texte de l'onglet actif en `--wtx` ou `--navy` (avec la pastille or seulement en fond) ; texte `#05302A` (`--onteal`) sur `.btn` et `.bubble.me`.
20. **Boutons de carte sur la recherche.** Demandes, volet en haut.
    - Constat : + / − / recentrer débordent de 36 px au-dessus de la vue et recouvrent la zone et les filtres (capture 01).
    - Correctif : masquer `.fabs` quand `S.sheet==='full'`, ou les limiter à `bottom: min(SH+14, hauteur de la vue - 260)`.
21. **Bureau 1440x900 : barre du bas hors de l'écran.**
    - Constat : le téléphone n'est pas réduit (`scale(1)`), son haut est à y=215 et son bas à 1 059 : la barre d'onglets est sous la ligne de flottaison (capture 07).
    - Correctif : dans `fit()`, calculer l'échelle avec `(innerHeight - pw.getBoundingClientRect().top - 20)/844`.
22. **Pas de retour système.**
    - Constat : le retour d'Android ou du navigateur quitte la page.
    - Correctif : appeler `history.pushState` dans `nav()` et `back()` sur `popstate`.
23. **Formulaire de proposition trop pauvre.** Demande.
    - Constat : le champ prix contient du texte (« 150 € ») avec un clavier numérique. On ne peut choisir ni forfait, à l'heure ou sur devis, ni écrire un message. La demande n'affiche ni date ni description.
    - Correctif : dans `SC.preq`, un champ numérique avec le suffixe € à part, le segment des 3 modes de prix (repris de `svcedit`), et un message facultatif.

### P2 : finition

24. **Onglet central sans état actif.** L'onglet « Services » n'a jamais l'état actif, alors que l'écran est un onglet racine. Correctif : poser `.on` et `aria-current` sur le bouton `mid` dans `paint()`.
25. **Cibles tactiles sous 44 px.** Filtres de la carte (40 px), segments (40 px), noms de service cliquables (38 px), interrupteur « Visible » (50x30). Correctif : `min-height:44px` sur `.chip`, `.seg button` et `.row .grow`, et une zone tactile de 44 px autour de `.tg`.
26. **Prix à 0 € accepté.** Un forfait ou un tarif horaire peut valoir 0 €. Correctif : dans `svcsave`, refuser `p<1` hors devis.
27. **Disponible / Hors ligne sans effet.** Le bouton ne produit ni explication ni changement visible. Correctif : afficher le message « Hors ligne : les clients ne vous voient plus » et un bandeau.
28. **Bandeau de mission à la 3e personne.** Côté pro, il affiche « Mission en cours : prestataire en route ». Correctif : « Vous êtes en route » quand `S.role==='pro'`.
29. **Formats différents entre fiche et profil.** « 4.9 » et « Ménage, Repassage » sur la fiche, « 4,9 » et « Ménage, repassage » sur le profil. Correctif : formater la note avec `toLocaleString('fr-FR')` et mettre les libellés de métier en minuscules après le premier.
30. **Épingle trompeuse.** Les épingles affichent « 80 € » (le budget minimum), ce qui ressemble à un prix fixe. Correctif : afficher « 80-120 € » ou « dès 80 € ».
31. **Filtre de service commun aux deux espaces.** Correctif : séparer `S.svcClient` et `S.svcPro`.
32. **Vocabulaire différent de l'app.** « Mon profil » et l'onglet « Profil » au lieu de « Mon entreprise » et « Entreprise » ; « Missions » au lieu d'« Agenda ». Correctif : reprendre les libellés de `BottomTabBar` et du Hub, ou acter le changement avec Romain.
33. **Barre d'onglets pendant l'assistant.** Elle reste complète, avec « Demandes » allumé. Correctif : masquer `tabbar` sur `pwiz`.
34. **Recherche SIRET qui trouve n'importe quoi.** « Rechercher » sur « 123 » répond « Trouvé dans l'annuaire » (`siretfill`), et il n'y a pas de bouton « Je suis particulier ». Correctif : afficher une erreur sous 14 chiffres et ajouter le bouton.
35. **Facture pro incomplète.** Elle n'indique ni « Vous percevez 54,78 € », ni l'état du virement (à payer ou reçu), et le document PING-V ne s'ouvre pas. Correctif : ajouter ces deux lignes et un lien vers PING-V.
36. **Téléphone bas sur un vrai mobile.** En 390 px, le téléphone commence à y=416 (titre et pastilles), donc l'utilisateur doit défiler avant de voir l'écran. Correctif : replier l'en-tête de la page en dessous de 820 px.

**Total : 5 P0, 18 P1, 13 P2.**

## Captures

- `captures/v3-prestataire-01-carte-volet-plein-boutons.png` : boutons de carte sur la recherche, volet en haut.
- `captures/v3-prestataire-02-messages-toast-sur-saisie.png` : bulles cassées et message temporaire sur la saisie.
- `captures/v3-prestataire-03-profil-haut.png` : en-tête du profil, « Vérifiée par PING » sur téléphone et e-mail.
- `captures/v3-prestataire-04-profil-verifications.png` : SIRET « Vérifiée par PING », RC Pro « En contrôle ».
- `captures/v3-prestataire-05-fiche-publique-rc-verifiee.png` : fiche publique, RC Pro affichée comme vérifiée, Réserver soi-même.
- `captures/v3-prestataire-06-facture-repassage-ouvre-menage-sombre.png` : la ligne Repassage ouvre la facture Ménage (thème sombre).
- `captures/v3-prestataire-07-bureau-1440.png` : en 1440x900, barre d'onglets hors de l'écran.
- `captures/v3-prestataire-08-assistant-telephone-efface.png` : téléphone effacé après le choix du rayon.
