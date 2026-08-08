# crux-sync Specification

## Purpose
TBD - created by archiving change crux-integration. Update Purpose after archive.
## Requirements
### Requirement: The system queries the CrUX History API for each configured page
The system SHALL read `engine/crux-pages.yaml` and, for each site's page entry with a non-null URL, call the CrUX `queryHistoryRecord` endpoint with `url`, `formFactor`, and `collectionPeriodCount=40`. The API key SHALL be passed as query parameter `?key=CRUX_API_KEY` read from the environment. The system SHALL request both `PHONE` and `DESKTOP` form factors for each page.

#### Scenario: Successful URL-level query
- **WHEN** the CrUX History API returns `record.collectionPeriods` and `record.metrics` with timeseries data for a given URL and form factor
- **THEN** each collection period's metrics are decomposed from the timeseries arrays and persisted with `query_level='url'`

#### Scenario: URL-level query fails with HTTP error
- **WHEN** the CrUX API returns an HTTP error for a URL-level query (e.g., 404 "URL not in CrUX dataset")
- **THEN** the system retries the query using the `origin` parameter instead of `url`, and persists results with `query_level='origin'`

#### Scenario: Form factor iteration
- **WHEN** querying a page URL
- **THEN** the system queries both `PHONE` and `DESKTOP` form factors for each URL

#### Scenario: API key passed as query parameter
- **WHEN** making a request to the CrUX History API
- **THEN** the URL is `POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=<CRUX_API_KEY>`

### Requirement: The system decomposes timeseries responses into individual rows
The system SHALL iterate the `collectionPeriods` array in parallel with `histogramTimeseries[].densities[]` and `percentilesTimeseries.p75s[]` to produce one `crux_history` row per `(collection_period, metric)` pair. The dates `{year, month, day}` SHALL be converted to `TEXT` in `YYYY-MM-DD` format.

#### Scenario: Three collection periods for LCP
- **WHEN** the API returns `collectionPeriods` of length 3 and `metrics.largest_contentful_paint` with timeseries arrays of length 3
- **THEN** exactly 3 rows are inserted into `crux_history` for LCP, one per collection period, each with `p75_value`, `good_pct`, `ni_pct`, and `poor_pct`

#### Scenario: Timeseries index alignment
- **WHEN** decomposing `collectionPeriods[0]` through `collectionPeriods[2]`
- **THEN** `histogramTimeseries[0].densities[0]` corresponds to period 0, `histogramTimeseries[0].densities[1]` to period 1, and `percentilesTimeseries.p75s[0]` to period 0

#### Scenario: Date conversion from object to string
- **WHEN** a collection period has `firstDate: {year: 2026, month: 5, day: 1}` and `lastDate: {year: 2026, month: 5, day: 28}`
- **THEN** `collection_start` is stored as `"2026-05-01"` and `collection_end` as `"2026-05-28"`

### Requirement: The system handles missing data with NaN and null
The system SHALL convert `"NaN"` values in histogram densities to SQL `NULL` and `null` values in percentile timeseries to SQL `NULL`. Periods with entirely missing data SHALL still produce rows (with NULL values) to preserve the period's existence.

#### Scenario: NaN in histogram densities
- **WHEN** `histogramTimeseries[0].densities[1]` is `"NaN"` (period 1 has no eligible data)
- **THEN** all `good_pct`, `ni_pct`, and `poor_pct` for period 1 are stored as `NULL`

#### Scenario: Null in percentile timeseries
- **WHEN** `percentilesTimeseries.p75s[1]` is `null`
- **THEN** `p75_value` for period 1 is stored as `NULL`

#### Scenario: Period with complete missing data
- **WHEN** all three bins have `"NaN"` for a period and p75 is `null`
- **THEN** a row is still inserted for that period with all metric values set to `NULL`

### Requirement: The system deduplicates collection periods across syncs
The system SHALL use `INSERT OR IGNORE` semantics based on the `UNIQUE(query_id, form_factor, metric_name, collection_end)` constraint to ensure only new collection periods are inserted on subsequent syncs.

#### Scenario: First sync inserts all available history
- **WHEN** the sync script runs for the first time and `crux_history` is empty
- **THEN** all collection periods returned by the CrUX API are inserted into `crux_history` (up to 40 periods)

#### Scenario: Second sync inserts only new periods
- **WHEN** the sync script runs again after one week and the CrUX API returns 40 periods (39 existing + 1 new)
- **THEN** only the 1 new collection period is inserted; the 39 duplicated are ignored by the UNIQUE constraint

#### Scenario: Idempotent re-execution
- **WHEN** the sync script runs twice with no new CrUX data available
- **THEN** zero rows are inserted and the script completes without errors

### Requirement: The system persists all five Core Web Vitals metrics
The system SHALL extract and persist the following metrics from each CrUX collection period: `largest_contentful_paint`, `cumulative_layout_shift`, `interaction_to_next_paint`, `first_contentful_paint`, and `experimental_time_to_first_byte`. For each, the p75 value and the good/needs-improvement/poor histogram bin densities SHALL be stored.

#### Scenario: All metrics present in API response
- **WHEN** the CrUX API response includes all five metric types with timeseries data
- **THEN** one row per metric per collection period is inserted into `crux_history` with `p75_value`, `good_pct`, `ni_pct`, and `poor_pct`

#### Scenario: CLS p75 stored as string
- **WHEN** the CrUX API returns `cumulative_layout_shift` with `"p75s": ["0.15", "0.16"]`
- **THEN** `p75_value` is stored as the string `"0.15"` for the first period and `"0.16"` for the second

#### Scenario: LCP p75 stored as numeric string
- **WHEN** the CrUX API returns `largest_contentful_paint` with `"p75s": [1362, 1352]`
- **THEN** `p75_value` is stored as the string `"1362"` for the first period and `"1352"` for the second

#### Scenario: Some metrics missing from API response
- **WHEN** the CrUX API response includes only a subset of the five metrics (e.g., no TTFB data)
- **THEN** only the available metrics are persisted; missing metrics are silently skipped

### Requirement: The system retries transient failures
The system SHALL retry failed API requests up to 3 times with exponential backoff (1s, 2s, 4s delay). Non-transient errors (404, 403, invalid API key) SHALL NOT be retried.

#### Scenario: Rate limit retry succeeds
- **WHEN** the CrUX API returns HTTP 429
- **THEN** the system waits with exponential backoff and retries up to 3 times

#### Scenario: Network timeout retry succeeds
- **WHEN** a fetch fails due to network timeout
- **THEN** the system retries up to 3 times with backoff

#### Scenario: Non-transient error skips retry
- **WHEN** the CrUX API returns HTTP 403 (invalid API key)
- **THEN** the system logs the error and skips to the next query without retrying

#### Scenario: Query failure does not abort entire sync
- **WHEN** one query fails permanently after all retries
- **THEN** the sync logs the failure and continues with the next query

### Requirement: The system tags every record with data provenance
The system SHALL set the `source` field to `'crux_google'` on every row inserted into `crux_collections` and `crux_history`.

#### Scenario: Source field set on collection record
- **WHEN** a new `crux_collections` row is inserted
- **THEN** the `source` field is `'crux_google'`

#### Scenario: Source field set on history record
- **WHEN** a new `crux_history` row is inserted
- **THEN** the `source` field is `'crux_google'`

### Requirement: The system records the query level on every history record
The system SHALL set the `query_level` field to `'url'` when data was obtained from a URL-level query and `'origin'` when obtained from an origin-level fallback.

#### Scenario: URL-level data tagged
- **WHEN** the CrUX API returns data for a URL query
- **THEN** the `query_level` in `crux_history` is `'url'`

#### Scenario: Origin-level fallback data tagged
- **WHEN** the CrUX API fails for a URL query but succeeds for the origin fallback
- **THEN** the `query_level` in `crux_history` is `'origin'`

