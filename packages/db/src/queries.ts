import type { Listing, WatchUrl, Snapshot, ListingEvent, RawListing, CategoryHeatRow } from "@market-radar-pl/types";
import { getDb } from "./client.js";

// ----------------------------------------------------------------
// WatchUrl queries
// ----------------------------------------------------------------

export async function getActiveWatchUrls(): Promise<WatchUrl[]> {
  const sql = getDb();
  const rows = await sql<WatchUrl[]>`
    SELECT * FROM watch_urls WHERE is_active = true ORDER BY created_at ASC
  `;
  return rows;
}

export async function insertWatchUrl(
  data: Pick<WatchUrl, "url" | "source" | "label">
): Promise<WatchUrl> {
  const sql = getDb();
  const [row] = await sql<WatchUrl[]>`
    INSERT INTO watch_urls (url, source, label)
    VALUES (${data.url}, ${data.source}, ${data.label ?? null})
    ON CONFLICT (url) DO UPDATE SET is_active = true
    RETURNING *
  `;
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function markWatchUrlChecked(id: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE watch_urls SET last_checked_at = now() WHERE id = ${id}`;
}

// ----------------------------------------------------------------
// Listing queries
// ----------------------------------------------------------------

export async function getListingByUrl(url: string): Promise<Listing | null> {
  const sql = getDb();
  const rows = await sql<Listing[]>`SELECT * FROM listings WHERE url = ${url}`;
  return rows[0] ?? null;
}

export async function upsertListing(
  watchUrlId: string,
  raw: RawListing,
  source: string
): Promise<{ listing: Listing; isNew: boolean }> {
  const sql = getDb();

  const existing = await getListingByUrl(raw.url);

  if (existing) {
    const [updated] = await sql<Listing[]>`
      UPDATE listings SET
        title         = ${raw.title},
        price_pln     = ${raw.price_pln ?? null},
        currency      = ${raw.currency},
        category      = ${raw.category ?? null},
        location      = ${raw.location ?? null},
        thumbnail_url = ${raw.thumbnail_url ?? null},
        last_seen_at  = now(),
        missing_checks = 0,
        status        = CASE WHEN status = 'probably_gone' THEN 'active' ELSE status END,
        updated_at    = now()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    if (!updated) throw new Error("Update returned no row");
    return { listing: updated, isNew: false };
  }

  const [inserted] = await sql<Listing[]>`
    INSERT INTO listings (
      watch_url_id, source, external_id, url, title,
      price_pln, currency, category, location, thumbnail_url
    ) VALUES (
      ${watchUrlId}, ${source}, ${raw.external_id ?? null}, ${raw.url}, ${raw.title},
      ${raw.price_pln ?? null}, ${raw.currency}, ${raw.category ?? null},
      ${raw.location ?? null}, ${raw.thumbnail_url ?? null}
    )
    RETURNING *
  `;
  if (!inserted) throw new Error("Insert returned no row");
  return { listing: inserted, isNew: true };
}

export async function markListingMissing(listingId: string): Promise<Listing> {
  const sql = getDb();
  const [row] = await sql<Listing[]>`
    UPDATE listings
    SET missing_checks = missing_checks + 1,
        updated_at     = now()
    WHERE id = ${listingId}
    RETURNING *
  `;
  if (!row) throw new Error("Listing not found: " + listingId);
  return row;
}

export async function applyClassification(
  listingId: string,
  status: Listing["status"],
  confidence: Listing["confidence"],
  probably_gone_at: string | null
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE listings
    SET status           = ${status},
        confidence       = ${confidence},
        probably_gone_at = ${probably_gone_at ?? null},
        updated_at       = now()
    WHERE id = ${listingId}
  `;
}

export async function getActiveListingsByWatchUrl(
  watchUrlId: string
): Promise<Listing[]> {
  const sql = getDb();
  return sql<Listing[]>`
    SELECT * FROM listings
    WHERE watch_url_id = ${watchUrlId}
      AND status NOT IN ('confirmed_gone')
  `;
}

// ----------------------------------------------------------------
// Snapshot queries
// ----------------------------------------------------------------

export async function insertSnapshot(data: Omit<Snapshot, "id" | "scraped_at">): Promise<Snapshot> {
  const sql = getDb();
  const [row] = await sql<Snapshot[]>`
    INSERT INTO snapshots (watch_url_id, listing_count, raw_listing_ids, http_status, error)
    VALUES (
      ${data.watch_url_id},
      ${data.listing_count},
      ${sql.array(data.raw_listing_ids)},
      ${data.http_status ?? null},
      ${data.error ?? null}
    )
    RETURNING *
  `;
  if (!row) throw new Error("Snapshot insert returned no row");
  return row;
}

// ----------------------------------------------------------------
// Event queries
// ----------------------------------------------------------------

export async function insertListingEvent(
  data: Omit<ListingEvent, "id" | "occurred_at">
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO listing_events (listing_id, event_type, payload)
    VALUES (${data.listing_id}, ${data.event_type}, ${sql.json(data.payload as Parameters<typeof sql.json>[0])})
  `;
}

// ----------------------------------------------------------------
// Dashboard queries
// ----------------------------------------------------------------

export async function getNewToday(): Promise<Listing[]> {
  const sql = getDb();
  return sql<Listing[]>`
    SELECT * FROM vw_new_today ORDER BY first_seen_at DESC LIMIT 100
  `;
}

export async function getGoneUnder24h(): Promise<Listing[]> {
  const sql = getDb();
  return sql<Listing[]>`
    SELECT * FROM vw_gone_under_24h ORDER BY probably_gone_at DESC LIMIT 100
  `;
}

export async function getCategoryHeat(): Promise<CategoryHeatRow[]> {
  const sql = getDb();
  return sql<CategoryHeatRow[]>`SELECT * FROM vw_category_heat LIMIT 20`;
}

export async function getPriceBands(): Promise<
  { band_label: string; min_pln: number; max_pln: number | null; count: number }[]
> {
  const sql = getDb();
  return sql`
    SELECT
      band_label,
      min_pln,
      max_pln,
      COUNT(*)::int AS count
    FROM (
      VALUES
        ('0–500 PLN',       0,    500),
        ('500–1000 PLN',  500,   1000),
        ('1000–5000 PLN', 1000,  5000),
        ('5000+ PLN',     5000,  NULL)
    ) AS bands(band_label, min_pln, max_pln)
    LEFT JOIN listings l
      ON l.price_pln >= bands.min_pln
     AND (bands.max_pln IS NULL OR l.price_pln < bands.max_pln)
     AND l.status = 'active'
    GROUP BY band_label, min_pln, max_pln
    ORDER BY min_pln ASC
  `;
}
