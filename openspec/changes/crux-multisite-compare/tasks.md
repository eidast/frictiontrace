## 1. Database Schema — crux_fractions table

- [x] 1.1 Add `crux_fractions` table DDL to `engine/src/crux/schema.ts` with columns: id, query_id, form_factor, metric_name, category, collection_start, collection_end, fraction_value, source, query_level, plus UNIQUE constraint and index.
- [x] 1.2 Add `CruxFractionRow` interface to `engine/src/crux/types.ts`.
- [x] 1.3 Add `CreateCruxFractionInput` interface and `cruxFractionsRepo` (insertMany) to `engine/src/crux/daos.ts`.

## 2. Data Ingestion — Expand crux-sync.ts

- [x] 2.1 Expand METRICS array in `scripts/crux-sync.ts` to include all 13 metric names: the 5 existing CWV plus `largest_contentful_paint_resource_type`, `largest_contentful_paint_image_time_to_first_byte`, `largest_contentful_paint_image_resource_load_delay`, `largest_contentful_paint_image_resource_load_duration`, `largest_contentful_paint_image_element_render_delay`, `navigation_types`, `round_trip_time`, and `form_factors`.
- [x] 2.2 Add `parseFractionResponse()` function that extracts `fractionTimeseries` data per metric, per category, per collection period, returning an array of `CreateCruxFractionInput`-compatible records. Handle \"NaN\" entries by skipping those periods.
- [x] 2.3 Modify `syncSite()` to call `parseFractionResponse()` after `parseHistoryResponse()` on the same API response, and persist fractional records via `cruxFractionsRepo.insertMany()`.
- [x] 2.4 Handle `form_factors` metric: add a separate API query per page without `formFactor` specified, since the API only returns `form_factors` when no form factor is specified. Parse and store the result.
- [x] 2.5 Update `SyncStats` interface to track fractional records inserted and skipped.

## 3. API Server — New endpoints and export updates

- [x] 3.1 Add `GET /api/fractions` endpoint to `scripts/crux-dashboard.ts` that queries `crux_fractions` joined with `crux_queries` and `crux_origins`, supporting the same filter parameters as `/api/compare` (sites, group, ff, page, level, dateFrom, dateTo).
- [x] 3.2 Add `GET /api/compare-grid` endpoint that returns pivoted data: for the selected sites and metric, return the most recent period's values plus the previous period's values (for trend indication). Include both histogram data (p75, good_pct, ni_pct, poor_pct) and fractional data (category: fraction_value pairs) in a format suitable for the comparison grid.
- [x] 3.3 Update `GET /api/export/csv` to include fractional data rows when applicable filters are active (new columns: `category`, `fraction_value`).
- [x] 3.4 Update `GET /api/export/json` to wrap data in `{ data: [...], fractions: [...] }` when fractional data is present.
- [x] 3.5 Update `GET /api/meta` to include counts for `crux_fractions` rows and distinct metric names.

## 4. Frontend — HTML and CSS

- [x] 4.1 Add "Comparativa" and "Desglose" tab buttons to the tab bar in `engine/src/crux/dashboard.html`.
- [x] 4.2 Add "Comparativa" tab content area with a `<div id="comparison-grid">` container for the HTML table grid, and an empty state message for < 2 sites selected.
- [x] 4.3 Add "Desglose" tab content area with chart containers for stacked bar charts: LCP resource types, navigation types, and form factors.
- [x] 4.4 Restructure the metric filter `<select>` in the sidebar to use `<optgroup>` with 3 groups: "Core Web Vitals" (5 options), "LCP Diagnostics" (5 options), "Other" (3 options). Add all 13 `<option>` elements.
- [x] 4.5 Add CSS styles in `engine/src/crux/dashboard.css` for: comparison grid table (`.compare-grid`), metric row headers, color-coded cells (green/yellow/red backgrounds), trend indicators, stacked bar chart containers, and the Desglose tab layout.

## 5. Frontend — JavaScript: Metric metadata and state

- [x] 5.1 Expand `METRIC_METADATA` in `engine/src/crux/dashboard.js` to include entries for all 13 metrics with: label, fullName, description, unit, thresholds (where applicable), type ("histogram" or "fraction"), and category ("core", "lcp_diag", "other").
- [x] 5.2 Add `metricCategories` metadata grouping in dashboard.js for use in the optgroup selector and for the comparison grid row grouping.
- [x] 5.3 Update `removeFilter()` and `applyPreset()` functions to handle the 8 new metric names.
- [x] 5.4 Update `stateToUrl()` to serialize up to 10 sites in the `sites` parameter (raise from current limit of 5).
- [x] 5.5 Update `urlToState()` to deserialize up to 10 sites.

## 6. Frontend — JavaScript: Comparativa tab

- [x] 6.1 Add `renderComparativa()` function that queries `/api/compare-grid` and renders the side-by-side HTML table with sites as columns, metrics as rows.
- [x] 6.2 Implement cell color coding: compare `p75_value` against per-metric thresholds from `METRIC_METADATA`; apply green (#3fb950), yellow (#d29922), or red (#f85149) background.
- [x] 6.3 Compute trend indicators per cell: compare current period p75 vs previous period p75; show green ▼ (improving >5%), red ▲ (worsening >5%), gray → (stable ≤5% change).
- [x] 6.4 Add metric row click handler: clicking a metric row label switches to the Tendencia tab with that metric pre-selected and current site selection preserved.
- [x] 6.5 Implement empty state: when fewer than 2 sites selected, show "Seleccioná al menos 2 sitios en el panel lateral para comparar".
- [x] 6.6 Render inline sparkline SVGs in each cell showing the last 4 periods' p75 trend using D3.js mini line charts (width ~60px, height ~20px, no axes).

## 7. Frontend — JavaScript: Desglose tab and fractional charts

- [x] 7.1 Add `renderDesglose()` function that queries `/api/fractions` and renders stacked bar charts for the active fractional metric.
- [x] 7.2 Implement `drawStackedBars()` D3.js function: horizontal or vertical stacked bars with one stack per selected site, segments colored by category, with hover tooltips.
- [x] 7.3 Handle LCP resource types chart: segments for "text", "image", "video" with distinct colors.
- [x] 7.4 Handle navigation types chart: segments for all 7 navigation types with distinct colors and abbreviated labels for legibility.
- [x] 7.5 Handle form factors chart: segments for "phone", "desktop", "tablet" with distinct colors.
- [x] 7.6 Implement metric auto-switch: when user selects a fractional metric while on a histogram-only tab (Resumen, Grupos, Sitios, Tendencia), automatically switch to the Desglose tab.

## 8. Frontend — JavaScript: Updated existing views

- [x] 8.1 Update `renderResumen()` to handle fractional and LCP subpart metrics: show single p75 scorecard per FF for subpart metrics, and stacked bar summary for fractional metrics.
- [x] 8.2 Update `renderGrupos()` and `renderSitios()` to handle the 3 new histogram-type metrics (4 LCP subparts + RTT) using the same grouped bar chart but with per-metric thresholds.
- [x] 8.3 Update `renderTendencia()` to work with LCP subpart and RTT metrics on the time-series chart.
- [x] 8.4 Update `renderDatos()` table to include rows from `crux_fractions` when a fractional metric filter is active (show `category` and `fraction_value` columns).

## 9. Verification

- [x] 9.1 Run `npx tsx scripts/crux-sync.ts` with `CRUX_API_KEY` set to sync all 13 metrics. Verify via `sqlite3 data/crux.db "SELECT DISTINCT metric_name FROM crux_history UNION SELECT DISTINCT metric_name FROM crux_fractions ORDER BY 1;"` that all 13 metric names appear.
- [x] 9.2 Start dashboard server (`npx tsx scripts/crux-dashboard.ts --serve`) and verify the Comparativa tab renders with 3+ selected sites, shows colored cells, trend indicators, and metric drill-down.
- [x] 9.3 Verify the Desglose tab renders stacked bar charts for LCP resource types, navigation types, and form factors with hover tooltips.
- [x] 9.4 Verify metric filter dropdown shows all 13 options grouped in 3 optgroups.
- [x] 9.5 Verify fractional metric auto-switch: select "LCP Resource Type" while on Resumen → auto-switches to Desglose.
- [x] 9.6 Verify build mode (`--build`) generates self-contained HTML with all metric metadata, fractional data, and new tabs working offline.
- [x] 9.7 Verify CSV export includes fractional data rows; verify JSON export includes both `data` and `fractions` arrays.
- [x] 9.8 Verify URL state serializes up to 10 sites.
- [x] 9.9 Run `npm test` or available test suite to check for regressions in existing DAOs and schema tests.
