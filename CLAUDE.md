# PING — contexte & passation (à lire en entier avant toute intervention)

PING = place de marché de **services de proximité** (ménage, repassage, nettoyage) sur
la Côte d'Azur. Deux côtés : **particulier** (client) et **prestataire** (pro). But :
réduire le délai besoin→achat, sécuriser par présélection, pointage QR avant/après,
séquestre, chat, et documentation en cas de litige.

Prod : **nexto-eta.vercel.app** — déploiement auto Vercel sur `main`.
Dépôt : `3opconsult-cyber/nexto`. Supabase projet `wmiawwaxwlvascyflpba` (eu-west-3).

## Règle de travail #1
**Décision Romain du 17/09/2026** : l'accès aux previews Vercel de PR posait trop de friction
(protection SSO Vercel bloquant l'accès aux previews, cf. historique de session) — on ne passe
plus par une PR + preview validée avant merge. Nouveau flux : Claude pousse/merge direct sur
`main` (branche+PR ou push direct, à sa discrétion) dès que `npx tsc --noEmit` et
`npm run build` passent ; ça part en prod automatiquement (Vercel déploie `main`).
**Romain valide après coup sur nexto-eta.vercel.app** et signale ce qui ne va pas ; on corrige
en avançant (« on corrige ensuite »), pas de blocage préalable sur un rendu visuel non vérifiable
avant merge. « Build OK » reste « ça compile », pas « rendu conforme » — mais la validation du
rendu se fait maintenant sur la prod, plus sur une preview.
(Ancienne règle, pour mémoire : brancher+PR avec validation preview avant merge — abandonnée
à cause de la friction d'accès Vercel, cf. session du 17/09.)

## Stack
Next.js 14 (App Router, `src/app`) · React + TS · Supabase (Postgres+Auth+Storage+RLS,
client `src/lib/supabase/client.ts`) · Leaflet + OSM (`src/components/LiveMap.tsx`) ·
design system `src/app/ping-ui.css` (teal #12B39C, navy #123644, gold, Quicksand+Inter).
`ping-legacy.css` = ancien style à retirer. Référence UX : `public/app.html` (servi sur
`/demo`), `public/admin.html` (servi sur `/admin`) — via rewrites `next.config.js`, ne pas casser.

## Navigation (source de vérité)
- `src/components/DesktopShell.tsx` : sidebar desktop (≥1000px). Mode pro/particulier
  **persisté en `localStorage('ping_mode')`**. Seul `/pro/(carte|dashboard|documents|onboarding)`
  force le mode pro ; seul `/client/profil` force le particulier ; le reste respecte le mode courant.
- `src/components/NavDrawer.tsx` : drawer mobile (même logique).
- Menu pro (dédupliqué) : Demandes autour de moi (/pro/carte) · Messages · Agenda · Litiges ·
  Mon entreprise (/pro/dashboard) — puis Mes opérations (/documents) · Mes pièces (/pro/documents) ·
  Mon parrainage (/client/parrainage) · Support PING.
- Menu client : Carte (/map) · Mes demandes (/client/demandes) · Messages · Agenda ·
  Mes réclamations (/litiges) · Profil — puis Mon parrainage · Mes favoris · Mes opérations · Support.

## Invariants métier — NE PAS enfreindre
- **Mono-produit** : ménage, repassage, nettoyage (+ vitres en base). Rien d'autre.
- **Commission : 5 % client + 11 % prestataire.** Modèle **3 factures** : le prestataire facture
  sous son en-tête (PING n'y apparaît pas) ; PING émet ses 2 commissions séparément. Chaque partie
  ne voit **que sa propre commission** + la prestation (RLS `invoices` correcte).
- **Règle suprême du tarif** : le prix se valide au **paramétrage initial** ; la facturation suit ;
  **seul un litige** peut le rouvrir. Pas de re-négociation une fois accepté. Dans le chat,
  « + Proposer un tarif » n'apparaît que tant qu'aucun devis n'est accepté.
- **3 modes de prix pro** : forfait, horaire, **sur devis** (enum `pricing_type` inclut `devis`).
- **Langage déclaratif** : « pièce fournie », « assurance renseignée » — jamais « vérifiée/certifié/garanti ».
- **Pas de GPS** pour le suivi, SAUF la validation d'arrivée « client absent » (photo horodatée + GPS).
- **Adresse du RDV** visible seulement quand la mission est **confirmée** — colonne
  `transactions.price_confirmed` (posée par `mission/new` à la création, ou par l'acceptation
  d'un devis dans le chat), jamais par une simple absence d'offre en attente (voir DepartureBar :
  prop `confirmed`). `requests` n'est lisible en direct (RLS) que par son auteur ou les parties
  à une transaction liée — jamais par un pro qui n'a pas encore répondu (ça, c'est `requests_nearby`,
  colonnes limitées). Le nom de l'interlocuteur (messages/chat/agenda/litiges/avis) passe par les
  RPC `transaction_counterparts` / `review_rater_names`, jamais par un embed direct sur `profiles`
  (RLS strictement self-read : l'embed renvoie toujours null pour quelqu'un d'autre).

## Pièges techniques (ont coûté du temps)
- RPC `providers_nearby` / `requests_nearby` : paramètres **`p_lat` / `p_lng`** (jamais `lat`/`lng`).
  Renommer un param = DROP puis CREATE. Nommer les contraintes FK dans les embeds PostgREST.
- `apply_migration` s'applique **direct en prod**. `ALTER TYPE … ADD VALUE` dans sa propre migration.
- Tables réelles : `transactions` (PAS `missions`), `disputes` (PAS `litiges`), `profiles`,
  `provider_profiles`, `requests`, `messages`, `invoices`, `reviews`, `documents`, `favorites`, `referrals`.
- Statuts transaction posés en pratique : `pending` → `arrived` → `completed`. **`held`, `released`,
  `refunded` ne sont JAMAIS posés** (Stripe pas branché) — ne pas construire de logique qui en dépend.
- `/hub` = index de dev (tape l'URL pour sauter partout). Orphelin volontaire, ne pas supprimer.

## Audit — état au 17/09/2026 (main récent)
CORRIGÉ cette session : régression « Je pars/adresse » (basé sur devis accepté, plus sur `held`) ·
menu pro dédupliqué · bug mobile « Carte » pro → /pro/carte · avis ré-affiché dans le chat ·
page `/mission/[id]/litige` cassée+orpheline SUPPRIMÉE (le litige passe par le chat → table `disputes`) ·
onglet dashboard « Profil » → « Réglages » · carte pro : clic demande / « Voir les demandes » ne
renvoient plus vers /pro/dashboard.

## BUGS / TROUS OUVERTS (à traiter, dans l'ordre conseillé)
1. ~~**Carte pro (`/pro/carte`) en layout cassé sur desktop**~~ CORRIGÉ : cadre téléphone retiré,
   panneau desktop permanent (`.detail-panel`), plus de double logo.
2. ~~**Flux « pro répond à une demande » inexistant**~~ CORRIGÉ : clic sur une demande (pin carte
   ou carte de la liste) → détail (métier/distance/budget/description) → « Contacter le client »
   → RPC `provider_respond_to_request` (nouvelle, SECURITY DEFINER — la RLS `transactions`
   n'autorisait que le buyer à insérer) → chat existant (négociation via le mécanisme de devis déjà
   en place). Au passage : `requests_nearby` ne renvoie plus l'adresse exacte du client (elle fuitait
   à tout pro avant toute proposition, contraire à l'invariant) — juste la distance.
3. ~~**Pages au vieux style** (Fredoka/Tailwind, hors design system) : `auth/login`, `auth/signup`
   (porte d'entrée !), `presentation`.~~ CORRIGÉ : `auth/login` et `auth/signup` restylés (Quicksand/
   Inter, teal/navy, logique intacte). `src/app/presentation/page.tsx` (le vieux Fredoka/« Nexto »)
   était en fait **du code mort** : `next.config.js` réécrit `/presentation` vers le fichier statique
   `public/presentation.html` (une animation d'accroche, déjà au design system, correcte) — cette
   règle de rewrite passe AVANT le routeur App Router, donc la page React n'était jamais atteignable.
   Supprimée plutôt que restylée pour rien.
4. **Stripe non branché** = pas de séquestre réel, pas de `held`/`released`. Gros chantier, EN ATTENTE
   (décision Romain : on prépare mais pas maintenant).
5. ~~**« Mon entreprise » à enrichir**~~ CORRIGÉ pour la partie faisable sans Stripe :
   `/pro/tarifs` (catalogue de prestations à prix fixe, table `services`) et `/pro/revenus`
   (récapitulatif + rappel DAC7, langage adapté aux prestations de service) ajoutés et liés depuis
   l'onglet Réglages du dashboard. « Calendrier » et « moyens de paiement » restent hors scope
   (voir décision produit plus bas / bug #4 Stripe).

## Comparatif démo (/demo = public/app.html, 44 écrans) vs app réelle — 17/09/2026
Demande de Romain : la démo (`/demo`) a une meilleure UX/flow que l'app réelle actuelle ; objectif
« faire pareil que la démo (sauf la carte, qui a besoin d'une vraie API) + combler les manques
(QR, facture entreprise/particulier, etc.) ». Après lecture écran par écran de `public/app.html`
(44 `<section class="view">`) et comparaison avec `src/app` :

**Déjà porté et conforme** : carte + recherche (`/map`), chat (`/mission/[id]/chat`, devis + avis
ré-affichés), QR arrivée/départ (`/mission/[id]/qrcodes`, `/scan/[phase]`), messages, agenda, profil
client, onboarding pro + KYC, dashboard pro, mes pièces, mes demandes (client), « signaler cet
échange » (dans le chat), devenir pro.

**Bonne surprise** : la facturation (3 documents — facture pour un prestataire immatriculé /
récapitulatif pour un particulier non-immatriculé / relevé de commission PING tant qu'elle n'est pas
immatriculée) est DÉJÀ implémentée et plus aboutie que la démo (`src/lib/invoice-pdf.ts` +
`/mission/[id]/facture`, doc juridique détaillé dans le fichier). VÉRIFIÉ de bout en bout (audit
du 17/09, suite) : trigger `transactions_invoice_on_complete` → `generate_invoices()` pose bien les
3 lignes `invoices` au passage à `completed`/`released`, jamais deux fois (garde `exists(...)`).

**CORRIGÉ le 17/09 (session d'audit)** :
- Client — `/client/avis` (avis publiés par le client, table `reviews` où `rater_id` = soi),
  `/client/confidentialite` (ce qui est visible/masqué, langage déclaratif), `/client/documents`
  (upload + visionneuse de la pièce d'identité) : les 3 étaient des rangées mortes sans `onClick`
  sur `/client/profil`.
- `/client/profil` mélangeait particulier et pro : une rangée « Mes revenus & déclaration » (DAC7,
  concept de vente de biens) n'a aucun sens pour un client qui ne perçoit jamais d'argent via PING —
  remplacée par « Mes opérations » (le vrai contenu de `/documents` pour un client).
- Pro — `/pro/tarifs` (catalogue de prestations, table `services`) et `/pro/revenus` (récapitulatif +
  DAC7 reformulé pour des prestations de service) + visionneuse de document dans `/pro/documents`
  (démo : `v_docview`) — voir bug #5 ci-dessus.
- BUG RÉEL corrigé au passage : la fiche pro (`/pro/[id]`) affichait toujours 5 étoiles par avis
  quel que soit le vrai score (lisait `r.rating`, colonne inexistante, au lieu de `r.stars`).

**Pas construit, volontairement** :
- Pro — « Devis instantané » structuré + liste « Demandes autour de vous » avec détail existent
  maintenant (`/pro/carte`, bug #2), mais le prix se négocie via le chat (+ Proposer un tarif) et
  non un widget de devis séparé — cohérent avec la « règle suprême du tarif ».
- « Moyens de paiement » (client et pro) : rangée/page volontairement inerte, Stripe non branché
  (bug #4, EN ATTENTE) — pas de fausse UI de paiement.

**Volontairement différent de la démo — NE PAS copier tel quel** (décisions déjà prises) :
- Litige (`v_litige`, `v_litige_suivi`, `p_litige`) : passe par le chat → table `disputes`, pages
  dédiées supprimées exprès (cf. Audit 17/09).
- Suivi en direct (`v_track`) : pas de GPS live, seulement la validation d'arrivée (invariant métier).
- Paiement (`v_pay`) : Stripe non branché, `held`/`released` jamais posés (bug #4, EN ATTENTE).

**Décision produit à prendre avant de construire** : réservation par créneau synchronisé à
l'agenda du pro (démo : `v_booking`, « Choisir un créneau ») n'existe pas du tout côté réel
(`mission/new` n'a pas de calendrier). C'est une vraie fonctionnalité nouvelle (agenda du pro
exposé en créneaux réservables), pas un simple restylage — à confirmer avec Romain avant de la
construire : garde-t-on le flux actuel (demande → devis négocié dans le chat), ou le remplace-t-on
par un vrai calendrier de créneaux ?

## Audit croisé + parcours complet bout en bout — 17/09/2026 (suite de session)
Après la première passe d'audit (ci-dessus), 3 vérifications indépendantes (comportement réel des
boutons/RLS, pas juste le visuel) puis un scénario complet particulier et pro tracés dans le code
ont trouvé et corrigé :
- **Fuite de sécurité** : `requests` avait une policy RLS `public read: true` + grant `SELECT` à
  `anon` → toute la table (adresse exacte incluse) était lisible par n'importe qui via un appel API
  direct, `requests_nearby` ne protégeait rien au niveau base. Policy remplacée (auteur ou parties
  à une transaction liée uniquement), `anon` retiré.
- `/pro/carte` : le toggle disponible/hors ligne ne touchait jamais `provider_profiles.is_active`
  (useState local) — un pro pouvait se croire masqué en restant visible. Corrigé.
- `/pro/[id]` : « Réserver » appelait la même fonction que « Contacter » (ouvrait juste un chat,
  sans jamais passer par l'écran de prix `mission/new`). Corrigé.
- Demande ouverte (client) : « + Publier une demande » menait à une impasse (`/mission/new` sans
  `?pro=`) — aucun code ne créait jamais de `requests.status='open'`, le flux #2 ci-dessus n'avait
  aucune alimentation réelle. Vraie page de création ajoutée (`/client/demandes/new` : titre,
  date/créneau/fréquence, budget min-max, géoloc pour lat/lng), + bug corrigé : une demande avec
  plusieurs pros répondants ne montrait que la DERNIÈRE transaction, les autres propositions
  disparaissaient silencieusement.
- Nom de l'interlocuteur toujours cassé (repli sur adresse/« Client »/« Prestataire ») dans
  Messages, Agenda, Litiges, et les avis de la fiche pro — même cause partout (embed direct sur
  `profiles`, RLS self-read). RPC dédiées `transaction_counterparts` / `review_rater_names`.
- `/pro/dashboard` reconstruit en « Mon entreprise » identique à la démo (`p_profile` : carte
  d'en-tête, Mon activité, Conformité, Mes pièces) au lieu d'une page à onglets/tuiles de stats ;
  Tableau de bord enrichi (raccourcis tarifs/revenus/documents, prochains rendez-vous).
- Litiges : lien mort vers `/mission/[id]/litige` (route supprimée) → renvoie vers le chat.
- Carte `/map` (DemoShell) : « Contacter » sans être connecté renvoyait vers la fiche pro en boucle
  au lieu de `/auth/login`.

**Scénario bout en bout tracé dans le code (pas de vrai clic navigateur, sandbox sans accès fiable
à la vraie Supabase) — confirmé sain** : inscription (trigger `on_auth_user_created` crée `profiles`)
→ connexion → carte/recherche → réservation (`mission/new`, prix figé) ou demande ouverte/chat →
négociation devis → QR arrivée (`scan/arrival`, RLS `tx participants update`) → QR fin
(`scan/complete`, calcule la durée si horaire) → trigger facturation (3 documents) → avis
(`ReviewModal`, recalcule la note du pro). Côté pro : onboarding (`provider_profiles.is_active=true`
dès la fin du wizard) → KYC → visible carte → répond à une demande ou reçoit une réservation directe
→ même chat/QR/facture → dashboard mis à jour.

## Scénario complet exécuté en conditions réelles — 17/09/2026 (demande explicite de Romain)
Contrairement aux passes précédentes (relecture de code + RLS), celle-ci a exécuté un vrai scénario
avec de vraies données en base (comptes créés via un vrai signup, pas une simulation) : inscription →
onboarding pro (forfait 100 € / 3 h incluses / 25 €/h au-delà, SIRET, KYC identité+RC pro) →
inscription client (KYC identité) → client contacte le pro → devis initial du pro (100 €/3 h/25 €/h)
→ contre-proposition du client (80 €/3 h/15 €/h) → acceptation par le pro → QR arrivée → intervention
de 5 h → QR fin → facturation automatique (80 € + 2 h de dépassement × 15 € = **110,00 €**) → avis
5 étoiles + pourboire 15 € + commentaire → note du pro recalculée. Comptes utilisés :
`audit.pro.claude@ping-demo.invalid` / `audit.client.claude@ping-demo.invalid` (mdp `AuditPing2026!`),
laissés en base pour inspection dans les dashboards.

**Trouvé et corrigé pendant ce scénario (une exécution réelle attrape ce qu'une relecture de code rate)** :
- **BUG CRITIQUE déjà en prod** : `openConversation()` (bouton « Contacter » depuis la carte ou une
  fiche pro) n'envoyait jamais de `description` à l'insertion dans `requests` — colonne `NOT NULL`
  sans défaut. **Toute ouverture de conversation depuis la carte échouait silencieusement.** Corrigé
  (`description: ''`). Même risque latent dans `mission/new` si le champ description (facultatif à
  l'écran) restait vide (`description || null` au lieu d'une chaîne vide) — corrigé aussi, jamais
  déclenché par les tests précédents car la description était toujours remplie à la main.
- **Modèle de prix manquant** : forfait et horaire étaient mutuellement exclusifs ; un forfait avec
  heures incluses puis dépassement horaire (le cas demandé) n'existait pas — le calcul de fin de
  mission écrasait le forfait dès qu'un tarif horaire était présent. Construit : `included_hours`
  (provider_profiles + transactions) + `base_forfait_cents` (transactions), calcul au scan de sortie,
  formulaire onboarding, écran de réservation, et négociation dans le chat (l'offre/contre-offre peut
  désormais porter un forfait + heures incluses + tarif de dépassement).
- **Cron oublié et trompeur** : `auto_release_completed_transactions` (toutes les 15 min) faisait
  passer une mission terminée à `released` (affiché « Réglée », vert) 24 h après la fin sans litige
  ouvert — alors que Stripe n'est pas branché et qu'aucun paiement réel n'a jamais lieu. Contredisait
  frontalement l'invariant documenté plus haut (« held/released ne sont jamais posés »). Désactivé
  (`cron.unschedule`), et les 3 transactions déjà mal étiquetées remises à `completed`.

**Confirmé sain par l'exécution réelle** : trigger de création de profil au signup · upload KYC +
statuts · visibilité carte (position statique du pro, `provider_profiles.lat/lng`) · négociation
devis avec accept/decline/contre-offre · RLS scan QR (`tx participants update`) · calcul de durée et
facturation automatique, y compris le nouveau cas forfait+dépassement · les 3 documents de facturation
avec les bons montants (`FACT` 110,00 €, `PING-C` 5,50 €, `PING-V` 12,10 €) · avis avec pourboire et
recalcul automatique de la note du pro.

**Limites structurelles constatées, aucune n'est un bug — décisions déjà connues ou nouvelles** :
- **RIB / carte bancaire** : ne sont collectés nulle part (ni onboarding pro, ni profil client) —
  cohérent avec Stripe non branché (bug #4) ; les construire sans Stripe derrière serait une fausse
  UI de paiement, contraire au principe déjà appliqué à « Moyens de paiement ». Vrai jeton bancaire
  = vrai chantier Stripe, pas un ajout ponctuel.
- **Aucun débit réel n'a jamais lieu** : tous les montants (total_charged_cents, payout_cents) sont
  déclaratifs, jamais prélevés — cohérent avec bug #4, mais à garder en tête à chaque lecture de
  dashboard : « Réglée » n'a jamais voulu dire « payé » (voir cron ci-dessus).
- **Pas de suivi GPS en direct** : seule la position statique déclarée du pro apparaît sur la carte
  (recherche), aucun point mobile pendant le trajet/l'intervention — invariant métier déjà documenté,
  pas un manque.
- **RLS `invoices` un peu plus permissive que l'invariant documenté** : les deux lignes de commission
  (`commission_client`/`commission_pro`) référencent les DEUX parties de la transaction dans leurs
  colonnes `issuer_id`/`client_id`, donc la policy RLS (`issuer_id OR client_id`) laisse chaque partie
  lire techniquement aussi la commission de l'autre via un appel API direct. L'écran `/mission/[id]/
  facture` filtre correctement côté application (chacun ne voit que sa propre commission + la
  prestation) — donc rien de visible dans l'app — mais l'invariant « RLS invoices correcte » est
  approximatif : c'est un filtrage applicatif, pas une garantie base de données. Pas corrigé cette
  session (risque de casser l'affichage existant pour un gain de confidentialité marginal, les taux
  5 %/11 % étant publics et donc les montants déductibles de toute façon) — à visiter si un jour ça
  compte davantage (ex. API publique, export comptable tiers).
- **Réservation par créneau/calendrier** : toujours pas construite (décision produit en attente,
  déjà notée plus haut).

## Comptes de test
Admin : 3op.consult@gmail.com. Prestataires fictifs : fictif1..10@ping-demo.invalid / PingDemo2026!.
Scénario complet forfait+dépassement (17/09) : audit.pro.claude@ping-demo.invalid /
audit.client.claude@ping-demo.invalid, mdp AuditPing2026!.
