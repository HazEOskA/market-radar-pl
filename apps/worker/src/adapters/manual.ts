import { parse } from "node-html-parser";
import type { Adapter, AdapterResult, WatchUrl, RawListing } from "@market-radar-pl/types";
import { rateLimitedFetch } from "../fetcher.js";

/**
 * Generic HTML adapter — extracts structured-data JSON-LD and common
 * open-graph / microdata patterns from any page. Suitable as a fallback
 * when a dedicated adapter is not available.
 */
export const manualAdapter: Adapter = {
  source: "manual",

  async fetch(watchUrl: WatchUrl): Promise<AdapterResult> {
    const result = await rateLimitedFetch(watchUrl.url);

    if (result.error || !result.body) {
      return { listings: [], http_status: result.status, error: result.error };
    }

    try {
      const listings = parseGenericHtml(result.body, watchUrl.url);
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

function parseGenericHtml(html: string, baseUrl: string): RawListing[] {
  const root = parse(html);
  const listings: RawListing[] = [];

  // Try JSON-LD Product / ItemList
  const ldScripts = root.querySelectorAll('script[type="application/ld+json"]');
  for (const script of ldScripts) {
    try {
      const data: unknown = JSON.parse(script.text);
      const extracted = extractFromJsonLd(data, baseUrl);
      listings.push(...extracted);
    } catch {
      // malformed JSON-LD — skip
    }
  }

  if (listings.length > 0) return listings;

  // Fallback: look for OG title + price meta
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "";
  const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
  const ogUrl   = root.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? baseUrl;

  if (ogTitle) {
    listings.push({
      external_id:   null,
      url:           ogUrl,
      title:         ogTitle,
      price_pln:     null,
      currency:      "PLN",
      category:      null,
      location:      null,
      thumbnail_url: ogImage,
    });
  }

  return listings;
}

function extractFromJsonLd(data: unknown, baseUrl: string): RawListing[] {
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  const type = String(obj["@type"] ?? "");

  if (type === "ItemList") {
    const items = Array.isArray(obj["itemListElement"]) ? obj["itemListElement"] : [];
    return items.flatMap((item: unknown) => extractFromJsonLd(item, baseUrl));
  }

  if (type === "ListItem" && obj["item"]) {
    return extractFromJsonLd(obj["item"], baseUrl);
  }

  if (type === "Product" || type === "Offer") {
    const url   = String(obj["url"] ?? baseUrl);
    const title = String(obj["name"] ?? "");
    if (!title) return [];

    let price_pln: number | null = null;
    const offers = obj["offers"] as Record<string, unknown> | undefined;
    if (offers) {
      const rawPrice = parseFloat(String(offers["price"] ?? ""));
      if (!isNaN(rawPrice)) price_pln = rawPrice;
    }

    return [
      {
        external_id:   String(obj["productID"] ?? obj["sku"] ?? url),
        url,
        title,
        price_pln,
        currency:      "PLN",
        category:      String(obj["category"] ?? ""),
        location:      null,
        thumbnail_url: typeof obj["image"] === "string" ? obj["image"] : null,
      },
    ];
  }

  return [];
}
