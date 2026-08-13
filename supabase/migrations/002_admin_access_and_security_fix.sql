-- ============================================================================
-- PING — Migration 002 (13/08/2026)
-- Documente les changements appliqués en direct sur la base via le connecteur
-- Supabase au cours de cette session, pour que le depot GitHub reste la
-- source de verite. Note: 001_initial_schema.sql est perime (ancien schema
-- pro_profiles/missions/litiges) — le schema reellement en production est
-- celui cree plus tot dans cette meme session (profiles, provider_profiles,
-- services, documents, requests, transactions, messages, reviews, invoices,
-- disputes, events). Un futur snapshot complet remplacera 001.
-- ============================================================================

-- 1) admin_stats() etait reste branche sur l'ancien schema (pro_profiles,
--    missions, litiges, invoices.nexto_commission...) qui n'existe plus —
--    aurait plante des le premier appel. Reecrite pour le schema reel.
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'total_providers', (SELECT COUNT(*) FROM provider_profiles),
    'active_providers', (SELECT COUNT(*) FROM provider_profiles WHERE is_active = true),
    'inactive_providers', (SELECT COUNT(*) FROM provider_profiles WHERE is_active = false),
    'total_clients', (SELECT COUNT(*) FROM profiles WHERE is_pro = false),
    'total_requests', (SELECT COUNT(*) FROM requests),
    'open_requests', (SELECT COUNT(*) FROM requests WHERE status = 'open'),
    'total_transactions', (SELECT COUNT(*) FROM transactions),
    'completed_transactions', (SELECT COUNT(*) FROM transactions WHERE status IN ('completed','released')),
    'disputed_transactions', (SELECT COUNT(*) FROM transactions WHERE status = 'disputed'),
    'open_disputes', (SELECT COUNT(*) FROM disputes WHERE status = 'open'),
    'total_volume_cents', COALESCE((SELECT SUM(total_charged_cents) FROM transactions), 0),
    'total_commission_cents', COALESCE((SELECT SUM(buyer_fee_cents + seller_fee_cents) FROM transactions), 0),
    'pending_documents', (SELECT COUNT(*) FROM documents WHERE status = 'pending')
  );
$function$;

-- NB: generate_invoice(p_mission_id uuid) est egalement restee sur l'ancien
-- schema (missions, pro_profiles, invoices.mission_id/nexto_commission...)
-- et est donc cassee. Non corrigee dans cette session (aucun code ne
-- l'appelle actuellement) — a reconstruire quand la generation de facture
-- reelle sera reprise.

-- 2) Faille trouvee : la policy "profiles self write" autorisait un
--    utilisateur a modifier N'IMPORTE QUELLE colonne de sa propre ligne,
--    y compris is_admin => auto-promotion admin possible depuis le client.
--    Verrouillee par trigger : is_admin ne peut changer que via service_role.
CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND auth.role() <> 'service_role' THEN
    NEW.is_admin := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_is_admin ON public.profiles;
CREATE TRIGGER trg_protect_is_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_admin_escalation();

-- 3) Fonction utilitaire pour les policies admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;

-- 4) Lecture admin (necessaire au panneau "Apercu reel" de admin.html,
--    qui interroge directement Supabase depuis le navigateur avec la cle
--    anon — sans ces policies RLS, les requetes de l'admin renvoyaient du vide)
DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;
CREATE POLICY "profiles admin read" ON public.profiles FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "transactions admin read" ON public.transactions;
CREATE POLICY "transactions admin read" ON public.transactions FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "disputes admin read" ON public.disputes;
CREATE POLICY "disputes admin read" ON public.disputes FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "documents admin read" ON public.documents;
CREATE POLICY "documents admin read" ON public.documents FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "invoices admin read" ON public.invoices;
CREATE POLICY "invoices admin read" ON public.invoices FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "events admin read all" ON public.events;
CREATE POLICY "events admin read all" ON public.events FOR SELECT USING (public.is_admin());

-- 5) Ecriture admin ciblee : valider/rejeter un document, activer/desactiver
--    un prestataire, faire evoluer un litige — depuis le panneau "Apercu reel"
DROP POLICY IF EXISTS "documents admin update" ON public.documents;
CREATE POLICY "documents admin update" ON public.documents FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "provider_profiles admin write" ON public.provider_profiles;
CREATE POLICY "provider_profiles admin write" ON public.provider_profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "disputes admin update" ON public.disputes;
CREATE POLICY "disputes admin update" ON public.disputes FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6) doc_status n'avait pas de valeur "rejected" (seulement pending/valid/expired)
--    necessaire pour l'action "Rejeter" un document depuis l'admin.
ALTER TYPE public.doc_status ADD VALUE IF NOT EXISTS 'rejected';
