-- =====================================================================
-- NEXTO — Schéma Supabase complet
-- À exécuter sur un schéma public PROPRE (après DROP SCHEMA public CASCADE)
-- Postgres 15 + PostGIS
-- =====================================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------- ENUMS ----------
CREATE TYPE user_role     AS ENUM ('client', 'pro', 'admin');
CREATE TYPE pro_status    AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE legal_form    AS ENUM ('auto_entrepreneur', 'sarl', 'eurl', 'sas', 'sasu', 'ei', 'sa', 'artisan', 'cesu', 'particulier_emploi');
CREATE TYPE vat_regime    AS ENUM ('franchise_base', 'reel_simplifie', 'reel_normal', 'non_assujetti');
CREATE TYPE service_type  AS ENUM ('plomberie', 'electricite', 'serrurerie', 'menage', 'baby_sitting', 'jardinage', 'manutention', 'bricolage', 'peinture', 'chauffage', 'vitrerie', 'autre');
CREATE TYPE mission_status AS ENUM ('pending', 'quoted', 'accepted', 'paid', 'in_progress', 'completed', 'disputed', 'cancelled', 'refunded');
CREATE TYPE document_type AS ENUM ('kbis', 'assurance_rc_pro', 'assurance_decennale', 'piece_identite', 'attestation_urssaf', 'diplome', 'autre');
CREATE TYPE doc_status     AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_status AS ENUM ('requires_payment', 'held', 'released', 'refunded', 'failed');
CREATE TYPE dispute_status AS ENUM ('open', 'investigating', 'resolved_client', 'resolved_pro', 'closed');
CREATE TYPE qr_kind        AS ENUM ('arrival', 'completion');

-- =====================================================================
-- 1. profiles  (1-1 avec auth.users)
-- =====================================================================
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role NOT NULL DEFAULT 'client',
  full_name    text,
  phone        text,
  avatar_url   text,
  birth_date   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. pros
-- =====================================================================
CREATE TABLE pros (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  status          pro_status NOT NULL DEFAULT 'pending',
  company_name    text,
  legal_form      legal_form,
  siret           text,
  rcs             text,
  naf_code        text,
  vat_regime      vat_regime,
  vat_number      text,
  address         text,
  city            text,
  postal_code     text,
  location        geography(Point, 4326),
  service_radius_km int NOT NULL DEFAULT 15,
  bio             text,
  rating_avg      numeric(3,2) NOT NULL DEFAULT 0,
  rating_count    int NOT NULL DEFAULT 0,
  iban            text,
  stripe_account_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pros_location ON pros USING GIST (location);
CREATE INDEX idx_pros_status   ON pros (status);

-- =====================================================================
-- 3. pro_services  (un pro propose 1..n métiers)
-- =====================================================================
CREATE TABLE pro_services (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id       uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  service      service_type NOT NULL,
  hourly_rate  numeric(10,2),
  callout_fee  numeric(10,2),
  UNIQUE (pro_id, service)
);
CREATE INDEX idx_pro_services_service ON pro_services (service);

-- =====================================================================
-- 4. pro_gallery  (photos scopées par métier)
-- =====================================================================
CREATE TABLE pro_gallery (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id     uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  service    service_type NOT NULL,
  image_url  text NOT NULL,
  caption    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. documents  (justificatifs pro)
-- =====================================================================
CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id     uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  type       document_type NOT NULL,
  file_url   text NOT NULL,
  status     doc_status NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. missions
-- =====================================================================
CREATE TABLE missions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pro_id        uuid REFERENCES pros(id) ON DELETE SET NULL,
  service       service_type NOT NULL,
  status        mission_status NOT NULL DEFAULT 'pending',
  description   text,
  address       text,
  location      geography(Point, 4326),
  scheduled_at  timestamptz,
  expires_at    timestamptz,  -- timer 15 min = simple expiration, aucune pénalité
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_missions_client ON missions (client_id);
CREATE INDEX idx_missions_pro    ON missions (pro_id);
CREATE INDEX idx_missions_status ON missions (status);

-- =====================================================================
-- 7. quotes  (devis)
-- =====================================================================
CREATE TABLE quotes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id    uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  pro_id        uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  amount_ht     numeric(10,2) NOT NULL,
  vat_rate      numeric(5,2)  NOT NULL DEFAULT 20.00,
  amount_ttc    numeric(10,2) NOT NULL,
  details       jsonb,
  accepted      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 8. payments  (escrow Stripe)
-- =====================================================================
CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id         uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  stripe_payment_intent text,
  amount_ttc         numeric(10,2) NOT NULL,
  commission_rate    numeric(5,2) NOT NULL,
  commission_amount  numeric(10,2) NOT NULL,
  pro_payout         numeric(10,2) NOT NULL,
  status             payment_status NOT NULL DEFAULT 'requires_payment',
  held_at            timestamptz,
  released_at        timestamptz,  -- libération J+2 après QR completion
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 9. qr_validations  (double QR : arrivée + fin)
-- =====================================================================
CREATE TABLE qr_validations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id   uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  kind         qr_kind NOT NULL,
  code         text NOT NULL,
  validated_at timestamptz,
  gps_lat      double precision,
  gps_lng      double precision,
  UNIQUE (mission_id, kind)
);

-- =====================================================================
-- 10. invoices  (factures, mentions légales FR)
-- =====================================================================
CREATE TABLE invoices (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id    uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  pro_id        uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  amount_ht     numeric(10,2) NOT NULL,
  vat_amount    numeric(10,2) NOT NULL,
  amount_ttc    numeric(10,2) NOT NULL,
  pdf_url       text,
  legal_mentions jsonb,  -- RC Pro, decennale, FEVAD, L.441-10, credit impot 7DB...
  issued_at     timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 11. reviews  (avis vérifiés, scopés par métier)
-- =====================================================================
CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  uuid NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
  pro_id      uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service     service_type NOT NULL,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 12. conversations + 13. messages
-- =====================================================================
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  uuid REFERENCES missions(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pro_id      uuid NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages (conversation_id);

-- =====================================================================
-- 14. disputes  (litiges)
-- =====================================================================
CREATE TABLE disputes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  opened_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      dispute_status NOT NULL DEFAULT 'open',
  reason      text,
  resolution  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- =====================================================================
-- 15. referrals  (parrainage : crédit issu de la commission, J+2, non cumulable, scopé métier)
-- =====================================================================
CREATE TABLE referrals (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service       service_type NOT NULL,  -- utilisable uniquement dans cette catégorie
  credit_amount numeric(10,2) NOT NULL DEFAULT 0,
  credited      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

-- =====================================================================
-- 16. notifications
-- =====================================================================
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  category   text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 17. commission_config  (commission glissante)
-- =====================================================================
CREATE TABLE commission_config (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service      service_type,
  min_amount   numeric(10,2) NOT NULL DEFAULT 0,
  max_amount   numeric(10,2),
  rate         numeric(5,2) NOT NULL,
  active       boolean NOT NULL DEFAULT true
);

-- =====================================================================
-- 18. audit_log
-- =====================================================================
CREATE TABLE audit_log (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text,
  entity_id  uuid,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- Fonction PostGIS : pros à proximité (pour la carte / le Ping)
-- =====================================================================
CREATE OR REPLACE FUNCTION pros_near(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 15,
  p_service service_type DEFAULT NULL
)
RETURNS TABLE (
  pro_id uuid,
  company_name text,
  rating_avg numeric,
  rating_count int,
  distance_km double precision
)
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.company_name, p.rating_avg, p.rating_count,
         ST_Distance(p.location, ST_MakePoint(lng, lat)::geography) / 1000.0 AS distance_km
  FROM pros p
  WHERE p.status = 'active'
    AND p.location IS NOT NULL
    AND ST_DWithin(p.location, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
    AND (
      p_service IS NULL
      OR EXISTS (SELECT 1 FROM pro_services ps WHERE ps.pro_id = p.id AND ps.service = p_service)
    )
  ORDER BY distance_km ASC;
$$;

-- =====================================================================
-- Trigger : maj note moyenne du pro après un avis
-- =====================================================================
CREATE OR REPLACE FUNCTION refresh_pro_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE pros SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE pro_id = NEW.pro_id),
    rating_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = NEW.pro_id)
  WHERE id = NEW.pro_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_refresh_pro_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_pro_rating();

-- =====================================================================
-- Trigger : créer un profile à l'inscription auth
-- =====================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_gallery   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- profiles : chacun lit/écrit le sien
CREATE POLICY profiles_self ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- pros : lecture publique des pros actifs ; le pro gère le sien
CREATE POLICY pros_public_read ON pros
  FOR SELECT USING (status = 'active' OR profile_id = auth.uid());
CREATE POLICY pros_owner_write ON pros
  FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- pro_services / pro_gallery : lecture publique
CREATE POLICY pro_services_read ON pro_services FOR SELECT USING (true);
CREATE POLICY pro_gallery_read  ON pro_gallery  FOR SELECT USING (true);
CREATE POLICY pro_services_owner ON pro_services
  FOR ALL USING (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()));
CREATE POLICY pro_gallery_owner ON pro_gallery
  FOR ALL USING (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()));

-- documents : visibles par le pro propriétaire
CREATE POLICY documents_owner ON documents
  FOR ALL USING (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid()));

-- missions : client propriétaire ou pro assigné
CREATE POLICY missions_party ON missions
  FOR ALL USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid())
  ) WITH CHECK (client_id = auth.uid());

-- reviews : lecture publique ; écriture par le client de la mission
CREATE POLICY reviews_read ON reviews FOR SELECT USING (true);
CREATE POLICY reviews_write ON reviews
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- messages / conversations : parties prenantes
CREATE POLICY conversations_party ON conversations
  FOR ALL USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM pros p WHERE p.id = pro_id AND p.profile_id = auth.uid())
  );
CREATE POLICY messages_party ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid()
             OR EXISTS (SELECT 1 FROM pros p WHERE p.id = c.pro_id AND p.profile_id = auth.uid()))
    )
  );

-- notifications : chacun les siennes
CREATE POLICY notifications_self ON notifications
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- referrals : le parrain voit les siens
CREATE POLICY referrals_self ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- =====================================================================
-- FIN
-- =====================================================================
