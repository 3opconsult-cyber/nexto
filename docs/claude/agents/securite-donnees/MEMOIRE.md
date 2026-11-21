# Mémoire securite-donnees (vérifié le 21/11/2026)
## Droits qui existent (à ne pas affaiblir)
- `profiles` : RLS strictement self-read (044) ; noms d'interlocuteurs par RPC `transaction_counterparts` / `review_rater_names`.
- `requests` : lisible par l'auteur et les parties d'une transaction ; `anon` retiré (fuite d'adresse corrigée le 17/09) ; pros via `requests_nearby` (SECURITY DEFINER, position floutée ~500 m, sans adresse).
- `messages` : RLS refuse `sender_id` NULL (`systemSender()`). Garde 027 : rien n'est modifiable sur `messages`.
- `transfer_payments` : payeur ou destinataire seulement ; IBAN dans `provider_private`, donné via RPC `payee_bank_details` à l'acheteur d'une mission terminée facturée.
- `admin_notifications`, `mission_cancellations` : lecture admin (`is_admin()`). `provider_live_zone` : jamais lisible directement, RPC seulement.
- Triggers de garde : `trg_cancellation_rules`, `trg_guard_payment_status`, `trg_enforce_incident_window`, `trg_enforce_arrival_departure`, `trg_guard_avance_immediate*`, `trg_guard_transfer_not_received`.
## Faiblesses connues
- RLS `invoices` permissive : chaque partie peut lire la commission de l'autre par appel API direct ; filtrage applicatif (A-TRANCHER h, AMELIORATIONS A-012).
- Mots de passe de test en clair dans CLAUDE.md et `supabase/a_coller/README.md` (A-TRANCHER l).
- Droit sur fonctions : après `revoke` à anon, un appel anonyme répond PGRST202 : comportement attendu, ne pas « corriger » en rouvrant.
- Admin : clé de secours `ADMIN_FALLBACK_KEY` (variable Vercel, désactivée si absente) ; la vraie protection = compte `is_admin` + middleware.
- CGU, CGV, confidentialité PROVISOIRES : juridique à valider (A-TRANCHER j).
## Méthode
- Tester les droits avec un vrai compte (anon, client, pro, admin) : une relecture ne suffit pas (incidents #10, #11 d'ERREURS.md).
- Fonction SECURITY DEFINER : `set search_path = public`, `revoke ... from public, anon`, `grant` explicite, variables `v_`.
- Requête `pg_policies` de référence : docs/droits-base-2026-11-18.md.
- Toute requête MCP contenant DROP/DELETE déclenche une confirmation humaine ; privilégier ADD COLUMN / CREATE OR REPLACE.
## Données sensibles (DONNEES.md)
- Pièces d'identité, Kbis, assurances, adresses, téléphones chiffrés `phone_enc`, IBAN, photos de présence, positions floutées, messages, litiges. Aucun mineur. Durées de conservation : [à compléter].

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
