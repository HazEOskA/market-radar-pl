import { parse } from "node-html-parser";
import type { Adapter, AdapterResult, WatchUrl, RawListing } from "@market-radar-pl/types";
import { rateLimitedFetch } from "../fetcher.js";

/**
 * OLX.pl adapter — parses public search/category listing pages.
 * Only reads publicly visible HTML; no authentication or bypass techniques.
 */
export const olxAdapter: Adapter = {
  source: "olx",

  async fetch(watchUrl: WatchUrl): Promise<AdapterResult> {
    const result = await rateLimitedFetch(watchUrl.url);

    if (result.error || !result.body) {
      return { listings: [], http_status: result.status, error: result.error };
    }

    try {
      const listings = parseOlxHtml(result.body);
      return { listings, http_status: result.status, error: null };
    } catch (err) {
      return {
        listings: [],
        http_status: result.status,
        error: String(err),
      };
    }
  },
};

function parseOlxHtml(html: string): RawListing[] {
  const root = parse(html);
  const listings: RawListing[] = [];

  // OLX embeds listing data as a JSON blob in a <script> tag
  const scripts = root.querySelectorAll("script");
  for (const script of scripts) {
    const text = script.text;
    if (!text.includes("window.__PRERENDERED_STATE__")) continue;

    try {
      const match = text.match(/window\.__PRERENDERED_STATE__\s*=\s*({.+?});?\s*$/ms);
      if (!match?.[1]) continue;

      const state = JSON.parse(match[1]) as Record<string, unknown>;
      const extracted = extractFromOlxState(state);
      listings.push(...extracted);
      break;
    } catch {
      // JSON parse failed — fall through to DOM scraping
    }
  }

  if (listings.length > 0) return listings;

  // DOM fallback: OLX listing cards
  const cards = root.querySelectorAll('[data-cy="l-card"]');
  for (const card of cards) {
    const anchor = card.querySelector("a");
    const url    = anchor?.getAttribute("href");
    if (!url) continue;

    const fullUrl    = url.startsWith("http") ? url : `https://www.olx.pl${url}`;
    const title      = card.querySelector("h6")?.text.trim() ?? "";
    const priceText  = card.querySelector('[data-testid="ad-price"]')?.text.trim() ?? "";
    const location   = card.querySelector('[data-testid="location-date"]')?.text.trim() ?? null;
    const img        = card.querySelector("img")?.getAttribute("src") ?? null;

    const price_pln = parsePlnPrice(priceText);

    listings.push({
      external_id:   extractOlxId(fullUrl),
      url:           fullUrl,
      title,
      price_pln,
      currency:      "PLN",
      category:      null,
      location,
      thumbnail_url: img,
    });
  }

  return listings;
}

function extractFromOlxState(state: Record<string, unknown>): RawListing[] {
  try {
    // OLX state shape varies; we try a few known paths
    const ads =
      (state["listing"] as Record<string, unknown>)?.["ads"] ??
      (state["ads"] as unknown[]);

    if (!Array.isArray(ads)) return [];

    return ads.map((ad: unknown) => {
      const a = ad as Record<string, unknown>;
      const params = (a["params"] as Record<string, unknown>[]) ?? [];
      const priceParam = params.find((p) => p["key"] === "price");
      const price_pln  = priceParam
        ? parseFloat(String((priceParam["value"] as Record<string, unknown>)?.["value"] ?? ""))
        : null;

      return {
        external_id:   String(a["id"] ?? ""),
        url:           String(a["url"] ?? ""),
        title:         String(a["title"] ?? ""),
        price_pln:     isNaN(price_pln ?? NaN) ? null : price_pln,
        currency:      "PLN",
        category:      String((a["category"] as Record<string, unknown>)?.["name"] ?? ""),
        location:      String((a["location"] as Record<string, unknown>)?.["cityName"] ?? ""),
        thumbnail_url: extractThumb(a["photos"]),
      };
    });
  } catch {
    return [];
  }
}

function extractThumb(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0] as Record<string, unknown>;
  return String(first?.["link"] ?? "") || null;
}

function extractOlxId(url: string): string | null {
  const match = url.match(/ID(\w+)\.html/);
  return match?.[1] ?? null;
}

function parsePlnPrice(text: string): number | null {
  const cleaned = text.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
