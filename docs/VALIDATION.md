# Validation & Testing

## Test suite

Tests live alongside source files (`*.test.ts`) and run with Vitest.

```bash
pnpm test                    # all packages
pnpm --filter @market-radar-pl/worker test
```

### Classifier (`classifier.test.ts`)

| Scenario                                    | Expected result            |
|---------------------------------------------|----------------------------|
| missing_checks = 0                          | active, confidence=high    |
| missing_checks = 1 (single-check noise)     | active, confidence=low     |
| missing_checks ≥ GONE_THRESHOLD (2)         | probably_gone              |
| Short-lived (< 24 h) + 3+ missing checks   | confidence=high            |
| Short-lived (< 24 h) at threshold           | confidence=medium          |
| Mid-lived (1–7 days) at threshold           | confidence=medium          |
| Long-lived (> 7 days) at threshold          | confidence=low             |
| probably_gone + re-appears (missing = 0)    | shouldReactivate() = true  |

### Normalizer (`normalizer.test.ts`)

| Scenario                        | Expected result            |
|---------------------------------|----------------------------|
| Whitespace in title/location    | Trimmed                    |
| Title > 200 chars               | Truncated to 200           |
| Empty currency string           | Normalised to "PLN"        |
| Lowercase currency              | Uppercased                 |
| Negative price                  | null                       |
| NaN price                       | null                       |
| Price with extra decimals       | Rounded to 2 dp            |
| Empty external_id               | null                       |
| Empty thumbnail_url             | null                       |

## Manual validation checklist

Before adding a new adapter:

- [ ] Verify the adapter returns `RawListing[]` with non-empty `url` and `title`
- [ ] Check `price_pln` is in PLN (add conversion if source uses another currency)
- [ ] Confirm `external_id` is stable across multiple scrapes
- [ ] Verify rate limiting is respected (`FETCH_DELAY_SECONDS`)
- [ ] Run against a live watch URL and check the `snapshots` table for errors
- [ ] Confirm no personal data (phone, email, name) is included in returned fields

## Database validation

The schema enforces:

- `status` CHECK constraint (only valid states)
- `confidence` CHECK constraint
- `source` CHECK constraint
- `url` UNIQUE on `listings` (prevents duplicate rows)
- `url` UNIQUE on `watch_urls` (prevents duplicate monitoring)
- `updated_at` trigger automatically maintained

## CI

Run tests via:

```bash
pnpm test
```

Turborepo caches test results between runs; clean with `pnpm turbo clean`.
