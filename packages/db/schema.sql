-- market-radar-pl schema
-- Compatible with Supabase / PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- watch_urls: URLs the worker monitors for listings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watch_urls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT NOT NULL UNIQUE,
  label         TEXT,
  source        TEXT NOT NULL CHECK (source IN ('olx','allegro','manual','otodom','sprzedajemy')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------
-- listings: one row per unique listing URL
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_url_id    UUID NOT NULL REFERENCES watch_urls(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,
  external_id     TEXT,
  url             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  price_pln       NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'PLN',
  category        TEXT,
  location        TEXT,
  thumbnail_url   TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','probably_gone','confirmed_gone','unknown')),
  missing_checks  INTEGER NOT NULL DEFAULT 0,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  probably_gone_at TIMESTAMPTZ,
  confidence      TEXT NOT NULL DEFAULT 'low'
                    CHECK (confidence IN ('low','medium','high')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_watch_url ON listings(watch_url_id);
CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_first_seen ON listings(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_listings_category  ON listings(category);

-- ----------------------------------------------------------------
-- snapshots: one row per worker run per watch_url
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_url_id    UUID NOT NULL REFERENCES watch_urls(id) ON DELETE CASCADE,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  listing_count   INTEGER NOT NULL DEFAULT 0,
  raw_listing_ids UUID[] NOT NULL DEFAULT '{}',
  http_status     INTEGER,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_watch_url ON snapshots(watch_url_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_scraped_at ON snapshots(scraped_at);

-- ----------------------------------------------------------------
-- listing_events: audit trail of status / price changes
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
                  CHECK (event_type IN ('first_seen','price_change','status_change','probably_gone')),
  payload       JSONB NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_listing   ON listing_events(listing_id);
CREATE INDEX IF NOT EXISTS idx_events_type      ON listing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_occurred  ON listing_events(occurred_at);

-- ----------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_updated_at ON listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- Useful views
-- ----------------------------------------------------------------

CREATE OR REPLACE VIEW vw_new_today AS
SELECT *
FROM   listings
WHERE  first_seen_at >= now() - INTERVAL '24 hours'
  AND  status = 'active';

CREATE OR REPLACE VIEW vw_gone_under_24h AS
SELECT *
FROM   listings
WHERE  probably_gone_at IS NOT NULL
  AND  (probably_gone_at - first_seen_at) < INTERVAL '24 hours';

CREATE OR REPLACE VIEW vw_category_heat AS
SELECT
  COALESCE(category, 'Unknown') AS category,
  COUNT(*) FILTER (WHERE first_seen_at >= now() - INTERVAL '24 hours' AND status = 'active')
    AS new_today,
  COUNT(*) FILTER (WHERE probably_gone_at IS NOT NULL
    AND (probably_gone_at - first_seen_at) < INTERVAL '24 hours')
    AS gone_under_24h,
  ROUND(AVG(price_pln) FILTER (WHERE price_pln IS NOT NULL), 2)
    AS avg_price_pln
FROM   listings
GROUP  BY COALESCE(category, 'Unknown')
ORDER  BY new_today DESC;
