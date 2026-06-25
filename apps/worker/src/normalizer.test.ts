import { describe, it, expect } from "vitest";
import { normalizeListing } from "./normalizer.js";
import type { RawListing } from "@market-radar-pl/types";

function makeRaw(overrides: Partial<RawListing> = {}): RawListing {
  return {
    external_id:   "abc123",
    url:           "https://example.com/listing/1",
    title:         "Test Listing",
    price_pln:     1234.56,
    currency:      "PLN",
    category:      "Electronics",
    location:      "Warsaw",
    thumbnail_url: "https://example.com/img.jpg",
    ...overrides,
  };
}

describe("normalizeListing", () => {
  it("trims whitespace from string fields", () => {
    const result = normalizeListing(makeRaw({ title: "  My Title  ", location: " Kraków " }));
    expect(result.title).toBe("My Title");
    expect(result.location).toBe("Kraków");
  });

  it("truncates title to 200 characters", () => {
    const long = "A".repeat(250);
    const result = normalizeListing(makeRaw({ title: long }));
    expect(result.title.length).toBe(200);
  });

  it("converts empty currency to PLN", () => {
    const result = normalizeListing(makeRaw({ currency: "" }));
    expect(result.currency).toBe("PLN");
  });

  it("uppercases currency", () => {
    const result = normalizeListing(makeRaw({ currency: "pln" }));
    expect(result.currency).toBe("PLN");
  });

  it("returns null for negative price", () => {
    const result = normalizeListing(makeRaw({ price_pln: -10 }));
    expect(result.price_pln).toBeNull();
  });

  it("returns null for NaN price", () => {
    const result = normalizeListing(makeRaw({ price_pln: NaN }));
    expect(result.price_pln).toBeNull();
  });

  it("rounds price to 2 decimal places", () => {
    const result = normalizeListing(makeRaw({ price_pln: 99.999 }));
    expect(result.price_pln).toBe(100);
  });

  it("converts empty external_id to null", () => {
    const result = normalizeListing(makeRaw({ external_id: "   " }));
    expect(result.external_id).toBeNull();
  });

  it("converts empty thumbnail_url to null", () => {
    const result = normalizeListing(makeRaw({ thumbnail_url: "" }));
    expect(result.thumbnail_url).toBeNull();
  });

  it("preserves valid price", () => {
    const result = normalizeListing(makeRaw({ price_pln: 1500.5 }));
    expect(result.price_pln).toBe(1500.5);
  });
});
