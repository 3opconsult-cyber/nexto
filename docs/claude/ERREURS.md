# Erreurs déjà commises : symptôme / cause / correction / garde-fou (vérifié le 21/11/2026)
Source : CLAUDE.md (HISTORIQUE.md), `docs/audit-ergonomie-2026-11-21.md`, session du 20-21/11. Ajouter ici chaque nouvel incident.

| # | Symptôme | Cause | Correction | Garde-fou |
|---|---|---|---|---|
| 1 | SQL collé « sans effet » ou objet introuvable | Romain a collé dans l'autre projet Supabase (`ahtdevozpbeargnmvzcn`) | Recoller dans `wmiawwaxwlvascyflpba` (eu-west-3) | Lien direct dans `supabase/a_coller/README.md` ; vérifier l'identifiant du projet avant tout collage |
| 2 | Aucune annulation ne passe : « column reference "kind" is ambiguous » | Variable PL/pgSQL `kind` de même nom qu'une colonne dans `cancel_booking` (056) | Variable renommée `v_kind` (migration 060, 20/11) | Préfixe `v_` ; test `scripts/e2e/annulations.mjs` après collage |
| 3 | Annulation impossible après l'arrivée du prestataire | Gardes 014/027 interdisaient `cancelled` après `arrived` ; décision 20/11 la rend possible aux frais totaux | Drapeau de session posé par `cancel_booking` seule (056), gardes adaptées | `trg_cancellation_rules` : écriture directe de `status = 'cancelled'` refusée |
| 4 | Aucun message système enregistré (réservation, en route, fin, litige) | RLS `messages` refuse `sender_id` NULL | `systemSender()` (`kind='system'` au nom de l'auteur) | Ne jamais écrire `sender_id: null` -> `src/lib/systemMessage.ts` |
| 5 | Routes serveur et middleware admin ne voient aucun utilisateur | `@supabase/ssr` 0.3 attend cookies `get/set/remove` ; `getAll/setAll` ignorés en silence | Corrigé dans `src/lib/supabase/server.ts` et `src/middleware.ts` | Tester une route serveur avec une vraie session |
| 6 | Appel anonyme à une fonction : réponse PGRST202 (fonction introuvable pour ce rôle) | Fonction révoquée à `anon` (droit retiré volontairement) ; l'appel se comporte comme « inexistante » | Comportement attendu pour un appel non connecté ; l'app appelle ces RPC connectée seulement | Distinguer PGRST202 (droit retiré) d'un vrai manque de migration ; [à compléter : écran concerné] |
| 7 | Chat lent : 63 à 103 requêtes, 7 à 9 `/auth/v1/user`, 19 `presence_state` | Cascade de lectures en série, doublons `getUser` | `getUser` partagé 15 s, appels dédoublonnés, lecture en parallèle (21/11) : 39 à 43 requêtes | Mesurer le nombre de requêtes avant/après ; reste `presence_state` x7 -> AMELIORATIONS.md |
| 8 | Boutons d'annulation / report non cliquables sur mobile | `Sheet` (z-index 80) sous la barre du bas (1500) | z-index 3000, focus rendu | Tout volet sur mobile : tester le clic avec la barre du bas |
| 9 | Ouverture de conversation depuis la carte échouait en silence | `requests.description` NOT NULL sans défaut, non envoyée | `description: ''` | Parcours réel (17/09) ; ne jamais envoyer `null` sur une colonne NOT NULL |
| 10 | Adresse exacte lisible par n'importe qui par appel API direct | Policy RLS `requests` `public read: true` + grant `anon` | Policy remplacée (auteur / parties), `anon` retiré | Tester les droits avec un compte réel, pas seulement l'écran |
| 11 | Carte pro toujours à 0 demande | `requests_nearby` non `SECURITY DEFINER`, RLS masquait tout | Définer, position floutée, sans ses propres demandes (30/10) | Tester la RPC avec un compte pro |
| 12 | Faux « Réglée » sur missions sans paiement | Cron `auto_release_completed_transactions` posait `released` sans Stripe | `cron.unschedule`, 3 transactions remises à `completed` | `held/released` jamais posés sur `status` |
| 13 | Toute facture >= 1 000 EUR échouait en PDF | Police standard sans espace fine des milliers | `pdfSafe()` | `node scripts/tests/facturation/run.cjs` |
| 14 | Impossible d'écrire un avis (focus repris à chaque lettre) | `onClose` de `Modal` recréé à chaque rendu | `onClose` gardé dans une ref | Test e2e avis |
| 15 | Requête agenda en 400 | `dispute_status` mal supposé (`investigating`) | Valeurs réelles `open` / `resolved` / `rejected` | Vérifier les enums en base avant de coder |
| 16 | Suivi marketing avant inscription perdu | `events` refuse l'insertion anonyme | Migration 015 | -- |
| 17 | `get_arrival_code` en 400 à chaque appel | Colonne `expires_at` ambiguë | Correctif 035 (03/11) | Même règle que #2 |
| 18 | Base de production menacée | Workflow `db-migrate.yml` faisait `DROP SCHEMA public CASCADE` à chaque push | Neutralisé (13/08/2026) | Ne jamais réintroduire d'application automatique de schéma |
| 19 | Cron « toutes les 15 min » inexistant | Vercel Hobby : un cron par jour | Crons quotidiens ; pg_cron côté base pour les 10 min | Voir A-TRANCHER.md (f) |
| 20 | Dossier `a_coller` : 059 collé avant ses prérequis | Ordre non respecté (025, 040, 054) | Ordre écrit dans le README | Lire l'ordre avant de coller |
| 21 | Test annulation : clic sur un bouton absent | Chat pas encore chargé | Tests attendent les boutons (commits 7c0f08b, 14fdeee) | Toujours attendre l'élément, jamais un délai fixe |

## Règles tirées
- Un incident = une ligne ici + un garde-fou (test, contrainte, revue). Sans garde-fou, l'incident est « non clos ».
- Une relecture de code ne remplace pas un scénario réel avec de vrais comptes de test.
- Toute migration : rejouable, testée collée deux fois, appels interdits refusés.
- 21/11/2026 | `parcours.mjs` A et B échouent au « Je pars » en soirée | le sélecteur de créneau n'offre que des heures du jour à +30 min dans les horaires d'ouverture ; tard dans la journée il propose le lendemain, et la base refuse « Je pars » avant le jour du rendez-vous (038) | ce n'est pas une régression du produit | rejouer ces deux parcours en journée (avant ~17 h heure de Paris), ou avec la clé service pour fixer un rendez-vous du jour
