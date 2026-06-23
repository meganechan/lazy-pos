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

-- §v0.6 Queue + per-item service time + technician lock.
-- Idempotent ADD COLUMN (Postgres) — bootstrap() runs this file every startup.
ALTER TABLE ticket_item ADD COLUMN IF NOT EXISTS minutes INTEGER;
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES app_user(id);
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
