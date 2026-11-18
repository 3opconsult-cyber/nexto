# Droits en base : fil des litiges et lecture des profils (lot 25)

Rédigé le 18/11/2026. C'est une relecture des migrations du dépôt, pas une lecture de la base : le connecteur Supabase a été refusé le 18/11. Chaque point dit ce que le dépôt prouve, ce qu'il ne prouve pas, et la correction préparée.

La correction minimale est dans `supabase/migrations/044_droits_litiges_profils.sql` (copie dans `supabase/a_coller/`). Elle ne contient ni DROP ni DELETE. Elle a été testée sur un Postgres 16 local, avec un schéma minimal qui imite la production (rôles `anon` et `authenticated`, `auth.uid()`, RLS).

## Ce qu'il faut lire en base avant de coller la 044

À lancer dans l'éditeur SQL Supabase (lecture seule). Le résultat dit si les failles ci-dessous existent vraiment :

```sql
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'dispute_messages', 'disputes', 'invoices', 'transactions',
                    'avance_immediate_demandes', 'avance_immediate_clients', 'documents')
order by tablename, policyname;

select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and table_name in ('profiles', 'dispute_messages', 'avance_immediate_demandes', 'avance_immediate_clients')
group by 1, 2 order by 1, 2;
```

## Failles trouvées

| # | Où | Ce que le dépôt montre | Gravité | Correction préparée |
|---|---|---|---|---|
| 1 | `profiles`, lecture | La 001 crée `profile_public_read` : `FOR SELECT USING (true)`. Aucune migration ne la retire. Si elle existe encore, tout visiteur, même sans compte, lit par l'API le téléphone chiffré, l'adresse et les autres colonnes de tous les comptes. CLAUDE.md dit la table « en lecture strictement personnelle », mais rien dans le dépôt ne le prouve (la 002 dit elle-même que la 001 est périmée). | Élevée si la politique existe | **044** : toute politique SELECT ou ALL de `profiles` dont la condition est `true` passe à `auth.uid() = id or is_admin()` (ALTER POLICY, sans DROP). Sans effet si elle n'existe plus. L'app ne lit jamais le profil d'un autre en direct : les noms passent par `provider_public_name`, `transaction_counterparts` et `review_rater_names`. |
| 2 | `dispute_messages`, toutes opérations | La 021 a été appliquée par le connecteur. Le fichier du dépôt ne contient que la table, pas les politiques (« voir l'historique Supabase »). On ne peut donc pas vérifier qui lit, qui écrit, ni si une partie peut écrire un message `mediation` (réservé à PING), au nom de l'autre partie, ou modifier un message déjà envoyé. | Moyenne (inconnue) | **044** : quatre politiques RESTRICTIVE, qui ne peuvent que retirer des droits : lecture et écriture par une partie de la mission ou un admin, `sender_id = auth.uid()`, aucune modification ni suppression sauf admin. Plus un déclencheur : une partie qui écrit en direct n'envoie que du texte, dans un litige ouvert. Les messages « system » des fonctions de la 040 passent, car elles s'exécutent sous leur propriétaire. |
| 3 | `transactions`, insertion | La garde de la 027 ne contrôle à l'insertion que le statut. Un client peut, par l'API, créer une mission `price_confirmed = true` à n'importe quel prix, avec 0 % de frais et de commission. Aujourd'hui `mission/new` calcule le prix dans le navigateur. | Élevée | **045** : `book_service()` (SECURITY DEFINER) recalcule prix, frais et commission en base (fiche de prix, taux de `app_settings`). `mission/new` l'utilise si elle existe. **Reste à faire** une fois l'app déployée et la 045 collée : refuser dans la garde 027 l'insertion directe d'une mission déjà confirmée. Ce n'est pas dans la 045, pour garder le repli de l'app. |
| 4 | `avance_immediate_demandes` | La 013 donne au prestataire `aid seller write` (FOR ALL) et INSERT/UPDATE à `authenticated`. Il peut écrire lui-même « payée », ou changer le montant, de la demande Urssaf de sa mission. | Élevée avant activation | **046** : REVOKE des écritures et déclencheur de garde. Seuls le serveur (clé service) et un admin écrivent. Les routes `/api/avance-immediate/**` écrivent avec la clé service. |
| 5 | `avance_immediate_clients` | Politique `aic self` FOR ALL : un client peut se déclarer « actif » avec un identifiant Urssaf inventé. | Moyenne | **046** (même correction). |
| 6 | `documents`, échéance | La colonne `valid_until` existe (la 005 l'utilise) mais aucune garde ne la protège : un prestataire peut écrire sa propre date d'expiration. C'est sans effet aujourd'hui, car rien ne la lit. Elle devient la date d'expiration avec la 042. | Faible, puis moyenne | **042** : la garde des pièces ne laisse au prestataire ni le statut, ni le motif, ni l'échéance, ni la date de décision. Un nouveau dépôt les remet à zéro. |
| 7 | `invoices`, lecture | Déjà noté le 17/09 : les deux lignes de commission portent les deux parties dans `issuer_id` et `client_id`, donc chaque partie lit par l'API la commission de l'autre. L'app filtre à l'affichage. | Faible (taux publics) | **Non corrigé.** La correction propre est une politique RESTRICTIVE par `kind`. Elle demande de connaître exactement qui est `issuer_id` et `client_id` sur chaque type de ligne (à lire en base). Elle risque de masquer la facture de la prestation si on se trompe. À faire avec un accès SQL, puis `scripts/e2e/factures.mjs`. |
| 8 | `profiles`, écriture | `profile_own` / `profiles self write` est FOR ALL. Seul `is_admin` est protégé (déclencheur de la 002). L'utilisateur peut donc modifier toutes ses autres colonnes, par exemple `is_pro`. | Faible | **Non corrigé.** À examiner colonne par colonne quand le schéma réel de `profiles` sera lu. |
| 9 | `disputes`, lecture | La 027 limite la création aux parties. La politique de lecture n'est dans aucune migration du dépôt. | Inconnue | **Non corrigé.** À vérifier avec la requête ci-dessus, puis même schéma que le point 2 (RESTRICTIVE). |

## Ce qui a été vérifié et n'est pas une faille

- **Noms des interlocuteurs.** Aucun écran ne fait d'embed `profiles(...)` (recherche dans `src/` le 18/11). Fermer la lecture publique de `profiles` ne change donc aucun affichage.
- **Admin.** `profiles admin read`, `documents admin read/update` et `disputes admin update` (002), ainsi que la lecture admin des missions (022), restent inchangés. La 044 garde `is_admin()` dans les politiques qu'elle resserre.
- **Arrangement à l'amiable (040).** Ses RPC écrivent dans `dispute_messages` avec `sender_id = auth.uid()` et `kind = 'system'`. Elles passent les politiques RESTRICTIVE (la partie est bien partie à la mission) et le déclencheur (elles s'exécutent sous leur propriétaire, pas sous `authenticated`). C'est testé en local avec une fonction équivalente.

## Tests locaux (Postgres 16, schéma minimal)

- Profils : un client voit 1 profil (le sien), un visiteur sans compte en voit 0, l'admin les voit tous.
- Fil des litiges :
  - une partie qui écrit `mediation` est refusée ;
  - écrire au nom de l'autre partie est refusé ;
  - modifier un message ne touche aucune ligne ;
  - une personne extérieure ne lit rien et ne peut pas écrire ;
  - l'admin écrit en médiation ;
  - un message « system » envoyé par une fonction SECURITY DEFINER passe ;
  - une partie ne peut plus écrire une fois le litige clos.
- Rejouer la 044 deux fois ne produit aucune erreur et ne change rien.

## Après le collage (à faire par Romain, ou par Claude quand l'accès revient)

1. Relancer la requête `pg_policies` ci-dessus et l'ajouter en annexe de ce rapport.
2. Lancer `scripts/e2e/separation-espaces.mjs` (26 OK) et `scripts/e2e/factures.mjs` (20 OK).
3. Ouvrir `/litiges/[id]` avec les deux comptes audit : le fil s'affiche, et un message part.
4. Ouvrir une fiche prestataire et la carte : les noms s'affichent comme avant.
