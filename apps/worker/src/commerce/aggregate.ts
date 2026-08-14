import type { Listing } from "@market-radar-pl/types";
import { candidateFingerprint, signalScoreFromListing } from "./candidate.js";

export interface CandidateGroup {
  fingerprint: string;
  title: string;
  category: string | null;
  listingIds: string[];
  evidenceCount: number;
  signalScore: number;
  observedPricesPln: number[];
}

export function aggregateCandidateEvidence(listings: Listing[]): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup & { scoreTotal: number }>();

  for (const listing of listings) {
    if (listing.status !== "probably_gone") continue;
    if (listing.confidence === "low") continue;

    const fingerprint = candidateFingerprint(listing.title, listing.category);
    const score = signalScoreFromListing(listing);
    const existing = groups.get(fingerprint);

    if (!existing) {
      groups.set(fingerprint, {
        fingerprint,
        title: listing.title,
        category: listing.category,
        listingIds: [listing.id],
        evidenceCount: 1,
        signalScore: score,
        observedPricesPln: listing.price_pln === null ? [] : [listing.price_pln],
        scoreTotal: score,
      });
      continue;
    }

    if (!existing.listingIds.includes(listing.id)) {
      existing.listingIds.push(listing.id);
      existing.evidenceCount += 1;
      existing.scoreTotal += score;
      existing.signalScore = Math.round((existing.scoreTotal / existing.evidenceCount) * 100) / 100;
      if (listing.price_pln !== null) existing.observedPricesPln.push(listing.price_pln);
    }
  }

  return Array.from(groups.values())
    .map(({ scoreTotal: _scoreTotal, ...group }) => group)
    .sort((a, b) => b.signalScore - a.signalScore || b.evidenceCount - a.evidenceCount);
}
