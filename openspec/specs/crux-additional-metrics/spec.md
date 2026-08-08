# crux-additional-metrics Specification

## Purpose
TBD - created by archiving change crux-multisite-compare. Update Purpose after archive.
## Requirements
### Requirement: The sync script fetches all 13 CrUX metrics
The sync script SHALL request all available CrUX History API metrics when fetching data for each site. The request body SHALL include all 13 metric names: the 5 existing Core Web Vitals (`largest_contentful_paint`, `cumulative_layout_shift`, `interaction_to_next_paint`, `first_contentful_paint`, `experimental_time_to_first_byte`) plus the 8 additional metrics (`largest_contentful_paint_resource_type`, `largest_contentful_paint_image_time_to_first_byte`, `largest_contentful_paint_image_resource_load_delay`, `largest_contentful_paint_image_resource_load_duration`, `largest_contentful_paint_image_element_render_delay`, `navigation_types`, `round_trip_time`, `form_factors`).

#### Scenario: All metrics requested from API
- **WHEN** `crux-sync.ts` sends a query to the CrUX History API for a site
- **THEN** the `metrics` field in the POST body contains all 13 metric names

#### Scenario: Sync skips form_factors when formFactor is specified
- **WHEN** a query includes a specific `formFactor` (PHONE or DESKTOP)
- **THEN** `form_factors` SHALL be excluded from the metrics list for that request because the API only returns form factors when no `formFactor` is specified

### Requirement: Fraction-type metrics are parsed from the API response
The sync script SHALL parse `fractionTimeseries` data from the CrUX History API response for metrics that use the fractional format: `largest_contentful_paint_resource_type`, `navigation_types`, and `form_factors`.

#### Scenario: LCP resource type fractions parsed
- **WHEN** the API response contains `largest_contentful_paint_resource_type` with `fractionTimeseries` entries for labels "text", "image", and "video"
- **THEN** each label's fraction array is extracted per collection period with its corresponding `collection_start` and `collection_end` dates

#### Scenario: Navigation types fractions parsed
- **WHEN** the API response contains `navigation_types` with `fractionTimeseries` entries for labels "navigate", "navigate_cache", "reload", "restore", "back_forward", "back_forward_cache", and "prerender"
- **THEN** each label's fraction array is extracted per collection period

#### Scenario: Form factors fractions parsed
- **WHEN** the API response contains `form_factors` with `fractionTimeseries` entries for labels "phone", "desktop", and "tablet"
- **THEN** each label's fraction array is extracted per collection period

#### Scenario: NaN fractions handled correctly
- **WHEN** a fractionTimeseries entry contains "NaN" for a particular collection period
- **THEN** that period is skipped (not inserted) for the affected metric and category

### Requirement: A crux_fractions table stores categorical metric data
The database SHALL include a `crux_fractions` table to store metric data that uses the fractional format, including the category label and fraction value per collection period.

#### Scenario: Table created on database open
- **WHEN** `openCruxDb()` is called
- **THEN** the `crux_fractions` table exists with columns: `id` (TEXT PK), `query_id` (TEXT FK → crux_queries), `form_factor` (TEXT), `metric_name` (TEXT), `category` (TEXT), `collection_start` (TEXT), `collection_end` (TEXT), `fraction_value` (REAL), `source` (TEXT DEFAULT 'crux_google'), `query_level` (TEXT CHECK 'origin'/'url')

#### Scenario: Unique constraint prevents duplicates
- **WHEN** a fraction record is inserted with the same `query_id`, `form_factor`, `metric_name`, `category`, and `collection_end`
- **THEN** the insert is ignored (INSERT OR IGNORE)

#### Scenario: Index supports efficient querying
- **WHEN** the table is created
- **THEN** an index exists on `(metric_name, category, collection_end)` for efficient time-based queries

### Requirement: LCP image subpart metrics use the existing histogram storage
LCP image subpart metrics (`largest_contentful_paint_image_time_to_first_byte`, `largest_contentful_paint_image_resource_load_delay`, `largest_contentful_paint_image_resource_load_duration`, `largest_contentful_paint_image_element_render_delay`) SHALL be stored in the existing `crux_history` table using the same `good_pct`/`ni_pct`/`poor_pct` structure, with their own Good/NI/Poor thresholds defined independently from LCP thresholds.

#### Scenario: LCP subpart histograms stored
- **WHEN** the API response contains `largest_contentful_paint_image_time_to_first_byte` with a 3-bin histogram
- **THEN** the densities are stored as `good_pct`, `ni_pct`, `poor_pct` in `crux_history` using the metric's own bin boundaries

#### Scenario: RTT histogram stored
- **WHEN** the API response contains `round_trip_time` with multi-bin histogram data
- **THEN** the bins are mapped to `good_pct`, `ni_pct`, `poor_pct` or the p75 percentile is stored with null distribution percentages

### Requirement: The API exposes fractional metric data
The API server SHALL provide endpoints to query fractional metric data with the same filter parameters as existing endpoints.

#### Scenario: Fractions endpoint returns categorized data
- **WHEN** `GET /api/fractions?metric=largest_contentful_paint_resource_type&ff=PHONE` is called
- **THEN** the response is an array of objects with `label`, `origin`, `metric_name`, `category`, `fraction_value`, `collection_end`, ordered by `collection_end` DESC

#### Scenario: Fractions endpoint respects site filters
- **WHEN** `GET /api/fractions?metric=navigation_types&sites=www.walmart.com.gt,www.exito.com` is called
- **THEN** only data for the specified sites is returned

### Requirement: Exports include fractional metric data
CSV and JSON exports SHALL include fractional metric data alongside histogram data when applicable filters are active.

#### Scenario: CSV export includes fraction columns
- **WHEN** the user exports CSV with a fractional metric filter active
- **THEN** the CSV includes columns for `category` and `fraction_value` alongside existing columns

#### Scenario: JSON export wraps fractional data
- **WHEN** the user exports JSON with all data (no metric filter)
- **THEN** the JSON includes both `data` (histogram records) and `fractions` (fractional records) arrays

