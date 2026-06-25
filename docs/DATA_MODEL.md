# Data Model

## Tables

### `watch_urls`

| Column           | Type        | Description                                   |
|------------------|-------------|-----------------------------------------------|
| `id`             | UUID PK     | Generated                                     |
| `url`            | TEXT UNIQUE | The listing-search or category URL to monitor |
| `label`          | TEXT        | Human-readable label                          |
| `source`         | TEXT        | Adapter identifier: `olx`, `manual`, etc.     |
| `is_active`      | BOOLEAN     | Soft-disable without deleting                 |
| `created_at`     | TIMESTAMPTZ | Row creation time                             |
| `last_checked_at`| TIMESTAMPTZ | When the worker last ran for this URL         |

### `listings`

One row per unique listing URL, updated on each scrape.

| Column            | Type         | Description                                       |
|-------------------|--------------|---------------------------------------------------|
| `id`              | UUID PK      |                                                   |
| `watch_url_id`    | UUID FK      | Parent watch URL                                  |
| `source`          | TEXT         | Adapter source                                    |
| `external_id`     | TEXT NULL    | Marketplace's own ID (if parseable)               |
| `url`             | TEXT UNIQUE  | Canonical listing URL                             |
| `title`           | TEXT         | Listing title (max 200 chars)                     |
| `price_pln`       | NUMERIC(12,2)| Price in PLN; NULL if not parseable               |
| `currency`        | TEXT         | Normalised to uppercase (`PLN`)                   |
| `category`        | TEXT NULL    | Category as shown on the page                     |
| `location`        | TEXT NULL    | City / region as shown on the page                |
| `thumbnail_url`   | TEXT NULL    | Public CDN URL of the first image                 |
| `status`          | TEXT         | `active` / `probably_gone` / `confirmed_gone` / `unknown` |
| `missing_checks`  | INTEGER      | Consecutive snapshots where this listing was absent |
| `first_seen_at`   | TIMESTAMPTZ  | When the worker first discovered this listing     |
| `last_seen_at`    | TIMESTAMPTZ  | Last snapshot where the listing was present       |
| `probably_gone_at`| TIMESTAMPTZ NULL | When the classifier first flagged it as gone |
| `confidence`      | TEXT         | `low` / `medium` / `high`                        |
| `created_at`      | TIMESTAMPTZ  |                                                   |
| `updated_at`      | TIMESTAMPTZ  | Managed by trigger                                |

### `snapshots`

One row per worker run per watch URL.

| Column            | Type      | Description                                   |
|-------------------|-----------|-----------------------------------------------|
| `id`              | UUID PK   |                                               |
| `watch_url_id`    | UUID FK   |                                               |
| `scraped_at`      | TIMESTAMPTZ | When the scrape happened                    |
| `listing_count`   | INTEGER   | Number of listings parsed                     |
| `raw_listing_ids` | UUID[]    | IDs of all listings upserted in this snapshot |
| `http_status`     | INTEGER NULL | HTTP status returned by the source         |
| `error`           | TEXT NULL | Error message if the scrape failed            |

### `listing_events`

Append-only audit log of changes.

| Column       | Type        | Description                                           |
|--------------|-------------|-------------------------------------------------------|
| `id`         | UUID PK     |                                                       |
| `listing_id` | UUID FK     |                                                       |
| `event_type` | TEXT        | `first_seen` / `price_change` / `status_change` / `probably_gone` |
| `payload`    | JSONB       | Event-specific data (old/new values, confidence, etc.)|
| `occurred_at`| TIMESTAMPTZ |                                                       |

## Views

| View              | Purpose                                              |
|-------------------|------------------------------------------------------|
| `vw_new_today`    | Active listings first seen in the last 24 h          |
| `vw_gone_under_24h` | Listings that went probably_gone within 24 h of first_seen |
| `vw_category_heat`| Aggregated new/gone counts and avg price per category |

## Status transitions

```
                first_seen
                    │
                    ▼
                 active ◄──────────────────┐
                    │                      │ re-appears in scrape
                    │ missing_checks ≥ 2   │
                    ▼                      │
             probably_gone ──────────────►─┘
                    │
                    │ (future: manual confirmation)
                    ▼
            confirmed_gone
```

## Confidence labels

| Label    | Meaning                                                      |
|----------|--------------------------------------------------------------|
| `high`   | Short-lived listing (< 24 h), confirmed absent in 3+ checks |
| `medium` | Gone within 24 h (at threshold), or gone within 7 days      |
| `low`    | Default; long-lived listing or just at threshold             |
