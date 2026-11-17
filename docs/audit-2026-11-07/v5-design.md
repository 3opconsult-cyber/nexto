# Audit v5 — fidélité du design de la maquette à l'app réelle (agent « design »)

Date : 17/11/2026. Référence : l'app en production (nexto-eta.vercel.app), le CSS `src/app/ping-ui.css`, `src/app/globals.css`, `src/app/ping-legacy.css` et les composants `src/components` (BottomTabBar, NavDrawer, Hub, DemoShell, LiveMap).
Objet : `public/maquette.html` (source `docs/audit-2026-11-07/maquette-artefact/index.html`).

## Méthode (vérifié, pas supposé)

- **App** : Playwright, viewport 390x844 (isMobile, hasTouch), connexion au compte admin, mode réglé par `localStorage.ping_mode`. **Lecture seule garantie par le script** : toute requête Supabase non GET est interceptée et neutralisée (sauf l'obtention du jeton de connexion et les RPC de lecture). Requêtes bloquées pendant l'audit : `message_reads` (marquage « lu » à l'ouverture du chat), `login_log`, `events`. Rien n'a été écrit en base.
- **Styles calculés** : `getComputedStyle` sur chaque texte et chaque boîte visible des 11 écrans, app et maquette (police réelle, taille, graisse, couleur, fond, bordure, rayon, ombre, padding, dimensions). Les valeurs ci-dessous sont mesurées, pas lues dans le code.
- **Maquette** : `window.jump(rôle, écran)` puis capture de `#screen`.
- Captures côte à côte (app à gauche, maquette à droite), 390x844 : `captures/v5-design-01.png` à `-08.png`. Les données personnelles réelles du compte admin (nom, adresse, téléphone, e-mail) sont masquées en gris sur les captures.

## Verdict

**La maquette n'est pas identique à l'app : c'est un autre système visuel.** Seules les couleurs de marque (navy #123644, teal #12B39C, gold #F2A93B, slate #4E6470, papier #F3F6F5), les libellés et la taille des libellés de la barre du bas, et le rayon des cartes (16 px) coïncident. Sur les 11 écrans comparés, **aucun** n'a la même structure : en-têtes, boutons, avatars, épingles de carte, bulles de chat, listes, écrans de connexion, couleur du bouton principal, barre du bas : tout diffère. Pour atteindre le « 100 % identique » demandé, il faut remplacer les jetons de la maquette par ceux de l'app (tableau en fin de document) et recopier 9 gabarits d'écran (en-tête blanc, en-tête navy, barre de carte, carte de connexion, rangée Hub, carte de conversation, carte de devis, épingle, feuille du bas).

**Découverte importante côté app (à trancher avant de « copier »)** : en production, **la police Quicksand n'est jamais chargée**. `layout.tsx` charge Quicksand et Inter via `next/font` sous des noms internes (`__Quicksand_01afd7`, `__Inter_176161`), mais `ping-ui.css` (`--fh:'Quicksand'`), `ping-legacy.css` et ~130 styles en ligne demandent la famille littérale `'Quicksand'` ; l'`@import` Google Fonts en tête de `ping-ui.css` est supprimé par le bundler (aucune règle `@import` dans les feuilles servies, vérifié). Mesure sur la prod : 132 textes en « Quicksand » non chargée et 108 textes en « Inter » littéral non chargé tombent sur la police système (Helvetica sur iPhone, Roboto sur Android). Seuls les textes qui héritent de la classe `font-nunito` du `<body>` (109 mesurés : barre du bas, puces, profil) sont en vrai Inter. **Tous les titres de l'app s'affichent donc en police système**, alors que la maquette affiche du vrai Quicksand. Recommandation : corriger l'app (une ligne, voir P0-1) plutôt que dégrader la maquette.

Comptage : **9 P0, 14 P1, 7 P2.**

## Notes /10 (fidélité au design de l'app, pas qualité intrinsèque de la maquette)

| Critère | Note | Pourquoi |
|---|---|---|
| Simplicité | 7 | La maquette est plus épurée que l'app (un seul gabarit d'en-tête), mais ce n'est pas ce que voit l'utilisateur réel. |
| Compréhension | 6 | Les intitulés divergent de l'app (« Missions » au lieu d'« Agenda », « Mon profil » au lieu de « Mon entreprise », « Écrire » au lieu de « Contacter », « Mes services » au lieu de « Mes tarifs ») : un testeur passant de l'une à l'autre se perd. |
| Fluidité | 6 | Pas de menu (burger + tiroir) alors que l'app en a un sur tous les écrans racine ; la bascule de mode passe par un sélecteur que l'app n'a pas. |
| Fiabilité des informations | 6 | Épingles « ★ 4,9 · vérifié » et « Identité vérifiée » partout ; l'app dit « Pièce d'identité fournie / Assurance RC renseignée ». Autorisé seulement pour une pièce validée par un admin (règle du 03/11), à n'afficher que dans ce cas. |
| Cohérence avec l'app | 2 | Structure différente sur 11 écrans sur 11 ; jetons de gris, bouton principal, avatars, bulles, épingles différents. |
| Design (identité à l'app) | 2 | Voir tableau des écarts ; seules les 5 couleurs de marque et la barre du bas sont proches. |

## Défauts

Navigation maquette : ouvrir `public/maquette.html#client` (ou `#prestataire`, `#public`), puis le bouton « Aller à » du panneau de droite. App : URL indiquée, mode via le menu.

### P0 — l'écran ne ressemble pas à l'app

**P0-1. Police des titres (toute l'app / toute la maquette).** App : titres en police système (Quicksand non chargée, voir verdict), corps en Inter réel ou système selon l'élément. Maquette : vrai Quicksand 700 + vrai Inter. Correctif recommandé **dans l'app** (`src/app/layout.tsx`, dans `<head>` du `<html>`) : `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap">` (rend valides d'un coup toutes les références littérales `'Quicksand'` et `'Inter'`), puis dans `ping-ui.css` `--fh:var(--font-quicksand),'Quicksand',system-ui,sans-serif;--fb:var(--font-inter),'Inter',system-ui,sans-serif`. Si le fondateur exige la copie de la prod telle quelle : dans la maquette, `.hd h2,.h1,.card h3,.av,.btn{font-family:system-ui,-apple-system,sans-serif}` — non recommandé.

**P0-2. Bouton principal (tous les écrans).** App : fond **#12B39C**, texte blanc, Quicksand 700 15 px, padding 14 px, hauteur 51-53 px ; **deux formes** dans l'app : rayon **14 px** (fiche ouverte sur la carte, pied de la fiche prestataire : `.btn` / `.ping-btn`) et pilule **999 px** (connexion, inscription, chat, « + Ajouter une prestation »). Secondaire : fond blanc, `box-shadow: inset 0 0 0 1.5px #E7EDEB` (ou bordure 1px #E7EDEB), texte #123644. Maquette : `--btn:#0A7D6E` (vert foncé), pilule partout, Inter 15 px, 50 px, secondaire bordé `1.5px #DCE5E3`. Correctif : `:root{--btn:#12B39C}` ; `.btn{min-height:51px;border-radius:14px;font:700 15px var(--fh);padding:14px}` ; ajouter `.btn.pill{border-radius:999px}` sur connexion, inscription, chat, tarifs ; `.btn.ghost{border:0;box-shadow:inset 0 0 0 1.5px #E7EDEB}`. Note : blanc sur #12B39C = contraste 2,6:1 (sous le seuil AA) ; c'est l'état réel de l'app, à corriger de part et d'autre si besoin, pas dans la maquette seule.

**P0-3. En-têtes (tous les écrans).** App : **trois gabarits**. (a) Barre de carte `.topbar` (/map, /pro/carte) : 56 px, fond `rgba(255,255,255,.97)`, bordure basse 1px #E7EDEB, padding 0 12px ; burger 34x34 rayon 10 fond #F3F6F5 ; logo « ping » (anneau radar 26 px + mot 19 px 700 #123644, ls .2px ; anneaux teal côté client, gold côté pro) ; pilule de mode 38 px rayon 999, 13 px 700 blanc, padding 9px 14px (« Passer en pro » fond #F2A93B / « Passer en particulier » fond #12B39C) ; bouton 38x38 rayon 11 fond #F3F6F5 bordure #E7EDEB (bulle de message côté client, cloche côté pro). (b) En-tête navy (Messages, Agenda, Mon entreprise, Mes tarifs) : fond #123644, 62 px, padding 14px 16px, burger 34 px rayon 10 fond `rgba(255,255,255,.1)` icône blanche, titre 17 px 700 blanc ; Mes tarifs : 140 px, surtitre « ESPACE PRESTATAIRE » 11 px 700 majuscules ls .44px blanc 72 %, titre 22 px ; Mon entreprise : titre 20 px + pilule teal « ● Visible sur la carte » 12 px 700, puis feuille blanche rayon 18px 18px 0 0. (c) Barre blanche (Mon profil 48 px avec burger et lien « ← Carte » teal 12,5 px 700 ; fiche prestataire 52 px avec chevron et cœur ; chat 55 px avec chevron, nom, drapeau « signaler ») : fond #fff, bordure basse 1px #E7EDEB, titre 16 px 700 #123644, icônes 34 px sans bordure. Maquette : un seul gabarit `.hd` transparent sur fond papier, titre 19 px, bouton retour 44x44 rayon 14 **bordé**. Correctif : `.hd{background:#fff;border-bottom:1px solid #E7EDEB;min-height:52px;padding:0 14px;gap:8px}.hd h2{font:700 16px var(--fh)}.hd .ib{width:34px;height:34px;border:0;border-radius:10px;background:transparent}` ; ajouter `.hd.navy{background:#123644;min-height:62px;padding:14px 16px;border:0}.hd.navy h2{color:#fff;font-size:17px}.hd.navy .ib{background:rgba(255,255,255,.1);color:#fff}` et l'appliquer à `SC.messages`, `SC.missions`, `SC.pprofile`, `SC.services` ; recréer `.topbar` (valeurs ci-dessus) en tête de `SC.map` et `SC.pmap`.

**P0-4. Menu absent.** App : burger sur tous les écrans racine → tiroir plein écran (≤480 px) : en-tête avatar 44 rayon 12 + prénom 15 px 700 + « membre depuis 2026 » 12 px 600 #4E6470, bouton fermer rond 30 px fond #F3F6F5 ; 4 entrées + « Support PING » (14,5 px 700 #123644, icône 17 px trait #4E6470, padding 13px 12px, rayon 10, actif fond #F3F6F5), séparateur 1px #E7EDEB ; en bas carte navy #123644 rayon 14 « Passer en mode pro / Proposer mes services » + interrupteur 38x22 ; côté pro, interrupteur « Disponible — visible sur la carte » en tête (fond `rgba(18,179,156,.1)`). Fond du voile `rgba(18,54,68,.45)`. Maquette : aucun burger, aucun tiroir (0 occurrence). Correctif : ajouter `SC.drawer` (calque `.overlay` aligné à gauche, fond blanc, largeur 100 %) avec ces valeurs, ouvert par le burger des en-têtes P0-3.

**P0-5. Carte : épingles et fond (#client Carte, #prestataire Carte).** App (Leaflet + tuiles OSM) : épingle = goutte 40x40 `border-radius:50% 50% 50% 0`, bordure 2px blanc, ombre `0 3px 8px rgba(18,54,68,.35)`, fond #12B39C (prestataire) ou **#F2A93B** (demande, côté pro) ; au-dessus, étiquette prix pilule fond #123644, 12 px 700 blanc, padding 5px 9px, bordure 1px blanc, ombre `0 2px 6px rgba(18,54,68,.3)` ; position de l'utilisateur 30 px #12B39C, bordure 4px blanc, ombre `0 0 0 7px rgba(18,179,156,.28), 0 3px 10px rgba(0,0,0,.3)`, info-bulle « Vous êtes ici » pilule blanche 11 px 700, padding 3px 10px ; côté pro, 2 anneaux d'écho 2px #12B39C. Maquette : pilule blanche avec avatar rond + prix + « ★ 4,9 · vérifié », fond de carte vectoriel stylisé (`--land:#EAF1EC`). Correctif : remplacer `.pin2` par `.pinp` (étiquette navy) + `.pind` (goutte) aux valeurs ci-dessus ; retirer note et « vérifié » de l'épingle ; fond de carte : image statique de tuiles OSM (ou à défaut `--land:#ECEAE3;--water:#A9D3E6;--park:#C9DEB2`).

**P0-6. Commandes flottantes de la carte client.** App : recherche `.searchbar` top 66 px, gauche/droite 14 px, rayon 16, padding 14px 16px (54 px), ombre `0 12px 28px rgba(20,50,60,.18)`, pastille 26x26 rayon 8 fond #12B39C (icône filtre blanche), texte « Filtrer par service, près de vous » 14 px 500 #4E6470 ; puces top 118 (Tous/Ménage/Repassage/Nettoyage) ; zoom Leaflet en haut à gauche (10,168) ; bouton rond **PING** 56 px dégradé `160deg #12B39C→#0C8F7E`, bordure 2,5px blanc, ombre `0 10px 26px rgba(18,179,156,.42)`, à droite bas 172 px ; « + Déposer une demande » pilule **navy #123644** 43 px, Quicksand 14 px 700, padding 11px 16px, ombre `0 8px 20px rgba(20,50,60,.25)`, à gauche bas 80 px ; recentrer 40x40 rayon 12 blanc ombre `0 8px 20px rgba(20,50,60,.2)`. Pas de liste en feuille basse au repos. Maquette : recherche « Tous les services » + bouton bascule, puces « Disponible maintenant / Ménage / … », bouton « Demander » vert foncé, zoom ronds 44 px à droite, **feuille basse avec liste** et gros bouton « Déposer une demande ». Correctif : recopier ces 6 éléments et ces positions dans `SC.map` ; supprimer la feuille basse au repos (elle n'apparaît dans l'app qu'au clic d'une épingle, P1-6).

**P0-7. Avatars (toutes les listes, fiches, chat).** App : carré arrondi, fond dégradé `linear-gradient(160deg,#14B39C,#0C8F7E)` (ou teinte du métier : repassage `#4E6470→#4C6472`, nettoyage `#F2A93B→#8A6520`), lettre Quicksand 700 blanche ; tailles : 42 px rayon 13 (messages), 44 px rayon 13 (`.row .av`), 46 px rayon 14 (fiche sur carte), 48 px rayon 14 fond #FF7A66 (profil client), 52 px rayon 15 fond blanc 18 % bordure 2px blanc 50 % (héros fiche), 64 px rayon 16 bordure 3px blanc (Mon entreprise). Maquette : **ronds** (`border-radius:50%`) en aplat de couleur. Correctif : `.av{border-radius:13px;background:linear-gradient(160deg,#14B39C,#0C8F7E)}` et rayons par taille ci-dessus ; `HUES` par métier plutôt que par personne.

**P0-8. Bulles du chat (#prestataire → Conversation).** App (`.msg`) : max 82 %, padding 9px 12px, rayon 15 px, 13 px 500 interligne 1,35 ; **les miennes fond #123644 (navy)** texte blanc, coin bas droit 5 px ; celles de l'autre fond blanc, bordure 1px #E7EDEB, coin bas gauche 5 px, texte #123644. Maquette : les miennes **teal #12B39C**, rayon 16/4, 14 px. Correctif : `.bubble{max-width:82%;padding:9px 12px;border-radius:15px;font:500 13px/1.35 var(--fb)}.bubble.me{background:#123644;border-bottom-right-radius:5px}.bubble.th{border:1px solid #E7EDEB;border-bottom-left-radius:5px}`.

**P0-9. Connexion et inscription (#public → Connexion / Inscription).** App : fond plein **#123644**, logo radar centré (anneaux teal + point vert), carte blanche marge 24 px, rayon **24**, padding 28px 26px (inscription 26px 24px), ombre `0 24px 60px rgba(0,0,0,.35)` ; titre « Connexion » 22 px 700 (« Vos informations » 21 px + « Étape 1 sur 2 » 11,5 px 700 #4E6470) ; libellés **majuscules** 11 px 700 #4E6470 ls .44px (« EMAIL », « MOT DE PASSE », inscription 10,5 px) ; champs blancs bordure 1px #E7EDEB rayon 14 (13 à l'inscription), padding 13px 14px, 50 px, œil afficher/masquer ; case « Rester connecté » ; liens 13 px 700 #0C8F7E ; bouton pilule teal 53 px Quicksand 15,5 px, ombre `0 8px 20px rgba(18,179,156,.3)` ; inscription : sélecteur « Particulier / Professionnel » sur le fond navy (conteneur `rgba(255,255,255,.1)` rayon 999 padding 4, actif #12B39C, inactif blanc 60 %, Quicksand 13 px 700), barre d'étapes 2 traits de 4 px (#12B39C / #E7EDEB), date de naissance en roulettes. Maquette : page papier ordinaire, en-tête `.hd` avec retour, libellés 13 px 600 en minuscules, bouton vert foncé. Correctif : nouveau gabarit `.auth` (valeurs ci-dessus) pour `SC.login` et `SC.signup`. (Le contenu « un seul écran » de la maquette est un choix produit ; seul l'habillage est à recopier.)

### P1 — même écran, valeurs différentes

**P1-1. Barre du bas.** App (`BottomTabBar`) : hauteur 59 px + zone sûre, fond #fff, bordure haute 1px **#DCE5E3**, ombre `0 -4px 16px rgba(18,54,68,.06)`, boutons padding 10px 0 8px, icône **21 px** trait 2, libellé 10,5 px 700, inactif #4E6470, actif **#12B39C** (particulier) / **#F2A93B** (pro), pastille non-lus rouge **#E5484D** pilule 16 px, 10 px 700 blanc (« 9+ »). Maquette : 66 px, pas d'ombre, icône 20 px, actif pro **#8A5A00**, pas de pastille. Icônes : `msg` de l'app = `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z` (maquette : variante arrondie du tiroir) ; `prof` de l'app = `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>` (maquette : r=3, plus petit). Correctif : `.tabbar{height:59px;box-shadow:0 -4px 16px rgba(18,54,68,.06);align-items:stretch}.tabbar button{padding:10px 0 8px;justify-content:flex-start;min-height:0}.tabbar svg.i{width:21px;height:21px}.tabbar.pro button.on{color:#F2A93B}` + ces deux tracés + pastille.

**P1-2. Gris et traits.** App : traits de cartes et de champs **#E7EDEB** (`--line`), barre du bas et champ du chat #DCE5E3, séparateurs de rangées Hub **#EEF2F1**, texte tertiaire (dates, mentions) **#6E8592**. Maquette : un seul `--line:#DCE5E3`, pas de tertiaire. Correctif : jetons en fin de document.

**P1-3. Mode sombre.** App : aucun. Maquette : deux blocs sombres (lignes 8-9 de `index.html`) et bouton « Thème : système » (ligne 176). Un téléphone en mode sombre voit une maquette sombre alors que l'app reste claire. Correctif : supprimer les deux blocs et le bouton, ou forcer `data-theme=light`.

**P1-4. Listes « Mon profil » (#client → Mon profil) et rubriques.** App (`Hub.tsx`) : titre de groupe 11 px 700 #4E6470 majuscules ls .04em, marge 18px 0 8px 2px (« MON ACTIVITÉ », « PAIEMENTS », …) ; conteneur blanc bordure #E7EDEB rayon 16 sans padding ; rangée padding 12px 14px, trait haut 1px #EEF2F1 ; pictogramme dans un carré 34x34 rayon 10 fond #F3F6F5, icône 16 px trait #0C8F7E ; titre 13,5 px 700 #123644 ; sous-titre 11,5 px #4E6470 sur une ligne ; chevron texte « › » #6E8592 ; badge 10,5 px 700 (ok : `rgba(18,179,156,.14)`/#0C8F7E ; à faire : `rgba(242,169,59,.16)`/#8A6520). Carte d'identité en tête (avatar #FF7A66, nom, ville, « Modifier » 12 px 700 #12B39C, Adresse/Téléphone/E-mail 13 px). Maquette : une seule carte, rangées 38 px d'icône rayon 12, titre 14 px 600, chevron SVG, barre « Profil complet à 50 % », sélecteur Particulier/Prestataire. Correctif : `.hubt{font:700 11px var(--fb);color:#4E6470;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 8px 2px}.card.hub{padding:0;overflow:hidden}.card.hub .row{padding:12px 14px;border:0;border-top:1px solid #EEF2F1;margin-top:-1px;min-height:0}.rico{width:34px;height:34px;border-radius:10px}.rico svg{width:16px;height:16px}.row b{font-weight:700;font-size:13.5px}.row small{font-size:11.5px;margin-top:2px}`, chevron « › ». Retirer le sélecteur Particulier/Prestataire (l'app ne bascule que depuis le menu et la pilule de la carte, règle du 30/10).

**P1-5. Messages (#client → Messages).** App : en-tête navy ; encart « N conversations dans votre espace … » (blanc, bordure #E7EDEB, rayon 14, cloche) ; champ « Rechercher » 44 px rayon 12 ; pilules de tri 29 px (actif navy, 11,5 px 700) ; titres de mois 11 px 700 #6E8592 majuscules ; **une carte par conversation** (blanc, bordure #E7EDEB, rayon 14, padding 12, écart 10 px), nom Quicksand 13,5 px 700, date 10,5 px 600 #6E8592, aperçu 12 px 400 #4E6470. Maquette : toutes les conversations dans une seule carte, nom Inter 14 px 600, heure 12,5 px. Correctif : un `.card` par conversation, ajouter recherche, tri, titres de mois.

**P1-6. Fiche sur la carte (#client Carte, toucher une épingle).** App (`.preview`) : feuille collée en bas, rayon **22px 22px 0 0**, padding 12px 16px 20px, ombre `0 -14px 36px rgba(20,50,60,.2)`, poignée 38x5 #E7EDEB ; avatar 46 rayon 14 ; nom 16 px 700 ; méta 11,5 px 500 #4E6470 (« Ménage · 4.7 (3) · à 0 m ») ; prix 15 px 700 à droite ; puces 10 px 600 `rgba(18,179,156,.12)`/#0C8F7E avec coche ; « ● Disponible » 12 px 600 #0C8F7E ; boutons « Contacter » (secondaire) + « Voir le profil » (principal, flex 1,3), rayon 14, 53 px. Maquette : carte flottante à 10 px des bords, rayon 20, bouton fermer, flèches précédent/suivant, « Profil / Réserver ». Correctif : `.preview{left:0;right:0;bottom:0;border-radius:22px 22px 0 0;padding:12px 16px 20px;box-shadow:0 -14px 36px rgba(20,50,60,.2)}` et contenu ci-dessus.

**P1-7. Fiche prestataire (#client → Fiche prestataire).** App : barre blanche 52 px « Profil du pro » + cœur ; **héros pleine largeur** dégradé `160deg #14B39C→#0C8F7E`, padding 16 px, avatar 52 px, nom 21 px 700 blanc, « 4.7 (3 avis) » 12 px, « ● Disponible » ; titres de section 16 px 700 ; lignes « Pièce d'identité fournie / Assurance resp. civile » (`.vrow ok` : blanc, bordure `rgba(18,179,156,.4)`, rayon 12, padding 10px 11px, icône 28 rayon 9 fond teal 12 %, titre 12,5 px 700, sous-titre 10,5 px, état « ✓ Fournie » 9,5 px 700 #12B39C) ; avertissement 10,5 px #6E8592 « … sans garantie » ; prestations en cartes `.ping-rev` (rayon 12) avec bouton « Réserver » secondaire ; pied collant blanc bordure haute #E7EDEB, « Contacter » + « Réserver · 100 € », rayon 14, 51 px. Maquette : titre « Prestataire », carte centrée avec avatar rond 65 px, « Écrire » / « Réserver », « Identité vérifiée », « 1 / 5 ». Correctif : recopier héros, `.vrow`, pied ; libellés « Profil du pro », « Contacter », « Réserver · <prix> ».

**P1-8. Conversation : devis et barre de saisie.** App : carte de devis blanche **bordure 1px #12B39C**, rayon 16, padding 16px 18px, ombre `0 4px 16px rgba(18,179,156,.12)`, pastille 22x22 rayon 7 teal 12 % + « DEVIS » 10,5 px 700 majuscules ls .05em #0C8F7E, prix Quicksand 21 px 700, boutons pilules « Refaire une proposition » (blanc, bordure #DCE5E3) / « Accepter » (teal) ; bandeau « Téléphone et e-mail restent masqués… » pleine largeur fond `rgba(18,179,156,.1)` 11,5 px 600 #0C8F7E centré ; date en pilule `rgba(18,54,68,.06)` 11 px 700 #4E6470 ; barre de saisie blanche bordure haute #E7EDEB padding 12px 16px, champ fond **#F3F6F5** bordure #DCE5E3 rayon 999, 44 px, bouton envoyer **rond 42 px #12B39C** avion blanc ; récapitulatif de la demande en carte en haut. Maquette : carte grise « Tarif proposé : Forfait 66 € » + étiquette « En attente », champ blanc, bouton envoyer carré blanc bordé. Correctif : `.card.offer{border:1px solid #12B39C;padding:16px 18px;box-shadow:0 4px 16px rgba(18,179,156,.12)}`, champ et bouton rond ci-dessus, bandeau et pilule de date.

**P1-9. Agenda (#prestataire → Missions).** App : titre « **Agenda** » en-tête navy ; encart cloche « 7 missions dans votre espace particulier » ; bandeau litige fond #FFF7ED bordure 1px #F2A93B rayon 16, pastille 36 px rayon 11 fond #F2A93B, titre 13,5 px 700, sous-titre 11,5 px #8A6520 ; carte calendrier blanche rayon 18 padding 12 : boutons ‹ › 38x32 rayon 10 bordés, « Aujourd'hui », date 15,5 px 700, sélecteur Jour/Semaine/Mois (fond #F3F6F5 rayon 11 padding 3, actif blanc rayon 9 ombre `0 1px 3px rgba(18,54,68,.15)`, 12,5 px 700), jour courant en rond teal 28 px, heures 10 px #4E6470. Maquette : titre « Missions », onglets pilule (actif gold) « En cours / Agenda / Terminées / Factures », carte de mission avec barre de progression. Correctif : titre « Agenda » ; `.seg{background:#F3F6F5;border:0;border-radius:11px;padding:3px}.seg button{border-radius:9px;min-height:31px;font-size:12.5px}.seg button.on,.seg.pro button.on{background:#fff;color:#123644;box-shadow:0 1px 3px rgba(18,54,68,.15)}`.

**P1-10. Mon entreprise (#prestataire → Mon profil).** App : titre « **Mon entreprise** » ; en-tête navy + pilule « Visible sur la carte » ; feuille blanche rayon 18 ; carte « Mon annonce · En ligne » fond `rgba(18,179,156,.06)` bordure `rgba(18,179,156,.45)` rayon 16, barre 6 px (#E3EBE9 / #12B39C) ; carte de couverture fond #F3F6F5 rayon 16 avec bandeau dégradé teal 110 px, avatar 64 px rayon 16 bordure 3px blanc, bouton « + » ; « MON ACTIVITÉ DU MOIS » ; alerte litige fond #FEE2E2 bordure #FCA5A5 rayon 14 texte #C0503A ; tuiles chiffres (blanc, #E7EDEB, rayon 14, valeur Quicksand 20 px). Maquette : titre « Mon profil », sélecteur, avatar rond centré, jauge **gold**, « Ma fiche publique / Mes services ». Correctif : titre et gabarit ci-dessus ; jauge teal.

**P1-11. Tarifs (#prestataire → Mes services).** App : en-tête navy 140 px « ESPACE PRESTATAIRE / Mes tarifs » ; « Catalogue de prix » 18 px 700 + texte 12,5 px ; « PRESTATIONS » ; une carte par prestation (blanc, #E7EDEB, rayon 14, padding 13px 14px) : nom Quicksand 14 px 700 + badge « PRINCIPAL » (10 px 700 majuscules teal 12 %/#0C8F7E), description 12 px #4E6470, prix Quicksand 16 px 700 à droite, « modifier » 11,5 px 700 #0C8F7E ; prestation sans prix en carte **pointillée** (bordure 1px dashed #B9CBC7) « + Fixer un prix » ; bouton **teal** pilule « + Ajouter une prestation ». Maquette : « Mes services », bouton **gold**, groupes par service avec boutons œil/crayon 44 px. Correctif : bouton teal ; prix à droite + lien « modifier » ; garder le regroupement par service (décision du 07/11, catalogue extensible) mais dans le gabarit de carte de l'app.

**P1-12. Carte pro (#prestataire → Carte).** App : barre de carte (logo gold, pilule teal « Passer en particulier », cloche) ; recherche 42 px padding 11px 14px, soleil gold, « Visible · demandes à moins de 15 km » 13,5 px 600 #4E6470, « Zone » 13 px 700 #F2A93B ; puces « Demandes ouvertes (5) / Mes interventions (5) » ; feuille ouverte rayon 22 avec poignée 44x5 #CBD7D4 et « Réduire » 12,5 px 700 ; « Disponible maintenant » 16 px 700 + interrupteur **gold** 44x26 ; lignes de stats 13,5 px ; cartes de demande rayon 13 padding 11, titre 13 px 700, badge **URGENT** fond #E8743B blanc 10,5 px 800, fourchette 11,5 px 700 #0C8F7E, méta « à 7,3 km · il y a 18 j ». Maquette : recherche « Zone : 15 km autour de moi », puces « Disponible / Tous / Ménage… », liste en rangées avec icônes étiquette, badge « Urgent » beige. Correctif : ces valeurs ; interrupteur `.tg{width:44px;height:26px}.tg::after{width:20px;height:20px}.tg.on{background:#F2A93B}` côté pro.

**P1-13. Puces.** App : 35 px, padding 7px 13px, 12,5 px 600, bordure 1px #E7EDEB, active fond #123644 texte blanc. Maquette : 40 px, 13 px, bordure #DCE5E3. Correctif : `.chip{min-height:35px;padding:7px 13px;font-size:12.5px;border-color:#E7EDEB}`.

**P1-14. Étiquettes d'état.** App : `.vchip`/badges 10-10,5 px 600-700, fond `rgba(18,179,156,.12)` texte #0C8F7E ; « Disponible » #0C8F7E ; attente `rgba(242,169,59,.16)`/#8A6520. Maquette : `.tag` 11,5 px, fond #E3F6F2 / #0C6F61, « Disponible maintenant » **#1A8F4C** (vert non présent dans l'app), attente #FFF1D6/#8A5A00. Correctif : `--okbg:rgba(18,179,156,.12);--oktx:#0C8F7E;--wbg:rgba(242,169,59,.16);--wtx:#8A6520;--ok:#0C8F7E` et `.tag{font-size:10.5px}`.

### P2

- **P2-1.** Fausse barre d'état « 9:41 · PING » (26 px) : l'app n'en a pas (`.status{display:none}` dans `ping-ui.css`). Correctif : `.status{display:none}` aussi dans le cadre téléphone, ou la garder neutre sans « PING ».
- **P2-2.** Bulle « Laisser un commentaire » (FeedbackBubble : pilule teal 52 px, ombre `0 8px 20px rgba(18,54,68,.35)`, en bas à droite à 660 px) visible sur tous les écrans de l'app, absente de la maquette. À ajouter si la maquette sert aux testeurs ; noter qu'elle **masque** du contenu dans l'app (bouton « Voir le profil », liste du profil, tuiles de Mon entreprise : visible sur les captures 01, 06, 07) : défaut de l'app.
- **P2-3.** Libellés divergents : « Écrire » (app : « Contacter »), « Prestataire » (« Profil du pro »), « Missions » (« Agenda »), « Mes services » (« Mes tarifs »), « Mon profil » côté pro (« Mon entreprise »), « Créer mon compte » (« Vos informations », étape 1 sur 2).
- **P2-4.** « vérifié » sur les épingles et « Identité vérifiée » sur la fiche : n'est autorisé (règle du 03/11) que si la pièce est validée par un admin ; l'app actuelle n'emploie que « fournie / renseignée ». À conditionner à `documents.status = valid`.
- **P2-5.** Zoom : l'app garde le contrôle Leaflet par défaut (carrés 30 px, « + / − » noirs en Lucida Console, bordure 2px `rgba(0,0,0,.2)`, en haut à gauche), hors charte ; la maquette a des ronds 44 px à droite, plus propres. Si « identique » : recopier le défaut Leaflet ; sinon corriger l'app.
- **P2-6.** Incohérences de l'app elle-même relevées en passant (à ne pas recopier aveuglément) : onglet « Carte » non surligné sur `/pro/[id]` ; onglet « Messages » non surligné dans le chat ; nom de l'utilisateur dans Mon profil en Inter 15 px **500** alors que tous les noms sont en Quicksand 700 ; champ du chat sans texte indicatif ; trois gabarits d'en-tête différents (P0-3) ; deux rayons de bouton (P0-2).
- **P2-7.** Interligne : l'app hérite d'un interligne 1,5 (ex. 13,5 px / 20,25 px) ; la maquette 1,45 et `normal` sur les titres. `body{line-height:1.5}`.

## Captures (app à gauche, maquette à droite, 390x844)

| Fichier | Écrans |
|---|---|
| `captures/v5-design-01.png` | Carte client, au repos et fiche ouverte |
| `captures/v5-design-02.png` | Carte pro (/pro/carte) |
| `captures/v5-design-03.png` | Fiche prestataire (/pro/[id]) |
| `captures/v5-design-04.png` | Messages (client) et Agenda (pro) |
| `captures/v5-design-05.png` | Conversation (pro) |
| `captures/v5-design-06.png` | Mon profil (client) |
| `captures/v5-design-07.png` | Mon entreprise et Tarifs (pro) |
| `captures/v5-design-08.png` | Inscription et Connexion |

## Jetons de l'app à recopier tel quel (mesurés en production le 17/11/2026)

### Couleurs

| Jeton | Valeur | Emploi mesuré |
|---|---|---|
| `--ink` / navy | `#123644` | textes principaux, en-têtes navy, puce active, bulle « moi », pilule « Déposer une demande », fond connexion |
| `--teal` | `#12B39C` | bouton principal, onglet actif particulier, liens, épingle prestataire, jour courant |
| `--tealD` | `#0C8F7E` | texte des badges et liens secondaires, prix des demandes, pictogrammes Hub |
| dégradé teal | `linear-gradient(160deg,#14B39C,#0C8F7E)` | avatars, héros fiche, bouton PING, bandeau Mon entreprise |
| `--gold` | `#F2A93B` | onglet actif pro, « Passer en pro », épingle demande, interrupteur pro, bandeau litige |
| `--amber` | `#B0873C` | pictos dorés |
| texte or | `#8A6520` | badge « à faire », sous-titre litige |
| `--coral` | `#FF7A66` | avatar profil client, point de notification |
| urgent | `#E8743B` | badge URGENT |
| rouge pastille | `#E5484D` | compteur non-lus |
| `--danger` | `#C0503A` | texte d'alerte litige (fond `#FEE2E2`, bordure `#FCA5A5`) |
| `--slate` | `#4E6470` | texte secondaire, onglets inactifs, libellés |
| tertiaire | `#6E8592` | dates, chevrons « › », mentions légales, titres de mois |
| corps foncé | `#3D5560` | description de demande dans le chat |
| `--paper` | `#F3F6F5` | fond d'écran, fond des boutons burger/cloche, carrés d'icône, champ du chat |
| carte | `#FFFFFF` | cartes, barres |
| `--line` | `#E7EDEB` | bordures de cartes, champs, en-têtes blancs |
| trait barre du bas | `#DCE5E3` | bordure haute de la barre du bas, champ du chat, bouton secondaire du devis |
| séparateur Hub | `#EEF2F1` | entre deux rangées Hub |
| piste de jauge | `#E3EBE9` | barre « Complète à 33 % » |
| poignée feuille pro | `#CBD7D4` | 44x5 |
| pointillés | `#B9CBC7` | carte « Fixer un prix » |
| `--warn-bg` | `#FFF7ED` | bandeau litige agenda |
| `--land` (carte) | `#ECEAE3` | fond sous les tuiles ; `--water #A9D3E6`, `--park #C9DEB2` |
| teintes | `rgba(18,179,156,.06/.1/.12/.14/.4/.45)` ; `rgba(242,169,59,.16)` ; `rgba(18,54,68,.06)` | fonds de badges, bandeaux, pilule de date |
| voile | `rgba(18,54,68,.45)` | derrière le tiroir |

### Polices

| Rôle | Famille | Graisse | Tailles mesurées |
|---|---|---|---|
| Titres, noms, prix, boutons | Quicksand (`--fh`) — **non chargée en prod, voir P0-1** | 700 (600 pour roulettes) | 22 (connexion, Mes tarifs), 21 (héros, prix devis), 20 (Mon entreprise, chiffres), 19 (logo, avatar), 18 (Catalogue de prix), 17 (titre navy), 16 (titres de barre blanche, sections, nom fiche), 15-15,5 (boutons), 14 (Déposer une demande, nom de prestation), 13,5 (nom en liste), 13 (pilule de mode, titre de demande), 12 (étiquette prix), 11,5 (PING), 11 (Vous êtes ici) |
| Corps | Inter (`--fb`) | 400 / 500 / 600 / 700 / 800 | 14 (recherche), 13,5 (Hub titre, stats), 13 (champs, liens), 12,5 (puces, sous-titres, segments), 12 (méta), 11,5 (sous-titre Hub, méta carte), 11 (titres de groupe majuscules, ls .04em), 10,5 (onglets, dates, libellés majuscules), 10 (badges, heures) |
| Interligne | 1,5 (hérité) | | |

### Rayons

| Valeur | Éléments |
|---|---|
| 999 px | pilules : puces, pilule de mode, Déposer une demande, boutons auth/chat/tarifs, badges, champ du chat |
| 50 % | bouton PING, envoyer (42 px), position, pastille |
| 50% 50% 50% 0 | épingle (goutte) |
| 24 px | carte de connexion / inscription |
| 22 px 22px 0 0 | feuilles du bas |
| 18 px | carte calendrier, feuille de Mon entreprise (haut) |
| 16 px | cartes, recherche, groupes Hub, carte devis, bandeau litige, couverture |
| 15 px | bulles (coin 5 px), avatar 52 |
| 14 px | boutons `.btn`, champs, cartes de conversation et de tarif, avatar 46-48 |
| 13 px | avatars 42-44, cartes de demande |
| 12 px | `.vrow`, recadrer, champ Rechercher |
| 11 px | cloche, sélecteur Jour/Semaine/Mois, pastille litige |
| 10 px | burger, carrés d'icône Hub, rangées du tiroir |
| 9 px | onglet actif du sélecteur, icône `.vrow` |
| 8 px | pastille de la recherche |

### Ombres

| Élément | Valeur |
|---|---|
| Recherche | `0 12px 28px rgba(20,50,60,.18)` |
| Feuille du bas | `0 -14px 36px rgba(20,50,60,.2)` |
| Barre du bas | `0 -4px 16px rgba(18,54,68,.06)` |
| Bouton PING | `0 10px 26px rgba(18,179,156,.42)` |
| Déposer une demande | `0 8px 20px rgba(20,50,60,.25)` |
| Recentrer | `0 8px 20px rgba(20,50,60,.2)` |
| Carte de connexion | `0 24px 60px rgba(0,0,0,.35)` |
| Bouton principal auth | `0 8px 20px rgba(18,179,156,.3)` |
| Carte de devis | `0 4px 16px rgba(18,179,156,.12)` |
| Onglet actif du sélecteur | `0 1px 3px rgba(18,54,68,.15)` |
| Bulle de commentaire | `0 8px 20px rgba(18,54,68,.35)` |
| Étiquette prix / épingle | `0 2px 6px rgba(18,54,68,.3)` / `0 3px 8px rgba(18,54,68,.35)` |
| Position | `0 0 0 7px rgba(18,179,156,.28), 0 3px 10px rgba(0,0,0,.3)` |
| Info-bulle « Vous êtes ici » | `0 2px 8px rgba(18,54,68,.2)` |
| Colonne de l'app | `0 0 40px rgba(18,54,68,.08)` |

### Hauteurs et dimensions

| Élément | Valeur |
|---|---|
| Barre de carte (topbar) | 56 px, padding 0 12px |
| Barre blanche | 48 px (profil), 52 px (fiche), 55 px (chat) ; padding 0 14px |
| En-tête navy | 62 px (Messages, Agenda), 140 px (Mes tarifs) |
| Barre du bas | 59 px + zone sûre (`--tabbar-h: calc(64px + env(safe-area-inset-bottom))` réservé), icône 21 px |
| Burger | 34x34 ; cloche / message 38x38 ; recentrer 40x40 ; bouton PING 56 ; envoyer 42 ; bulle de commentaire 52 |
| Recherche | 54 px (client), 42 px (pro) ; top 66 px ; puces top 118 px |
| Puce | 35 px |
| Pilule de mode | 38 px |
| Bouton principal | 51-53 px |
| Champ | 50 px (auth), 47 px (inscription), 44 px (recherche, chat) |
| Rangée Hub | ~59-65 px (padding 12px 14px, icône 34) |
| Carte de conversation | 68 px (padding 12, avatar 42) |
| Goutte d'épingle | 40x40, étiquette 24 px |
| Interrupteurs | 44x26 (carte pro), 38x22 (tiroir) |
| Marges latérales | 16 px (pages), 14 px (carte), 24 px (carte de connexion) |

### Bloc prêt à coller (fin du `<style>` de `maquette-artefact/index.html`)

```css
/* Alignement sur l'app en production (mesures du 17/11/2026) */
:root{--teal:#12B39C;--tealD:#0C8F7E;--navy:#123644;--ink:#123644;--gold:#F2A93B;--amber:#B0873C;--coral:#FF7A66;--orange:#E8743B;
--paper:#F3F6F5;--bg:#F3F6F5;--card:#fff;--slate:#4E6470;--muted:#6E8592;--line:#E7EDEB;--line2:#DCE5E3;--div:#EEF2F1;
--land:#ECEAE3;--water:#A9D3E6;--park:#C9DEB2;--btn:#12B39C;--onteal:#fff;--ok:#0C8F7E;--red:#C0503A;
--okbg:rgba(18,179,156,.12);--oktx:#0C8F7E;--wbg:rgba(242,169,59,.16);--wtx:#8A6520;--rbg:#FEE2E2;--rtx:#C0503A;
--fh:'Quicksand',system-ui,sans-serif;--fb:'Inter',system-ui,sans-serif}
body{line-height:1.5}
.status{display:none}
.hd{background:#fff;border-bottom:1px solid var(--line);min-height:52px;padding:0 14px;gap:8px}
.hd h2{font:700 16px var(--fh);color:var(--ink)}
.hd .ib{width:34px;height:34px;border:0;border-radius:10px;background:transparent}
.hd.navy{background:#123644;min-height:62px;padding:14px 16px;border:0}.hd.navy h2{color:#fff;font-size:17px}.hd.navy .ib{background:rgba(255,255,255,.1);color:#fff}
.btn{min-height:51px;border-radius:14px;font:700 15px var(--fh);padding:14px;background:var(--btn);color:#fff}
.btn.pill{border-radius:999px}
.btn.ghost{background:#fff;color:var(--ink);border:0;box-shadow:inset 0 0 0 1.5px var(--line)}
.btn.gold{background:var(--btn);color:#fff}
.chip{min-height:35px;padding:7px 13px;font-size:12.5px;border-color:var(--line)}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.seg{background:var(--paper);border:0;border-radius:11px;padding:3px}
.seg button{border-radius:9px;min-height:31px;font-size:12.5px;color:var(--slate)}
.seg button.on,.seg.pro button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(18,54,68,.15)}
.tag{font-size:10.5px}
.card{border-color:var(--line)}
.av{border-radius:13px;background:linear-gradient(160deg,#14B39C,#0C8F7E)!important}
.rico{width:34px;height:34px;border-radius:10px}.rico svg.i{width:16px;height:16px}
.row{border-bottom-color:var(--div)}.row b{font-weight:700;font-size:13.5px}.row small{font-size:11.5px;margin-top:2px}
.hubt{font:700 11px var(--fb);color:var(--slate);text-transform:uppercase;letter-spacing:.04em;margin:18px 0 8px 2px}
.bubble{max-width:82%;padding:9px 12px;border-radius:15px;font:500 13px/1.35 var(--fb)}
.bubble.me{background:#123644;color:#fff;border-bottom-right-radius:5px}
.bubble.th{background:#fff;border:1px solid var(--line);border-bottom-left-radius:5px}
.preview{left:0;right:0;bottom:0;border-radius:22px 22px 0 0;padding:12px 16px 20px;box-shadow:0 -14px 36px rgba(20,50,60,.2)}
.search{border-radius:16px;padding:14px 16px;min-height:54px;box-shadow:0 12px 28px rgba(20,50,60,.18);font-weight:500;color:var(--slate)}
.tabbar{height:59px;border-top-color:var(--line2);box-shadow:0 -4px 16px rgba(18,54,68,.06);align-items:stretch}
.tabbar button{padding:10px 0 8px;justify-content:flex-start;min-height:0}
.tabbar svg.i{width:21px;height:21px}
.tabbar.pro button.on{color:#F2A93B}
.tg{width:44px;height:26px}.tg::after{width:20px;height:20px}.tg.on::after{left:21px}
.field span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.field input,.field textarea,.field select{border:1px solid var(--line);border-radius:14px;padding:13px 14px;min-height:50px}
```

Plus, dans le JavaScript de la maquette : supprimer les deux blocs sombres (lignes 8-9) et le bouton `#theme` ; remplacer les tracés `msg` et `prof` de la barre du bas (P1-1) ; remplacer `.pin2` par l'épingle de l'app (P0-5) ; ajouter `.topbar`, burger, tiroir, gabarit `.auth` (P0-3, P0-4, P0-9) ; renommer les titres (P2-3).

## Ce qui n'a pas été vérifié

- Rendu sur un vrai iPhone / Android (la police de repli exacte de P0-1 est déduite des règles CSS, la mesure a été faite sous Chromium Linux).
- Version ordinateur (≥1000 px) : non comparée, la demande portait sur 390x844.
- Écrans non listés dans la demande (QR, facture, litige, onboarding pro).
