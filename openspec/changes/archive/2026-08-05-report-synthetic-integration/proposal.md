## Why

The group comparison report (`reports/crux-group-compare.html`) currently shows only CrUX field data. The synthetic baseline run (`run_20260805_Z1PctQ`, 76/76 URLs) now provides lab metrics — TBT, Speed Index, page weight, Lighthouse performance score — that explain *why* field numbers look the way they do. Showing field vs lab side by side per cohort and page type turns the report from a scoreboard into a diagnostic tool.

## What Changes

- Extend `scripts/crux-group-report.ts` to read the latest non-excluded run from `synthetic_runs` and add a lab section to the HTML report.
- Per page type: a lab summary table per cohort (min / median / max across sites) for Lighthouse performance score, TBT, Speed Index, total byte weight, and lab LCP.
- Per page type: a lab heatmap (sites × the 5 lab metrics) using the same graduated color conventions (score uses Lighthouse bands: ≥0.9 green, ≥0.5 amber, <0.5 red — higher is better).
- If no synthetic run exists, the lab sections render a notice instead of failing.

## Capabilities

### Modified Capabilities
- `crux-group-compare-report`: new lab sections sourced from `synthetic_runs`, alongside the existing CrUX field sections.

## Impact

- **Modified file**: `scripts/crux-group-report.ts` only (read-only queries on `synthetic_runs`; no schema changes).
- Report output remains a single self-contained HTML at `reports/crux-group-compare.html`.
- No changes to the CrUX sync, the synthetic runner, or the dashboard.
