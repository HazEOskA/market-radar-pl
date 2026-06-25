import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { classifyListing, shouldReactivate } from "./classifier.js";
import type { Listing } from "@market-radar-pl/types";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  const now = new Date().toISOString();
  return {
    id:              "test-id",
    watch_url_id:    "watch-id",
    source:          "olx",
    external_id:     null,
    url:             "https://www.olx.pl/d/oferta/test.html",
    title:           "Test listing",
    price_pln:       1000,
    currency:        "PLN",
    category:        "Electronics",
    location:        "Warsaw",
    thumbnail_url:   null,
    status:          "active",
    missing_checks:  0,
    first_seen_at:   now,
    last_seen_at:    now,
    probably_gone_at: null,
    confidence:      "high",
    created_at:      now,
    updated_at:      now,
    ...overrides,
  };
}

describe("classifyListing", () => {
  it("returns active+high confidence when missing_checks is 0", () => {
    const result = classifyListing(makeListing({ missing_checks: 0 }));
    expect(result.status).toBe("active");
    expect(result.confidence).toBe("high");
    expect(result.probably_gone_at).toBeNull();
  });

  it("returns active+low confidence for 1 missing check (single-check noise)", () => {
    const result = classifyListing(makeListing({ missing_checks: 1 }));
    expect(result.status).toBe("active");
    expect(result.confidence).toBe("low");
    expect(result.probably_gone_at).toBeNull();
  });

  it("returns probably_gone when missing_checks reaches the threshold (default 2)", () => {
    const result = classifyListing(makeListing({ missing_checks: 2 }));
    expect(result.status).toBe("probably_gone");
    expect(result.probably_gone_at).not.toBeNull();
  });

  it("returns probably_gone for missing_checks above the threshold", () => {
    const result = classifyListing(makeListing({ missing_checks: 5 }));
    expect(result.status).toBe("probably_gone");
  });

  describe("confidence levels", () => {
    it("is 'high' for short-lived listing (< 24 h) with extra missing checks", () => {
      const recentTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
      const listing = makeListing({
        missing_checks: 3, // above threshold + 1
        first_seen_at:  recentTime,
        last_seen_at:   recentTime,
      });
      const result = classifyListing(listing);
      expect(result.confidence).toBe("high");
    });

    it("is 'medium' for listing gone within 24h at exact threshold", () => {
      const recentTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // 6h ago
      const listing = makeListing({
        missing_checks: 2,
        first_seen_at:  recentTime,
        last_seen_at:   recentTime,
      });
      const result = classifyListing(listing);
      expect(result.confidence).toBe("medium");
    });

    it("is 'medium' for listing alive 1–7 days", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const listing = makeListing({
        missing_checks: 2,
        first_seen_at:  threeDaysAgo,
        last_seen_at:   threeDaysAgo,
      });
      const result = classifyListing(listing);
      expect(result.confidence).toBe("medium");
    });

    it("is 'low' for long-lived listing (> 7 days)", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const listing = makeListing({
        missing_checks: 2,
        first_seen_at:  tenDaysAgo,
        last_seen_at:   tenDaysAgo,
      });
      const result = classifyListing(listing);
      expect(result.confidence).toBe("low");
    });
  });

  it("sets a valid ISO timestamp in probably_gone_at", () => {
    const result = classifyListing(makeListing({ missing_checks: 2 }));
    expect(() => new Date(result.probably_gone_at!)).not.toThrow();
  });
});

describe("shouldReactivate", () => {
  it("returns true for a probably_gone listing that reappears (missing_checks = 0)", () => {
    const listing = makeListing({ status: "probably_gone", missing_checks: 0 });
    expect(shouldReactivate(listing)).toBe(true);
  });

  it("returns false for active listing with 0 missing checks", () => {
    const listing = makeListing({ status: "active", missing_checks: 0 });
    expect(shouldReactivate(listing)).toBe(false);
  });

  it("returns false for probably_gone with non-zero missing checks", () => {
    const listing = makeListing({ status: "probably_gone", missing_checks: 2 });
    expect(shouldReactivate(listing)).toBe(false);
  });
});
