# Audit du super admin (/admin), 07/11/2026

Périmètre : https://nexto-eta.vercel.app/admin, compte administrateur du brief, ordinateur 1440x900 et mobile 390x844. Lecture seule : aucun bouton qui écrit n'a été pressé (Valider/Rejeter une pièce, Reçu, Envoyer au support, Enregistrer). Mes passages ont créé des « visites » au nom du fondateur dans /admin/visites et /admin/parcours (traces de l'audit, pas de vrais usages).

## 1. Verdict

L'admin est joli et le menu est lisible, mais il ne permet pas encore de piloter une phase de test : plusieurs chiffres et listes mélangent données fictives, démo et réel sans l'indiquer, des écrans clés (litiges, pièces à valider, retours de la bulle verte, nouveaux inscrits) sont absents, cachés ou sans suite, et une faille d'injection HTML touche les noms saisis par les inscrits.

## 2. Notes /10

| Axe | Note | Justification |
|---|---|---|
| Design | 7 | Cohérent avec la charte, mais mobile : l'Aperçu réel déborde (988 px), tableaux coupés sans indice ; pages /admin/retours et /admin/paiements dans une autre typographie, sans fil d'Ariane identique. |
| Ergonomie | 5 | Barre de recherche et période décoratives, filtres/tri/regroupement morts sur les listes, fiches pauvres, litiges et documents non ouvrables, cibles tactiles < 44 px. |
| Fluidité | 6 | Pas de saut notable, burger et barre du bas fonctionnent ; mais « Voir » mène à des écrans vides, et la carte s'ouvre sur une zone sans aucun point. |
| Compréhension | 4 | « démo » à côté de « Vue d'ensemble » alors que l'écran dit « données réelles » ; « Données disponibles au lancement » partout ; jargon technique (prototype, lot L7, noms de fichiers). |
| Fonctionnel | 4 | Sorties factices (campagnes, hebdo), numéros de factures inventés, liste « Voir la liste » en dur, redirection admin cassée à la connexion, 3 contrôles dead. |
| Données | 3 | Aucun chiffre ne concorde d'un écran à l'autre (voir D1 à D5) ; le « réel » inclut les fictifs. |
| Homogénéité des textes | 5 | Tutoiement dans Prospection / vouvoiement ailleurs, « 25.0 % », valeurs brutes (auto_entrepreneur), « menage » sans accent ni majuscule. |
| Accessibilité | 6 | Contrastes corrects, champs en 16 px sur mobile ; cibles tactiles courtes, onglet actif absent de la barre basse hors 4 sections, pas d'indice de défilement horizontal. |
| Technique | 4 | Injection HTML (noms, messages de support, motifs de litige), 406 à chaque connexion, supabase-js chargé depuis esm.sh, carte OSM sans attribution. |

## 3. Écrans parcourus

Ordinateur (D) et mobile (M), tous chargés, sans erreur JS ; une seule erreur console : le 406 de la connexion (T3).

1. Vue d'ensemble `/admin` (D, M)
2. Aperçu réel `/admin` section live (D, M)
3. Utilisateurs, onglets « Propose » et « Réserve » (D, M) + fiche personne (modale) (D, M)
4. Activité & annonces, cases/puces « Inclure les fictives », « Annonces en cours »… (D, M)
5. Transactions + fiche transaction (modale) (D, M)
6. Prospection : 10 sous-onglets (Flash terrain, Leads entrants, Prospects CRM, Partenariats, Cahier des actions, Tunnel de vente, Matériel commercial, Campagnes & QR, Plan & messages, Landing souscription) (D, M pour la barre d'onglets)
7. Supports & visuels : liens, aperçus Téléphone/Ordinateur, 35 liens testés (tous 200) (D)
8. Commissions (D, M)
9. Documents & factures (D, M)
10. Paiements & séquestre (D, M)
11. Déclarations DAC7 (D, M)
12. Conformité (KYC) (D, M)
13. Litiges (D, M)
14. Signalements (D, M)
15. `/admin/retours`, `/admin/visites`, `/admin/parcours`, `/admin/commission`, `/admin/paiements` (D)
16. `/litiges` (vue médiation côté app) (D)
17. Carte de l'aperçu réel (Vue d'ensemble et Aperçu réel) (D, M)
18. Burger, barre d'onglets du bas, carte « Installer le raccourci » (M)

## 4. Erreurs et bugs

### P0 (bloquant ou faux)

**A1. Injection HTML possible via le nom d'un inscrit (et les messages de support, motifs de litige)**
- Écrans : Utilisateurs, fiche personne, Aperçu réel. `/admin`
- Constat : `renderLiveUsers` écrit `name`, `city`, `c.full_name` sans échappement ; la fiche écrit `prof.full_name`, `m.body` (messages de support) ; Aperçu réel écrit `reason` des litiges et `full_name` sans `esc()`. Un inscrit qui se nomme `<img src=x onerror=...>` exécuterait du script dans la session admin (accès à tout). Indice visible : le motif de litige « prirnrn…xbj< » s'affiche avec son `<`.
- Preuve : code lignes ~3170-3215 et 3515-3550, 3624-3650 de `public/admin.html` (lu, non exploité volontairement). Les parties Activité et Prospection utilisent bien `esc()`.
- Correctif : passer toutes les valeurs venant de la base par `esc()` (déjà défini ligne 3570).

**D1. « Réel » mélangé aux données fictives et chiffres incohérents entre écrans**
- Vue d'ensemble : Volume 5 418,66 €, Commissions 1 125,09 €, Prestataires 30/30, « données réelles » ; la case juste en dessous : Réalisé 0 €, Missions en cours 0. Aperçu réel : « ce n'est pas une démo », missions 81 (70 terminées), 11 demandes ouvertes ; Activité (sans fictives) : 5 annonces, 0 mission ; avec fictives : 11 annonces, 9 en cours, 70 terminées, 4 811 € réalisés. Le fondateur voit deux vérités.
- Autres écarts mesurés : « Clients inscrits 9 » (6 sont des fixtures Camille, Thomas, Léa, Antoine, Julie, Marc) alors que seuls 3 particuliers sont de vrais comptes (Samuel Catena, Romain Test, Nico Jako) ; « Prestataires actifs 30/30 » sont 29 fictifs/fixtures + audit ; Personnes de l'Activité affiche pour « romain collin » 8 en cours / 4 achevées alors que les KPI du même écran disent 0 / 0 (les personnes ne filtrent pas les fictifs) ; « Missions en cours » compte aussi les missions « En attente » alors que la liste Transactions n'a qu'une seule ligne « En cours ».
- Preuve : `admin-03-activite-0-ligne.png`, `admin-01-vue-ensemble-demo-recherche.png`, mesures `admin_pipeline` (11 vs 5), `admin_stats`.
- Fichier : `public/admin.html` (`loadLiveData` ~3109, `loadActivite` 3571) + RPC `admin_stats` / `admin_pipeline` (la première ne filtre pas `fictif`).
- Correctif : un seul réglage « inclure les fictifs » (par défaut non) appliqué à toutes les RPC et listes, et un libellé « fictif » sur chaque ligne concernée.

**D2. « Documents & factures » liste 210 documents qui n'existent pas tels quels**
- La table `invoices` contient 99 lignes (33 missions) avec des numéros du type `FACT-2026-00037` (5 chiffres). L'admin en affiche 210 (70 missions terminées x 3), numérotés `FACT-2026-0070` (4 chiffres), fabriqués côté navigateur à partir de l'ordre d'affichage (`seq = i+1`). La fiche transaction montre encore un troisième format (`FACT-2026-452286d0`). Rien ne concorde avec les PDF reçus par les utilisateurs ni avec /admin/paiements (`PING-C-2026-00034`). Un clic sur une ligne ne fait rien.
- Preuve : lecture REST `invoices` (99 lignes, numéros 5 chiffres), `admin-11-documents-clic-sans-effet.png`.
- Fichier : `public/admin.html` `loadLiveInvoices` (~3234) et `openTxDetail` (~3445).
- Correctif : lire la table `invoices` (numéro, type, lien vers le PDF) au lieu de reconstruire.

**D3. Campagnes & QR et suivi hebdomadaire : chiffres inventés, présentés comme réels**
- Onglet Campagnes & QR : 11 supports (Flyer laverie, Tabac gare, Google Ads…) datés d'août avec « 36 leads attribués, cohérent avec Leads entrants », codés en dur (`CAMPAGNES`, ligne 2375). Leads entrants réel : 38 « direct » et 1 « animation », donc aucun lien. Les QR et liens générés pointent vers `https://ping.app/...` (domaine non à nous) : un QR imprimé à partir de cet écran ne mène nulle part. Le tableau « Suivi hebdomadaire » (S3 : 17 pros, 22 € le coût, 1 demande sans réponse) est du HTML statique.
- Preuve : `admin-05-campagnes-qr-fictives.png`, `campUrl()` ligne 2388.
- Correctif : brancher sur `signup_attributions`/liens `/l/<code>` réels (nexto-eta.vercel.app), supprimer ou étiqueter « exemple » le reste.

**D4. « Voir la liste » (Actifs sur la carte 30) montre 4 prestataires de démonstration**
- Liste : Léa Nettoyage, Bruno Ménage, Yanis Services, Léo Services, tous « Connecté », issus des données de prototype `ENT` (ligne 1278). Aucun lien avec les 30 prestataires. La carte s'ouvre sur un point moyen (Alpes, ni Nice ni Grasse), 39 pastilles dont 0 dans le cadre, car la moyenne des coordonnées inclut des fixtures à Paris, Lyon, Lille, Toulouse.
- Preuve : `admin-06-carte-vide-liste-demo.png` ; mesure : 39 marqueurs, 0 visibles, mobile et ordinateur.
- Fichier : `public/admin.html` ligne 3321 (`setView([avgLat, avgLng], 13)`) ; handlers « Voir la liste » (`showMapPeople`, ligne 2656).
- Correctif : `fitBounds` sur les marqueurs ; remplacer la liste par la vraie (`list`).

**F1. Litiges ouverts impossibles à traiter depuis l'admin**
- Vue d'ensemble : « 5 litiges ouverts, Voir » renvoie à la section Litiges, vide (« Données disponibles au lancement », Résolus —, Montant en jeu —). Aperçu réel liste les 5 litiges mais la ligne n'est pas cliquable. Le seul accès réel est l'URL `/litiges` (médiation), jamais proposée dans le menu admin ; le texte renvoie à « /litiges » sans lien. Le bloc « Règles prévues » est un texte, pas une action.
- Preuve : `admin-12-litiges-file-vide.png`, clic test (aucune navigation).
- Correctif : lister les litiges dans la section Litiges avec lien direct `/litiges/[id]`.

**F2. Pièces à valider : « Voir » mène à une section vide ; Valider/Rejeter sans voir le fichier**
- Vue d'ensemble « 3 pièces à examiner, Voir » ouvre Conformité (KYC) : « Données disponibles au lancement ». Les pièces ne sont que dans Aperçu réel, avec Valider / Rejeter immédiats, sans visionneuse, sans confirmation, alors que « Valider » sert à afficher « profil vérifié par PING ».
- Fichier : `public/admin.html` ~3166-3195 (`mkBtn`), `nav('conformite')` du bloc « À traiter ».
- Correctif : aperçu du fichier (URL signée) et confirmation avant validation ; lien « Voir » direct vers cette liste.

### P1 (gêne forte)

**R1. Les retours de la bulle verte ne sont visibles nulle part de façon lisible**
- Les commentaires de la bulle sont stockés comme événements `feedback_note` (table `events`) et n'apparaissent que dans /admin/visites (une ligne par visite, 24 900 px de haut, plafonné à 1 000 événements et 300 profils). `/admin/retours`, le seul lieu nommé « retours », lit une autre table (`beta_feedback`, carrousel /essai/avis) et affiche « 0 avis ». Aucun lien dans le menu : accès uniquement par trois petits « Ouvrir » enfouis dans Supports & visuels.
- Preuve : `admin-08-retours-testeurs-vide.png`, code `src/app/admin/visites/page.tsx` lignes 38-39, 71.
- Correctif : entrée de menu « Retours testeurs » qui liste les `feedback_note` (date, auteur, page, texte) avec compteur sur le tableau de bord.

**R2. Nouveaux inscrits peu visibles**
- Aucune vue « derniers inscrits » : l'Aperçu réel ne liste que les prestataires (des Fictif 11-19 du 2 novembre), alors que le vrai dernier inscrit (Samuel Catena, particulier, 4 nov.) n'apparaît que dans Utilisateurs (« membre depuis nov. 2026 », sans date, sans e-mail, sans état des pièces) et Leads entrants (dans Prospection, mélangé aux fictifs). Pas d'alerte e-mail à l'admin à chaque inscription.
- Correctif : bloc « Derniers inscrits » (rôle, date/heure, canal d'arrivée, pièces fournies ou non) sur la Vue d'ensemble.

**F3. Fiche personne trop maigre pour un suivi de test**
- Affiche : nom, rôle, ville · téléphone · e-mail, métier, note, bouton « Voir la mission active » (seulement si pending/arrived), chat de support. Manque : date d'inscription, dernière connexion, état des pièces, nombre d'annonces, de missions, de litiges, son historique.
- Preuve : `admin-04-fiche-personne-maigre.png`. Fichier : `openPersonDetail` ligne 3468.

**F4. Barre de recherche et sélecteur de période décoratifs**
- « Rechercher un pro, un client, une transaction… » est un `<div>` sans champ ni action ; « Depuis le lancement » aussi (aucun menu). Visibles sur tous les écrans.
- Fichier : `public/admin.html` ligne 453 (`.search`, `.period`). Correctif : les brancher ou les retirer.

**F5. Filtre, tri, regroupement et compteur « 0 ligne » morts sur toutes les listes chargées dynamiquement**
- Testé sur Transactions (81 lignes), Utilisateurs (30), Documents (210), Aperçu réel, Activité : taper un filtre ne réduit pas la liste, cliquer un en-tête ne trie pas, « Grouper par » ne regroupe pas, le compteur reste « 0 ligne » ; « Toutes années » n'a qu'une option. Seul le champ du haut d'Utilisateurs (« Filtrer par nom, ville, métier ») fonctionne : il y en a donc deux superposés, dont un mort.
- Preuve : `admin-03-activite-0-ligne.png` ; mesure : filtre « Terminée » sur Transactions, 81 lignes avant et après.
- Cause : `enhanceTable` (ligne 2290) fige la liste des lignes (`original`) au premier affichage, avant l'arrivée des données.
- Correctif : relancer l'initialisation après chaque chargement de données, ou lire les lignes à chaque application.

**F6. Aperçu réel déborde en mobile**
- Largeur de page 988 px pour 390 d'écran : « Derniers prestataires inscrits » et « Documents en attente » sont dans une grille à 2 colonnes forcée en ligne (`grid-template-columns:1fr 1fr`), non empilée en mobile ; filtres et colonnes coupés (Statut, « Désactiver »).
- Preuve : `admin-02-mobile-apercu-reel-debordement.png`. Fichier : ligne 517 (`#liveTablesTop`).
- Correctif : classe avec media query d'empilement.

**T1. Connexion admin sans `?next=` atterrit sur /map, pas /admin**
- `auth/login/page.tsx` ligne 88 : `from('profiles').select('is_admin, is_pro').single()` sans filtre ; pour un admin (RLS élargie) la requête renvoie 40 lignes, répond 406 et ne lit jamais `is_admin`. Preuve : 406 sur `profiles?select=is_admin,is_pro` à chaque connexion, sur ordinateur et mobile. Correctif : ajouter `.eq('id', user.id)`.

**F7. Sections « à brancher » présentées comme écrans de pilotage**
- DAC7 (tous les blocs « À brancher »), Paiements & séquestre (« Fonds détenus 0 € », « Données bancaires : Conforme », « Modèle validé », « Prêt, à brancher » alors que le paiement en ligne est éteint), Signalements, Conformité (échéances vides), Litiges (« Règles prévues », « Prévu »). Les étiquettes « Données disponibles au lancement » occupent 25 emplacements. Un fondateur ne distingue pas « il n'y a rien à faire » de « cet écran n'est pas fonctionnel ». « Conforme » est une affirmation sans contrôle derrière.
- Correctif : un badge « Non branché » homogène, retirer « Conforme ».

### P2 (finition)

- **T2** Langage de prototype visible : « dans ce prototype (`insExpiry` par entité) », « lot L7 », noms de fichiers `ping-evaluation-technique-prospection.md`, « URL provisoires (ping.app) », « cliquer le statut pour simuler » (Prospection), note de l'aperçu « si elle affiche une erreur 404, c'est que cet outil de prévisualisation ne sert que ce fichier admin seul ». À reformuler ou retirer pour un non-technicien.
- **H1** Tu/vous mélangés : Prospection tutoie (« montre le QR », « clique », « tu n'as plus qu'à »), le reste vouvoie.
- **H2** Valeurs brutes de la base : colonne Statut `auto_entrepreneur`, `sasu`, `eurl`, `particulier` ; annonces « menage », « repassage » en minuscules sans accent ; `/admin/commission` « 25.0 % » (virgule attendue) ; note « 3.9 ★ » (virgule attendue) ; transactions « 02 nov. » sans année.
- **H3** Même libellé pour deux choses : « Commissions » (menu) vs « Commission » (texte, route), « Missions en cours » (KPI) vs statut « En cours » (liste) vs « En attente ».
- **E1** Cibles tactiles < 44 px sur mobile : burger 38x38, retour 34x34, liens « Aperçu », « Ouvrir », « Copier le lien » en texte nu.
- **E2** Barre du bas mobile : aucun onglet actif pour les sections hors des 4 (Documents, Prospection…). Vérifié sans défaut : le burger s'ouvre, les 4 onglets changent de section, « Menu » ouvre le tiroir, taper à droite du tiroir le ferme.
- **E3** Carte « Installer le raccourci » : uniquement des consignes écrites (pas de bouton d'installation), placée tout en bas de la Vue d'ensemble (à ~2 700 px sur mobile). Le manifeste et les icônes répondent en 200.
- **E4** Tableaux mobiles défilant horizontalement sans indice (colonnes Ville, Note, Ouvrir invisibles dans Utilisateurs). Preuve : `admin-07-mobile-utilisateurs-tronque.png`.
- **E5** `/admin/paiements` n'a pas le lien « Retour à l'admin » des autres pages /admin/* ; `/admin/retours` est en typographie Arial, pas Quicksand/Inter.
- **E6** Table Utilisateurs : onglet « Réserve des services » vocabulaire différent du reste (« particuliers » / « clients »).
- **E7** Pastille « démo » dans le menu à côté de « Vue d'ensemble » alors que le contenu annonce « données réelles » (`admin-01-...png`).
- **T4** `supabase-js` chargé depuis `https://esm.sh/@supabase/ssr@0.3.0` : si ce CDN est indisponible, toutes les données réelles de l'admin tombent. Carte OSM sans attribution (`attributionControl:false`) : mention de licence obligatoire.
- **T5** Mots de passe/clé : sans objet (non lus). Les pages /admin/visites affichent téléphone et adresse en clair, pour un admin : acceptable, mais à garder en tête avec de vrais inscrits.

## 5. Non vérifié

- Clic sur Valider / Rejeter (pièces), « Reçu » (virements), « Envoyer » (support), « Désactiver » (prestataire), « Enregistrer » (réglages), formulaires de Prospection (Nouveau prospect, Nouveau partenaire, Consigner l'action, WhatsApp) : écrivent en base ou ouvrent un service externe ; interdits en lecture seule.
- Section Signalements et fil « dossier » de signalement, file KYC, litige complet (`/litiges/[id]`) : aucune donnée réelle disponible côté admin, donc non montrés (les écrans de prototype `ENT/TX/LITIGES/SIGNALEMENTS` n'ont pas été atteints depuis le menu réel).
- Fonctionnement des RPC `admin_stats` et `admin_pipeline` côté serveur : seules leurs sorties ont été lues, pas leur définition SQL.
- Exploitation réelle de A1 (injection) : non tentée pour ne rien écrire ; établie par lecture du code.
- Appareils réels iOS/Android (installation, safe areas) : seul l'émulateur Chromium mobile a été utilisé.
- Captures : 12, dans `/home/user/nexto/docs/audit-2026-11-07/captures/` (`admin-01` à `admin-12`).

## 6. Ce qu'il manque pour piloter une phase de test avec de vrais inscrits

1. Un interrupteur global « masquer les comptes et missions fictifs » appliqué partout (D1).
2. Un bloc « Derniers inscrits » avec date, rôle, canal et état des pièces ; alerte e-mail/notification à chaque inscription (R2).
3. Une entrée de menu « Retours testeurs » alimentée par la bulle verte, avec compteur (R1).
4. La liste réelle des litiges et des pièces à valider, avec liens directs vers le dossier (F1, F2).
5. Fiche personne complète : pièces, missions, litiges, dernière connexion, historique (F3).
6. Liste des annonces en cours : présente et correcte dans Activité & annonces (5 en cours, concordant avec la Vue d'ensemble), mais à promouvoir sur la Vue d'ensemble avec leur ancienneté et le délai sans réponse d'un prestataire.
7. Liens et QR de campagne qui pointent sur le vrai domaine et se comptent réellement (D3).
