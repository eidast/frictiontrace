# Tasks

- [x] 1.1 Create `scripts/crux-group-report.ts` that opens `data/crux.db` read-only via `engine/src/crux/db.ts` and queries the latest collection period (`MAX(collection_end)`), PHONE form factor, for metrics LCP, INP, CLS, FCP, TTFB.
- [x] 1.2 Aggregate results into two cohorts: Walmart (`walmart_propios` + `walmart_subsidiarias`) and Competencia (`otros`), grouped by page type (`homepage`, `checkout`, `plp`, `pdp`).
- [x] 1.3 Compute per cohort × page type × metric: min, max, average of `p75_value` across sites, tracking which site label reaches min and max. Sites with null p75 are excluded from stats and counted separately.
- [x] 1.4 Render a self-contained HTML file (inline CSS/JS, no external dependencies) with one table per page type; rows = metrics, column groups = Walmart / Competencia, each with min / avg / max sub-columns.
- [x] 1.5 Apply CWV threshold color coding per metric cell: LCP ≤2500ms good / ≤4000ms NI / >4000ms poor; INP ≤200 / ≤500 / >500; CLS ≤0.1 / ≤0.25 / >0.25; FCP ≤1800 / ≤3000 / >3000; TTFB ≤800 / ≤1800 / >1800.
- [x] 1.6 Include report header with generation date, collection period, site counts per cohort, and a legend of the color scale.
- [x] 1.7 Add npm script `crux:group-report` to root `package.json` and write output to `reports/crux-group-compare.html`.
- [x] 1.8 Run the script, verify the HTML is generated and contains plausible values; run `npm run typecheck` and `npm run test:unit`.
- [x] 1.9 Add a CSS-only tooltip on each metric label (row headers and legend) explaining what the metric measures and its good/poor thresholds, in Spanish.
- [x] 1.10 Add a "Sitios evaluados" section listing every site per cohort (label, origin, country), flagging sites with no CrUX data in the period.
- [x] 1.11 Replace the average column with the median of site p75 values, and add a "% bueno" column per cohort = percentage of sites rated "good" for the metric (colored ≥75% good / ≥50% NI / else poor).
- [x] 1.12 Add a heatmap section ("Semáforo") per page type: rows = individual sites grouped by cohort, columns = the 5 metrics, cells colored with the same CWV rating scale showing the site p75 value.
- [x] 1.13 Replace the flat 3-color scale with a graduated scale: green→amber→red interpolation between good and poor thresholds, progressively darker red beyond poor (capped at 2× poor), with automatic text contrast; add a gradient bar to the legend.
- [x] 1.14 Make all data tables sortable: clicking a column header sorts rows by that column (numeric-aware, asc/desc toggle), via a small inline JS snippet with data attributes on cells; the report remains self-contained.
