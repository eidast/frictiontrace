## ADDED Requirements

### Requirement: The system provides a crux-specific SQLite database
The system SHALL maintain a SQLite database at `data/crux.db` with a schema that stores origins, queries, collections, and historical CrUX metrics. The database SHALL be opened via `openCruxDb()` and closed via `closeCruxDb()`, following the same pattern as `openRunDb()`. The database SHALL be created with WAL journal mode and foreign keys enabled.

#### Scenario: Database created on first open
- **WHEN** `openCruxDb()` is called and `data/crux.db` does not exist
- **THEN** the database file is created with the full crux schema (4 tables, indexes, constraints)

#### Scenario: Database reopened preserves data
- **WHEN** `openCruxDb()` is called and `data/crux.db` already exists
- **THEN** the existing database is opened and all previously persisted data is accessible

### Requirement: The schema includes indexes for common analytics queries
The system SHALL create indexes on `crux_history` for the query patterns used in analytics: `(metric_name, collection_end)`, `(query_id, form_factor, metric_name)`, and `(query_level, metric_name)`.

#### Scenario: Index created for metric time-series queries
- **WHEN** the schema is applied
- **THEN** an index `idx_crux_history_metric_time` on `(metric_name, collection_end)` exists

#### Scenario: Index created for per-query lookups
- **WHEN** the schema is applied
- **THEN** an index `idx_crux_history_query_metric` on `(query_id, form_factor, metric_name)` exists

#### Scenario: Index created for level-filtered analytics
- **WHEN** the schema is applied
- **THEN** an index `idx_crux_history_level` on `(query_level, metric_name)` exists

### Requirement: The system stores origin metadata
The system SHALL store each benchmark site in a `crux_origins` table with `id`, `origin` (domain), `group_name` (walmart_propios, walmart_subsidiarias, otros), `label` (human-readable name), and `country`. The `origin` column SHALL have a UNIQUE constraint.

#### Scenario: Origin inserted
- **WHEN** a new site is synced for the first time
- **THEN** a row is inserted into `crux_origins` with the origin domain and metadata from the YAML config

#### Scenario: Duplicate origin skipped
- **WHEN** an origin already exists in `crux_origins`
- **THEN** the existing row is preserved via INSERT OR IGNORE

### Requirement: The system stores per-URL query configuration
The system SHALL store each URL queried to the CrUX API in a `crux_queries` table with `id`, `origin_id` (FK), `url`, `page_type` (homepage/checkout/plp/pdp), and `query_level` (origin/url). There SHALL be a UNIQUE constraint on `(origin_id, url, page_type)`.

#### Scenario: URL query inserted
- **WHEN** a CrUX query is performed for a specific URL with `query_level='url'`
- **THEN** a row is inserted into `crux_queries` with the full URL, page type, and level

#### Scenario: Origin query inserted as fallback
- **WHEN** a CrUX query falls back to origin level
- **THEN** a row is inserted with `url` set to the origin and `query_level='origin'`

### Requirement: The system stores fetch collection metadata
The system SHALL store each fetch to the CrUX API in a `crux_collections` table with `id`, `query_id` (FK), `form_factor`, `fetched_at` (timestamp), and `source`. There SHALL be a UNIQUE constraint on `(query_id, form_factor, fetched_at)`.

#### Scenario: Collection recorded per fetch
- **WHEN** the sync script queries the CrUX API for a given query and form factor
- **THEN** a row is inserted into `crux_collections` recording the fetch timestamp and source

#### Scenario: Same query fetched again later
- **WHEN** the sync script queries the same query and form factor on a subsequent run
- **THEN** a new `crux_collections` row is inserted with the new `fetched_at`, and historical rows are preserved

### Requirement: The system stores historical CrUX metrics
The system SHALL store each CrUX metric per collection period in a `crux_history` table with `id`, `query_id` (FK), `form_factor`, `metric_name`, `collection_start` (TEXT, YYYY-MM-DD), `collection_end` (TEXT, YYYY-MM-DD), `p75_value` (TEXT), `good_pct` (REAL), `ni_pct` (REAL), `poor_pct` (REAL), `source`, and `query_level`. There SHALL be a UNIQUE constraint on `(query_id, form_factor, metric_name, collection_end)`.

#### Scenario: LCP metric stored with numeric p75 as text
- **WHEN** the CrUX API returns LCP data for period 2026-05-01 to 2026-05-28 with p75=3200ms, good=45%, ni=35%, poor=20%
- **THEN** a row is inserted with `metric_name='largest_contentful_paint'`, `p75_value='3200'`, `good_pct=0.45`, `ni_pct=0.35`, `poor_pct=0.20`

#### Scenario: CLS metric stored as decimal string
- **WHEN** the CrUX API returns CLS data with p75="0.15"
- **THEN** `p75_value` is `'0.15'` (stored as TEXT) and `p75_value` is NULL for the numeric columns since CLS has no millisecond value

#### Scenario: Period with no eligible data
- **WHEN** a collection period has `"NaN"` in all histogram bins and `null` for p75
- **THEN** the row is inserted with `p75_value=NULL`, `good_pct=NULL`, `ni_pct=NULL`, `poor_pct=NULL`

#### Scenario: Duplicate collection period ignored
- **WHEN** a sync attempts to insert a collection period that already exists (same `query_id`, `form_factor`, `metric_name`, `collection_end`)
- **THEN** the insert is ignored without error via INSERT OR IGNORE

### Requirement: The system provides query helpers for analytics
The system SHALL export functions from `engine/src/crux/queries.ts` that allow querying `data/crux.db` for common analytics patterns: metrics by group, metrics by page type, time-series for a specific origin, and latest snapshot for benchmarking.

#### Scenario: Query metrics by group
- **WHEN** calling `getMetricsByGroup(db, 'walmart_propios')`
- **THEN** the function returns aggregated metrics across all origins in that group, grouped by metric name and form factor

#### Scenario: Query metrics by page type
- **WHEN** calling `getMetricsByPageType(db, 'checkout')`
- **THEN** the function returns aggregated metrics for checkout pages across all sites

#### Scenario: Query time-series for a specific origin
- **WHEN** calling `getTimeSeries(db, 'www.walmart.com.gt', 'largest_contentful_paint', 'PHONE')`
- **THEN** the function returns rows ordered by `collection_end` with p75_value and histogram percentages over time

#### Scenario: Query latest snapshot for all sites
- **WHEN** calling `getLatestSnapshot(db)`
- **THEN** the function returns one row per origin per metric per form factor with the most recent `collection_end`
