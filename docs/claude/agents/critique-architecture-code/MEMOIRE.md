# Mémoire critique-architecture-code (vérifié le 21/11/2026)
## Architecture
- Next.js 14 App Router (`src/app`), React + TS, Supabase (Postgres, Auth, Storage, RLS). Routes API Next.js, 2 crons Vercel, aucune fonction Supabase.
- Logique métier sensible en base (RPC SECURITY DEFINER, triggers de garde) ; l'application détecte les migrations par sondes et garde l'ancien comportement.
- Pages statiques générées : public/*.html par `brand/*/build.py` ; rewrites `/demo` (app.html), `/admin` (admin.html), `/bienvenue`, `/plaquettes`, animations dans `next.config.js` : ne pas casser.
- Admin : `public/admin.html` est un gros fichier statique (échappement HTML en lot 2) ; protégé par middleware + `is_admin()`.
## Dette connue
- `ping-legacy.css` à retirer ; pages anciennes supprimées (presentation, litige).
- Deux chemins de calcul de fin de mission : SQL `_presence_amounts` (prod) et `computeFinalAmounts` TS (historique) ; parité testée sur 400 cas.
- Migrations : pas de table de suivi ; ordre dans `supabase/a_coller/README.md` ; certaines migrations réécrivent des fonctions de précédentes (048 sur 038, 052 sur 045/048, 055 par 056) : risque de régression à recoller.
- `providers_nearby` : définition de prod absente du dépôt (058 ne l'a pas recréée).
- Gardes 014/027 adaptées par un drapeau de session posé par `cancel_booking` : couplage fin à surveiller.
## Risques déjà vécus (ERREURS.md)
- Variables PL/pgSQL ambiguës, cookies `@supabase/ssr`, `db-migrate.yml` destructeur, RLS trop large.
## Critères
- Un fichier de code par règle, règle testée, retour arrière écrit, aucune règle métier dupliquée entre TS et SQL sans test de parité.
- Proposition = fichier et ligne, effet attendu, test de non-régression, retour arrière.
## Format d'une proposition
- Une ligne : axe, proposition, preuve (fichier ou mesure), impact 1-5, effort 1-5, risque. Maximum 5 par passage.
- Lecture seule : ne rien écrire dans le code ni dans AMELIORATIONS.md ; l'agent principal décide et consigne.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Passe 1 (21/11) : A-035 à A-039 ; 8 dépendances retirées ; formule de commission copiée en 6 endroits et cache getRates jamais vidé (A-037, accord requis) ; chat 1 269 lignes, admin.html 5 469 lignes.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : signaler les composants partagés modifiés par deux chantiers (agenda/page.tsx, Calendar, BottomTabBar) et les scripts de test désynchronisés des libellés.
