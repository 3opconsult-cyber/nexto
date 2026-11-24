# Mémoire gardien-fidelite (créée le 23/11/2026, vérifié le 23/11/2026)

## Acquis
- La maquette de référence est `docs/maquette/maquette-ping-v11.html` (copie de `public/maquette.html`, 18/11/2026) ; `docs/maquette/data.js` liste ~250 éléments avec statut (fait / incomplet / absent) et preuve datée.
- Les statuts de `data.js` datent du 18/11 : à reverifier en production avant de les recopier dans le contrat.
- La production est `https://nexto-eta.vercel.app` ; `/maquette` sert la maquette ; `/admin` redirige vers la connexion sans session.
- Une page de l'app sans session : redirection vers l'inscription faite côté navigateur (le HTTP répond 200) : se prouve par navigateur, pas par curl.
- Le dernier commit en production se lit dans les déploiements Vercel (meta githubCommitSha) ; deux déploiements « production » par envoi (A-036).
- Textes d'interface : copiés depuis le code (`src/`), jamais retapés.
- Les écarts voulus par Romain (VOULU) citent la décision : voir `docs/claude/HISTORIQUE.md` et `A-TRANCHER.md`.
## Pièges
- « Build OK » ne prouve pas le rendu ; un déploiement « READY » d'un autre commit ne prouve pas la fonction demandée.
- Les comptes audit n'ont pas de compte administrateur : tout l'admin reste NON VÉRIFIÉ (écran lisible seulement par un admin).
- Après 17 h (Paris) les parcours qui créent une mission du jour ne trouvent plus de créneau : ne pas conclure à une régression.
- La pastille Messages des comptes audit reste à « 9+ » (nombreuses conversations QA).
- Les états « en attente », « refusée », « expirée » demandent une mission de test dans cet état : sinon NON VÉRIFIÉ.
- Une maquette est un dessin : l'espace entre éléments et les animations ne se prouvent pas par texte ; ne pas écrire OK sans mesure.
## À ne pas refaire
- Ne pas relire tout le dépôt ni rejouer les parcours complets : lire le journal depuis la dernière ligne, chercher, curl.
- Ne pas corriger ni proposer du code : consigner l'écart.
- Ne pas marquer OK sur la seule foi d'un rapport d'agent : vérifier la preuve.
- Ne pas recopier un mot de passe de test dans un rapport.
## Leçons de la deuxième passe (23/11/2026, sans production)
- Échantillon de 41 « OK (code) » : 7 références pointaient la mauvaise ligne ou le mauvais fichier (CGU, Décision PING, pastille, pièces 45 jours, Je pars, fiche publique, aperçu) ; 2 affirmations non prouvées par la ligne citée (Hors ligne retiré de la liste, Retour sans doublon d'historique) : toujours lire la ligne citée, pas seulement le fichier.
- Un VOULU exige une décision écrite de Romain : la pile technique (HISTORIQUE l.26) n'est pas une décision ; la carte OpenFreeMap est repassée MANQUE. HISTORIQUE l.336 dit l'inverse du séquestre éteint : la décision est l.567.
- `providers_nearby` en production n'est pas dans le dépôt (058 l.18) : ce que la liste affiche se prouve en production seulement.
- DEMANDES.md : des chiffres de tests (34/34, 42/42) ne correspondaient pas à ETAT.md (35/35, 41/42) : comparer au dépôt avant de croire une ligne « faite ».
- 23/11 passe visuelle : maquette ouvrable sans réseau avec Playwright : `showView(role); jump(role, écran)` puis capture de `#screen` (390x740). Production : connexion par /auth/login ; ids de mission lus par clic dans /messages, litige par clic dans /litiges.
- 23/11 : écarts mesurés, pas supposés : bouton principal prod #0C8F7E (4,0:1) contre maquette #0B8374 (4,65:1) ; puce « Vitres » présente en prod malgré la règle « non proposé » ; `/` mène à l'inscription, l'accueil réel est `/bienvenue` (page statique).
- 23/11 (consigne de Romain) : maquette = référence, écart sans décision = À CORRIGER, pas une question. Ne pas lister « décisions attendues » pour des libellés ou des mises en page : transmettre au principal avec « aligner sur la maquette ». Réserver les questions à argent, juridique, authentification, suppression.
- 23/11 : un statut « OK (code) » n'est pas une preuve de fidélité visuelle ; la preuve est une capture maquette et application côte à côte (30 captures dans docs/maquette-ecarts-2026-11-23/).
- 24/11 passe 4 : « Voir les prestataires » (et non « Dès que possible ») fait avancer Trouver un prestataire ; 4 appuis jusqu'à « Réserver ». Le déploiement se lit par `gh api repos/.../deployments` (sha + statut). Mesure de lecture aérée : compter les feuilles de texte sous 15 px (la barre du bas en compte 7 à 12 px). Mon annonce : 20 cibles sous 44 px.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : lire la production, pas le code de ta branche ; une ligne n'est OK qu'avec une capture ; VOULU exige une décision citée (carte centrale 23/11, lecture aérée 24/11, parcours en 4 appuis 23/11) ; après chaque lot, remesurer le pourcentage (58/212 = 27,4 % le 24/11).
