import { describe, expect, it } from "vitest";
import { evaluateSnapshotHealth } from "./snapshot-health.js";
import type { AdapterResult } from "@market-radar-pl/types";

function result(overrides: Partial<AdapterResult> = {}): AdapterResult {
  return {
    listings: [],
    http_status: 200,
    error: null,
    ...overrides,
  };
}

describe("evaluateSnapshotHealth", () => {
  it("marks a normal successful snapshot authoritative", () => {
    const health = evaluateSnapshotHealth(
      result({ listings: [{
        external_id: "1",
        url: "https://example.com/1",
        title: "Item",
        price_pln: 100,
        currency: "PLN",
        category: null,
        location: null,
        thumbnail_url: null,
      }] }),
      1,
    );

    expect(health.status).toBe("healthy");
    expect(health.is_authoritative).toBe(true);
    expect(health.coverage_ratio).toBe(1);
  });

  it("marks adapter errors non-authoritative", () => {
    const health = evaluateSnapshotHealth(result({ error: "timeout" }), 20);
    expect(health.status).toBe("failed");
    expect(health.is_authoritative).toBe(false);
  });

  it("marks non-success HTTP status non-authoritative", () => {
    const health = evaluateSnapshotHealth(result({ http_status: 429 }), 20);
    expect(health.status).toBe("failed");
    expect(health.is_authoritative).toBe(false);
  });

  it("does not treat a sudden empty snapshot as evidence that all listings disappeared", () => {
    const health = evaluateSnapshotHealth(result({ listings: [] }), 20);
    expect(health.status).toBe("degraded");
    expect(health.is_authoritative).toBe(false);
    expect(health.reason).toBe("unexpected_empty_snapshot");
  });

  it("allows an empty first snapshot when there is no historical baseline", () => {
    const health = evaluateSnapshotHealth(result({ listings: [] }), 0);
    expect(health.status).toBe("healthy");
    expect(health.is_authoritative).toBe(true);
  });
});
