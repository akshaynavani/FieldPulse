CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name                   TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('rep', 'manager')),
  territory              TEXT NOT NULL,
  quarterly_quota_cents  BIGINT NOT NULL DEFAULT 0 CHECK (quarterly_quota_cents >= 0),
  password_hash          TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opaque bearer sessions. Only a SHA-256 of the token is stored, so a DB leak
-- does not hand out live sessions.
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  device_label  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  industry       TEXT NOT NULL,
  tier           CHAR(1) NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  address        TEXT NOT NULL,
  lat            DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng            DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  last_visit_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_owner_idx ON accounts (owner_id);
CREATE INDEX accounts_name_idx ON accounts (lower(name));

CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT
);
CREATE INDEX contacts_account_idx ON contacts (account_id);

CREATE TABLE visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rep_id          UUID NOT NULL REFERENCES users(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  outcome         TEXT CHECK (outcome IN ('productive', 'follow_up_needed', 'no_decision_maker', 'rescheduled', 'not_interested')),
  notes           TEXT NOT NULL DEFAULT '',
  follow_up_at    TIMESTAMPTZ,
  check_in_lat    DOUBLE PRECISION,
  check_in_lng    DOUBLE PRECISION,
  CHECK ((completed_at IS NULL) = (outcome IS NULL))
);
CREATE INDEX visits_rep_scheduled_idx ON visits (rep_id, scheduled_at);
CREATE INDEX visits_account_idx ON visits (account_id);

CREATE TABLE deals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  owner_id             UUID NOT NULL REFERENCES users(id),
  title                TEXT NOT NULL,
  amount_cents         BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  stage                TEXT NOT NULL CHECK (stage IN ('prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  expected_close_date  DATE NOT NULL,
  lost_reason          TEXT,
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deals_owner_stage_idx ON deals (owner_id, stage);
CREATE INDEX deals_account_idx ON deals (account_id);

-- Replayed offline mutations carry an Idempotency-Key; the first response is
-- stored and returned again for duplicates.
CREATE TABLE idempotency_keys (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  status_code  INT NOT NULL,
  response     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
