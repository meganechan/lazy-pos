-- lazy-pos schema (Postgres) — mirrors pm1 design spec v0.3 §3
-- store_id on every main table (future-proof; single store for now)

CREATE TABLE IF NOT EXISTS store (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL
);

-- §v0.8 Multi-tenant SaaS — store = tenant. Each store gets a unique shop code
-- used by the shop-scoped login picker. Idempotent (bootstrap runs every start).
ALTER TABLE store ADD COLUMN IF NOT EXISTS code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS store_code_uniq ON store(code);
ALTER TABLE store ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS member (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES store(id),
  line_user_id TEXT,
  name         TEXT NOT NULL,
  phone        TEXT,
  notes        TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES store(id),
  name         TEXT NOT NULL,
  category     TEXT,
  base_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 30,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ticket (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES store(id),
  member_id    INTEGER REFERENCES member(id),
  staff_name   TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','done','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticket_item (
  id           SERIAL PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES service(id),
  qty          INTEGER NOT NULL DEFAULT 1,
  quoted_price NUMERIC(10,2) NOT NULL,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS quote_confirm (
  id           SERIAL PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL DEFAULT 'line',
  quoted_total NUMERIC(10,2) NOT NULL,
  sent_at      TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  line_msg_id  TEXT
);

CREATE TABLE IF NOT EXISTS payment (
  id                   SERIAL PRIMARY KEY,
  ticket_id            INTEGER NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  payment_seq          INTEGER NOT NULL,
  method               TEXT NOT NULL CHECK (method IN ('cash','beam_edc','unpaid')),
  amount               NUMERIC(10,2) NOT NULL,
  beam_idempotency_key UUID,
  beam_charge_id       TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','success','failed','voided')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §6 RBAC + audit (v0.4). pin_hash is an auth/password hash (scrypt), NOT an
-- idempotency hash. Demo users seeded from JS bootstrap (hashing lives in JS).
CREATE TABLE IF NOT EXISTS app_user (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES store(id),
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('owner','staff')),
  pin_hash     TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  store_id      INTEGER,
  actor_user_id INTEGER,
  action        TEXT NOT NULL,
  entity        TEXT,
  entity_id     TEXT,
  detail        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- §v1.0 Durable sessions — survive server restart / deploy (was in-memory).
-- Token is a random UUID; the row carries a denormalised snapshot of the user
-- so auth needs a single indexed lookup. expires_at gates validity (30-day TTL
-- set by the server). Idempotent — bootstrap() runs this file every startup.
CREATE TABLE IF NOT EXISTS app_session (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES app_user(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  store_id    INTEGER NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_session_expires ON app_session (expires_at);

-- §v1.1 Free-style (custom) line items + safe service migrate-on-delete.
-- Non-destructive: existing ticket_item rows keep their service_id. A custom
-- item has service_id = NULL and carries its label in custom_name.
ALTER TABLE ticket_item ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- §v1.2 Discounts (bill + per-item, % or ฿) + staff pricing + staff
-- permission ceilings / daily quota + owner-PIN override. All non-destructive.
-- Semantics: for a STAFF user, max_discount_percent / max_discount_baht are the
-- ceiling they may apply WITHOUT an owner override; daily_discount_quota /
-- daily_staff_price_quota are how many discount / staff-price actions they may
-- do per day WITHOUT override. 0 = none allowed without override. OWNER is
-- unlimited and never needs override.
ALTER TABLE service     ADD COLUMN IF NOT EXISTS staff_price NUMERIC(10,2);
ALTER TABLE ticket      ADD COLUMN IF NOT EXISTS discount_type TEXT;   -- 'percent' | 'baht' | NULL
ALTER TABLE ticket      ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2);
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2);
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS is_staff_price BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS store_settings (
  store_id                INTEGER PRIMARY KEY REFERENCES store(id),
  max_discount_percent    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  max_discount_baht       NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_discount_quota    INTEGER NOT NULL DEFAULT 0,
  daily_staff_price_quota INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_daily_usage (
  store_id INTEGER NOT NULL,
  user_id  INTEGER NOT NULL,
  day      DATE NOT NULL,
  kind     TEXT NOT NULL,            -- 'discount' | 'staff_price' | 'override'
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, user_id, day, kind)
);

-- §v1.3 Per-staff discount/quota overrides. Each field is NULLABLE: a NULL means
-- "fall back to the store_settings value for this field". Non-destructive.
CREATE TABLE IF NOT EXISTS staff_settings (
  store_id                INTEGER NOT NULL,
  user_id                 INTEGER NOT NULL,
  max_discount_percent    NUMERIC(5,2),
  max_discount_baht       NUMERIC(10,2),
  daily_discount_quota    INTEGER,
  daily_staff_price_quota INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id)
);

-- §v0.6 Queue + per-item service time + technician lock.
-- Idempotent ADD COLUMN (Postgres) — bootstrap() runs this file every startup.
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS minutes INTEGER;
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES app_user(id);
-- §v1.4 — who opened the bill (for staff "see only my bills" RBAC). Non-destructive.
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES app_user(id);

-- §v1.5 — daily staff attendance (check-in/out). "Working today" is derived from
-- the row for CURRENT_DATE (checked in AND not checked out) — resets naturally each
-- day, no cron. Only checked-in staff appear in the queue / tech pickers.
CREATE TABLE IF NOT EXISTS attendance (
  store_id     INTEGER NOT NULL,
  user_id      INTEGER NOT NULL,
  day          DATE NOT NULL,
  check_in_at  TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  PRIMARY KEY (store_id, user_id, day)
);
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS est_minutes INTEGER;

-- §v0.7 Services full CRUD + deep detail (service description + add-on options).
-- Idempotent — bootstrap() runs this file every startup.
ALTER TABLE service ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS service_option (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER,
  service_id   INTEGER REFERENCES service(id),
  name         TEXT NOT NULL,
  price_delta  NUMERIC(10,2) DEFAULT 0,
  minute_delta INTEGER DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- §Beam Bolt PoC — per-store device pairing for the PAIRING (physical EDC) mode.
-- A store pairs once (POST /api/bolt/pair with a pairing code shown on the EDC),
-- storing the Bolt connection + device ids. Idempotent — bootstrap() runs this
-- file every startup.
ALTER TABLE store ADD COLUMN IF NOT EXISTS bolt_connection_id TEXT;
ALTER TABLE store ADD COLUMN IF NOT EXISTS bolt_device_id TEXT;

-- §issue#29 Multi-image upload for services (stored on DO Spaces / S3).
-- Each row is one uploaded image; ON DELETE CASCADE removes images when the
-- parent service is hard-deleted. Idempotent — bootstrap() runs this file every
-- startup. The matching CREATE also lives in index.js bootstrap for clarity.
CREATE TABLE IF NOT EXISTS service_image (
  id          SERIAL PRIMARY KEY,
  store_id    INT,
  service_id  INT REFERENCES service(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
