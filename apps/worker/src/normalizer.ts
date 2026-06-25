import type { RawListing } from "@market-radar-pl/types";

const TITLE_MAX = 200;

/**
 * Normalise a raw listing scraped from an adapter.
 * Trims whitespace, caps title length, normalises price and currency.
 */
export function normalizeListing(raw: RawListing): RawListing {
  return {
    external_id:   raw.external_id?.trim() || null,
    url:           raw.url.trim(),
    title:         raw.title.trim().slice(0, TITLE_MAX),
    price_pln:     normalizePricePln(raw.price_pln, raw.currency),
    currency:      normalizeCurrency(raw.currency),
    category:      raw.category?.trim() || null,
    location:      raw.location?.trim() || null,
    thumbnail_url: raw.thumbnail_url?.trim() || null,
  };
}

function normalizePricePln(price: number | null, currency: string): number | null {
  if (price === null || isNaN(price)) return null;
  if (price < 0) return null;
  // If we ever add EUR / USD adapters we can apply an exchange rate here
  return Math.round(price * 100) / 100;
}

function normalizeCurrency(currency: string): string {
  const upper = currency.trim().toUpperCase();
  return upper || "PLN";
}
