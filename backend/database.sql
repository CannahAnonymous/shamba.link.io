-- ShambaLink relational database schema.
-- Intended for PostgreSQL (Render PostgreSQL or another managed provider).

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  crop TEXT NOT NULL,
  local_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'agent', 'buyer')),
  location TEXT NOT NULL,
  distance_km NUMERIC(8, 2),
  quantity TEXT NOT NULL,
  price_tsh_per_kg NUMERIC(12, 2) NOT NULL CHECK (price_tsh_per_kg >= 0),
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listings_crop_search_idx
  ON listings (LOWER(crop), LOWER(local_name), LOWER(location));

CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'agent', 'buyer')),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unanswered_questions (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'sw')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'agent', 'buyer')),
  contact TEXT NOT NULL UNIQUE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
