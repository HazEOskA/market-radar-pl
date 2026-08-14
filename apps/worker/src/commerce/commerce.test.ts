import { describe, expect, it } from "vitest";
import type { Listing } from "@market-radar-pl/types";
import { candidateFingerprint, signalScoreFromListing } from "./candidate.js";
import { computeEconomics } from "./economics.js";
import { evaluateCommerceGate } from "./gate.js";

function listing(overrides: Partial<Listing> = {}): Listing {
  const now = Date.now();
  return {
    id: "listing-1",
    watch_url_id: "watch-1",
    source: "olx",
    external_id: "external-1",
    url: "https://example.test/listing-1",
    title: "Magnetic Power Bank 10000 mAh",
    price_pln: 129,
    currency: "PLN",
    category: "Electronics",
    location: "Warsaw",
    thumbnail_url: null,
    status: "probably_gone",
    missing_checks: 3,
    first_seen_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date(now - 30 * 60 * 1000).toISOString(),
    probably_gone_at: new Date(now).toISOString(),
    confidence: "high",
    created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
    ...overrides,
  };
}

describe("candidate derivation", () => {
  it("creates a deterministic normalized fingerprint", () => {
    expect(candidateFingerprint("Magnetic Power Bank 10000 mAh", "Electronics"))
      .toBe("electronics:magnetic-power-bank-10000-mah");
  });

  it("scores high-confidence fast exits strongly", () => {
    expect(signalScoreFromListing(listing())).toBe(100);
  });
});

describe("economics", () => {
  it("computes contribution margin and percentage", () => {
    const result = computeEconomics({
      targetPricePln: 169,
      supplierCostPln: 58,
      shippingCostPln: 14,
      channelFeePln: 17,
      returnsReservePln: 8,
    });
    expect(result.variableCostPln).toBe(97);
    expect(result.contributionMarginPln).toBe(72);
    expect(result.marginPct).toBe(42.6);
  });

  it("rejects invalid negative costs", () => {
    expect(() => computeEconomics({
      targetPricePln: 100,
      supplierCostPln: -1,
      shippingCostPln: 0,
      channelFeePln: 0,
    })).toThrow();
  });
});

describe("commerce gate", () => {
  const healthyEconomics = computeEconomics({
    targetPricePln: 169,
    supplierCostPln: 58,
    shippingCostPln: 14,
    channelFeePln: 17,
    returnsReservePln: 8,
  });

  it("holds candidates without economics for review", () => {
    expect(evaluateCommerceGate({ signalScore: 85, evidenceCount: 2, economics: null }).verdict)
      .toBe("REVIEW");
  });

  it("requires at least two pieces of evidence for draft readiness", () => {
    const result = evaluateCommerceGate({ signalScore: 85, evidenceCount: 1, economics: healthyEconomics });
    expect(result.verdict).toBe("REVIEW");
    expect(result.reasons).toContain("insufficient_independent_evidence");
  });

  it("marks strong evidence plus healthy economics as draft ready", () => {
    expect(evaluateCommerceGate({ signalScore: 85, evidenceCount: 2, economics: healthyEconomics }).verdict)
      .toBe("DRAFT_READY");
  });
});
