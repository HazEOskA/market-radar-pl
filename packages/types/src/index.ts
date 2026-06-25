// ----------------------------------------------------------------
// Core domain types for market-radar-pl
// ----------------------------------------------------------------

export type Source = "olx" | "allegro" | "manual" | "otodom" | "sprzedajemy";

export type ListingStatus =
  | "active"
  | "probably_gone"
  | "confirmed_gone"
  | "unknown";

/** Confidence that a listing disappearance reflects a real-world exit */
export type ConfidenceLabel = "low" | "medium" | "high";

export interface Listing {
  id: string;
  watch_url_id: string;
  source: Source;
  external_id: string | null;
  url: string;
  title: string;
  price_pln: number | null;
  currency: string;
  category: string | null;
  location: string | null;
  thumbnail_url: string | null;
  status: ListingStatus;
  /** Number of consecutive snapshots where this listing was absent */
  missing_checks: number;
  first_seen_at: string; // ISO-8601
  last_seen_at: string; // ISO-8601
  probably_gone_at: string | null; // ISO-8601
  confidence: ConfidenceLabel;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: string;
  watch_url_id: string;
  scraped_at: string; // ISO-8601
  listing_count: number;
  raw_listing_ids: string[];
  http_status: number | null;
  error: string | null;
}

export type ListingEventType =
  | "first_seen"
  | "price_change"
  | "status_change"
  | "probably_gone";

export interface ListingEvent {
  id: string;
  listing_id: string;
  event_type: ListingEventType;
  payload: Record<string, unknown>;
  occurred_at: string; // ISO-8601
}

export interface WatchUrl {
  id: string;
  url: string;
  label: string | null;
  source: Source;
  is_active: boolean;
  created_at: string;
  last_checked_at: string | null;
}

// ----------------------------------------------------------------
// Derived / analytics types
// ----------------------------------------------------------------

export interface CategoryHeatRow {
  category: string;
  new_today: number;
  gone_under_24h: number;
  avg_price_pln: number | null;
}

export interface PriceBandRow {
  band_label: string;
  min_pln: number;
  max_pln: number | null;
  count: number;
}

export interface DashboardSummary {
  new_today: Listing[];
  gone_under_24h: Listing[];
  category_heat: CategoryHeatRow[];
  price_bands: PriceBandRow[];
}

// ----------------------------------------------------------------
// Adapter contract
// ----------------------------------------------------------------

export interface RawListing {
  external_id: string | null;
  url: string;
  title: string;
  price_pln: number | null;
  currency: string;
  category: string | null;
  location: string | null;
  thumbnail_url: string | null;
}

export interface AdapterResult {
  listings: RawListing[];
  http_status: number;
  error: string | null;
}

export interface Adapter {
  source: Source;
  /** Fetch and parse listings from a watch URL */
  fetch(watchUrl: WatchUrl): Promise<AdapterResult>;
}

// ----------------------------------------------------------------
// Classifier output
// ----------------------------------------------------------------

export interface ClassifierResult {
  status: ListingStatus;
  confidence: ConfidenceLabel;
  probably_gone_at: string | null;
}
