# Architecture

## Overview

`market-radar-pl` is a TypeScript monorepo (pnpm + Turborepo) with three tiers:

```
apps/web      — Next.js 14 dashboard (React Server Components)
apps/worker   — Node.js long-running process (adapter → normalize → classify → persist)
packages/db   — Postgres client + typed query helpers
packages/types — Shared domain types (Listing, Snapshot, ListingEvent, Adapter, …)
```

## Data flow

```
Watch URL (PostgreSQL)
       │
       ▼
  [Adapter]  (olx | manual | otodom | …)
       │  fetches public HTML, returns RawListing[]
       ▼
  [Normalizer]  (trim, cap length, validate price)
       │
       ▼
  [DB upsert]  listings, snapshots
       │
       ▼
  [Classifier]  (missing_checks → status, confidence)
       │
       ▼
  listing_events (audit log)
       │
       ▼
  [Next.js dashboard]
     ├─ New listings today
     ├─ Gone under 24 h
     ├─ Category heat
     ├─ Price bands
     └─ Confidence score
```

## Adapter architecture

Each data source is an isolated module implementing the `Adapter` interface:

```ts
interface Adapter {
  source: Source;
  fetch(watchUrl: WatchUrl): Promise<AdapterResult>;
}
```

Adapters are registered at worker startup via `registerAdapter()`. Adding a new
source (e.g. `otodom`) requires only creating `apps/worker/src/adapters/otodom.ts`
and calling `registerAdapter(otodomAdapter)` in `index.ts` — no other changes.

## Scheduler

The worker runs `runOnce()` at startup and on a configurable interval
(`WORKER_INTERVAL_MS`, default 15 minutes). Each run:

1. Loads all active `watch_urls` from Postgres.
2. Fetches each URL via the matching adapter.
3. Upserts all returned listings (idempotent via `url` unique key).
4. Increments `missing_checks` for listings absent from the latest fetch.
5. Runs the classifier on each updated listing.
6. Persists a `snapshot` row (listing count, errors, HTTP status).

## Next.js dashboard

- Server Components fetch data directly from Postgres via `@market-radar-pl/db`.
- The `AddWatchUrl` component is the only Client Component (form state).
- ISR revalidation: 60 seconds (`export const revalidate = 60`).

## Environment variables

See `.env.example` at the repo root. Critical:

| Variable          | Consumer | Purpose                          |
|-------------------|----------|----------------------------------|
| `DATABASE_URL`    | both     | PostgreSQL connection string     |
| `WORKER_INTERVAL_MS` | worker | Scrape frequency (default 900000) |
| `GONE_THRESHOLD`  | worker   | Missing checks before "gone" (default 2) |
