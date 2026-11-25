# Rubrique Données SQL : base, migrations, RLS (créé le 25/11/2026)
Session « PING · Données SQL ». Agents : securite-donnees, continuite-reprise. Claude n'a pas l'écriture Supabase : Romain colle le SQL.

## Ce qui est propre
Migrations (`supabase/migrations/`, copie dans `supabase/a_coller/`, ordre dans son README), sondes de détection, droits RLS, fonctions `security definer`, données de test et leur nettoyage, avoirs, sauvegardes.

## Règles
Migration rejouable, sans DROP ni DELETE ; app déployée AVANT de coller ; `set search_path = public` ; variables PL/pgSQL en `v_` ; `revoke ... from public, anon` puis `grant`. Détail : `REGLES-TECH.md` (section Base de données). `db-migrate.yml` neutralisé : ne jamais le réactiver.

## Argent
Renvoi : `REGLES-METIER.md`. Les tables d'argent (`invoices`, `transfer_payments`, `commission_debts`) sont décrites dans `RUBRIQUE-FACTURATION.md`.

## Code
`supabase/migrations/*`, `supabase/a_coller/*`, `src/lib/supabase/`. Contrôles : `CONTROLES.md`, `scripts/tests/`.

## À faire et notes
Voir `A-FAIRE.md`, section Données SQL. Nettoyage des données QA : jamais sans l'accord écrit de Romain, liste d'abord.
