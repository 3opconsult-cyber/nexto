# Audit visiteur et parcours d'inscription / connexion (07/11/2026)

Périmètre : visiteur sans compte, de la plaquette `/bienvenue` jusqu'au dernier écran du formulaire d'inscription (jamais validé). Prod https://nexto-eta.vercel.app. Mobile 390x844 (x2, tactile) et ordinateur 1440x900. Aucun compte créé : les appels d'inscription ont été interceptés côté navigateur (jamais envoyés), les erreurs serveur ont été simulées. Aucune donnée touchée.

## 1. Verdict
Le parcours est propre et rapide à charger (aucun saut de page), mais il fait perdre du monde : l'inscription prestataire envoyée par la plaquette fait remplir 5 à 6 écrans AVANT de demander un compte (puis renvoie à l'inscription sans rien garder), les champs du formulaire sont sans repère de focus, sans libellé relié, en 14 px (zoom automatique sur iPhone), et le téléphone accepte n'importe quoi.

## 2. Notes /10
| Axe | Note | Justification |
|---|---|---|
| Design | 7 | Cohérent sur les 6 écrans vus ; défauts : la page /auth/reset est en clair quand login/signup sont en foncé, l'inscription sur ordinateur est une colonne foncée dans une page blanche. |
| Ergonomie | 5 | 5 appuis pour atteindre le formulaire, 8 pour le remplir, cibles de 16 à 30 px (liens, retour), données perdues si on ouvre les CGU, pro parti du mauvais bout. |
| Fluidité | 8 | CLS 0 sur toutes les pages (max 0,0087 sur /auth/reset), chargement /bienvenue 381 ms, transitions propres ; commandes de l'animation coupées dans la fenêtre mobile de /bienvenue. |
| Compréhension | 6 | Écran bêta = mur de 85 mots ; « Professionnel » / « prestataire » / « pro » mélangés ; « Finaliser » et date de naissance préremplie « 1 janv. 1996 » ambigus. |
| Fonctionnel | 5 | Téléphone non validé, redirections de visiteur incohérentes (signup avec retour / login sans retour / prototype démo), parcours pro qui perd ses données. |
| Données | 7 | Liens courts, UTM et ancres corrects ; adresse e-mail de contact identique partout ; erreurs serveur bien traduites. Non vérifié : e-mail de confirmation réel. |
| Homogénéité des textes | 6 | « email » / « e-mail » / « mail », « Pros indépendants » / « Prestataires » / « Professionnel », espace avant « : » qui passe en début de ligne, info et erreur affichées ensemble sur la connexion. |
| Accessibilité | 4 | Aucun libellé relié à son champ (0 sur 4 puis 0 sur 2), aucun indicateur de focus sur les champs, champs à 14 px, cibles tactiles sous 44 px. |
| Technique | 7 | Aucune erreur console sur le parcours ; 1 appel refusé (401) à `requests_nearby` par un visiteur ; toute URL inconnue répond 200 avec le prototype. |

## 3. Écrans parcourus
1. Plaquette /bienvenue : couverture, choix du rôle, choix « Suivre le parcours / Voir l'animation », 6 écrans particulier, 7 écrans prestataire, écran bêta, retour arrière (mobile + ordinateur).
2. Fenêtre « Voir l'animation » (iframe) de /bienvenue, rôle particulier et prestataire (mobile).
3. /animation-client en page seule : lecteur, commandes, fin avec « Je m'inscris » (mobile). /animation-prestataire dans la fenêtre (mobile).
4. /plaquettes et ses ancres #particulier #pro #devenir-pro #entreprises #annonceurs (mobile ; ordinateur pour la page).
5. Liens courts /l/ins, /l/insp, /l/bv, /l/zzz (code inconnu).
6. Redirections de visiteur : /map /messages /agenda /client/profil /pro/carte /pro/dashboard /documents /aide /mission/abc /client /hub.
7. /auth/signup particulier : étape 1, étape 2, retour arrière, glissement, erreurs simulées (déjà inscrit, mot de passe, trop de tentatives, e-mail invalide), écran « Vérifiez votre boîte mail » (simulé) ; onglet Professionnel (mobile + ordinateur).
8. /auth/login : erreur, mot de passe oublié (vide et avec e-mail), lien vers l'inscription avec `?next=` (mobile + ordinateur).
9. /auth/reset sans lien valide (mobile).
10. /pro/onboarding sans compte, via /l/insp : étapes 1 à 4 sur 5 (mobile).
11. /cgu et /confidentialite (mobile).

## 4. Erreurs et bugs

### P0
**P0-1. L'inscription prestataire demande 5 à 6 écrans avant de demander un compte, puis renvoie à l'inscription sans rien garder.**
- Écran : bouton « Je m'inscris » de /bienvenue (prestataire) et des plaquettes, lien `/l/insp` qui mène à `/pro/onboarding`. Visiteur sans compte.
- Constat : le visiteur remplit métier, tarif, statut, (entreprise), adresse, téléphone, texte de présentation, coche les CGV. Au clic sur « Terminer », `finish()` ne trouve pas d'utilisateur et le renvoie vers `/auth/signup?role=pro`. Rien n'est enregistré, tout est en mémoire de la page. Après inscription il faut confirmer son e-mail, se connecter, et tout recommencer.
- Attendu : le compte d'abord (ou conservation des réponses), puis le profil.
- Preuve : étapes 1 à 4 parcourues en réel (capture 11 ; aucun appel en écriture envoyé) ; la dernière étape n'a PAS été exécutée (action refusée par l'environnement). Le renvoi vers l'inscription et la perte des données sont établis par lecture du code, pas par exécution : `src/app/pro/onboarding/page.tsx` lignes 164-165 (`if (!user) { router.push('/auth/signup?role=pro'); return }`) ; aucun `localStorage`/`sessionStorage` dans le fichier. Lien `/l/insp` : `src/app/l/[code]/route.ts` ligne 70 (`path: '/pro/onboarding'`).
- Correctif : faire pointer `/l/insp` et le bouton prestataire de la plaquette vers `/auth/signup?role=pro` (puis onboarding après connexion), ou sauvegarder les réponses en `sessionStorage` et les rejouer après l'inscription.

### P1
**P1-1. Un nouveau prestataire arrive sur la carte client après confirmation de l'e-mail (déduit du code, non exécuté).**
- Écran : /auth/signup onglet Professionnel puis /auth/login. Constat : à l'inscription le rôle « pro » est envoyé mais la connexion ne regarde que `profiles.is_pro`, qui reste faux tant que l'onboarding n'est pas fini. Il atterrit sur /map comme un client, sans rappel de finir son profil. Attendu : retour vers `/pro/onboarding`.
- Preuve : `src/app/auth/login/page.tsx` lignes 80-84 ; CLAUDE.md (« is_pro défaut false »). Non exécuté (pas de vraie inscription).
- Correctif : après connexion, si le compte a été inscrit comme prestataire et n'a pas de `provider_profiles`, rediriger vers `/pro/onboarding` (ou passer `?next=/pro/onboarding` dans le lien de confirmation).

**P1-2. Ouvrir « Conditions Générales » ou « Politique de confidentialité » efface tout le formulaire.**
- Écran : /auth/signup étape 2. Constat : le lien ouvre /cgu dans le même onglet ; au retour, formulaire vide, retour à l'étape 1 (valeurs `['','','','']`). Attendu : lien dans un nouvel onglet ou valeurs conservées.
- Preuve : mesure Playwright (étape 1 remplie, étape 2 remplie, appui sur le lien, retour). Fichier : `src/app/auth/signup/page.tsx` ligne 229-231 (`<Link href="/cgu">` sans `target`, état en mémoire seulement).
- Correctif : `target="_blank" rel="noopener"` sur les deux liens.

**P1-3. Aucun repère de focus sur les champs et aucun libellé relié.**
- Écran : /auth/signup, /auth/login, /auth/reset. Constat : champ actif = `outline: none`, bordure et ombre inchangées (mesuré : `outlineStyle none`, bordure `#E7EDEB` identique focus ou non) ; `labels.length = 0` sur les 4 champs de l'étape 1 et les 2 de la connexion (un appui sur le libellé ne place pas le curseur, un lecteur d'écran ne l'annonce pas). Attendu : bordure teal au focus, `htmlFor`/`id`.
- Preuve : mesures `b3.mjs`, `a6.mjs`, `a9.mjs`. Fichiers : `inputStyle` dans `src/app/auth/signup/page.tsx` ligne 12 et `src/app/auth/login/page.tsx` ligne 9 (`outline: 'none'`), `<label>` sans `htmlFor`.
- Correctif : ajouter une règle `input:focus-visible` (bordure teal #12B39C + halo) et relier chaque `<label>` à son champ.

**P1-4. Champs en 14 px : l'iPhone zoome la page à chaque appui dans un champ.**
- Écran : étape 1 et 2 d'inscription (14 px), connexion (14,5 px), onboarding pro (14 à 15 px). Constat : mesuré `font-size 14px`. Safari iOS agrandit la page sous 16 px et ne la remet pas à l'échelle, le formulaire se retrouve décalé. Non vérifié sur un vrai iPhone (Chromium).
- Fichier : `inputStyle` (`signup/page.tsx` ligne 13 `fontSize: 14`, `login/page.tsx` ligne 10 `14.5`). Correctif : 16 px minimum.

**P1-5. Le téléphone accepte n'importe quoi à l'inscription.**
- Écran : /auth/signup étape 1. Constat : « abc » passe à l'étape 2. L'onboarding pro, lui, exige un format français : deux règles différentes pour la même donnée. Preuve : saisie « abc » → « Étape 2 sur 2 ». Fichier : `step1Ok()` dans `signup/page.tsx` ligne 52 (`!form.phone.trim()` seulement).
- Correctif : même contrôle de format que l'onboarding, message sous le champ.

**P1-6. Toute URL inconnue répond 200 avec le prototype de démonstration.**
- Écran : par exemple /pagexyz, /mission/abc, /client. Constat : aucune page 404, le visiteur voit l'application de démonstration (titre « PING — démo », données fictives, filtres « Remise en état »), alors que l'app n'est pas visitable sans compte. Preuve : capture 12, `curl` : 200 et 180 555 octets pour /pagexyz et /mission/abc.
- Fichier : `next.config.js` lignes 53-56 (`fallback: [{ source: '/:path*', destination: '/client.html' }]`).
- Correctif : supprimer ce fallback (ou le limiter aux chemins voulus) et laisser une vraie page 404 avec lien vers /bienvenue.

**P1-7. Redirections de visiteur incohérentes : le retour vers la page demandée se perd selon l'écran.**
- Constat : /map, /pro/carte, /aide mènent à `/auth/signup?next=…` (bon), mais /messages, /agenda, /client/profil, /pro/dashboard, /documents mènent à `/auth/login` SANS `next` (la page redirige elle-même plus vite que le garde `AuthGate`). Après connexion le visiteur arrive sur la page par défaut, pas là où il allait. 18 fichiers concernés. Un visiteur arrivé d'un lien envoyé (ex. une notification) perd sa destination.
- Preuve : navigation en direct, `a4.mjs`. Fichiers : `src/app/messages/page.tsx` ligne 49, `src/app/agenda/page.tsx` ligne 32 (`router.push('/auth/login')`), liste complète par recherche de `push('/auth/login')`.
- Correctif : retirer ces redirections locales et laisser `AuthGate` seul décider (avec `next`), ou ajouter `?next=` partout.

**P1-8. Cibles tactiles sous 44 px sur les liens clés du parcours.**
- Mesures : « S'inscrire » (connexion) 16 px de haut ; « Mot de passe oublié ? » 20 px ; « Se connecter » (inscription) ~16 px ; flèche de retour 28 px (inscription) et 30 px (onboarding) ; bouton « Retour » de la plaquette 30 px ; onglets Particulier/Professionnel 38 px ; points de la plaquette 22x8 px ; case à cocher 16 px. Ce sont les liens que les visiteurs perdus utilisent. Correctif : hauteur ≥ 44 px (marge intérieure).

### P2
- **P2-1. Fenêtre « Voir l'animation » sur mobile : les commandes sont coupées.** La fenêtre de /bienvenue fait 636 px de haut, le contenu de l'animation 689 px ; les boutons Pause/précédent/suivant sont tronqués d'environ 13 px (capture 03). En page seule (/animation-client) tout est visible. Cause : iframe `#ovf` plus basse que le lecteur. Correctif : donner à l'iframe `height: 100dvh` moins la barre du haut, ou réduire la scène.
- **P2-2. Retour depuis l'écran bêta : on revient à l'écran 1 du carrousel**, pas au dernier (`back()` → `show('slides')` repart de 0) dans `public/bienvenue.html`. Correctif : mémoriser l'index courant.
- **P2-3. Écran bêta : mur de texte (~85 mots, 9 lignes).** Capture 02. Le message clé (« les paiements ne sont pas réels ») est noyé au milieu ; l'espace avant « : » passe en début de ligne (« : votre avis ») ; « inscrit(e) ». Bouton « Continuer vers l'inscription » sur deux lignes. Correctif : 3 puces courtes, espaces insécables avant « : ».
- **P2-4. Étape 1 d'inscription : la roue de date affiche « 1 janv. 1996 » alors qu'aucune date n'est enregistrée** (le texte dessous dit « Facultatif »). Capture 10. Faux positif pour l'utilisateur qui croit l'avoir saisie. Correctif : roue vide/grisée tant qu'on n'y touche pas, ou champ date saisissable.
- **P2-5. Écran de connexion : le message de succès « un lien vous a été envoyé » reste affiché à côté de « Email ou mot de passe incorrect ».** Preuve : capture 08. Cause : `info` jamais effacé dans `handleLogin` (`login/page.tsx` ligne 54). Correctif : `setInfo('')` au début.
- **P2-6. /auth/reset : visuel et accessibilité différents.** Fond clair (#F3F6F5) alors que login/signup sont en foncé ; champs sans libellé (placeholder seul), pas d'œil pour voir le mot de passe, pas de retour à la connexion pendant « Vérification du lien… » (4 s) ; un petit décalage de mise en page à l'apparition du message d'expiration (CLS 0,0087). Capture 09.
- **P2-7. Inscription sur ordinateur : colonne foncée de 480 px dans une page blanche.** Capture 10 ; le fond foncé ne couvre pas la fenêtre (la connexion a le même défaut). Correctif : fond foncé sur `body` pour les pages /auth.
- **P2-8. Titre d'onglet identique sur toutes les pages /auth, /pro/onboarding, /essai** (« PING — Et si ce que vous cherchez se trouvait juste à côté de vous ? »). Correctif : `metadata.title` par page (« Inscription — PING », « Connexion — PING »).
- **P2-9. Mots mélangés.** « email » (formulaires), « e-mail » (CLAUDE.md), « boîte mail » ; « Professionnel » (onglet inscription), « Je suis prestataire » (plaquette), « PROS INDÉPENDANTS » (plaquette), « Devenir prestataire ». Le libellé de l'onglet « Professionnel » est aussi trompeur pour un particulier qui rend service (statut « Un particulier » existe à l'onboarding). Correctif : un seul mot (« Prestataire ») et « e-mail » partout.
- **P2-10. « Finaliser » (titre étape 2) ne dit pas ce qu'on va faire.** Remplacer par « Votre accès » ou « E-mail et mot de passe ». Pas d'indication de la règle du mot de passe avant l'erreur (« au moins 8 caractères » n'apparaît qu'après une erreur du serveur ; le navigateur affiche seulement « Please lengthen this text… » en anglais selon la langue du navigateur).
- **P2-11. Message d'erreur navigateur en anglais** (« Please fill out this field. ») dans un environnement non francophone : les champs utilisent la validation native sans message personnalisé ; le texte suit la langue du navigateur. Correctif : `noValidate` + messages maison.
- **P2-12. Un visiteur sur /pro/carte déclenche un appel refusé** `rpc/requests_nearby` (401, « permission denied ») avant la redirection. Erreur console sans effet visible. Correctif : ne pas appeler quand il n'y a pas de session.
- **P2-13. Pages /cgu et /confidentialite : « VERSION PROVISOIRE — EN COURS DE VALIDATION JURIDIQUE » visible du public** et texte en 13,5 px. Connu (CLAUDE.md) mais à lever avant tout lancement ; adresse de contact `info@opconsult.co` (orthographe à confirmer, comme noté dans CLAUDE.md).
- **P2-14. Lien du logo sans nom accessible** (`<a>` autour de `Sign`, le texte lu est le contenu de la balise de style `@keyframes pingSignPulse`). Ajouter `aria-label="PING, accueil"`.
- **P2-15. Aucun moyen de « sauter » le carrousel de la plaquette** : pour atteindre l'inscription il faut les 6 ou 7 écrans (ou le dernier point), sans bouton « S'inscrire » visible dès l'écran 1 (le lien n'est qu'au dernier écran).

### Mesures de fluidité (mobile 390x844 sauf mention)
| Page | CLS | Remarque |
|---|---|---|
| /bienvenue (toutes étapes) | 0 | chargement 381 ms |
| /plaquettes (6 ancres) | 0 | pas de défilement horizontal (390 px) |
| /animation-client | 0 | |
| /auth/signup (2 étapes, retour, glissement) | 0 | glissement à vide bien refusé (message affiché) |
| /auth/login | 0 | |
| /auth/reset | 0,0087 | à 4,5 s (texte d'expiration) |
| /pro/onboarding (visiteur) | 0 | |
| /cgu, /confidentialite | 0 | pas de défilement horizontal |
Ordinateur 1440x900 : CLS 0 sur signup, login, plaquettes ; 0 (valeur nulle d'un nœud texte) sur /bienvenue.

## 5. Nombre d'appuis (mesuré)
Depuis le lien reçu ou le QR (`/l/ins`) : 0 appui pour atteindre le formulaire.
Depuis /bienvenue, particulier : **5 appuis** (rôle, « Suivre le parcours », point 6 du carrousel, « Je m'inscris », « Continuer vers l'inscription ») ; **9** en tournant les pages avec la flèche.
Remplir l'inscription particulier : **8 appuis** minimum (prénom, nom, téléphone, « Continuer », e-mail, mot de passe, case CGU, « Créer mon compte »), 5 saisies de texte, plus 2 champs facultatifs (date, adresse) qui ajoutent 2 appuis. Soit **13 appuis** de /bienvenue à la fin du formulaire ; puis e-mail à confirmer, connexion (3 appuis), accueil de 3 écrans (« Passer » possible : 1 appui), carte : environ **19 appuis et un détour par la boîte mail**.
Prestataire, depuis /bienvenue : 5 appuis jusqu'à l'onboarding, puis 5 écrans (particulier) ou 6 (entreprise) avec au minimum : métier (2 appuis), tarif (type + prix + « Continuer » = 3), statut (2), adresse + téléphone (3), « Terminer » avec case CGV (2) = **12 appuis minimum**, avant d'être renvoyé à l'inscription (8 appuis), puis confirmation e-mail, connexion, et les pièces (`/pro/onboarding/documents`) : **au moins 30 appuis** avant d'être visible sur la carte, dont 12 refaits (non exécuté jusqu'au bout).

## 6. Parcours d'inscription amélioré (propositions)
**Supprimer**
- L'écran bêta intermédiaire (le texte devient 3 puces au-dessus du formulaire ou un bandeau « Version bêta, paiements non réels » sous le bouton).
- Le carrousel de 6-7 écrans comme passage obligé : il reste dispo mais le bouton « S'inscrire » doit être visible dès le premier écran.
- La roue de date de naissance de l'étape 1 (à demander plus tard, au moment du crédit d'impôt / avance immédiate).
- Le champ adresse de l'étape 1 (demandé de toute façon au moment de réserver avec présélection d'adresse).
- Le double choix « Particulier / Professionnel » en haut de l'inscription (le rôle est déjà connu quand on vient de la plaquette, et il suffit d'un lien « Je propose mes services » ensuite).

**Regrouper**
- Une seule page d'inscription en 1 écran pour le particulier : e-mail, mot de passe (avec œil), prénom, téléphone, case CGU, « Créer mon compte » = 5 appuis au lieu de 8. Nom de famille, téléphone et adresse demandés après la première connexion, au premier besoin.
- Pour le prestataire : compte (même écran, 1 appui de moins) PUIS onboarding (métier, tarif, statut, zone, texte de présentation) ; téléphone et zone fusionnés sur un seul écran, texte de présentation facultatif sans « Passer » caché.
- Un seul libellé de rôle partout (« Prestataire ») et un seul mot « e-mail ».

**Ajouter**
- Connexion ou inscription en un geste : lien magique ou « Continuer avec Google / Apple » pour supprimer la confirmation d'e-mail et le mot de passe (aujourd'hui, la confirmation par e-mail est le point où la plupart des visiteurs sortent de l'app).
- Une aide en direct pendant la saisie : format du téléphone (« 06 12 34 56 78 »), force du mot de passe, vérification de l'e-mail (« gmial.com ? »), message qui apparaît sous le champ plutôt qu'en bas.
- Un écran « Vérifiez votre boîte mail » avec bouton « Renvoyer l'e-mail », bouton « Ouvrir ma messagerie » et lien « Mauvaise adresse ? Modifier » (il n'y en a aucun aujourd'hui).
- Au retour de la confirmation : connexion automatique, puis direction `/pro/onboarding` pour un prestataire, ou l'accueil de 3 écrans pour un client, avec le `next` préservé.
- Sauvegarde automatique (`sessionStorage`) de ce qui est saisi, pour ne rien perdre en ouvrant les CGU ou en revenant en arrière.
- Un focus visible, des libellés reliés, des champs en 16 px, des cibles de 44 px, des titres d'onglet par page.
- Une vraie page 404 au lieu du prototype.

## 7. Non vérifié
- E-mail de confirmation réel, lien de confirmation, redirection après confirmation (aucune inscription réelle, conformément au brief).
- Dernier écran « Terminer » de l'onboarding prestataire et l'écran suivant : action refusée par l'environnement ; la perte de données est établie par la lecture du code uniquement.
- Écran d'accueil à 3 écrans (WelcomeCarousel) et le passage de l'inscription vers /pro/onboarding : il aurait fallu une session réelle ou simulée ; vérifié seulement dans le code (bouton « Passer » présent).
- Remplissage automatique du navigateur (attributs `autocomplete` lus : `given-name`, `family-name`, `tel`, `street-address`, `email`, `new-password`, présents ; comportement non essayé sur appareil), clavier mobile réel (le champ e-mail d'inscription n'a pas `inputMode="email"` ni `autoCapitalize="none"` contrairement à la connexion), zoom iOS (supposé d'après la taille 14 px, non testé sur iPhone).
- Mesures de CLS sur appareil réel et réseau lent (mesuré en Chromium sur une connexion rapide).
- Un test initial de remplissage a échoué une fois (délai de 30 s sans champ trouvé) sur /auth/signup avant de réussir à tous les essais suivants, sans erreur console : non reproduit, cause inconnue.

## Captures
`/home/user/nexto/docs/audit-2026-11-07/captures/` : visiteur-inscription-01 à -12 (dernier écran plaquette, écran bêta, fenêtre animation coupée, inscription étape 1 et 2, champ vide, boîte mail, connexion erreur+info, reset, inscription bureau, onboarding pro sans compte, URL inconnue = prototype).
