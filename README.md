# market-radar-pl

Polish marketplace intelligence tool. Tracks public listings from configured URLs and detects listings that disappear within 24 hours — a signal correlated with fast exits (sold, removed, expired).

> **Scope:** reads only publicly visible listing data. No login, no anti-bot bypass, no seller contact. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md).

## Features

- Add watch URLs manually (OLX, Otodom, or any public listing page)
- Worker snapshots configured URLs on a configurable interval (default 15 min)
- Listings normalised and deduplicated by URL
- Tracks `first_seen_at` / `last_seen_at` per listing
- Marks listings as `probably_gone` after 2+ consecutive missing checks
- Confidence labels (low / medium / high) based on listing lifespan
- Dashboard:
  - New listings today
  - Gone under 24 h (probable exits)
  - Category heat map
  - Price bands
  - Per-listing confidence score

## Monorepo structure

```
market-radar-pl/
├── apps/
│   ├── web/          Next.js 14 dashboard
│   └── worker/       Node.js scrape worker
├── packages/
│   ├── db/           Postgres client + query helpers
│   └── types/        Shared TypeScript types
└── docs/
    ├── ARCHITECTURE.md
    ├── COMPLIANCE.md
    ├── DATA_MODEL.md
    └── VALIDATION.md
```

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL 15+ (or a Supabase project)

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/hazeoska/market-radar-pl.git
cd market-radar-pl
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL at minimum
```

### 3. Apply the database schema

```bash
psql "$DATABASE_URL" -f packages/db/schema.sql
```

Or paste the contents of `packages/db/schema.sql` into the Supabase SQL editor.

### 4. Run the worker

```bash
pnpm worker
# or
pnpm --filter @market-radar-pl/worker dev
```

The worker runs once immediately, then every `WORKER_INTERVAL_MS` milliseconds.
Add watch URLs via the dashboard or directly in the `watch_urls` table.

### 5. Run the dashboard

```bash
pnpm web
# or
pnpm --filter @market-radar-pl/web dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run tests

```bash
pnpm test
```

Tests cover the classifier logic and normalizer. No database connection required.

## Adding a watch URL

Via the dashboard form, or directly:

```sql
INSERT INTO watch_urls (url, source, label)
VALUES ('https://www.olx.pl/d/nieruchomosci/mieszkania/wynajem/krakow/', 'olx', 'OLX Kraków rentals');
```

## Adding a new adapter

1. Create `apps/worker/src/adapters/yoursite.ts` implementing the `Adapter` interface.
2. Register it in `apps/worker/src/index.ts`:
   ```ts
   import { yoursiteAdapter } from "./adapters/yoursite.js";
   registerAdapter(yoursiteAdapter);
   ```
3. Add `"yoursite"` to the `Source` union in `packages/types/src/index.ts`.
4. Add the check constraint to `packages/db/schema.sql`.

## Environment variables

| Variable              | Default    | Description                                      |
|-----------------------|------------|--------------------------------------------------|
| `DATABASE_URL`        | —          | PostgreSQL connection string (required)          |
| `WORKER_INTERVAL_MS`  | `900000`   | Scrape interval in ms (15 min)                   |
| `GONE_THRESHOLD`      | `2`        | Missing checks before "probably_gone"            |
| `FETCH_DELAY_SECONDS` | `3`        | Politeness delay between requests to same domain |
| `FETCH_CONCURRENCY`   | `2`        | Max concurrent fetches                           |
| `FETCH_USER_AGENT`    | (generic)  | User-agent string sent with requests             |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Compliance & legal notes](docs/COMPLIANCE.md)
- [Data model](docs/DATA_MODEL.md)
- [Validation & testing](docs/VALIDATION.md)
