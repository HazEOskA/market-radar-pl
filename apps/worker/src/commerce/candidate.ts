import type { Listing } from "@market-radar-pl/types";

export function candidateFingerprint(title: string, category: string | null): string {
  const normalizedTitle = title
    .toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .slice(0, 12)
    .join("-") || "unknown";

  const normalizedCategory = (category ?? "uncategorized")
    .toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "uncategorized";

  return `${normalizedCategory}:${normalizedTitle}`;
}

export function signalScoreFromListing(listing: Listing): number {
  const confidenceBase = listing.confidence === "high" ? 78 : listing.confidence === "medium" ? 62 : 40;
  const firstSeen = new Date(listing.first_seen_at).getTime();
  const goneAt = listing.probably_gone_at ? new Date(listing.probably_gone_at).getTime() : Date.now();
  const hoursAlive = Math.max(0, goneAt - firstSeen) / 3_600_000;

  let velocityBonus = 0;
  if (hoursAlive <= 6) velocityBonus = 17;
  else if (hoursAlive <= 12) velocityBonus = 12;
  else if (hoursAlive < 24) velocityBonus = 7;

  const priceEvidence = listing.price_pln !== null && listing.price_pln > 0 ? 5 : 0;
  return Math.min(100, confidenceBase + velocityBonus + priceEvidence);
}
