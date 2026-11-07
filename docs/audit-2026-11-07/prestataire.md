# Audit PING, espace prestataire (07/11/2026, lecture seule)

Méthode : Playwright sur la prod, compte du brief en mode pro, mobile 390x844 et ordinateur 1440x900, géolocalisation simulée sur Nice (et un passage sans géolocalisation). Rien n'a été écrit en base : aucun envoi, aucun interrupteur basculé, onboarding arrêté avant « Terminer ». Je distingue VÉRIFIÉ (mesuré ou vu) de SUPPOSÉ.

## 1. Verdict
L'espace prestataire est cohérent et riche, mais la carte des demandes ne montre aucune épingle à l'ouverture, un bouton clé est caché sur ordinateur, une fenêtre d'installation masque l'écran sur mobile, et plusieurs textes se contredisent (séquestre « Bientôt », commission « retenue » alors que tout passe par virement).

## 2. Notes /10
- Design : 8. Cohérent avec la charte (non critiquée) ; défauts de superposition : bulle de commentaire, titre « Zone couverte » masqué, bouton « Passer en particulier » caché sur ordinateur.
- Ergonomie : 6. Carte sans épingles visibles, cibles tactiles de 19 à 34 px (Zone, Compléter, Photo/Fichier, burger, + et −), champ entreprise sans libellé.
- Fluidité : 7. Volets Réduire / Zone s'ouvrent et se ferment correctement (testés 3 fois) ; compteurs qui passent de (0) à (7) après 1 à 3 s sans état de chargement ; fenêtre d'installation à chaque page.
- Compréhension : 6. Bandeaux « N missions dans votre espace particulier » ambigus, CGV qui décrivent un autre modèle de paiement que l'écran Versements, « Entreprise de romain · Particulier ».
- Fonctionnel : 7. Tous les boutons testés agissent (Zone, rayon, onglets, fiche, retour, burger, onboarding) ; deux boutons doublons ; demandes périmées toujours proposées.
- Données : 6. Dashboard « 9 demandes près de vous » contre carte « 7 » au même moment ; chip « Mes interventions (5) » contre volet « 2 interventions » ; demandes « Exemple — … » et « (Donnée fictive de démonstration) » visibles.
- Homogénéité des textes : 6. « Bientôt » sur le séquestre, 4.5 / 4,5, « Passer en particulier » / « Revenir en mode particulier », « Entreprise » / « Mon entreprise », « Mon entreprise » en double.
- Accessibilité : 5. Zone, interrupteur de disponibilité, onglets : des div cliquables sans rôle ni clavier ; cibles sous 44 px ; champs sans libellé (entreprise, message du chat).
- Technique : 7. Un 406 Supabase à chaque connexion ; un ChunkLoadError 404 vu une fois sur /agenda (non reproduit) ; sinon aucune erreur console.

## 3. Écrans parcourus
1. Carte des demandes /pro/carte : mobile + ordinateur (Zone, rayon, onglets, volet Réduire, fiche demande, annonce personnelle, Mes interventions)
2. Mon entreprise /pro/dashboard : mobile + ordinateur
3. Mes tarifs /pro/tarifs : mobile + ordinateur
4. Mes revenus /pro/revenus : mobile + ordinateur
5. Mes versements /pro/paiements : mobile + ordinateur
6. Mes disponibilités /pro/disponibilites : mobile + ordinateur
7. Mes pièces /pro/documents : mobile + ordinateur
8. Mon annonce /pro/annonce : mobile + ordinateur
9. Attente /pro/attente : mobile + ordinateur
10. Onboarding /pro/onboarding, étapes 1 à 5 (parcours particulier) et 1 à 4 (parcours professionnel) : mobile ; /pro/onboarding/documents (étape 1 sur 3) : mobile
11. Messages /messages : mobile + ordinateur
12. Chat d'une mission /mission/<id>/chat : ordinateur (lecture)
13. Agenda /agenda : mobile + ordinateur
14. Litiges /litiges : mobile + ordinateur
15. Mes opérations /documents : mobile + ordinateur
16. Comment ça marche /aide : mobile + ordinateur
17. Menu burger (mobile) et sidebar (ordinateur), barre du bas en mode pro
18. Comparaison avec /client/profil (mode particulier, mobile)

## 4. Erreurs et bugs

**P0** : aucun bloquant.

**P1-1. Carte : aucune demande visible à l'ouverture.**
Écran : /pro/carte, mobile et ordinateur, avec ou sans géolocalisation. Les demandes sont à 11-13 km, la carte s'ouvre en zoom 15 (quartier) sans cadrer les épingles ; la fiche d'une demande ne recentre pas non plus. Le pro voit une carte vide alors que le volet annonce 7 demandes. Preuve : captures 02 et 04 (aucune épingle, aucun prix) ; mesure : 7 demandes entre 11,1 et 12,7 km. Fichier : src/components/LiveMap.tsx l.64-67 (`map.setView([userPos...], 15)`). Correctif : cadrer la carte sur l'ensemble des épingles (fitBounds) et recentrer sur la demande sélectionnée.

**P1-2. Ordinateur : bouton « Passer en particulier » et cloche cachés par le panneau.**
Écran : /pro/carte, 1440x900. Le bouton (x 1216, y 9, 156x38) est recouvert par le panneau « Votre activité » ; seule une bande verte dépasse. La bascule reste possible via la sidebar (« Revenir en mode particulier »). Preuve : capture 02. Fichier : src/app/pro/carte/page.tsx (`.procarte-topbar` / `.detail-panel`) et src/app/ping-ui.css. Correctif : placer le panneau sous la barre du haut (top ≥ 56 px) ou masquer la pilule sur ordinateur.

**P1-3. Fenêtre « Installer le raccourci PING » sur chaque page à barre du bas.**
Écran : /pro/carte, /pro/dashboard, /messages, /agenda, mobile et ordinateur, tant qu'on ne clique pas « Plus tard ». Elle recouvre environ 45 % de l'écran mobile dès l'arrivée, avant tout contenu. Preuve : captures 01 et 11 (la fenêtre revient à chaque chargement dans un même contexte ; SUPPOSÉ : après « Plus tard » elle se tait, non testé pour ne rien stocker). Fichier : src/components/InstallPrompt.tsx. Correctif : ne l'afficher qu'après une première action utile et en bandeau discret, pas en feuille plein bas.

**P1-4. Vocabulaire interdit : « Bientôt » sur le séquestre.**
Écran : /pro/paiements (ordinateur), carte « Paiement en ligne sous séquestre » avec pastille « Bientôt ». Preuve : capture 08. Fichier : src/app/pro/paiements/page.tsx l.175. Correctif : retirer la pastille ou reformuler sans « bientôt » (règle CLAUDE.md du 03/11).

**P1-5. CGV de l'onboarding en contradiction avec le modèle de paiement.**
Écran : /pro/onboarding, dernière étape : « commission PING retenue sur mes versements, prélèvement SEPA des commissions non retenues ». Or /pro/paiements dit « votre client vous règle par virement, PING ne touche pas à cet argent » et la commission se vire à PING. Preuve : capture 09 et texte /pro/paiements. Fichier : src/app/pro/onboarding/page.tsx ~l.197-200. Correctif : aligner la phrase sur le virement (le prestataire règle sa commission à PING sur facture) tant que le séquestre n'est pas actif.

**P1-6. Demandes périmées ou de démonstration proposées aux prestataires.**
Écran : /pro/carte (liste et fiche). Demandes « il y a 52 j » (Ménage, Repassage), date souhaitée « vendredi 30 octobre » déjà passée, titres « Exemple — Ménage de bureaux… » et description « (Donnée fictive de démonstration) » vues par tout prestataire. Preuve : capture 04 et liste de 7 demandes. Cause supposée : aucune expiration des `requests` ouvertes ; données fictives non filtrées par `fictif` dans `requests_nearby`. Correctif : masquer les demandes dont la date est passée ou de plus de 30 jours, et exclure `fictif=true` en production.

**P1-7. Champ « Votre entreprise » sans libellé ni indication, bouton bloqué sans explication.**
Écran : /pro/onboarding, étape 4 sur 6 (parcours professionnel). Le champ de recherche du nom est vide, sans placeholder ; « Continuer » reste grisé sans message ; même constat à l'étape « Où intervenez-vous ? » où il faut cocher « Je confirme… » pour activer Continuer, sans indication. Preuve : capture 05 ; inputs lus : placeholder vide. Fichier : src/app/pro/onboarding/page.tsx l.318-322 (input sans placeholder). Correctif : ajouter placeholder « Nom de votre entreprise ou SIRET » et une phrase d'aide sous le bouton grisé.

**P2-1. Parcours d'inscription prestataire : nombre d'écrans.** Mesuré : particulier 5 étapes + 3 pour les pièces = 8 écrans ; professionnel 6 + 3 = 9, soit environ 9 à 14 appuis avant la fin (hors saisie), après les 2 étapes de création de compte et l'e-mail. Le total passe de « sur 5 » à « sur 6 » après l'étape 3 (« Vous êtes… »), le compteur bouge en cours de route. La question particulier/professionnel arrive après les tarifs. Fichier : src/app/pro/onboarding/page.tsx. Correctif : poser « Vous êtes… » en premier, fixer le total dès l'étape 1, fusionner téléphone et position.

**P2-2. Deux boutons identiques.** Dernière étape : « Terminer » et « Passer et terminer » appellent tous deux `finish()` (page.tsx l.409). Pièces (/pro/onboarding/documents) : « Continuer sans ce document » et « Passer, je le ferai plus tard » font la même chose (documents/page.tsx l.98-100). Correctif : garder un seul bouton.

**P2-3. Compteurs incohérents.** (a) Dashboard « 9 demandes près de vous » contre carte « Demandes ouvertes (7) » au même moment (le centre et le rayon diffèrent : position de l'appareil contre profil ; SUPPOSÉ). (b) Mobile, vue Mes interventions : chip « Mes interventions (5) » et volet « 2 interventions · afficher la liste » (carte page.tsx l.397 ne compte que les missions à venir, pas les terminées). (c) Pendant le chargement les chips affichent (0) puis (7) après 1 à 3 s, sans indicateur. Correctif : même source et même libellé, état « chargement » sur les chips.

**P2-4. Libellés pas alignés entre menus et espaces.** Barre du bas « Entreprise » / burger et sidebar « Mon entreprise » ; pilule « Passer en particulier » / menu « Revenir en mode particulier » ; page « Mon entreprise » contenant une rubrique « Mon entreprise » ; pro à 5 rubriques (Mon activité, Prix et revenus, Paiements et fiscalité, Mon entreprise, Plus) contre 4 côté particulier (Mon activité, Paiements, Mon compte, Plus) ; en-tête « Mon entreprise » avec « Entreprise de romain · Particulier » pour un prestataire particulier. Preuve : capture 12, texte du dashboard. Fichiers : src/components/BottomTabBar.tsx l.41, NavDrawer.tsx, ModeSwitchPill.tsx, src/app/pro/dashboard/page.tsx. Correctif : « Mon entreprise » partout ; une seule formulation de bascule ; nom d'affichage sans « Entreprise de » pour un particulier.

**P2-5. Superpositions.** La bulle « Laisser un commentaire » recouvre le bouton de recentrage de la carte (mobile, capture 03), le texte de la fiche demande (capture 04) et la dernière case de « Mon annonce » (capture 07) ; sur ordinateur elle masque le bas de la liste. Le titre « Zone couverte » est caché derrière les chips quand le volet Zone est ouvert (capture 03 ; carte page.tsx l.337 top 118 contre chips top 122). Correctif : remonter ou masquer la bulle sur ces écrans, décaler le volet Zone sous les chips.

**P2-6. Cibles tactiles sous 44 px (mobile).** Zone (lien de texte), + et − de la carte (30x30), bouton menu (34x34), « Compléter » (64x19), Photo et Fichier (76x31), Jour/Semaine/Mois (31), Précédent/Suivant (38x32), « Retour à Mon entreprise » (32x32). Mesure : script getBoundingClientRect. Correctif : min-height 44 px.

**P2-7. Accessibilité.** Zone, interrupteur Disponible, chips, cartes de demande sont des div avec onClick, sans rôle bouton ni focus clavier (carte page.tsx l.229, 333, 358). Champ de saisie du chat sans placeholder ni libellé (capture 10).

**P2-8. Bandeau « N missions dans votre espace particulier. Passez-y depuis le menu. »** (Messages, Agenda, Litiges, Opérations en mode pro) : le nombre (7) ne correspond pas à la liste affichée juste dessous (6 conversations, missions « Audit C. »), et la phrase ne dit pas pourquoi elles sont dans l'autre espace. Correctif : « 7 conversations vous attendent côté particulier », avec lien direct.

**P2-9. Finitions de texte.** Note « 4.5 » (point) sur /pro/revenus contre « 4,5 » sur le dashboard ; pièces : /pro/attente liste « Diplôme ou qualification » alors que /pro/documents propose Identité / Assurances / Statut de l'entreprise ; « Mon annonce » : pastille verte mal alignée avec le titre (capture 07) ; crochets « (Litige fictif) », « (Donnée fictive de démonstration) » dans l'agenda, les litiges et le chat (compte fondateur, probablement attendu).

**P2-10. Technique.** Requête `profiles?select=is_admin,is_pro` renvoie 406 à chaque connexion (single() sans ligne ; visible sur login). ChunkLoadError 404 sur /_next/static/chunks/app/agenda/page-65176f722480a653.js, vu une fois sur ordinateur, non reproduit au passage suivant (SUPPOSÉ : déploiement Vercel en cours).

**Vérifié sans défaut** : volet du bas Réduire / afficher la liste (3 aller-retours OK, 66 px replié, 591 px ouvert) ; volet Zone (ouvre, ferme au second appui, rayons 5-50 km) ; onglets Demandes ouvertes / Mes interventions ; fiche demande avec flèche retour et son annonce personnelle sans bouton Contacter (message explicatif) ; menu burger complet ; sidebar ordinateur ; aucun emoji coloré (seulement ✓ ★ tolérés) ; aucun « certifié », « garanti » ni marque tierce ; pas de débordement horizontal sur 14 écrans x 2 formats.

## 5. Non vérifié
- Basculer « Disponible maintenant », envoyer « Contacter le client », envoyer un message, enregistrer IBAN/SAP/tarifs/pièces, « Terminer » de l'onboarding : écritures interdites.
- Recherche d'entreprise par SIRET (étape entreprise) et envoi de pièces : demandent d'écrire ; Continuer reste grisé sans saisie.
- Persistance de « Plus tard » de la fenêtre d'installation et rendu réel sur iPhone/Android (émulation Chromium).
- Géolocalisation réelle (simulée sur Nice) ; la position déclarée du compte est à Vence.
- Bouton du point de géolocalisation (recentrage) : présent, non pu cliqué proprement car recouvert par la bulle (voir P2-5), comportement non mesuré.
- Prestataire avec pièces validées (« profil vérifié par PING »), mission payée (adresse visible), états vides d'un compte neuf : le compte du fondateur ne les expose pas.
- Base de données : aucun accès SQL utilisé.

## Captures (docs/audit-2026-11-07/captures/)
01 carte mobile + fenêtre d'installation · 02 carte ordinateur, pas d'épingles, bouton caché · 03 volet Zone, titre masqué, bulle sur recentrage · 04 fiche demande, bulle sur le texte · 05 onboarding entreprise, champ vide · 06 menu burger · 07 Mon annonce · 08 Mes versements, séquestre « Bientôt » · 09 onboarding dernière étape (CGV, deux boutons) · 10 chat ordinateur · 11 agenda mobile + fenêtre d'installation · 12 Mon entreprise
