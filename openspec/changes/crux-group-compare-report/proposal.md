## Why

Stakeholders need a single, shareable summary that compares the 13 Walmart-ecosystem sites (5 `walmart_propios` + 8 `walmart_subsidiarias`) against the 6 competitor sites (`otros`) on Web performance. The existing dashboard is interactive and per-site; there is no aggregated group-level view with min/max/average per page type and industry-standard (Core Web Vitals) color coding.

## What Changes

- Add `scripts/crux-group-report.ts`: a static report generator that reads `data/crux.db` and writes a self-contained `reports/crux-group-compare.html`.
- The report compares two cohorts — **Walmart** (`walmart_propios` + `walmart_subsidiarias`) vs **Competencia** (`otros`) — broken down by page type (`homepage`, `checkout`, `plp`, `pdp`).
- Scope: PHONE form factor only, latest collection period only, metrics LCP, INP, CLS, FCP and TTFB.
- For each cohort × page type × metric, show min / max / average of p75 values across sites, plus the site that reaches each extreme.
- Color-code each cell with Core Web Vitals thresholds (good / needs improvement / poor).

## Capabilities

### New Capabilities
- `crux-group-compare-report`: Static HTML report aggregating CrUX p75 metrics by site cohort and page type, with min/max/average statistics and CWV threshold color coding.

## Impact

- **New file**: `scripts/crux-group-report.ts` (read-only against `data/crux.db`; writes `reports/crux-group-compare.html`).
- **package.json**: new npm script `crux:group-report`.
- No changes to the database schema, the sync pipeline, or the existing dashboard.
- Report output goes to `reports/` (already the convention for generated artifacts).
