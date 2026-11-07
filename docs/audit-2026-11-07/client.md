# Audit PING : espace particulier (client), 07/11/2026

Compte du fondateur en mode particulier, lecture seule. Mobile 390x844 et ordinateur 1440x900, Chromium, fuseau Europe/Paris, prod https://nexto-eta.vercel.app.

## 1. Verdict
L'espace particulier est propre et sans erreur technique, mais la carte (écran n°1) est piégée : le bouton « Laisser un commentaire » masque le bouton de recentrage, la fiche mobile ne se ferme pas, et la facture affiche le logo PING sur la facture du prestataire.

## 2. Notes
| Axe | Note | Justification |
|---|---|---|
| Design | 8/10 | Cohérent. Défauts : en-têtes de page qui changent (navy / blanc / « ‹ » / « ← Retour »), bande grise sous la carte sur ordinateur. |
| Ergonomie | 5/10 | Fiche carte mobile sans fermeture, recentrage inaccessible, « Annuler/Supprimer » en petit texte collé, burger 34 px, calendrier sous le pli. |
| Fluidité | 7/10 | Pas de saut ni d'erreur. Le retour depuis une fiche pro ne garde pas la recherche ; popup d'installation qui bloque la carte. |
| Compréhension | 6/10 | Bouton rond « PING » sans libellé ni retour visuel ; règle d'adresse formulée de 3 façons ; « payé via PING » ambigu. |
| Fonctionnel | 6/10 | Carte, recherche, formulaire, validations OK ; recentrage et fermeture de fiche inutilisables. |
| Données | 7/10 | Montants cohérents (75 + 6 = 81 €). « Ville non renseignée » alors que l'adresse est Vence. Données de test visibles. |
| Homogénéité des textes | 5/10 | Apostrophes droites/courbes mélangées, « 5.0 » vs « 4,5 », « Nov. » en majuscule, « Email / e-mail / courriel », « pro / prestataire ». |
| Accessibilité | 5/10 | Lignes cliquables en div (pas de lien ni bouton), champs sans libellé associé, texte gris #6E8592 à 3,9:1, texte blanc sur teal à 2,6:1, cibles < 44 px. |
| Technique | 9/10 | 0 erreur console et 0 requête 4xx/5xx sur tous les écrans valides. |

## 3. Écrans parcourus
Mobile (M) et ordinateur (O) sauf mention.
1. Carte `/map` (M, O) : géoloc, point « Vous êtes ici », puces, pins, fiche, zoom, recentrage
2. Recherche (volet de `/map`) (M, O)
3. Fiche prestataire `/pro/2f9706a4-…` (M) ; identifiant invalide (M, O)
4. Mes demandes `/client/demandes` (M, O)
5. Déposer une demande `/client/demandes/new` (M, O), validation à vide seulement
6. Messages `/messages` (M, O)
7. Chat `/mission/65b4d644-…/chat` et `/mission/f4a52c98-…/chat` (M, O)
8. Codes QR `/mission/65b4d644-…/qrcodes` (M, O)
9. Facture `/mission/f4a52c98-…/facture` (M, O)
10. Agenda `/agenda` (M, O)
11. Mon profil `/client/profil` (M, O)
12. `/client/avis`, `/client/documents`, `/client/confidentialite`, `/client/parrainage`, `/client/avance-immediate`, `/client/favoris` (M, O)
13. Litiges `/litiges`, `/litiges/7f71016e-…`, `/litiges/0efe7840-…` (M, O)
14. Mes opérations `/documents` (M, O)
15. Aide `/aide`, Support `/support`, `/comment-ca-marche`, `/cgu`, `/confidentialite` (M, O)
16. Menu burger (M), barre du bas (M), sidebar (O)

## 4. Bugs

**P1**

1. **Le bouton « Laisser un commentaire » recouvre le bouton de recentrage de la carte.** `/map`, mobile et ordinateur. La bulle (fixed, bottom 132 px) tombe pile sur `.loc` (bottom 80 px). Playwright : « subtree intercepts pointer events » sur `.loc` (ordi, 56 essais). L'utilisateur ne peut plus recentrer après avoir déplacé la carte. Preuve : client-01, client-03. Fichiers : `src/components/FeedbackBubble.tsx` (bottom 132px), `src/app/ping-ui.css` ligne 182 (`.loc`). Correctif : monter `.loc` et `.pingbtn` au-dessus de la bulle, ou la masquer sur `/map`.
2. **La fiche prestataire mobile ne se ferme jamais.** `/map`, mobile, après un clic sur un pin. Le clic sur la carte ne la ferme pas, la poignée n'est pas active, il n'y a pas de croix (le panneau ordinateur en a une). Elle couvre le recentrage, le bouton PING et « Déposer une demande », et masque les pins du bas. Seule sortie : « Voir le profil » ou « Contacter ». Preuve : client-02 (classe `preview show` toujours présente après un clic carte). Fichier : `src/components/DemoShell.tsx`, `closePreview()` appelé seulement depuis `contact()` et « Voir le profil ». Correctif : fermer au clic carte (`map.on('click')`), ajouter une croix et un glissement vers le bas.
3. **La facture de la prestation affiche le logo « ping » en en-tête.** `/mission/<id>/facture`, onglet Prestation. L'invariant CLAUDE.md dit que PING n'apparaît pas sous l'en-tête du prestataire. Preuve : client-08. Fichier : `src/app/mission/[id]/facture/page.tsx` ligne 154. Correctif : logo PING seulement sur les onglets de commission ; l'émetteur seul sur la prestation.
4. **Le volet de détail ordinateur recouvre « Passer en pro » et la cloche.** `/map`, ordinateur, après un clic sur un pin : `.detail-panel` à y=12, alors que la barre haute est au même endroit. Les deux boutons deviennent à moitié visibles et inutilisables. Preuve : client-03. Fichier : `DemoShell.tsx` + `ping-ui.css` (`.detail-panel`). Correctif : démarrer le panneau sous la barre haute.

**P2**

5. **Bande grise sous la carte sur ordinateur.** `/map`, 1440x900 : `.mapwrap` fait 836 px de haut sur 900 (64 px réservés à une barre du bas qui n'existe pas sur ordinateur). Preuve : client-03, mesure `mapwrap [236,0,1204,836]`. Fichier : `ping-ui.css` (hauteur de la carte). Correctif : retirer la réserve ≥ 1000 px.
6. **Étiquette « Vous êtes ici » posée sur le prix d'un pin voisin** (« 25 €/h » à moitié caché) après dézoom. Preuve : client-04. Fichier : `src/components/LiveMap.tsx` (tooltip `bottom`, offset 8). Correctif : placer l'étiquette à gauche ou la réduire à partir d'un certain zoom.
7. **Bouton rond « PING » sans libellé explicite ni effet visible** : il recharge les prestataires sans retour (`DemoShell.tsx` : `onClick={() => loadPros()}`). Il couvre un pin (« 21 €/h », client-01). Correctif : un libellé « Actualiser » et un retour visuel, ou le supprimer.
8. **Une seule épingle visible à l'ouverture** : zoom 15 fixe, 16 prestataires dont 15 hors champ ; ni liste ni compteur sur la carte (`LiveMap.tsx`, `setView(..., 15)`). Correctif : afficher « 16 prestataires » avec un lien vers la liste, ou cadrer sur les 3 plus proches.
9. **Fenêtre « Installer le raccourci PING » sur ordinateur** : bloque la carte, donne toujours les instructions de Chrome (même sous Safari/Firefox), centrée en bas sans bords ; guillemets coupés en fin de ligne (« ... « / Installer PING »). Preuve : client-05. Fichier : `src/components/InstallPrompt.tsx`. Correctif : ne l'afficher que sur mobile ou sur navigateur compatible, et espaces insécables dans les guillemets.
10. **Agenda mobile : le calendrier passe sous le pli** : encart « 6 missions dans votre espace prestataire » + 2 bandeaux de litige occupent 600 px, la liste « À venir » est encore plus bas. Les 2 bandeaux mènent au même chat. Preuve : client-06. Fichier : `src/app/agenda/page.tsx`. Correctif : regrouper les litiges en une ligne, la liste avant la grille.
11. **Mes demandes : propositions cachées derrière un tap sur la carte, sans indication.** Il n'y a pas de flèche ; seul le badge « 1 proposition » le suggère (`client/demandes/page.tsx` : `onClick` sur le bloc). « Annuler » et « Supprimer » sont des `<span>` de 12 px (≈ 15 px de haut), côte à côte, « Annuler » sans confirmation (le rôle « Supprimer » en a une via `confirm()` natif). Preuve : client-07. Correctif : vrais boutons, ≥ 44 px, chevron sur la carte, confirmation d'annulation.
12. **Écran « Mes demandes » : la tête (titre, phrase, gros bouton) mange tout l'écran** avant la première demande, avec doublon « Déposez une demande » / « + Déposer une demande » (preuve client-07).
13. **Formulaire d'annonce : l'erreur « Indiquez un titre » s'affiche en bas de page** à ~2000 px du champ concerné, sans focus ni surlignage (mobile : défilement à 1721 px). Champs sans `aria-label` ni `htmlFor`. Fichier : `src/app/client/demandes/new/page.tsx` (`setError` ligne 84). Correctif : focaliser le champ en erreur et y défiler.
14. **Avis proposé automatiquement à l'ouverture d'un chat de mission terminée, même avec un litige ouvert** : la fenêtre « Comment s'est passée l'intervention ? » apparaît sur la mission du litige (`f4a52c98`). Phrase « Il compte pour les clients suivants — et pour lui » peu claire. Preuve : client-09. Fichier : `src/components/ReviewModal.tsx` + chat. Correctif : ne pas ouvrir automatiquement si un litige est ouvert.
15. **Règle « adresse visible » formulée de trois façons.** Chat : « une fois la mission validée et réglée » ; `/client/confidentialite` : « mission confirmée (aucun devis en attente) » ; `/confidentialite` et profil : « mission confirmée ». La règle réelle est « confirmée ET payée ». Fichiers : `client/confidentialite/page.tsx`, `client/profil/page.tsx`, `src/app/confidentialite/page.tsx`. Correctif : une seule phrase partagée.
16. **Profil : « Particulier · ville non renseignée » alors que l'adresse est Vence ; adresse affichée en capitales avec doublon** « 40 RUE DES ARCS 06140 VENCE, 06140, VENCE » (aussi sur la facture et le formulaire). Preuve : client-10. Correctif : déduire la ville de l'adresse, mettre en forme à l'enregistrement.
17. **Aperçu de message peu parlant** : `/messages` affiche « Voici mon tarif : » / « Ma proposition : » tronqués, sans montant. Correctif : afficher « Devis 40,00 € ».
18. **Retour depuis une fiche pro vers la carte, pas vers la recherche** : l'état (filtres, tri) est perdu (`DemoShell` : `view` en `useState`). Correctif : mettre la vue de recherche dans l'URL.
19. **En-têtes de page incohérents** : Agenda, Messages, Mes demandes, Litiges, Facturation en bandeau navy ; Mon profil, fiche pro, QR en blanc ; retour par « ‹ », « ← Retour » ou burger selon la page ; `/documents` a un « ‹ » et un burger. Correctif : un seul gabarit d'en-tête.
20. **Libellés qui varient** : « Profil du prestataire » (carte ordinateur) / « Profil du pro » (fiche) ; « Pièce d'identité » apostrophe droite sur la fiche pro, `/client/documents`, `/client/avis`, contre « Pièce d’identité fournie » courbe ailleurs ; notes « 5.0 » (carte, fiche) contre « 4,5 » (Mes demandes) ; « 2 Nov. – 8 Nov. 2026 » et « Samedi 7 Novembre 2026 » (majuscule) contre « 7 nov » ailleurs ; « Email » (parrainage) / « e-mail » (profil) / « courriel » (avance immédiate) ; « Crédit d'impôt immédiat » (profil) / « avance immédiate » (adresse). Fichiers : `DemoShell.tsx`, `agenda/page.tsx`, `client/parrainage/page.tsx`.
21. **`/aide` contient deux rubriques redondantes** : « Facture, avis et pourboire » et « Facture et avis » (`src/lib/aide.ts`).
22. **Fiche pro : la description est répétée** deux fois (« À propos » et sous « Prestations proposées »), « Fournie » répété (titre + badge), deux boutons « Réserver ». Preuve : client-12.
23. **« Total payé via PING » (`/documents`)** : le client paie la prestation directement au prestataire par virement ; « via PING » est ambigu.
24. **Mentions légales de la facture sans accents** (« penalites », « interet legal », « Indemnite », « anticipe », « Règlement à réception ») et « clients professionnels 40 EUR » pour un particulier. Les textes viennent de la base (`invoices.legal`, fonction `generate_invoices`). Preuve : client-08.
25. **Cibles tactiles < 44 px** : burger 34x34 (toutes pages), zoom carte 30x30, « Trier par date » 29 px, boutons agenda 31–38 px, avatars étoiles 31x30, « Voir comment ça marche » 19 px, « Annuler cette réservation » 17 px, flèche retour 30 px.
26. **Contrastes** : gris #6E8592 sur blanc = 3,87:1 (texte 10–12 px partout : demandes, profil) ; blanc sur teal #12B39C = 2,64:1 (boutons « Voir le profil », « Publier mon annonce », « Réserver »). Mesures calculées ; la couleur est validée, donc à traiter par la taille ou le poids du texte.
27. **Lignes de listes (messages, agenda, litiges) sans lien** : zéro `<a href>` détecté (clic sur div) ; pas de clic droit, pas de navigation clavier. Correctif : de vrais liens.
28. **Chat : zone de saisie sans texte indicatif, et sur ordinateur les bulles et le devis occupent 1100 px de large** (client-chat ordi). Même chose pour `/support`.
29. **Icône du menu « Support PING » identique à « Messages »** dans le drawer et la sidebar.
30. **Heures affichées dans le fuseau de l'appareil** (une même mission affichée 13:00 puis 14:00 dans mon premier passage en UTC, puis 14:00 partout en Europe/Paris). Pas de bug en France, mais à noter pour un déplacement.

**P0** : aucun.

Vocabulaire interdit : aucune occurrence de « certifié », « garanti » (hors « sans garantie » dans une mention de réserve), de marque tierce ni d'emoji coloré sur les écrans vus. « Bientôt » n'apparaît que sur Moyens de paiement et Crédit d'impôt immédiat, pas sur le séquestre.

Données de test visibles dans le compte : titre « repassage » / description « testetetetetetet », motif de litige « prirnrnjkcqsndjcnoshCOUsbjk xbj< » (compte du fondateur, pas un défaut produit).

## 5. Non vérifié
- Chat : acceptation d'un devis, envoi de message, ouverture d'un litige, publication d'un avis, annulation, scan QR : tout écrit en base, interdit.
- Publication réelle d'une annonce (seulement la validation à vide).
- Bascule en mode pro depuis le menu (modifie `ping_mode` seulement côté navigateur, mais l'interrupteur est présenté comme un réglage ; non cliqué).
- Géolocalisation réelle : simulée à Nice (43.71, 7.26) ; le comportement refus/timeout n'est pas testé.
- Écran Frais de service de la facture, relevé CSV/PDF, partage.
- Mesure du CLS : pas de saut visible dans les captures et les temps de chargement, mais pas de PerformanceObserver.
- Aucun accès à la base ; les données affichées sont celles du compte fondateur et de comptes fictifs.

Captures : `docs/audit-2026-11-07/captures/client-01` à `client-12`.
