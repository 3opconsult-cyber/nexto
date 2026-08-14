# PING — Passation, 14 août 2026

## Méthode confirmée — à suivre sans exception

1. Écrire/modifier le code réel en local (bash), jamais retapé à la main dans un appel d'outil géant
2. Vérifier avec `npx tsc --noEmit` avant tout envoi
3. Pousser sur GitHub via `git push` (le token ci-dessous a les droits, déjà utilisé tout du long)
4. Vercel redéploie automatiquement sur push vers `main` — déjà connecté, ne rien reconfigurer
5. Vérifier via le workflow GitHub Actions "Deploy to Vercel" (`/repos/3opconsult-cyber/nexto/actions/runs`)

## Règle impérative de méthode (rappel explicite de Romain, 14/08)

**Ne pas créer d'abord.** Avant tout nouveau code : chercher ce qui existe déjà dans le dépôt,
calquer sur le parcours et les conventions déjà en place, identifier la règle/le pattern
existant, et seulement ensuite publier. Ne pas réinventer une page ou un flux sans avoir
d'abord lu le code réel qui tourne aujourd'hui.

## Limite d'outils — à expliquer une fois, clairement, dès le début de la prochaine session

Claude n'a ni navigateur ni accès réseau vers `nexto-eta.vercel.app` (uniquement une liste
fermée de domaines : GitHub, npm, pypi — pas les domaines Vercel). "Déployé avec succès"
signifie seulement que le code compile et que le build Vercel a réussi — jamais qu'un rendu
visuel a été vérifié. Les vérifications possibles côté Claude : lecture de code, `tsc`,
requêtes SQL directes sur Supabase (bypasse RLS), logs GitHub Actions. Rien de plus.
Romain a explicitement rejeté les maquettes interactives dans la boîte de dialogue (widget
Visualizer) — ne pas en reproposer. La seule validation visuelle possible vient de Romain
lui-même sur l'URL réelle ou l'app installée sur son téléphone.

---

## Accès

**GitHub**
- Dépôt : `3opconsult-cyber/nexto`, branche `main`
- Jeton fine-grained (Contents: Read and write, scope limité à ce dépôt) : **voir le fichier
  PING-REPRISE.md fourni directement par Claude dans la conversation, ou l'espace Notion —
  GitHub bloque le token en clair dans un commit (protection anti-fuite de secrets, normal).**
  S'il ne fonctionne plus : `github.com/settings/personal-access-tokens/main` → "nexto-push" → Regenerate.

**Vercel**
- Projet `nexto`, id `prj_XTpD1OmYM7EudTvt8l0gf2fFKzXk` — équipe `nextoping`, id `team_48WNJnzha0bSyh7e3OpY8iu7`
- Déjà connecté au dépôt GitHub, aucune action requise

**Supabase**
- Projet id `wmiawwaxwlvascyflpba`, nom "nexto" (org `3opconsult`, région eu-west-3 Paris)
- URL : `https://wmiawwaxwlvascyflpba.supabase.co`
- Clé publique (anon, safe cote client) : `sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP`
- Compte à connecter : `3op.consult@gmail.com`

**Notion**
- Espace "NEXTO — Espace projet", page id `39e6dcca-9add-81fc-aef5-f6198f72f23a`
- Ce document y est également poussé (voir tout en bas)

---

## État réel, vérifié au 14/08

**Schéma production réel** : `profiles`, `provider_profiles`, `services`, `documents`,
`requests`, `transactions`, `messages`, `reviews`, `invoices`, `disputes`, `events`.
`supabase/migrations/001_initial_schema.sql` est **périmé** (ancien schéma
`pro_profiles`/`missions`/`litiges`) — ne jamais l'appliquer. Le vrai schéma est documenté
dans `002_admin_access_and_security_fix.sql` et `003_map_and_onboarding_fixes.sql`.

**En ligne et connecté à Supabase (vérifié par lecture de code + tests SQL internes, PAS par un clic humain) :**
- `/map` — vraie carte visuelle (Leaflet + OpenStreetMap, sans clé), remplace l'ancienne liste seule
- `/pro/[id]`, `/auth/signup`, `/auth/login`
- `/pro/onboarding` — refondu en flow une-question-par-écran (service, tarif, statut particulier/pro,
  recherche SIRET via `recherche-entreprises.api.gouv.fr`, position par géolocalisation, téléphone, bio)
- `/pro/onboarding/documents` — un document à la fois, pictogrammes SVG, skip
- `/pro/attente`, `/pro/dashboard` — statut et données réels
- `/mission/new` — crée une vraie `requests` puis `transactions` (adresse + description conservées, avant elles étaient perdues)
- `/mission/[id]/qrcodes` — QR générés 100% côté client (`qrcode-generator`), plus de fuite vers un tiers
- `/mission/[id]/scan/[phase]` — recalcule réellement le montant pour les prestations à l'heure
- `/mission/[id]/chat` — connecté à la table `messages`
- `/admin` — onglet "Aperçu réel" branché sur Supabase (KPIs, prestataires, documents, transactions, litiges)
- PWA installable : `manifest.json`, icônes brandées, meta tags iOS — icône réelle sur écran d'accueil, plein écran
- `/demo` (app.html) : vrai mode plein écran sur petit écran / PWA installée (le mockup de téléphone décoratif ne s'affiche plus)

**Neutralisé, redirige vers `/demo`** : `/hub`, `/mission/[id]/facture`, `/mission/[id]/litige`, `/client/*`

**Sécurité corrigée cette session** :
- `.github/workflows/db-migrate.yml` était **destructeur** (DROP SCHEMA public CASCADE puis
  réapplication du schéma périmé) — neutralisé (déclenchement manuel uniquement, corps retiré).
  Avait échoué 2 fois avant la partie destructrice, base vérifiée intacte, mais aurait tout cassé
  si le secret avait été valide. **Ne jamais le réactiver sans le reconstruire proprement.**
- Un utilisateur pouvait s'auto-promouvoir admin (`profiles.is_admin` modifiable via son propre update) — fermé par trigger
- `admin_stats()` était appelable par n'importe qui, même non connecté — restreint aux admins
- Bucket de stockage `documents` (pièces d'identité) était **public** — corrigé (privé + policies)
- 7 comptes `auth.users` fantômes de juin (`*.demo@nexto.app`, `admin@nexto.app`) — supprimés

**Base de données** : actuellement 0 ligne partout (avant lancement), sauf `auth.users` = 0
également après nettoyage. Tests internes (créer un vrai compte via `auth.users`, dérouler
tout le parcours, tout supprimer) passés deux fois le 14/08 — voir méthode ci-dessous si à
reproduire.

---

## Reste à faire, par ordre de priorité

1. **La carte : Romain rapporte qu'elle "ne fonctionne toujours pas."** Correctif Leaflet
   posé le 13/08 mais jamais vérifié visuellement par personne — priorité absolue de la
   prochaine session. Vérifier d'abord si le problème est le rendu (CSS/JS Leaflet cassé
   en prod), l'absence de prestataires réels à afficher (base vide, comportement attendu),
   ou autre chose. Ne pas supposer, relire le code et demander à Romain ce qu'il voit précisément.
2. **Compte admin de Romain** (`3op.consult@gmail.com`) toujours inexistant en base — il doit
   s'inscrire lui-même via `/auth/signup`, puis Claude peut passer `is_admin=true`.
3. **Prévisualisation/maquette du parcours complet** — Romain veut vérifier la simplicité et la
   fluidité de l'inscription (pro et utilisateur), sans perte de prestataires en cours de route.
   Format demandé encore ambigu (il a rejeté le widget dans le chat) : clarifier avec lui
   directement en début de session ce qu'il attend précisément avant de construire quoi que ce soit.
4. Point non résolu, à clarifier avec Romain : **"reste à valider le SA et l'ensemble des accès"**
   — signification exacte pas comprise (transcription vocale ambiguë), demander confirmation.
5. Point non résolu, jamais clarifié malgré une relance : **"s'il y a des entreprises, quelques
   simples, demande de produire les documents"** — probablement lié à la recherche SIRET dans
   l'onboarding (gestion de plusieurs résultats de recherche ?), à faire préciser.
6. `generate_invoice()` reste cassée (ancien schéma) — aucun code ne l'appelle actuellement, pas urgent
7. `/hub`, `/mission/[id]/facture`, `/mission/[id]/litige`, `/client/*` à reconstruire pour le nouveau schéma
8. Pas d'historique des missions côté client (aucune page équivalente à `/pro/dashboard` pour un client) — gap identifié, jamais demandé explicitement
9. Notifications push — reportées volontairement (nécessite clés VAPID + stockage abonnements + mécanisme d'envoi, à faire proprement, pas dans l'urgence)
10. Migration `001_initial_schema.sql` toujours périmée — un snapshot complet du schéma réel n'a jamais été fait (dette de documentation, pas bloquant)

---

## Pièges rencontrés cette session — ne pas refaire

- `app.html` (`/demo`) et `admin.html` (`/admin`) tournent **hors du layout Next.js** (fichiers
  statiques dans `public/`, servis via rewrite dans `next.config.js`). Toute modification de
  `src/app/layout.tsx` (meta tags, manifest, polices) **ne s'applique pas à ces deux fichiers** —
  ils ont leur propre `<head>` à éditer séparément.
- RLS : par défaut, aucune requête admin ne remonte de données (les policies ne visaient que le
  propriétaire de chaque ligne). Toute nouvelle fonctionnalité admin doit ajouter ses propres
  policies `is_admin()`, sinon la requête renvoie silencieusement du vide (pas d'erreur).
- Une policy `UPDATE ... USING (auth.uid() = id)` sans `WITH CHECK` restrictif autorise la
  modification de N'IMPORTE QUELLE colonne, y compris des colonnes sensibles comme `is_admin`.
  Toujours vérifier les colonnes sensibles d'une table avant d'écrire une policy self-write large.
- `ALTER TYPE ... ADD VALUE` ne doit jamais être mélangé dans la même migration qu'une valeur
  utilisée dans la même transaction — le séparer en migration propre.
- Ne jamais faire confiance à un service tiers pour des données sensibles (ex. tokens QR envoyés
  en clair à un générateur d'image externe) — préférer une génération locale.
- Table vide ≠ sans risque à modifier : toujours vérifier si du code en dépend avant de toucher au schéma.
- Un test "interne" via SQL direct (Supabase MCP) contourne RLS — il valide les données, pas les
  permissions réelles d'un utilisateur connecté depuis le navigateur. Le dire clairement à chaque fois.

---

*Ce document est également disponible dans le dépôt (`PING-REPRISE.md`) et dans l'espace
Notion "NEXTO — Espace projet".*
