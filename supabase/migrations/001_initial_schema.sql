-- ============================================================
-- NEXTO — Schéma initial complet
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('client', 'pro', 'admin');
CREATE TYPE pro_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE legal_form AS ENUM (
  'auto_entrepreneur', 'sarl', 'eurl', 'sas', 'sasu',
  'ei', 'sa', 'artisan', 'cesu', 'particulier_emploi'
);
CREATE TYPE vat_regime AS ENUM (
  'franchise_base',   -- auto-entrepreneur < seuil
  'reel_simplifie',   -- TVA réelle simplifiée
  'reel_normal',      -- TVA réelle normale
  'non_assujetti'     -- particulier employeur, CESU
);
CREATE TYPE service_type AS ENUM (
  'plomberie', 'electricite', 'serrurerie', 'menage',
  'baby_sitting', 'jardinage', 'manutention', 'bricolage',
  'peinture', 'chauffage', 'vitrerie', 'autre'
);
CREATE TYPE mission_status AS ENUM (
  'pending', 'quoted', 'accepted', 'paid',
  'in_progress', 'completed', 'disputed', 'cancelled', 'refunded'
);
CREATE TYPE document_type AS ENUM (
  'id_card', 'kbis', 'rc_pro', 'decennale',
  'urssaf', 'siret_cert', 'iban_cert', 'other'
);
CREATE TYPE document_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE litige_status AS ENUM ('open', 'under_review', 'resolved_client', 'resolved_pro', 'closed');

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'client',
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  birthdate     DATE,
  address       TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRO PROFILES ────────────────────────────────────────────
CREATE TABLE pro_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          pro_status NOT NULL DEFAULT 'pending',
  legal_form      legal_form NOT NULL,
  company_name    TEXT NOT NULL,
  siret           TEXT UNIQUE,
  naf_code        TEXT,
  rcs_number      TEXT,
  vat_regime      vat_regime NOT NULL DEFAULT 'franchise_base',
  vat_number      TEXT,
  social_capital  NUMERIC(12,2),
  hq_address      TEXT,
  bio             TEXT,
  hourly_rate     NUMERIC(8,2),
  travel_fee      NUMERIC(8,2) DEFAULT 0,
  location        GEOGRAPHY(POINT, 4326),
  radius_km       INTEGER DEFAULT 10,
  is_available    BOOLEAN DEFAULT true,
  rating_avg      NUMERIC(3,2) DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  mission_count   INTEGER DEFAULT 0,
  stripe_account_id TEXT,
  iban            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRO SERVICES ────────────────────────────────────────────
CREATE TABLE pro_services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id      UUID NOT NULL REFERENCES pro_profiles(id) ON DELETE CASCADE,
  service     service_type NOT NULL,
  UNIQUE(pro_id, service)
);

-- ─── PRO DOCUMENTS ───────────────────────────────────────────
CREATE TABLE pro_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id        UUID NOT NULL REFERENCES pro_profiles(id) ON DELETE CASCADE,
  doc_type      document_type NOT NULL,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  status        document_status DEFAULT 'pending',
  expires_at    DATE,
  verified_at   TIMESTAMPTZ,
  verified_by   UUID REFERENCES profiles(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MISSIONS ────────────────────────────────────────────────
CREATE TABLE missions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref             TEXT UNIQUE NOT NULL DEFAULT 'NXT-' || UPPER(SUBSTR(uuid_generate_v4()::TEXT, 1, 8)),
  client_id       UUID NOT NULL REFERENCES profiles(id),
  pro_id          UUID REFERENCES pro_profiles(id),
  service         service_type NOT NULL,
  status          mission_status NOT NULL DEFAULT 'pending',
  description     TEXT NOT NULL,
  address         TEXT NOT NULL,
  floor           TEXT,
  access_code     TEXT,
  location        GEOGRAPHY(POINT, 4326),
  urgency         TEXT DEFAULT 'normal', -- normal, today, immediate
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  amount_ht       NUMERIC(10,2),
  vat_rate        NUMERIC(5,2) DEFAULT 10,
  amount_ttc      NUMERIC(10,2),
  commission_rate NUMERIC(5,2) DEFAULT 10,
  commission_ttc  NUMERIC(10,2),
  nexto_fee_client NUMERIC(10,2),
  stripe_payment_intent TEXT,
  escrow_released BOOLEAN DEFAULT false,
  qr_start_code   TEXT,
  qr_end_code     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── QUOTES (devis) ──────────────────────────────────────────
CREATE TABLE quotes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  pro_id      UUID NOT NULL REFERENCES pro_profiles(id),
  lines       JSONB NOT NULL DEFAULT '[]', -- [{label, qty, unit_price_ht}]
  vat_rate    NUMERIC(5,2) DEFAULT 10,
  total_ht    NUMERIC(10,2) NOT NULL,
  total_ttc   NUMERIC(10,2) NOT NULL,
  note        TEXT,
  valid_until TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES (factures) ─────────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref             TEXT UNIQUE NOT NULL DEFAULT 'FAC-' || UPPER(SUBSTR(uuid_generate_v4()::TEXT, 1, 8)),
  mission_id      UUID NOT NULL REFERENCES missions(id),
  quote_id        UUID REFERENCES quotes(id),
  client_id       UUID NOT NULL REFERENCES profiles(id),
  pro_id          UUID NOT NULL REFERENCES pro_profiles(id),
  lines           JSONB NOT NULL DEFAULT '[]',
  vat_rate        NUMERIC(5,2),
  total_ht        NUMERIC(10,2) NOT NULL,
  total_ttc       NUMERIC(10,2) NOT NULL,
  nexto_commission NUMERIC(10,2),
  net_pro         NUMERIC(10,2),
  legal_mentions  JSONB, -- RC pro, décennale, etc.
  pdf_url         TEXT,
  issued_at       TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  cesu_eligible   BOOLEAN DEFAULT false,
  tax_credit_eligible BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LITIGES ─────────────────────────────────────────────────
CREATE TABLE litiges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  opened_by   UUID NOT NULL REFERENCES profiles(id),
  status      litige_status DEFAULT 'open',
  description TEXT NOT NULL,
  photos      TEXT[] DEFAULT '{}',
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  decision    TEXT,
  amount_refunded NUMERIC(10,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      UUID NOT NULL REFERENCES missions(id),
  client_id       UUID NOT NULL REFERENCES profiles(id),
  pro_id          UUID NOT NULL REFERENCES pro_profiles(id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality     INTEGER CHECK (punctuality BETWEEN 1 AND 5),
  quality         INTEGER CHECK (quality BETWEEN 1 AND 5),
  cleanliness     INTEGER CHECK (cleanliness BETWEEN 1 AND 5),
  communication   INTEGER CHECK (communication BETWEEN 1 AND 5),
  comment         TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_public       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MESSAGES ────────────────────────────────────────────────
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  sender_id   UUID NOT NULL REFERENCES profiles(id),
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'text', -- text, quote, system
  metadata    JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRO QR CODES ────────────────────────────────────────────
CREATE TABLE pro_qr_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id      UUID NOT NULL REFERENCES pro_profiles(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
  scanned_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CLIENT CRM (contacts sauvegardés par pro) ───────────────
CREATE TABLE pro_contacts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_id      UUID NOT NULL REFERENCES pro_profiles(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES profiles(id),
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  source      TEXT DEFAULT 'qr', -- qr, mission, manual
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pro_id, client_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_pro_profiles_location ON pro_profiles USING GIST(location);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_client ON missions(client_id);
CREATE INDEX idx_missions_pro ON missions(pro_id);
CREATE INDEX idx_messages_mission ON messages(mission_id);
CREATE INDEX idx_reviews_pro ON reviews(pro_id);

-- ─── FONCTION PROS NEARBY ────────────────────────────────────
CREATE OR REPLACE FUNCTION pros_nearby(
  lat FLOAT, lng FLOAT, radius_m INT DEFAULT 10000,
  service service_type DEFAULT NULL
)
RETURNS TABLE(
  pro_id UUID, user_id UUID, company_name TEXT,
  hourly_rate NUMERIC, travel_fee NUMERIC,
  rating_avg NUMERIC, rating_count INT,
  distance_m FLOAT, is_available BOOLEAN,
  legal_form legal_form, vat_regime vat_regime
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.user_id, p.company_name,
    p.hourly_rate, p.travel_fee,
    p.rating_avg, p.rating_count,
    ST_Distance(p.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY) AS distance_m,
    p.is_available,
    p.legal_form, p.vat_regime
  FROM pro_profiles p
  LEFT JOIN pro_services ps ON ps.pro_id = p.id
  WHERE
    p.status = 'active'
    AND p.is_available = true
    AND p.location IS NOT NULL
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY,
      radius_m
    )
    AND (service IS NULL OR ps.service = service)
  ORDER BY distance_m
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE litiges ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_contacts ENABLE ROW LEVEL SECURITY;

-- Profiles: chacun voit/modifie le sien
CREATE POLICY "profile_own" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profile_public_read" ON profiles FOR SELECT USING (true);

-- Pro profiles: public read, own write
CREATE POLICY "pro_profile_public" ON pro_profiles FOR SELECT USING (status = 'active');
CREATE POLICY "pro_profile_own" ON pro_profiles FOR ALL USING (user_id = auth.uid());

-- Missions: client et pro concernés
CREATE POLICY "mission_client" ON missions FOR ALL USING (client_id = auth.uid());
CREATE POLICY "mission_pro" ON missions FOR ALL USING (
  pro_id IN (SELECT id FROM pro_profiles WHERE user_id = auth.uid())
);

-- Messages: participants à la mission
CREATE POLICY "messages_mission" ON messages FOR ALL USING (
  mission_id IN (
    SELECT id FROM missions
    WHERE client_id = auth.uid()
    OR pro_id IN (SELECT id FROM pro_profiles WHERE user_id = auth.uid())
  )
);

-- Invoices: client ou pro concerné
CREATE POLICY "invoice_client" ON invoices FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "invoice_pro" ON invoices FOR SELECT USING (
  pro_id IN (SELECT id FROM pro_profiles WHERE user_id = auth.uid())
);

-- Reviews: public read, client write
CREATE POLICY "review_public" ON reviews FOR SELECT USING (is_public = true);
CREATE POLICY "review_client" ON reviews FOR INSERT WITH CHECK (client_id = auth.uid());

-- Documents: pro only + admin
CREATE POLICY "doc_own" ON pro_documents FOR ALL USING (
  pro_id IN (SELECT id FROM pro_profiles WHERE user_id = auth.uid())
);

-- Pro contacts: pro only
CREATE POLICY "contacts_pro" ON pro_contacts FOR ALL USING (
  pro_id IN (SELECT id FROM pro_profiles WHERE user_id = auth.uid())
);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pro_updated BEFORE UPDATE ON pro_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRIGGER nouveau profil à la création auth ───────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, phone, birthdate)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'birthdate')::DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
