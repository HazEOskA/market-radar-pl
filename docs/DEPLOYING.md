# Deploying to Vercel

## What runs on Vercel

Only the **Next.js dashboard** (`apps/web`) is deployed to Vercel.
The worker (`apps/worker`) is a long-running Node.js process and must be
deployed separately (Railway, Render, Fly.io, or a cron job). Vercel
serverless functions have a max timeout of 60 s, which is incompatible
with the polling loop.

## Vercel project settings

Configure these in the Vercel dashboard under **Project → Settings → General**:

| Setting              | Value                                                        |
|----------------------|--------------------------------------------------------------|
| **Framework Preset** | Next.js                                                      |
| **Root Directory**   | *(leave blank — use repo root)*                              |
| **Install Command**  | `pnpm install --frozen-lockfile`                             |
| **Build Command**    | `pnpm turbo run build --filter=@market-radar-pl/web`         |
| **Output Directory** | `apps/web/.next`                                             |
| **Node.js Version**  | 20.x                                                         |

`vercel.json` at the repo root encodes these same settings so they are
version-controlled and apply automatically on import.

## Environment variables

Set these in **Project → Settings → Environment Variables**:

### Required

| Variable        | Example value                                        | Notes                               |
|-----------------|------------------------------------------------------|-------------------------------------|
| `DATABASE_URL`  | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Supabase connection string (Transaction mode pooler recommended) |

### Optional (have sensible defaults)

| Variable              | Default value | Notes                                           |
|-----------------------|---------------|-------------------------------------------------|
| `OLX_ENABLED`         | `false`       | Web app does not use this — worker only         |
| `ALLEGRO_ENABLED`     | `false`       | Web app does not use this — worker only         |
| `FETCH_DELAY_SECONDS` | `10`          | Worker only                                     |
| `GONE_THRESHOLD`      | `2`           | Worker only                                     |

> Do NOT set `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.
> Only `DATABASE_URL` (using the Supabase connection pooler) is needed.

## Supabase setup

1. Create a new Supabase project.
2. Go to **Project → Settings → Database → Connection String → Transaction pooler**.
3. Copy the URI and set it as `DATABASE_URL` in Vercel.
4. Run the schema:
   - Go to **SQL Editor** in Supabase.
   - Paste and run the contents of `packages/db/schema.sql`.

## First deploy checklist

After deploying, verify the following in order:

- [ ] Vercel build log shows no TypeScript errors
- [ ] Dashboard loads at `https://your-project.vercel.app`
- [ ] Dashboard shows an error banner if `DATABASE_URL` is not set (expected)
- [ ] After setting `DATABASE_URL`, dashboard loads with empty sections (no data yet)
- [ ] `POST /api/watch-urls` accepts a valid URL:
  ```bash
  curl -X POST https://your-project.vercel.app/api/watch-urls \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.olx.pl/d/oferta/test","source":"manual","label":"Test"}'
  ```
  → should return `201` with a `watchUrl` object
- [ ] `GET /api/watch-urls` returns the newly added URL
- [ ] Sections show data after the worker runs at least once

## Worker deployment (Railway example)

```bash
railway login
railway init
railway add --service worker
# Set DATABASE_URL, OLX_ENABLED, GONE_THRESHOLD, FETCH_DELAY_SECONDS
railway up --service worker
```

Start command: `pnpm --filter @market-radar-pl/worker start`

## Known limitations

| Limitation                             | Notes                                                    |
|----------------------------------------|----------------------------------------------------------|
| Worker not on Vercel                   | Long-running loop incompatible with serverless; deploy separately |
| OLX adapter may break on site redesign| OLX HTML structure is not versioned; monitor `snapshots.error` |
| No auth on the web app                 | Anyone with the URL can add watch URLs; add auth before public launch |
| No Allegro adapter yet                 | `ALLEGRO_ENABLED=true` logs a warning, does nothing      |
| ISR revalidation is 60 s              | Dashboard may show data up to 60 s stale                 |
| Thumbnail images from third-party CDNs| May fail to load due to hotlink protection; benign        |
