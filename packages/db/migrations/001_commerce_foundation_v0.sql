-- Commerce foundation v0
-- Adds snapshot authority metadata used to prevent false disappearance signals.

ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS fetch_status TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS previous_listing_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_ratio NUMERIC(12,6),
  ADD COLUMN IF NOT EXISTS is_authoritative BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'snapshots_fetch_status_check'
  ) THEN
    ALTER TABLE snapshots
      ADD CONSTRAINT snapshots_fetch_status_check
      CHECK (fetch_status IN ('healthy','degraded','failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_snapshots_authoritative
  ON snapshots(is_authoritative, scraped_at DESC);
