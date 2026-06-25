import type { Listing, ClassifierResult, ConfidenceLabel } from "@market-radar-pl/types";

const GONE_THRESHOLD = parseInt(process.env["GONE_THRESHOLD"] ?? "2", 10);

/**
 * Classify a listing's status based on how many consecutive checks it has
 * been absent from the source page.
 *
 * Rules:
 *  - 0 missing checks  → active
 *  - 1 missing check   → still active (single-check noise), low confidence
 *  - ≥ GONE_THRESHOLD  → probably_gone, with confidence determined by time alive
 */
export function classifyListing(listing: Listing): ClassifierResult {
  if (listing.missing_checks === 0) {
    return {
      status:          "active",
      confidence:      "high",
      probably_gone_at: null,
    };
  }

  if (listing.missing_checks < GONE_THRESHOLD) {
    return {
      status:          "active",
      confidence:      "low",
      probably_gone_at: null,
    };
  }

  // Listing has been missing for GONE_THRESHOLD or more consecutive checks
  const hoursAlive = computeHoursAlive(listing.first_seen_at, listing.last_seen_at);
  const confidence  = computeConfidence(hoursAlive, listing.missing_checks);

  return {
    status:          "probably_gone",
    confidence,
    probably_gone_at: new Date().toISOString(),
  };
}

/**
 * Compute how many hours old the listing is (from first_seen_at to now).
 * A short-lived listing missing from the source has higher exit confidence.
 */
function computeHoursAlive(firstSeen: string, _lastSeen: string): number {
  const first  = new Date(firstSeen).getTime();
  const diffMs = Math.max(0, Date.now() - first);
  return diffMs / (1000 * 60 * 60);
}

/**
 * Confidence that the disappearance reflects a real-world exit (e.g. sold,
 * removed), not a scraping glitch.
 *
 * High   → short-lived listing (< 24 h) seen multiple checks, then gone
 * Medium → disappeared after 1–7 days, multiple checks confirm absence
 * Low    → disappeared after a long time, or only just past the threshold
 */
function computeConfidence(hoursAlive: number, missingChecks: number): ConfidenceLabel {
  if (hoursAlive < 24 && missingChecks >= GONE_THRESHOLD + 1) return "high";
  if (hoursAlive < 24) return "medium";
  if (hoursAlive < 168 && missingChecks >= GONE_THRESHOLD) return "medium";
  return "low";
}

/**
 * Determine whether a listing that was previously probably_gone and then
 * re-appeared should be re-activated.
 */
export function shouldReactivate(listing: Listing): boolean {
  return listing.status === "probably_gone" && listing.missing_checks === 0;
}
