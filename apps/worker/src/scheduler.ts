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
import type { WatchUrl } from "@market-radar-pl/types";
import { getAdapter } from "./adapters/base.js";
import { normalizeListing } from "./normalizer.js";
import { classifyListing } from "./classifier.js";

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

  console.log(`[scheduler] Fetching ${watchUrl.url} (source: ${watchUrl.source})`);
  const adapterResult = await adapter.fetch(watchUrl);

  const seenUrls = new Set<string>();
  const savedIds: string[] = [];

  for (const rawListing of adapterResult.listings) {
    try {
      const normalised = normalizeListing(rawListing);
      if (!normalised.url || !normalised.title) continue;

      seenUrls.add(normalised.url);

      const { listing, isNew } = await upsertListing(watchUrl.id, normalised, watchUrl.source);
      savedIds.push(listing.id);

      if (isNew) {
        await insertListingEvent({
          listing_id: listing.id,
          event_type:  "first_seen",
          payload:     { url: listing.url, title: listing.title, price_pln: listing.price_pln },
        });
      }
    } catch (err) {
      console.error("[scheduler] Error upserting listing:", err);
    }
  }

  // Mark previously-seen listings that are now absent
  const knownListings = await getActiveListingsByWatchUrl(watchUrl.id);
  for (const listing of knownListings) {
    if (seenUrls.has(listing.url)) continue;

    const updated = await markListingMissing(listing.id);
    const result  = classifyListing(updated);

    if (result.status !== listing.status || result.confidence !== listing.confidence) {
      await applyClassification(listing.id, result.status, result.confidence, result.probably_gone_at);

      if (result.status === "probably_gone") {
        await insertListingEvent({
          listing_id: listing.id,
          event_type:  "probably_gone",
          payload:     {
            missing_checks:   updated.missing_checks,
            confidence:       result.confidence,
            probably_gone_at: result.probably_gone_at,
          },
        });
      }
    }
  }

  await insertSnapshot({
    watch_url_id:    watchUrl.id,
    listing_count:   savedIds.length,
    raw_listing_ids: savedIds,
    http_status:     adapterResult.http_status,
    error:           adapterResult.error,
  });

  await markWatchUrlChecked(watchUrl.id);

  console.log(
    `[scheduler] Done: ${watchUrl.url} — ${adapterResult.listings.length} raw, ${savedIds.length} saved`
  );
}
