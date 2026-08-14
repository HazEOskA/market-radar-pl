# Validation & Testing

## Test suite

Tests live alongside source files (`*.test.ts`) and run with Vitest.

```bash
pnpm test
pnpm --filter @market-radar-pl/worker test
```

### Classifier (`classifier.test.ts`)

Covers missing-check thresholds, confidence levels and reactivation intent.

### Normalizer (`normalizer.test.ts`)

Covers title/location normalization, currency normalization, invalid prices,
rounding, empty IDs and thumbnail handling.

### Snapshot authority (`snapshot-health.test.ts`)

Foundation v0 regression coverage:

- successful snapshots are authoritative
- adapter errors are non-authoritative
- non-success HTTP responses are non-authoritative
- unexpected empty snapshots with prior listings are degraded/non-authoritative
- an empty first snapshot without historical baseline is allowed

The invariant under test is:

> A source failure must never become market-demand evidence.

## Database / integration validation

Before merging foundation changes, verify against a disposable PostgreSQL database:

1. Apply `packages/db/schema.sql` to a fresh database.
2. Apply `packages/db/migrations/001_commerce_foundation_v0.sql` to an old schema.
3. Confirm snapshot authority columns exist.
4. Confirm a reappearing listing clears `probably_gone_at`.
5. Confirm `vw_gone_under_24h` only contains rows whose current status is `probably_gone`.
6. Confirm `price_change` and `status_change` events are persisted.

## Source validation checklist

Before enabling a new adapter:

- [ ] Verify the adapter returns non-empty stable URLs and titles
- [ ] Confirm currency/price semantics
- [ ] Confirm `external_id` stability
- [ ] Verify worker rate limiting
- [ ] Confirm failed/degraded fetches remain non-authoritative
- [ ] Confirm ingestion host allowlisting
- [ ] Confirm redirects cannot reach local/private network destinations
- [ ] Review source Terms of Service and robots policy
- [ ] Confirm no seller contact PII is collected

## CI

`.github/workflows/ci.yml` runs:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

on feature-branch pushes and pull requests to `main`.

## Known validation gap

An additional unit-test file for literal network-address SSRF cases could not be
written through the repository connector because the connector blocked that write.
The defensive runtime URL guard is present, but this specific automated test coverage
must be added from a normal development environment before production rollout.
