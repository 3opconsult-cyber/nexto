# Contrat maquette / application : Site public et inscription (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Accueil /bienvenue | Deux boutons de rôle : « Je cherche un prestataire » / « Je suis prestataire » | OK | src/app/not-found.tsx:51 ; A03 Q140 ; app-accueil.png : /bienvenue (page statique) affiche « Je cherche un prestataire » et « Je suis prestataire » ; la page introuvable porte aussi « Je suis prestataire » |
| Accueil /bienvenue | Sans compte, /map renvoie vers l'inscription (application non visitable) | OK | src/components/AuthGate.tsx:14 ; A03, AuthGate (décision 03/11) ; vu 23/11 : sans compte, / mène à /auth/signup?next=%2Fmap |
| Inscription | Un seul écran de compte, saisie gardée, CGU ouvertes dans un nouvel onglet | OK (code) | src/app/auth/signup/page.tsx:312 ; A04 Q056 Q126 |
| Inscription | Étape précédente, mot de passe affichable, contrôles en français | OK (code) | src/app/auth/signup/page.tsx:303 ; Q126 ; nombre d'appuis non remesuré |
| Vérifier l'e-mail | Écran « Vérifiez votre boîte mail » et « Changer d'e-mail » (formulaire rouvert rempli) | OK (code) | src/app/auth/signup/page.tsx:202 ; A02 Q126 |
| Accueil en 3 écrans | Carrousel d'accueil après la vérification | OK (code) | src/components/WelcomeCarousel.tsx:44 ; A02 Q018 |
| Position | Encart expliquant la position AVANT la demande du navigateur | OK (code) | src/components/LocationAsk.tsx:21 ; A02 Q116 ; lacune A02 comblée dans le code |
| Choisir une ville | Villes proposées, carte recentrée, distances calculées depuis la ville | OK (code) | src/components/LocationAsk.tsx:12 ; Q116 Q127 ; 7 villes |
| Connexion | Mot de passe oublié, e-mail contrôlé | OK | src/app/auth/login/page.tsx:53 ; Q080 Q141 ; app-connexion.png : « Mot de passe oublié ? » |
| Connexion | Carte blanche sur fond navy, titres Quicksand | OK | src/components/TransferCard.tsx:116 ; Q080 ; rendu non mesuré ; app-connexion.png : carte blanche sur fond navy, titre « Connexion » en Quicksand |
| Conditions générales | Clause « PING est une plateforme de mise en relation… ne garantit ni la solvabilité ni la qualité » | OK (code) | src/app/cgu/page.tsx:25 ; Q183 ; texte provisoire, validation juridique à faire (A-TRANCHER j) |
| Page introuvable | Vraie page d'erreur avec retour (plus le prototype) | OK (code) | src/app/not-found.tsx:14 ; A24 Q057 |
| Pages publiques hors maquette | /plaquettes, /animation-courte, /l/ins, /confidentialite, /aide | NON VÉRIFIÉ | Production injoignable depuis cet environnement : 403 Vercel (voir CONTRAT-MAQUETTE.md) |
| Accueil /bienvenue | Carte blanche « ping » + « L'application de rencontre client-prestataire, en proximité · Côte d'Azur », « J'ai déjà un compte », « Ménage, repassage, vitres et fin de chantier, près de chez vous. » | MANQUE | maquette-accueil.png / app-accueil.png : /bienvenue est une page « AVANT-PREMIÈRE » (logo PING, « Et si ce que vous cherchez se trouvait juste à côté ? ») sans « J'ai déjà un compte » ni phrase d'accroche ; l'accueil de la maquette n'existe pas dans l'app (/ renvoie à l'inscription) ; aucune décision citée |
| Connexion | Libellés : lien « Retour » en haut, interrupteur « Rester connecté », « Pas encore de compte ? Créer un compte » | MANQUE | app-connexion.png : pas de « Retour », case à cocher, « S'inscrire » ; l'app ajoute « Recevoir un lien de connexion par e-mail » ; aucune décision citée |
