import {
  getActiveWatchUrls,
  getActiveListingsByWatchUrl,
  upsertListing,
  markListingMissing,
  applyClassification,
  insertSnapshot,
  insertListingEvent,
  markWatchUrlChecked,
} from "@market-radar-pl/db";
import type { Listing, WatchUrl } from "@market-radar-pl/types";
import { getAdapter } from "./adapters/base.js";
import { normalizeListing } from "./normalizer.js";
import { classifyListing } from "./classifier.js";
import { evaluateSnapshotHealth } from "./snapshot-health.js";

export async function runOnce(): Promise<void> {
  const watchUrls = await getActiveWatchUrls();
  console.log(`[scheduler] Processing ${watchUrls.length} watch URLs`);

  for (const watchUrl of watchUrls) {
    try {
      await processWatchUrl(watchUrl);
    } catch (err) {
      console.error(`[scheduler] Error processing ${watchUrl.url}:`, err);
    }
  }
}

async function processWatchUrl(watchUrl: WatchUrl): Promise<void> {
  const adapter = getAdapter(watchUrl.source);
  if (!adapter) {
    console.warn(`[scheduler] No adapter for source "${watchUrl.source}", skipping ${watchUrl.url}`);
    return;
  }

  const knownListings = await getActiveListingsByWatchUrl(watchUrl.id);

  console.log(`[scheduler] Fetching ${watchUrl.url} (source: ${watchUrl.source})`);
  const adapterResult = await adapter.fetch(watchUrl);
  const health = evaluateSnapshotHealth(adapterResult, knownListings.length);

  // A failed/degraded fetch is evidence about source health, NOT evidence that
  // every previously-seen listing disappeared. Persist the snapshot and stop.
  if (!health.is_authoritative) {
    await insertSnapshot({
      watch_url_id: watchUrl.id,
      listing_count: adapterResult.listings.length,
      raw_listing_ids: [],
      http_status: adapterResult.http_status,
      error: health.reason,
      fetch_status: health.status,
      previous_listing_count: health.previous_listing_count,
      coverage_ratio: health.coverage_ratio,
      is_authoritative: false,
    });
    await markWatchUrlChecked(watchUrl.id);

    console.warn(
      `[scheduler] Non-authoritative snapshot for ${watchUrl.url}: ${health.reason ?? health.status}; missing checks unchanged`,
    );
    return;
  }

  const seenUrls = new Set<string>();
  const savedIds: string[] = [];

  for (const rawListing of adapterResult.listings) {
    try {
      const normalised = normalizeListing(rawListing);
      if (!normalised.url || !normalised.title) continue;

      seenUrls.add(normalised.url);

      const { listing, isNew, previous } = await upsertListing(
        watchUrl.id,
        normalised,
        watchUrl.source,
      );
      savedIds.push(listing.id);

      if (isNew) {
        await insertListingEvent({
          listing_id: listing.id,
          event_type: "first_seen",
          payload: { url: listing.url, title: listing.title, price_pln: listing.price_pln },
        });
        continue;
      }

      if (previous && priceChanged(previous.price_pln, listing.price_pln)) {
        await insertListingEvent({
          listing_id: listing.id,
          event_type: "price_change",
          payload: {
            from_price_pln: previous.price_pln,
            to_price_pln: listing.price_pln,
          },
        });
      }

      if (previous && previous.status !== listing.status) {
        await insertListingEvent({
          listing_id: listing.id,
          event_type: "status_change",
          payload: {
            from_status: previous.status,
            to_status: listing.status,
            reason: "listing_reappeared",
          },
        });
      }
    } catch (err) {
      console.error("[scheduler] Error upserting listing:", err);
    }
  }

  // Only an authoritative snapshot is allowed to increment missing_checks.
  for (const listing of knownListings) {
    if (seenUrls.has(listing.url)) continue;

    const updated = await markListingMissing(listing.id);
    const result = classifyListing(updated);

    if (result.status !== listing.status || result.confidence !== listing.confidence) {
      await applyClassification(
        listing.id,
        result.status,
        result.confidence,
        result.probably_gone_at,
      );

      if (result.status !== listing.status) {
        await insertListingEvent({
          listing_id: listing.id,
          event_type: "status_change",
          payload: {
            from_status: listing.status,
            to_status: result.status,
            missing_checks: updated.missing_checks,
            confidence: result.confidence,
          },
        });
      }

      if (result.status === "probably_gone") {
        await insertListingEvent({
          listing_id: listing.id,
          event_type: "probably_gone",
          payload: {
            missing_checks: updated.missing_checks,
            confidence: result.confidence,
            probably_gone_at: result.probably_gone_at,
          },
        });
      }
    }
  }

  await insertSnapshot({
    watch_url_id: watchUrl.id,
    listing_count: savedIds.length,
    raw_listing_ids: savedIds,
    http_status: adapterResult.http_status,
    error: null,
    fetch_status: health.status,
    previous_listing_count: health.previous_listing_count,
    coverage_ratio: health.coverage_ratio,
    is_authoritative: true,
  });

  await markWatchUrlChecked(watchUrl.id);

  console.log(
    `[scheduler] Done: ${watchUrl.url} — ${adapterResult.listings.length} raw, ${savedIds.length} saved`,
  );
}

function priceChanged(previous: Listing["price_pln"], current: Listing["price_pln"]): boolean {
  if (previous == null || current == null) return previous !== current;
  return Number(previous) !== Number(current);
}
