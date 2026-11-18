# Plan marketing PING — 8 semaines, avec les outils existants (18/11/2026)

Demande de Romain : « le plan avec les outils marketing (vidéo animation, e-mail, plaquette pour les pros et les
clients) ». Ce plan n'invente aucun support : il dit **quoi envoyer, à qui, quand, par quel canal, et comment lire
le résultat dans l'admin**. Il complète `/plan-marketing` (critique, cibles, accroche) et
`docs/audit-marketing-2026-10-31.md`. Résumé et modèles d'e-mails visibles dans l'admin :
`/admin` → Supports & visuels → carte « Plan marketing et modèles d'e-mails ».

Période : semaine 1 = semaine du lundi 23/11/2026, semaine 8 = semaine du 11/01/2027 (les fêtes tombent en S5-S6).

## 0. Avant le premier envoi : quatre points à trancher par Romain

1. **Séquestre montré comme actif dans les vidéos.** `/animation-client` (« paiement sous séquestre jusqu'à la fin
   de la mission ») et `/animation-prestataire` (« paiement sous séquestre ») le présentent sans réserve, et
   `/bienvenue` ouvre ces vidéos (« Voir l'animation »). Dans l'application, le paiement en ligne est **éteint** :
   règlement par virement, sur facture. Les e-mails de ce plan n'en parlent pas et disent « les paiements en ligne
   ne sont pas encore ouverts », mais ils renvoient vers ces vidéos. Options : (a) remettre « bientôt » sur l'écran
   séquestre des deux vidéos avant d'écrire à de vrais prospects (recommandé), (b) garder tel quel en assumant le
   décalage, couvert seulement par l'écran bêta de `/bienvenue`. Les plaquettes (`/plaquettes`, slides de
   `/bienvenue`) sont conformes : « Règlement par virement, sur facture ».
2. **Adresse de contact** `info@opconsult.co` (pied de chaque e-mail, plaquettes) : orthographe à confirmer.
3. **E-mails aux particuliers (RGPD, art. L34-5 du CPCE)** : un e-mail commercial à un particulier exige son accord
   préalable. L'invitation client ne part qu'à des personnes qui ont donné leur adresse pour ça (réseau personnel,
   rencontre terrain, formulaire « flash »). Aux professionnels (prestataires, entreprises), l'e-mail est permis s'il
   concerne leur métier, avec un moyen simple de refuser : chaque modèle finit par « répondez stop ».
4. **Taux de commission** : les e-mails disent « commission seulement sur les missions réalisées » sans chiffre (le
   taux est réglable sur `/admin/commission`, 17 % prestataire aujourd'hui). Le donner au téléphone, pas par écrit,
   tant qu'il peut encore bouger.

## 1. Les outils, et le lien exact à utiliser

| Outil | Pour qui | Lien à envoyer | Lien tracé (QR, e-mail) |
|---|---|---|---|
| Accueil avant-première (choix du rôle, plaquette, vidéo, écran bêta, inscription) | tous | `https://nexto-eta.vercel.app/bienvenue` (`#particulier`, `#pro`) | `/l/bv` ; e-mails `/l/epr` (pro), `/l/ecl` (client) |
| Plaquette particuliers | clients | `/plaquettes#particulier` | QR `/l/pq` |
| Plaquette prestataires | pros déjà installés | `/plaquettes#pro` | QR `/l/pqp` |
| Plaquette « Devenir prestataire » | particuliers qui veulent proposer leurs services | `/plaquettes#devenir-pro` | QR `/l/pqd` |
| Plaquette entreprises | sociétés de ménage | `/plaquettes#entreprises` | QR `/l/ent` ; e-mail `/l/eent` |
| Plaquette annonceurs | commerces locaux (S7-S8, optionnel) | `/plaquettes#annonceurs` | e-mail de contact sur le dernier écran |
| Vidéo « PING pour les particuliers » (~35 s) | clients | `/animation-client` | fin : QR `/l/ins` |
| Vidéo « PING pour les prestataires » (~45 s) | pros | `/animation-prestataire` | fin : bouton `/l/insp` |
| Tutos (après la commande, client absent) | inscrits | `/aide` | — |
| Flyers, affiche, chevalet, stickers, posts Instagram | terrain, réseaux | fichiers dans `/brand/files/` (admin, Supports imprimés) | `/l/fp`, `/l/fpr`, `/l/af`, `/l/ch`, `/l/s1`-`s4`, `/l/sp1`-`sp2`, `/l/ig`, `/l/igp` |
| Lien par prospect | DM, SMS | `/l/dm?c=<nom>` (pro), `/l/st?c=<nom>` | `utm_content` = le nom |
| Modèles d'e-mails (7) | voir §3 | `/brand/emails/<nom>.html` (+ `.txt`) | codes `epr`, `epr2`, `ecl`, `ecl2`, `eap`, `eac`, `eent` |

**Nouveaux codes créés pour les e-mails** (`src/app/l/[code]/route.ts`, `utm_source=email`) :

| Code | Destination | `utm_medium` / `utm_content` | Utilisé par |
|---|---|---|---|
| `epr` | `/bienvenue#pro` | prospection / email_prospection_pro | prospection-prestataire |
| `epr2` | `/pro/onboarding` (inscription prestataire puis assistant) | relance / email_relance_pro | relance-prestataire |
| `ecl` | `/bienvenue#particulier` | invitation / email_invitation_client | invitation-client |
| `ecl2` | `/auth/signup` | relance / email_relance_client | relance-client |
| `eap` | `/pro/dashboard` (Mon entreprise) | accueil / email_apres_inscription_pro | apres-inscription-prestataire |
| `eac` | `/map` | accueil / email_apres_inscription_client | apres-inscription-client |
| `eent` | `/plaquettes#entreprises` | b2b / email_entreprises | entreprises |

Un lien par prospect reste possible : `/l/epr?c=epr_dupont` (le `c` remplace `utm_content` ; garder le préfixe du
modèle pour savoir quel e-mail a marché).

**Correctif fait avec ce plan** : `/bienvenue` perdait l'origine. La page est statique, et son bouton « Continuer
vers l'inscription » passait par `/l/ins` ou `/l/insp`, qui réécrivent les UTM (source « animation » /
« plaquette ») : une inscription venue d'un e-mail ou de `/l/bv` n'était jamais comptée comme telle. La page garde
maintenant les UTM d'arrivée pour la session et les porte jusqu'à l'inscription (`/auth/signup?utm_…` ou
`/pro/onboarding?utm_…`). Sans UTM, rien ne change. Source : `brand/plaquettes/build_bienvenue.py`.

## 2. Lire les résultats dans l'admin

- **Prospection → Leads entrants / Performance par canal** : inscriptions réellement attribuées, par `utm_source`
  (email, flyer, sticker, instagram, prospection…) et par support. C'est l'indicateur principal de chaque action.
- **`/admin/parcours`** : pour chaque inscrit, sa source (`utm_source · utm_medium · utm_content`) puis ce qu'il a
  fait dans l'application.
- **`/admin/visites`** : une ligne par visite (temps passé, pages vues, commentaires de la bulle verte). Les
  e-mails « après l'inscription » (`eap`, `eac`) s'y voient : l'URL d'arrivée porte `utm_content=email_apres_…`.
- **Conformité (KYC)** : pièces déposées et validées (passage à « profil vérifié par PING »).
- **Activité & annonces**, **Transactions** : demandes déposées, missions confirmées.
- **Campagnes & QR** : liste des supports et de leurs QR. Les lignes marquées « exemple » sont des illustrations
  (chiffres non réels), laissées en place pour le moment.

Limite connue : un clic sur `/l/<code>` n'est pas enregistré en tant que tel, ni une visite de `/bienvenue`,
`/plaquettes` ou des vidéos (pages statiques). On ne mesure donc que ce qui mène à une inscription ou à une visite
de l'application. Pour compter les ouvertures d'un e-mail, noter à la main le nombre d'envois (tableur ou cahier
des actions de Prospection) et comparer aux inscriptions.

## 3. Les modèles d'e-mails

Fichiers : `public/brand/emails/<nom>.html` (aperçu, à copier-coller dans la messagerie) et `<nom>.txt` (version
texte). Source unique : `brand/emails/build.py` (régénérer : `python3 brand/emails/build.py`). Remplacer
`[Prénom]`, `[Ville]`, `[Votre prénom]` avant l'envoi. Envoi **un par un, depuis la boîte de Romain** (personnalisé,
jamais en masse) : pas d'outil d'e-mailing payant à ce stade. La clé Resend de l'application sert aux
notifications de mission, pas à la prospection.

| Modèle | Objet | Quand | Lien tracé |
|---|---|---|---|
| `prospection-prestataire` | Des clients près de chez vous, sans démarchage | J0, premier contact pro | `/l/epr` + vidéo prestataires |
| `relance-prestataire` | PING : votre place à [Ville] | J+4 si pas de réponse, une seule fois | `/l/epr2` |
| `invitation-client` | Je vous invite à tester PING en avant-première | J0, personne qui a donné son accord | `/l/ecl` + vidéo particuliers |
| `relance-client` | Votre accès à PING vous attend | J+5 si pas inscrit, une seule fois | `/l/ecl2` |
| `apres-inscription-prestataire` | Bienvenue sur PING : trois réglages pour être visible | J+1 après l'inscription | `/l/eap` + liens tarifs, disponibilités, pièces |
| `apres-inscription-client` | Bienvenue sur PING : votre première demande | J+1 après l'inscription | `/l/eac` + dépôt de demande |
| `entreprises` | Vos équipes visibles auprès des clients de [Ville] | J0 B2B, puis appel J+3 | `/l/eent` |

Cadence par prospect (reprise de Prospection → Plan & messages) : J0 e-mail ou DM, J+4 relance, J+7 appel ou
passage, puis on arrête. Les inscrits repérés dans `/admin/parcours` reçoivent l'e-mail « après l'inscription » le
lendemain ; un pro qui n'a ni tarif ni pièce à J+7 reçoit un appel.

## 4. Plan semaine par semaine

Principe conservé : **les prestataires d'abord** ; on n'ouvre la demande des particuliers que quand la carte montre
des prestataires dans la zone visée (Grasse puis communes voisines). Objectifs indicatifs, à ajuster en fin de S4.

| Semaine | Prestataires | Clients particuliers | Entreprises / annonceurs | Objectif de fin de semaine |
|---|---|---|---|---|
| S1 (23/11) | Liste de 60 pros (annuaires publics, SIRENE, réseau). 8 e-mails `prospection-prestataire` par jour ouvré, appel des pros qui répondent | 15 proches testeurs : `invitation-client` (`/l/ecl`) ou texte d'invitation de l'admin (`/l/bv`) | — | 40 pros contactés, 10 inscrits, 15 testeurs |
| S2 (30/11) | Relances J+4 (`relance-prestataire`), `apres-inscription-prestataire` à chaque inscrit, validation des pièces dans Conformité | Lecture des retours (bulle verte, `/admin/visites`), corrections | — | 20 pros inscrits, 10 profils complets (tarifs + pièces) |
| S3 (07/12) | Terrain : flyer pro (`/l/fpr`), stickers `sp1`/`sp2` (salon pro, fournisseurs), vidéo prestataires envoyée en DM (`/l/dm?c=`) | — | 10 e-mails `entreprises` (`/l/eent`), appel J+3, rendez-vous de 15 min | 30 pros inscrits, 2 entreprises en essai |
| S4 (14/12) | Relances téléphone des profils incomplets (`/admin/parcours`) | Ouverture d'un premier quartier dense : stickers `s1`-`s4` (commerce, immeuble, laverie, marché), affiche `/l/af`, chevalet `/l/ch` | Suivi des essais entreprises | Carte pleine sur la zone 1 ; 30 clients inscrits. **Bilan à mi-parcours** |
| S5 (21/12) | Message aux pros inscrits : « passez Disponible » avant les fêtes (téléphone, SMS) | Thème « grand ménage avant les fêtes » : posts `/l/ig`, groupes de quartier (lien `/l/bv`), flyer `/l/fp` chez les commerçants partenaires | — | 10 premières demandes déposées |
| S6 (28/12) | Pause prospection (fêtes) ; validation des pièces en attente | `apres-inscription-client` aux inscrits sans demande ; relances `relance-client` | — | Taux « inscrit → demande » mesuré |
| S7 (04/01) | Deuxième vague : 40 nouveaux pros, zone 2 | Zone 2 : stickers et affiche, invitation des contacts terrain qui ont donné leur e-mail | Optionnel : 5 commerces locaux, plaquette `/plaquettes#annonceurs` | 50 pros inscrits, 100 clients inscrits |
| S8 (11/01) | Avis croisés : demander aux pros ayant fini une mission d'inviter leurs clients habituels (parrainage `/client/parrainage`) | Relance des inscrits inactifs | — | **Bilan final** : quel canal continuer, lequel arrêter |

## 5. Détail des actions

| # | Action | Cible | Outil (lien) | Message | Canal | Fréquence | Indicateur dans l'admin | Coût | Qui |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Prospection e-mail pros | Prestataires installés | `prospection-prestataire` → `/l/epr` (`/bienvenue#pro`), vidéo `/animation-prestataire` | « Des clients près de chez vous, sans démarchage. Vous fixez vos tarifs, la facture se fait toute seule. » | E-mail personnel | 8 par jour ouvré, S1-S3 puis S7 | Performance par canal : `email` / `email_prospection_pro` | 0 € | Romain envoie ; Claude tient les modèles |
| 2 | Relance pros | Pros sans réponse | `relance-prestataire` → `/l/epr2` | « Les premiers inscrits sont les premiers vus. Cinq minutes. » | E-mail | Une fois, J+4 | `email_relance_pro` | 0 € | Romain |
| 3 | Appel / passage | Pros ayant répondu ou relancés | Plaquette `/plaquettes#pro` à l'écran, QR `/l/pqp` à scanner | Démo de 5 minutes : carte, tarifs, QR, facture | Téléphone, terrain | J+7 | `plaquette_pro`, `inscription_pro` | Déplacements | Romain |
| 4 | Accueil des pros inscrits | Nouveaux pros | `apres-inscription-prestataire` → `/l/eap`, `/aide` | « Trois réglages pour être visible : tarifs, disponibilités, pièces. » | E-mail | J+1 de chaque inscription | `/admin/visites` (`email_apres_inscription_pro`), Conformité (pièces) | 0 € | Romain ; validation des pièces par l'admin |
| 5 | Terrain pros | Pros de passage (fournisseurs, salons) | Flyer pro `/l/fpr`, stickers `/l/sp1`, `/l/sp2` | « Recevez un ping. Le reste, c'est nous. » | Impression | S3, S7 | `flyer_a5_pro`, `chantier`, `salon_pro` | ~60 € (300 flyers A5 + 1 planche stickers) | Romain |
| 6 | Entreprises de ménage | Sociétés avec salariés | `entreprises` → `/l/eent` (`/plaquettes#entreprises`) | « Vos équipes visibles, votre planning ne change pas. » | E-mail puis appel | 10 en S3, suivi S4 | `email_entreprises`, `plaquette_entreprises` | 0 € | Romain |
| 7 | Testeurs proches | Réseau personnel | `invitation-client` → `/l/ecl`, ou texte d'invitation de l'admin (`/bienvenue`) | « Testez en avant-première, votre avis compte (bulle verte). » | E-mail, WhatsApp | S1, une fois | `email_invitation_client`, `bienvenue` ; retours dans « Retours des testeurs » | 0 € | Romain |
| 8 | Ouverture d'un quartier | Particuliers de la zone 1 puis 2 | Stickers `/l/s1`-`s4`, affiche `/l/af`, chevalet `/l/ch`, flyer `/l/fp` | « Et si ce que vous cherchiez était juste à côté ? » | Impression, commerces | S4-S5, S7 | `commerce`, `immeuble`, `laverie`, `marche`, `affiche_a4`, `chevalet_a5`, `flyer_a5_part` | ~80 € par zone (affiches, 300 flyers, stickers) | Romain colle et dépose ; noter les emplacements réels (renommer le `content` du code) |
| 9 | Réseaux sociaux | Particuliers | Posts `/l/ig`, vidéo `/animation-client` (MP4 à générer), lien `/l/bv` | « Envoyez un ping. Quelqu'un est déjà là. » | Instagram, groupes de quartier | 2 posts par semaine S5-S8 | `post_part`, `bienvenue` | 0 € (option : 5 €/jour de publicité géociblée en S5, à décider) | Romain publie |
| 10 | Relance clients | Contacts sans compte | `relance-client` → `/l/ecl2` | « Votre accès vous attend. Deux étapes. » | E-mail | Une fois, J+5 | `email_relance_client` | 0 € | Romain |
| 11 | Accueil des clients inscrits | Nouveaux clients sans demande | `apres-inscription-client` → `/l/eac` | « Contactez un prestataire ou déposez une demande. » | E-mail | J+1 de chaque inscription | `/admin/visites` (`email_apres_inscription_client`), Activité & annonces | 0 € | Romain |
| 12 | Bilan | Tous | Admin : Performance par canal, `/admin/parcours`, Conformité, Activité | Garder les 2 canaux qui ramènent le plus d'inscriptions complètes, arrêter le reste | — | Fin S4, fin S8 | Coût par inscription (dépenses saisies dans l'admin) | 0 € | Romain, avec Claude pour la lecture |

Budget total indicatif sur 8 semaines : **150 à 250 €** d'impression (deux zones), hors publicité optionnelle
(~35 € pour une semaine à 5 €/jour). Aucun abonnement.

## 6. Ce qui reste à faire (hors de ce plan, à décider)

- MP4 des vidéos `/animation-client` et `/animation-prestataire` : pas encore générés (procédure en tête de
  `brand/anim-presentation/build.py`) ; nécessaires pour publier sur les réseaux.
- Compter les clics `/l/<code>` (aujourd'hui seule l'inscription est mesurée) : écrire un événement dans `events`
  depuis la route, après vérification que l'insertion anonyme est ouverte (migration `015_suivi_anonyme.sql`).
- Plaquette entreprises : la phrase « chaque salarié en mission devient un point PING » peut se lire comme un suivi
  de position ; la carte ne montre que la zone déclarée. À reformuler si un prospect pose la question.
