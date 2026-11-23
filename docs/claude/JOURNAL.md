# Journal des livraisons (reprise de `git log`, 16/09/2026 au 21/11/2026, 324 commits)
Une ligne par jour : nombre de commits, plage, livraisons principales avec leur identifiant court. Détail : `git log --format='%ad %h %s' --date=short`.
Ajouter une ligne à chaque mise en production (date, identifiant, résumé en une phrase). Vérifié le 21/11/2026 : tête de `main` = 9b4ffc5.

| Jour | Commits | Livraisons principales |
|---|---|---|
| 16/09 | 6 (34e6712..72febe6) | CLAUDE.md créé (ad9fc33) ; correctif « Je pars/adresse » et menu pro dédupliqué (7859f03) ; avis réaffiché dans le chat (26aa623) ; page litige orpheline supprimée (b8fe8eb) ; carte pro (72febe6) |
| 17/09 | 20 (36244c5..5d9ff54) | Carte pro desktop refaite (36244c5) ; auth restylée (2351170) ; règle de travail push direct (6fb48df) ; pro répond à une demande (327d75f) ; audit croisé, fuite d'adresse `requests` corrigée (1798cc7) ; Mon entreprise (726614d) ; demandes ouvertes (44d2e24) ; forfait + dépassement, bug critique de réservation (3bdc893) ; kit marketing (5d9ff54) |
| 18/09 | 14 (7be9b1b..42e5c02) | Posts Instagram et carrousels (7be9b1b..7ae590c) ; page `/essai` et retours testeurs dans l'admin (04fdb20, 098da1a) ; admin : communication et commercialisation (ffdcb25) |
| 20/09 | 2 (2c42d61, f7b70a6) | Admin : mapping inscriptions ; essai, onboarding pro, bulle de feedback |
| 21/09 | 7 (7b09d16..6d8d09c) | Inscription (date de naissance) ; refonte du parcours `/essai` (1181f62, 269e240) |
| 01/10 | 1 (aa33c6c) | `/essai` : logo agrandi, onglet admin « Visites » |
| 26/10 | 15 (4497a48..90e6674) | Bêta-test, catalogue réservable (35e408c) ; Messages et chat façon messagerie ; prix tout compris ; parrainage ; régie pub ; commission réglable 8 %/17 % (90e6674) |
| 27/10 | 11 (20173c4..42c108b) | Annulation gratuite puis modèle à paliers (9b60522, 1de2757) ; SEO villes (d685335) ; plus d'emoji (cee072b) ; double sécurité GPS au scan (96a3801) |
| 28/10 | 8 (ca6b374..f2d9e3a) | Plaquettes et animation (ca6b374, 2cede49) ; agenda et suivi d'intervention (11fee04, 6a44670) ; réservation par créneau prête (f2d9e3a) |
| 29/10 | 9 (2763117..338dafa) | Avance immédiate Urssaf prête (82f9b9b) ; séparation client/prestataire (665c200) ; séquestre prêt, éteint (957bb13, bcc2149) ; heure entamée due (6f4a455) |
| 30/10 | 16 (4b466c0..4bbf703) | Audit complet, une cinquantaine de corrections (4b466c0) ; messages système enfin enregistrés (c34bc03) ; menu à 4 entrées (770b76c) ; adresse après validation (03b7281) ; avis du prestataire sur le client (12c1ac9) ; récapitulatif et partage des factures (4bbf703) |
| 31/10 | 18 (afa5d3f..d55ebc7) | Pare-feu SEPA, CGV (afa5d3f) ; PDF >= 1 000 EUR corrigé (968b718) ; tests e2e et pare-feu ; litige en dossier dédié (80debb8) ; adresse d'intervention (0d2af2c) ; verrous base (db58439) ; animation prestataires (9fc590f) ; virement SEPA (d55ebc7) |
| 01/11 | 5 (64f070b..5f57c80) | Notifications, tableau de bord pro (64f070b) ; réglages locaux ignorés par Git (56f18e1) ; animation d'inscription (cb91f61) |
| 02/11 | 9 (57dfe9f..54ac6ce) | `/bienvenue` et plaquette unique (00d6237, 2dc1dc4) ; inscription prestataire (a2efea4) ; client absent, avis client (b4df030) ; mot de passe oublié (86b5e9d) |
| 03/11 | 37 (63067ef..638022d) | Correctif `get_arrival_code` (63067ef) ; lecteur d'animations ; accès réservé aux inscrits (15dd18c) ; animations client/prestataire séparées (8139de5) ; clé de secours admin sortie du code (b9b4285) ; carte pro, admin mobile, journal des connexions (400b711, 9786b6e) |
| 07/11 | 16 (b29135c..d729e40) | Audit 10/10 et vision UX (cfcf295..2cda78b) ; maquettes v2 à v4.1 (834927f..d5af6cd) ; décision services extensibles (646dc9c) |
| 17/11 | 12 (a058487..a2b558f) | Maquette v6 ; audit v5 ; liste CESU (c0ee07c) ; contre-audit v6 |
| 18/11 | 56 (cf12aa6..a6495d6) | Plan de refonte en 33 lots (d2ace22) ; lots 2 à 31 fusionnés ; fond de carte vectoriel (6891882) ; arrivée/départ sécurisés (310ce5f) ; arrangement à l'amiable (cf97f03) ; catalogue des services (f15d596) ; migrations 042-047 préparées (03c5638) ; plan marketing 8 semaines (12572c1) ; ergonomie (a6495d6) |
| 19/11 | 21 (3e993f4..8721e65) | Process de commande porté (3e993f4) ; e2e A et B sur la prod (17050fe) ; trois remesures ergonomie (a2282b7, 31acd8a, f833fa5) ; réservation à accepter, migration 052 (cc693b7, 8721e65) |
| 20/11 | 35 (eb39e05..dff8ca9) | Réservation à accepter complète (eb39e05) ; 053-054 (9273c1a) ; délai d'incident 24 h (ab01ce8) ; calcul de facture testé (53d4ab6) ; 057, 058, alertes pièces et position d'intervention ; virement non reçu 059 (4d8e229) ; annulations à paliers 056 (0a2200e, d7537d6) ; litige dans le chat 059b (44d6265) ; annulation après arrivée (71fd538) ; correctif 060 (8f7411b) |
| 21/11 | 6 (862db42..9b4ffc5) | Délai de report réglable (862db42) ; ergonomie : fenêtres au-dessus de la barre, cibles 44 px (6ba9a05, 65f43b4) ; QR de mission partagé (c13d631) ; test B corrigé (9b4ffc5) |

## Étiquettes de production
Aucune étiquette `prod-AAAA-MM-JJ` n'existe encore (vérifié le 21/11/2026 : `git tag` vide). Première étiquette proposée : `prod-2026-11-21` sur 9b4ffc5, à créer avec l'accord de Romain.

## Ajouts du 22-23/11/2026
| 22/11 | 9 (cfef3bb..b4c6437) | Carte variante Waze (cfef3bb) ; 3 essais du build GitHub (251c49b) ; bon de commande depuis le chat (04e7109) ; vérifications de recette et captures ; 3 animations courtes + audit (1db5f89) ; alertes admin lisibles et chat en direct, 062 non collée (b4c6437) |
| 23/11 | gardien-fidelite | Agent gardien-fidelite, DEMANDES.md, BRIEF-AGENT.md, maquettes dans docs/maquette/, contrat de fidélité (branche claude/gardien-fidelite, PR en brouillon, non fusionnée) ; mémoire des 13 agents mise à jour avec les leçons du 21-22/11 |
