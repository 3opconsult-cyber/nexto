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
