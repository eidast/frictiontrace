## Why

The CrUX dashboard currently ingests and visualizes only 5 Core Web Vitals metrics, but the CrUX History API returns 13 metrics total. The 8 additional metrics (LCP resource types, LCP image subparts, round trip time, navigation types, and form factor distribution) are available in the API but are not fetched, stored, or displayed. Additionally, there is no dedicated view for comparing 2-5 individually selected sites side-by-side across metrics — a capability CrUX Vis cannot offer at all, and one that would give FrictionTrace a unique advantage for the Walmart e-commerce benchmark.

## What Changes

- Extend `crux-sync.ts` to request and parse the 8 additional CrUX metrics from the History API, including both histogram-type metrics (LCP image subparts, RTT) and fraction-type metrics (LCP resource type, navigation types, form factors).
- Add a new `crux_fractions` table to the SQLite schema for storing categorical/fractional metrics that don't fit the existing good/NI/poor histogram model.
- Add new API endpoints (`/api/fractions`, `/api/compare-grid`) to expose the additional metrics and power the comparison view.
- Add a new "Comparativa" tab to the dashboard with a side-by-side grid view: selected sites as columns, metrics as rows, with color-coded cells and sparkline/trend indicators.
- Add new D3.js stacked bar charts for fractional metrics (LCP resource types, navigation types) in both the comparison view and a new "Desglose" tab.
- Extend the metric metadata map and the metric filter selector to include all 13 metrics.
- Update the CSV/JSON export endpoints to include fractional metric data.
- Support up to 10 individual sites selected for side-by-side comparison (raised from the current URL-state limit of 5).

## Capabilities

### New Capabilities
- `crux-additional-metrics`: Fetching, parsing, storing, and exposing the 8 additional CrUX metrics beyond the current 5 Core Web Vitals. Covers LCP resource types, LCP image subparts (4 metrics), round trip time, navigation types, and form factor distribution.
- `dashboard-multisite-compare`: A dedicated side-by-side comparison tab where 2-10 individually selected sites are displayed as columns with each metric as a row. Includes color-coded severity, trend indicators, and the ability to drill down per metric.

### Modified Capabilities
- `crux-dashboard`: New "Comparativa" and "Desglose" tabs, extended metric selector (5 → 13 options), new API endpoints (`/api/fractions`, `/api/compare-grid`), expanded metric metadata, and updated export logic.

## Impact

- **Data ingestion**: `scripts/crux-sync.ts` — expands `METRICS` array and adds `parseFractionResponse()` alongside existing `parseHistoryResponse()`.
- **Database schema**: `engine/src/crux/schema.ts` — new `crux_fractions` table; `engine/src/crux/types.ts` and `engine/src/crux/daos.ts` — new types and repository for fractional data.
- **API server**: `scripts/crux-dashboard.ts` — new `/api/fractions` and `/api/compare-grid` endpoints, updated export endpoints.
- **Frontend**: `engine/src/crux/dashboard.html` — new tabs, expanded metric selector; `engine/src/crux/dashboard.js` — new comparison and fractional chart renderers, expanded metadata, updated state and filters.
- **CSS**: `engine/src/crux/dashboard.css` — new styles for comparison grid and fractional charts.
- **Configuration**: `engine/crux-pages.yaml` — no changes (only current sites, no ad-hoc URL entry).
- Backward-compatible: existing tabs, charts, and API endpoints remain unchanged. The new `crux_fractions` table is additive.
