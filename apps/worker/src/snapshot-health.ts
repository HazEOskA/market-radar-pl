import type { AdapterResult } from "@market-radar-pl/types";

export type SnapshotHealthStatus = "healthy" | "degraded" | "failed";

export interface SnapshotHealth {
  status: SnapshotHealthStatus;
  is_authoritative: boolean;
  previous_listing_count: number;
  current_listing_count: number;
  coverage_ratio: number | null;
  reason: string | null;
}

export function evaluateSnapshotHealth(
  result: AdapterResult,
  previousListingCount: number,
): SnapshotHealth {
  const currentListingCount = result.listings.length;
  const coverageRatio = previousListingCount > 0
    ? currentListingCount / previousListingCount
    : null;

  if (result.error) {
    return {
      status: "failed",
      is_authoritative: false,
      previous_listing_count: previousListingCount,
      current_listing_count: currentListingCount,
      coverage_ratio: coverageRatio,
      reason: `adapter_error:${result.error}`,
    };
  }

  if (result.http_status < 200 || result.http_status >= 400) {
    return {
      status: "failed",
      is_authoritative: false,
      previous_listing_count: previousListingCount,
      current_listing_count: currentListingCount,
      coverage_ratio: coverageRatio,
      reason: `http_status:${result.http_status}`,
    };
  }

  if (previousListingCount > 0 && currentListingCount === 0) {
    return {
      status: "degraded",
      is_authoritative: false,
      previous_listing_count: previousListingCount,
      current_listing_count: currentListingCount,
      coverage_ratio: 0,
      reason: "unexpected_empty_snapshot",
    };
  }

  return {
    status: "healthy",
    is_authoritative: true,
    previous_listing_count: previousListingCount,
    current_listing_count: currentListingCount,
    coverage_ratio: coverageRatio,
    reason: null,
  };
}
