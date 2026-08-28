# PING — Handoff pour reprise en nouvelle conversation (28/08/2026)

**RÈGLE ABSOLUE AVANT TOUTE CHOSE** : interdiction de recréer quoi que ce soit sans avoir cherché
d'abord si ça existe déjà. Ce document + `PING-45-ECRANS-DEMO.md` (dans le repo) + un `ls` réel du
repo et de `/mnt/user-data/outputs/branding/` sont les sources de vérité. Cette règle existe parce que
plusieurs sessions passées ont reconstruit des choses déjà faites, ou cru manquant ce qui existait.

---

## 1. Où trouver quoi (carte du territoire)

- **Repo réel** : `github.com/3opconsult-cyber/nexto`, branche `main`. Déployé automatiquement sur Vercel.
- **App live** : `nexto-eta.vercel.app` (redirige vers `/map`)
- **Admin** : `nexto-eta.vercel.app/admin?key=ping-sa-2026` — nécessite ensuite une vraie connexion
  avec le compte `3op.consult@gmail.com` (mot de passe : le redéfinir si besoin, voir section 5)
- **Supabase** : projet `wmiawwaxwlvascyflpba`, région eu-west-3 (Paris) — accessible via le connecteur
  Supabase MCP, pas besoin de clé si le connecteur est actif dans la conversation.
- **Vercel** : projet `prj_XTpD1OmYM7EudTvt8l0gf2fFKzXk`, team `team_48WNJnzha0bSyh7e3OpY8iu7`
- **Notion (ce document et le reste)** : espace "NEXTO — Espace projet", page racine
  `39e6dcca-9add-81fc-aef5-f6198f72f23a`. Chercher avec `notion-search` avant de supposer qu'un
  contenu n'existe pas — l'espace contient déjà vision, design system (partiellement obsolète,
  voir section 3), architecture, décisions actées.
- **Référence de design `/demo`** : `nexto-eta.vercel.app/demo` (fichier `public/app.html`, 45 écrans).
  `PING-45-ECRANS-DEMO.md` dans le repo liste chacun avec son statut réel (fait / partiel / absent).
  **Toujours lire ce fichier avant de dire "il manque X".**

---

## 2. État réel du produit (résumé — le détail exhaustif est dans `PING-45-ECRANS-DEMO.md`)

Construit et fonctionnel en base réelle (pas de fausses données sauf comptes de démo explicitement marqués) :
- Carte, recherche, fiche prestataire, favoris, réservation réelle (statut "pending", paiement en
  attente — Stripe pas branché, c'est assumé et affiché honnêtement à l'utilisateur)
- QR arrivée/départ réels, chat de mission avec système de devis validable (accepter/refuser/refaire
  une proposition), signalement de litige depuis le chat
- Règle des 24h auto-libération du paiement via `pg_cron` réel (tourne toutes les 15 min)
- Parrainage (règle : 1 filleul qui termine une mission = commission offerte, plafond 50€, 1×/mois)
- Chat support admin ↔ utilisateur (`admin_conversations`/`admin_messages`), accessible `/support`
- Onboarding pro avec pré-remplissage réel (édition sans perte de données), statut juridique visible
- Admin : carte en direct réelle (positions + statuts réels), CRM Utilisateurs avec recherche,
  factures réelles générées depuis les transactions (modèle FACT-/PING-C-/PING-V-, pas de PDF encore),
  fiche transaction groupant chat + QR + litiges + facture

**Trous connus, assumés, pas des oublis** :
- Paiement réel (Stripe) — jamais branché
- Génération de PDF de facture — l'enregistrement existe, le document téléchargeable non
- Avis clients — aucune écriture d'avis nulle part, trou le plus ancien du projet
- Enchères/système d'offres — **volontairement pas construit**, contredit le modèle sans enchères validé

---

## 3. Branding — verrouillé le 27-28/08/2026

- **Nom : PING**, confirmé après vérification. SONAR écarté (conflit direct avec une startup française
  active, sonar-app.co/sonarpay.fr, même secteur). SOCO écarté (saturé, plusieurs apps existantes dont
  une trop proche conceptuellement). SONA testé mais a une collision d'acronyme (Philippines,
  "State of the Nation Address") — pas bloquant en soi, mais PING reste le choix le plus propre.
- **Charte couleur/typo** (validée 06/08, ré-confirmée) : ink `#123644`, ink2 `#0e2a34`, teal `#12B39C`,
  tealD `#0C8F7E`, coral `#FF7A66`, gold `#F2A93B`, green `#2FD06E`, paper `#F3F6F5`. Quicksand (titres)
  + Inter (texte). **La page "2 · Design system" dans Notion est OBSOLÈTE** (violet/Fredoka, du 15/07,
  jamais mise à jour après le pivot du 06/08) — ne pas s'y fier pour la couleur/typo.
- **Logo verrouillé** : anneaux concentriques + point vert qui pulse — le geste réel du bouton PING
  qui scanne la carte. Fichiers : `logo_lockup_final.png` (sur navy et blanc). Déjà appliqué aux vraies
  icônes de l'app (favicon, PWA, apple-touch-icon) dans le repo.
- **Piste explorée mais non retenue** : technique du "negative space design" (logo à message caché,
  comme la flèche FedEx) sur SONAR et CONNECT — fonctionnait bien visuellement mais liée aux noms
  écartés. Fichier de comparaison : `pistes-sona-connect-comparaison.png`. Pourrait resservir si le
  nom change un jour, sinon sans objet.
- **Direction graphique demandée pour la suite** : minimaliste, suggéré plutôt qu'expliqué, grille
  stricte (une seule marge, alignements exacts), pas de composition "Canva/WordArt" (éléments
  centrés empilés sans hiérarchie). Le dernier essai vignette (point d'interrogation dessiné en SVG,
  point du "?" = le vrai logo radar, QR aligné sur la même ligne de base que le texte, marge unique
  12mm) a été le mieux reçu — s'en inspirer pour la suite plutôt que repartir de zéro.

---

## 4. Assets déjà produits ce soir (27-28/08) — NE PAS REFAIRE

Tous dans `/mnt/user-data/outputs/branding/` au moment de la rédaction (vérifier qu'ils y sont
toujours, sinon les régénérer depuis le HTML source si besoin, décrit ci-dessous) :

| Fichier | Contenu |
|---|---|
| `logo_lockup_final.png` | Logo final, navy + blanc |
| `flyer-ping-particulier.pdf` / `flyer-ping-pro.pdf` | Flyers A6 minimalistes |
| `pitch-ping-particulier.pdf` / `pitch-ping-pro.pdf` | Présentations paysage 4 pages, format pro |
| `sticker-v1` à `v5` | 5 variantes de sticker rond 55mm |
| `vignettes-campagne-pro.pdf` | 3 vignettes 100×100mm, direction "point d'interrogation = signal" |
| `ig_post_particulier.png` / `ig_post_pro.png` | Posts Instagram carrés 1080×1080 |

**Dans le repo réel (déployé)** :
- `/comment-ca-marche` — carrousel interactif réel, particulier + pro, transitions animées, logo qui pulse
- `/landing-particulier` et `/landing-pro` — landings d'acquisition, UTM propagés
- Icônes de l'app (favicon, PWA) déjà mises à jour avec le logo final

**Outil de rendu** : `weasyprint` (Python, `pip install weasyprint --break-system-packages`) — PAS
`wkhtmltopdf`, qui a un vrai bug de rendu sur les pages carrées/hautes (contenu ne remplit pas le
canevas). Les fichiers HTML source des derniers essais vignette sont dans `/home/claude/print/` de
CETTE session — non persistants, à reconstruire si besoin depuis le HTML donné dans les fichiers
`vignettes_v*.html` (le pattern de code est dans l'historique de conversation, section vignettes).

---

## 5. Accès & identifiants pour continuer

- **GitHub** : le token de session précédente ne persiste PAS entre conversations (sandbox neuf à
  chaque fois). Pour en obtenir un nouveau : demander à Romain de se connecter sur github.com **avec
  le compte `3opconsult-cyber`** (pas son compte perso), puis aller directement sur
  `github.com/settings/personal-access-tokens/new` → Repository access → `nexto` → Permissions →
  Contents → **Read and write** → Generate. Le coller dans le chat, le stocker dans
  `/home/claude/.gh_token_env` (`export GH_TOKEN="..."`), sourcer avant chaque commande git.
- **Supabase / Vercel** : via les connecteurs MCP, pas de token à gérer manuellement si les
  connecteurs sont actifs dans la nouvelle conversation.
- **Compte admin réel** : `3op.consult@gmail.com` — mot de passe réinitialisable directement en SQL
  via `UPDATE auth.users SET encrypted_password = crypt('nouveau_mdp', gen_salt('bf')) WHERE email = '3op.consult@gmail.com'`
  (extension pgcrypto déjà active). C'est aussi le même compte que "romain" utilisé pour les tests —
  toutes les transactions de test, favoris, parrainage y sont rattachés.

---

## 6. Mission pour la prochaine session

1. **Terminer la comm** — décliner la nouvelle direction graphique (grille stricte, point
   d'interrogation = signal) sur le reste des supports : flyers, stickers, présentations paysage,
   posts Instagram. Cohérence totale entre tous les supports avant de les considérer finis.
2. **Finir le personal branding** — le logo et la charte sont verrouillés ; il reste à vérifier que
   *tous* les écrans réels de l'app (pas seulement les icônes) reflètent bien le lockup final, et à
   trancher si la technique "negative space" doit être creusée davantage ou abandonnée définitivement.
3. **Lancer l'acquisition** — les landings et le carrousel sont en ligne avec tracking UTM réel.
   Reste à construire, si demandé : un vrai module de gestion de campagnes dans l'onglet Prospection
   de l'admin (créer/suivre plusieurs vignettes, voir les scans par variante) — explicitement PAS
   commencé, à faire seulement si Romain le confirme, pas en supposition.

---

## 7. Pièges déjà payés cette session — ne pas les repayer

- `wkhtmltopdf` casse sur les pages carrées/hautes → utiliser `weasyprint`
- Les embeds PostgREST implicites (`profiles(...)`) cassent dès qu'une table a 2 chemins vers la
  même cible → toujours `profiles!nom_de_la_contrainte_fkey(...)`
- Les fichiers statiques (`admin.html`, `demo`, landings) ont besoin d'un header `Cache-Control:
  no-cache` explicite dans `next.config.js`, sinon les mises à jour semblent invisibles
- `export const dynamic`/`revalidate` sur une page Next.js "use client" a cassé le build une fois —
  vérifié risqué, à éviter ou tester très prudemment
- Ne jamais supposer qu'un fichier référencé dans "comm" existe réellement — vérifier avec `find`/`ls`
  avant de construire dessus ou d'affirmer qu'il manque
