# Contrat maquette / application : Site public et inscription (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Accueil /bienvenue | Deux boutons de rôle : « Je cherche un prestataire » / « Je suis prestataire » | OK (code) | src/app/not-found.tsx:51 ; A03 Q140 |
| Accueil /bienvenue | Sans compte, /map renvoie vers l'inscription (application non visitable) | OK (code) | src/components/AuthGate.tsx:14 ; A03, AuthGate (décision 03/11) |
| Inscription | Un seul écran de compte, saisie gardée, CGU ouvertes dans un nouvel onglet | OK (code) | src/app/auth/signup/page.tsx:312 ; A04 Q056 Q126 |
| Inscription | Étape précédente, mot de passe affichable, contrôles en français | OK (code) | src/app/auth/signup/page.tsx:303 ; Q126 ; nombre d'appuis non remesuré |
| Vérifier l'e-mail | Écran « Vérifiez votre boîte mail » et « Changer d'e-mail » (formulaire rouvert rempli) | OK (code) | src/app/auth/signup/page.tsx:202 ; A02 Q126 |
| Accueil en 3 écrans | Carrousel d'accueil après la vérification | OK (code) | src/components/WelcomeCarousel.tsx:44 ; A02 Q018 |
| Position | Encart expliquant la position AVANT la demande du navigateur | OK (code) | src/components/LocationAsk.tsx:21 ; A02 Q116 ; lacune A02 comblée dans le code |
| Choisir une ville | Villes proposées, carte recentrée, distances calculées depuis la ville | OK (code) | src/components/LocationAsk.tsx:12 ; Q116 Q127 ; 7 villes |
| Connexion | Mot de passe oublié, e-mail contrôlé | OK (code) | src/app/auth/login/page.tsx:53 ; Q080 Q141 |
| Connexion | Carte blanche sur fond navy, titres Quicksand | OK (code) | src/components/TransferCard.tsx:116 ; Q080 ; rendu non mesuré |
| Conditions générales | Clause « PING est une plateforme de mise en relation… ne garantit ni la solvabilité ni la qualité » | OK (code) | src/components/DemoShell.tsx:522 ; Q183 ; texte provisoire, validation juridique à faire (A-TRANCHER j) |
| Page introuvable | Vraie page d'erreur avec retour (plus le prototype) | OK (code) | src/app/not-found.tsx:14 ; A24 Q057 |
| Pages publiques hors maquette | /plaquettes, /animation-courte, /l/ins, /confidentialite, /aide | NON VÉRIFIÉ | Production injoignable depuis cet environnement : 403 Vercel (voir CONTRAT-MAQUETTE.md) |
