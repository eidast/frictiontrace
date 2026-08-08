## Context

The CrUX dashboard currently ingests 5 Core Web Vitals metrics from the CrUX History API and stores them in a `crux_history` table with `good_pct`, `ni_pct`, `poor_pct`, and `p75_value` columns. The dashboard is a vanilla HTML/CSS/JS frontend with D3.js charts, served by a Node.js HTTP server that queries a SQLite database.

The CrUX History API returns 13 metrics total. The 8 additional metrics fall into two structural categories:

1. **Histogram-type** (4 LCP image subparts + RTT): Same 3-bin histogram structure as existing metrics, but with different bin boundaries and thresholds. These can reuse the existing `crux_history` table.

2. **Fraction-type** (LCP resource type, navigation types, form factors): Use `fractionTimeseries` instead of `histogramTimeseries`. Each metric has named categories (e.g., "text", "image", "video") with a fraction per category per collection period. These require a new storage model.

There is also no dedicated multi-site comparison view. While the sidebar allows selecting multiple sites, no view explicitly puts sites side-by-side as columns with metrics as rows.

## Goals / Non-Goals

**Goals:**
- Fetch and store all 13 CrUX metrics from the History API for all sites in `crux-pages.yaml`.
- Store fractional metrics in a new `crux_fractions` table appropriate for their category-based structure.
- Expose new API endpoints (`/api/fractions`, `/api/compare-grid`) to serve the additional data.
- Add "Comparativa" and "Desglose" tabs to the dashboard with side-by-side grid and stacked bar visualizations.
- Extend CSV/JSON exports to include fractional data.
- Raise URL-state site limit from 5 to 10.

**Non-Goals:**
- Ad-hoc URL/origin entry beyond `crux-pages.yaml`.
- Live API lookups; all data remains pre-synced.
- Changing the existing 5 CWV metric charts or their behavior.
- Introducing React, Tailwind, or new UI frameworks.
- Adding tablet form factor as a query dimension (PHONE/DESKTOP only per current config).

## Decisions

### Use a separate `crux_fractions` table for fractional metrics

Fractional metrics have a fundamentally different shape: a category label + a numeric fraction, rather than good/NI/poor bins + a p75 value. Storing them in `crux_history` would require nullable columns with misleading semantics.

**Table schema:**

```sql
CREATE TABLE IF NOT EXISTS crux_fractions (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES crux_queries(id),
  form_factor TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  category TEXT NOT NULL,
  collection_start TEXT NOT NULL,
  collection_end TEXT NOT NULL,
  fraction_value REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'crux_google',
  query_level TEXT NOT NULL CHECK(query_level IN ('origin', 'url')),
  UNIQUE(query_id, form_factor, metric_name, category, collection_end)
);

CREATE INDEX IF NOT EXISTS idx_crux_fractions_metric_cat_time
  ON crux_fractions(metric_name, category, collection_end);
```

**Alternative considered:** Add a `category` and `fraction_value` column to `crux_history` with nullable `good_pct`/`ni_pct`/`poor_pct`. Rejected because it makes queries ambiguous (a row either has histogram data OR fraction data, never both) and complicates the insert logic.

### Parse fractional metrics in a dedicated function

The existing `parseHistoryResponse()` handles histogram + percentile data. A new `parseFractionResponse()` handles `fractionTimeseries` data, keeping concerns separate and avoiding complex branching in the existing parser.

```
parseHistoryResponse() → existing (handles histogram + p75, maps to crux_history)
parseFractionResponse()  → new (handles fractionTimeseries, maps to crux_fractions)
```

Both are called from `syncSite()` after a single API response is received (the API returns all requested metrics in one response).

### LCP subpart metrics and RTT use the existing crux_history table

LCP image subparts (`largest_contentful_paint_image_*`) and `round_trip_time` use the same `histogramTimeseries` + `percentilesTimeseries` format as existing CWV metrics. They can be stored in `crux_history` without schema changes.

**Caveat:** These metrics' bin boundaries differ from CWV thresholds. LCP subparts are measured in milliseconds but don't use the 2500/4000ms thresholds. The existing `good_pct`/`ni_pct`/`poor_pct` columns are still semantically correct (bin 0, bin 1, bin 2 from the API), but the frontend must use per-metric thresholds for color coding, not assume CWV thresholds.

**Alternative considered:** Create a separate table for non-CWV histogram metrics. Rejected because the data shape is identical; only the interpretation differs, which is a frontend concern.

### Comparison grid uses a dedicated `/api/compare-grid` endpoint

Rather than having the frontend issue multiple `/api/compare` calls and merge data, a single endpoint returns pivoted data for the comparison grid. This reduces HTTP round-trips and moves aggregation logic to SQLite (where it's fast).

**Request:** `GET /api/compare-grid?sites=...&metric=...&ff=...`
**Response shape:**
```json
{
  "columns": ["Walmart GT", "Exito CO", "PriceSmart CR"],
  "metrics": [
    {
      "name": "largest_contentful_paint",
      "label": "LCP",
      "unit": "ms",
      "thresholds": { "good": 2500, "ni": 4000 },
      "values": [
        { "p75": 1234, "good_pct": 0.85, "ni_pct": 0.10, "poor_pct": 0.05 },
        { "p75": 3200, "good_pct": 0.42, "ni_pct": 0.33, "poor_pct": 0.25 },
        null
      ],
      "trends": [
        { "prev_p75": 1350, "curr_p75": 1234 },
        { "prev_p75": 3100, "curr_p75": 3200 },
        null
      ]
    }
  ]
}
```

Each `values[i]` and `trends[i]` corresponds to `columns[i]`. Null means no data for that site + metric combination.

### Comparison grid is a vanilla HTML table with CSS classes

Rather than rendering with D3.js (which is better suited for charts), the comparison grid is a styled HTML `<table>`. This gives:
- Natural responsive behavior
- Simpler cell-level click handling
- Easier styling with CSS (green/yellow/red backgrounds)
- Better accessibility

D3.js is used only for the sparkline trend indicators (inline mini-SVG per cell) and the Desglose tab stacked bar charts.

### Metric selector groups options by category

The current `<select>` becomes an `<optgroup>`-based select with 3 groups:

```
Core Web Vitals          LCP Diagnostics           Other
├ LCP                    ├ Resource Type           ├ RTT
├ CLS                    ├ Image TTFB              ├ Nav Types
├ INP                    ├ Load Delay              └ Form Factors
├ FCP                    ├ Load Duration
└ TTFB                   └ Render Delay
```

This avoids a flat 13-item list that would be hard to scan.

### Fractional metric filter auto-switches to Desglose tab

When the user selects a fractional metric (resource type, navigation types, form factors) while on a tab that only shows histogram data (Resumen, Grupos, Sitios, Tendencia), the dashboard automatically switches to the Desglose tab. This prevents confusion when a tab shows "no data" because it only queries histogram data for a fractional metric name. The Datos tab is excluded from auto-switch since it can display both.

**Alternative considered:** Show an error message. Rejected because it adds a step for the user. Auto-switch is more helpful.

## Risks / Trade-offs

- **Re-sync required:** All sites must be re-synced to fetch the 8 additional metrics. The sync script already handles idempotent inserts, so existing data is preserved and new metrics are appended.
- **DB size growth:** Adding ~500 rows per site (8 metrics × 40 periods × 2 form factors × multiple categories) roughly doubles the database size (from ~15MB to ~30MB). Acceptable for a local tool.
- **Fractional metric APIs may return fewer periods:** Some fractional metrics were added to CrUX more recently than CWV metrics (LCP resource types and subparts launched Feb 2025). The sync script handles partial data via NaN/null checks.
- **form_factors metric requires un-filtered queries:** The `form_factors` metric is only returned by the API when no `formFactor` is specified. The sync script should make one additional query per page (without formFactor) to capture this metric, or batch it with the origin-level query.
