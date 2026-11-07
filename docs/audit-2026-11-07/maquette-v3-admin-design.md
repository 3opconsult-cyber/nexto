# Audit maquette v3 : admin, onglets d'analyse, design transversal (admin-design, 07/11/2026)

Fichier audité : `public/maquette.html` (source `docs/audit-2026-11-07/maquette-artefact/index.html` + `data.js`).
Méthode : Playwright (Chromium), 1440×900 et 390×844 (isMobile, hasTouch, DPR 2), thèmes clair et sombre ;
parcours complets rejoués (prestataire → envoi d'une assurance → admin → validation → fiche publique ;
chaque bouton « Voir » des quatre onglets d'analyse cliqué un par un, écran d'arrivée relevé).
Scripts : `/tmp/claude-0/-home-user-nexto/423f808d-6c68-5b55-942e-00e7e2289be0/scratchpad/e2e/admin-design/f1.mjs` à `f8.mjs`, `cap.mjs`.

## Verdict

La v3 n'est pas présentable à Romain : le lien central de l'admin (valider une pièce allume le badge sur la fiche publique) ne fonctionne pas, la fiche publique affiche « RC Pro vérifiée par PING » pour une pièce encore en contrôle, les quatre onglets d'analyse s'affichent sous le téléphone, hors de l'écran, et deux collisions de CSS cassent le chat, le litige et la frise de mission.

## Notes /10 (périmètre admin + onglets d'analyse + design transversal)

| Axe | Note | Raison principale |
|---|---|---|
| Simplicité | 7 | Admin en 5 onglets lisibles, « À traiter » en tête |
| Compréhension | 5 | Chiffres incohérents d'un écran à l'autre ; statuts des onglets d'analyse faux |
| Fluidité | 4 | Onglets d'analyse invisibles ; « Voir » sans retour possible |
| Ergonomie | 5 | Refus sans confirmation ni motif ; pièce de Hugo P. impossible à traiter |
| Design | 4 | Deux collisions de CSS ; barre du bas coupée à 1440×900 ; en-tête de 405 px à 390 px |
| Fonctionnel | 3 | Le badge ne s'allume pas ; litige admin sans action ; commission et virements absents |

## Demandes de Romain (périmètre)

| # | Demande | Statut | Preuve |
|---|---|---|---|
| 1 | Retour arrière partout | **KO partiel** | Dans le téléphone, le retour fonctionne (Admin : Litiges → dossier → retour → Litiges → retour → Personnes, filtre conservé). Mais depuis Validation, Audit ou Contrôle qualité, « Voir » ouvre l'écran sans moyen de revenir à la liste : le retour du navigateur quitte la maquette (`history.replaceState`, on arrive sur `about:blank` dans le test), le retour du téléphone mène à l'accueil du rôle, et un clic sur la pastille « Validation » réaffiche la liste de 38 lignes en haut de page. |
| 9 | Pictogrammes homogènes et identiques à l'app | **KO partiel** | Les tracés communs sont bien copiés (map, msg de BottomTabBar, ag, prof, ent, doc et heart de NavDrawer, Hub). Écarts : 5e onglet prestataire « Profil » + `prof` au lieu de « Entreprise » + `ent` (`BottomTabBar.tsx` l. 41) ; deux maisons différentes (`ent` pour le SIRET, `home` pour l'accueil admin) ; l'icône Messages (`msg`) sert aussi pour « E-mail » et « Retours » ; l'onglet « Missions » porte l'icône agenda ; zoom « + / − » en caractères et non en SVG ; trait arrondi partout alors que BottomTabBar et NavDrawer n'ont pas `strokeLinecap` (bout carré). |
| Admin (ensemble) | Envoi d'un document → liste « Pièces » → validation → badge | **KO** | Le document arrive bien dans « Pièces à valider » (décennale envoyée depuis Mon profil prestataire : « 3 pièces à valider », la décennale est listée) et la validation passe bien à « Vérifiée par PING » dans le profil du prestataire (6 sur 8). Mais la fiche publique ne change pas (pas de décennale, capture 04) : `verifBlock()` lit le tableau figé `PROS[0].v`. |

## Défauts

### P0 (bloquants)

1. **Onglets d'analyse invisibles** — `#audit`, `#controle-qualite`, `#validation`, `#apres-lancement` (ouverture directe ou clic sur la pastille). Le téléphone et son panneau restent affichés ; le contenu de l'onglet commence à y = 1099 px sur un écran de 900 px. À l'œil, un clic sur « Audit des manques » ne fait rien (seule la pastille change de couleur). Cause : `.wrap{display:flex}` l'emporte sur l'attribut `hidden` de `#p_mock` (mesuré : `hidden=true`, `display:flex`). Capture 01. **Correctif** : ajouter `[hidden]{display:none!important}` en tête du CSS.
2. **Valider une pièce n'allume pas le badge sur la fiche publique** — `#prestataire` → Profil → « Assurance décennale » → Prendre en photo → Envoyer → `#admin` → Pièces → Valider → Oui, valider → `#prestataire` → Profil → « Ma fiche publique ». Le message dit « badge visible sur la fiche », mais la fiche n'affiche aucune décennale. Capture 04. **Correctif** : pour `PROS[0]`, calculer `v` et `q` à partir de `S.me` (clés à `'ok'`, qualifications `st==='ok'`) dans `verifBlock()` et dans les pastilles d'en-tête de `SC.procard`.
3. **« Vérifié par PING » affiché pour une pièce non validée** (règle de langage du CLAUDE.md) — même parcours, état initial. La fiche publique d'Amélie R. affiche « RC Pro vérifiée par PING » et la pastille « RC Pro », alors que son profil indique « RC Pro : En contrôle (24 h) » et que l'admin la liste à valider. **Correctif** : même correctif que le n° 2 (retirer `'rc'` du `v` figé de `PROS[0]`).
4. **Les messages envoyés s'affichent comme une pastille ronde de 32 × 30 px** — chat (Client → Messages → Amélie R. → Accepter le devis, ou envoi d'un message) et dossier de litige (aussi depuis Admin → Litiges). Le texte disparaît. Cause : la classe du point « ma position » de la carte, `.me{position:absolute;width:30px;height:30px;border-radius:50%…}`, s'applique aussi à `.bubble.me` (mesuré : `position:absolute`, 32 × 30). Capture 05. **Correctif** : renommer le point de carte `.me` en `.mypos` (CSS l. 91 et les deux `<span class="me">` de `SC.map` / `SC.pmap`).
5. **Frise du suivi de mission déformée** — Client → Missions → la mission → QR → « Le prestataire a scanné » → Suivre. Les étapes faites deviennent des blocs verts arrondis, et le texte passe sous la coche. Cause : la classe `.done` du bouton « Voir l'écran » des onglets d'analyse (`display:inline-block; padding; background:var(--okbg)`) s'applique aussi à `.step.done` (mesuré : `display:inline-block`, fond `rgb(227,246,242)`). **Correctif** : renommer `.done` en `.seebtn` dans le CSS, `auditPane()` et `qcPane()`.
6. **La pièce de Hugo P. est impossible à traiter** — Admin → Pièces → Hugo P. → Valider → Oui, valider (ou Refuser). La carte reste, alors que le message « Document validé : badge visible sur la fiche » s'affiche. L'accueil indique toujours « 1 pièce à valider », et l'état vide n'est jamais atteint. Cause : la clé `'x'` n'existe pas dans `S.me` (`docok`, `docko`), et `SC.a_home` ajoute `+1` en dur. Capture 06. **Correctif** : tenir une liste `S.adocs` des pièces en attente, retirée à la validation et au refus, avec un état vide « Rien à valider ».

### P1 (gêne forte)

7. **Ordinateur 1440×900 : la barre du bas du téléphone est hors de l'écran** (y = 983 à 1049). `fit()` calcule l'échelle avec `innerHeight-30` sans tenir compte des 215 px d'en-tête, donc l'échelle reste 1. Capture 02. **Correctif** : `s=Math.min(1,(innerHeight-pw.getBoundingClientRect().top-16)/844)`, ce qui donne 0,79 ici.
8. **Mobile 390 px : le téléphone ne doit pas garder de cadre.** L'en-tête mesure 405 px (paragraphe + 9 pastilles sur 4 lignes) et le téléphone commence à y = 417. Il est dessiné dans une carte bordée de 358 px de large, alors que les écrans sont conçus pour 390 px (épingles et volet en px fixes). Deux défilements s'emboîtent : la page, puis l'écran. Captures 07 et 08. **Correctif** : à 820 px et moins, téléphone plein écran (`width:100vw; height:100dvh; border:0; border-radius:0; margin:0 -16px`), en-tête réduit à une barre collante (`<select>` des sections + thème), paragraphe d'introduction masqué, panneau « Ce qui change » dans un tiroir.
9. **« Refuser » sans confirmation ni motif** — Admin → Pièces → Refuser : le refus est immédiat, alors que « Valider » demande une confirmation. Le message affirme « le prestataire est prévenu avec le motif », mais aucun motif n'est saisi. Côté prestataire, la RC Pro refusée redevient « À ajouter », sans aucune explication. **Correctif** : dans `SC.a_docs`, demander une confirmation avec un choix de motif (illisible, expiré, nom différent, mauvais document) ; ajouter un statut `ko` dans `ST` (« Refusée : motif ») affiché dans `SC.pprofile`.
10. **Dossier de litige admin sans action de médiation** — Admin → Litiges → « Vitres 12 oct. ». Le dossier n'offre que « Ajouter une photo », une action de partie, et le message « D'accord pour jeudi » est présenté comme écrit par l'admin. C'est un recul par rapport à la production (`/litiges/[id]` : réponse du médiateur, clôture « résolu / non retenu », remboursement ou retenue). Capture 05. **Correctif** : si `S.role==='admin'`, afficher dans `SC.dispute` un champ « Répondre en médiateur », les boutons « Clore : résolu » et « Clore : non retenu », et « Rembourser / retenir », chaque bulle étant attribuée à sa partie.
11. **La carte « Pièce à valider » ne donne pas de quoi décider** — Admin → Pièces. On n'y voit que le nom, le type et un cadre « Aperçu du document » qui ne s'ouvre pas. Il manque la date d'envoi, la période de validité (essentielle pour RC Pro et décennale), l'assureur et le numéro de police, et un lien vers la fiche du prestataire. **Correctif** : ajouter ces champs dans `SC.a_docs`, un bouton « Ouvrir en grand », et le nom cliquable vers la fiche.
12. **Admin incomplet par rapport à ses propres règles et à la production** — le panneau d'Admin : accueil annonce « Commission réglable en admin », et l'onglet Après le lancement « réglables dans l'admin », mais il n'existe aucun écran de commission. Manquent aussi le rapprochement des virements (`transfer_payments`), les virements en retard, les signalements et le seuil « heure entamée ». **Correctif** : ajouter un écran « Réglages et argent » (taux client et prestataire, seuil heure entamée, virements à rapprocher) et une ligne « virements en retard » dans « À traiter ».
13. **Chiffres incohérents entre les écrans admin** — le KPI annonce « 5 annonces en cours », mais l'écran Annonces en liste 3. Dans Personnes, Lina F. a « 0 annonce » alors que l'écran Annonces montre la sienne, et Nadia K. a « 2 annonce » pour 1 visible. Nadia K., marquée « Particulier », figure « en contact » comme prestataire sur l'annonce de Marie. « 2 missions en cours » contre 1 dans Personnes. « 0 € réalisé » alors que deux factures existent (66 € et 36 €, soit 16,50 € de commissions sur la première d'après la facture). « ≈ 86 € à venir » pour deux missions de 66 € (≈ 33 €). **Correctif** : calculer KPI, Annonces et Personnes à partir d'un seul jeu de données (`PEOPLE` + une liste `ADS`).
14. **Onglets d'analyse : « Voir » sans retour** (voir demande 1). **Correctif** : dans `jump()`, faire `history.pushState` et mémoriser l'onglet et la position de défilement d'origine ; afficher dans le panneau latéral une pastille « ← Retour à la validation » qui restaure les deux.
15. **Statuts faux dans les onglets d'analyse** :
    - Contrôle qualité, « Admin · Pièces » : « badge allumé sur la fiche » est marqué « Corrigé », c'est faux (n° 2).
    - Contrôle qualité, « Romain · Factures », « Corrigé · voir » : ouvre Missions sur « En cours », pas sur « Factures » (`jump()` ne pose pas `S.mtab='fact'`).
    - Contrôle qualité, « Pictogrammes : mêmes tracés que l'app » : seulement en partie vrai (n° 17).
    - Audit, « Admin : retours des testeurs » : marqué « Absent / Introuvables », ce qui contredit le Contrôle qualité (« Noyés dans une page de 24 900 px ») : ils existent. Statut à corriger en « Incomplet ».
    - « Mots interdits : 0 » ne teste pas la vraie règle : « vérifié par PING » pour une pièce non validée par un admin (n° 3 et 16).
    - Le compteur de l'en-tête, « 25 corrigées », est donc surévalué d'au moins 3.

    **Correctif** : repasser ces lignes de `QC` et `AUDIT` dans `data.js`, et ajouter un `mtab` optionnel à `jump()`.
16. **Langage de vérification incorrect dans le profil prestataire** — Prestataire → Profil. Téléphone, E-mail et SIRET sont marqués « Vérifiée par PING ». Or ce ne sont pas des pièces validées par un admin (un code SMS, un lien, l'annuaire), et l'accord est faux (« le téléphone… vérifiée »). La fiche publique dit, elle, « Téléphone vérifié ». **Correctif** : statuts propres à chaque type dans `ST` / `vrow` (« Vérifié par SMS », « Vérifié par lien », « Trouvé dans l'annuaire ») ; garder « Vérifiée par PING » pour les documents seulement.
17. **Pictogrammes non identiques à l'app** (demande 9, détails plus haut). **Correctif** : 5e onglet prestataire « Entreprise » + `ent` comme `BottomTabBar.tsx` ; une seule maison (utiliser `ent` ou une icône tableau de bord distincte pour l'accueil admin) ; une enveloppe pour « E-mail » ; garder `msg` pour Messages uniquement ; SVG `plus` / `minus` pour le zoom ; aligner `stroke-linecap` sur l'app, ou ajouter `strokeLinecap="round"` dans l'app.

### P2 (finition)

18. **Contraste** : texte blanc sur turquoise #12B39C = 2,6:1 (`.btn`, `.bubble.me`, bouton du bandeau mission), alors que les pastilles de la page utilisent déjà `--onteal` (texte foncé) sur le même turquoise. Les deux sont incohérents. Onglet actif turquoise sur blanc : 2,6:1 ; or sur blanc (prestataire) : 2,0:1, en thème clair. En sombre, les mêmes couleurs passent (environ 5:1). **Correctif** : `color:var(--onteal)` sur `.btn` ; `--tealD` pour le libellé de l'onglet actif en clair.
19. **Accueil admin** : seul le KPI « Annonces en cours » est cliquable ; les trois autres ont le même aspect mais sont des `div`. « Inclure les fictifs » n'est qu'un message, et sa cible fait 109 × 20 px. **Correctif** : rendre les 4 KPI cliquables, ou différencier visuellement ; transformer « Inclure les fictifs » en interrupteur de 44 px qui agit.
20. **Cibles sous 44 px** : pastilles « Aller directement à un écran » (36 px), « Voir l'écran » de l'Audit (34 px, 22 boutons), « Corrigé · voir » (34 px, 25 boutons), boutons de Validation (40 px). **Correctif** : `min-height:44px` sur `.goto button`, `.done`, `.vbtn`.
21. **L'espace admin ne se distingue pas** : sa barre du bas est turquoise comme celle du client (le prestataire est en or), et aucun repère « Admin » dans l'écran. **Correctif** : onglet actif en navy pour l'admin, et une pastille « Admin PING » dans `hd()`.
22. **Flèche retour irrégulière sur les onglets racines** : absente au premier affichage d'Accueil, présente sur Annonces après un changement d'onglet, et elle ramène à l'onglet précédent. À trancher : soit pas de retour sur les racines d'onglet, soit partout.
23. **Toucher une pièce déjà validée et la renvoyer la repasse en contrôle sans avertir** — Prestataire → Profil → « Pièce d'identité : Vérifiée par PING » → photo → envoyer → « En contrôle (24 h) ». **Correctif** : une ligne validée ouvre une vue en lecture avec « Remplacer le document » et une confirmation.
24. **Le message d'information traverse les espaces** : « Document validé » s'affiche encore sur l'espace prestataire après le changement de pastille. **Correctif** : `S.toast=''` dans `showView()`.
25. **Alignement desktop** : l'en-tête est aligné à gauche (x = 130, largeur 1180) mais le bloc téléphone + panneau est centré (x = 334), ce qui laisse un grand vide à droite. **Correctif** : `justify-content:flex-start` sur `.wrap`, ou centrer aussi l'en-tête.
26. **Accord** : « 2 annonce » dans Personnes (`SC.a_ppl`).
27. **Retours des testeurs et Personnes non cliquables** : aucun état « lu » ; « 4 retours » reste dans « À traiter » pour toujours ; pas de fiche personne.
28. **Libellé incohérent** : « Vitres 12 oct. » (admin) contre « Vitres, 12 oct. » (client, dossier).
29. **Sévérité P2 en vert** (`.sev.p2` = couleurs « ok ») : se lit comme « réglé ». **Correctif** : gris neutre.

## Captures

- `captures/v3-admin-design-01-onglet-analyse-masque-par-telephone.png` (n° 1)
- `captures/v3-admin-design-02-ordinateur-1440x900-barre-du-bas-coupee.png` (n° 7)
- `captures/v3-admin-design-03-admin-confirmation-validation.png` (parcours n° 2, étape admin)
- `captures/v3-admin-design-04-fiche-publique-sans-decennale-validee.png` (n° 2, 3)
- `captures/v3-admin-design-05-admin-litige-sans-action-de-mediation.png` (n° 4, 10)
- `captures/v3-admin-design-06-admin-hugo-validation-sans-effet.png` (n° 6)
- `captures/v3-admin-design-07-mobile-390-entete-405px-sombre.png` (n° 8)
- `captures/v3-admin-design-08-mobile-390-telephone-dans-un-cadre.png` (n° 8)
