# Tasks

- [ ] 1.1 Add to `engine/crux-pages.yaml` a new group `walmart_global` with 4 sites (Walmart US `www.walmart.com`, Walmart Canada `www.walmart.ca`, Walmart Mexico `www.walmart.com.mx`, Walmart Chile `super.lider.cl`), each with homepage/checkout/plp/pdp URLs verified during research (see design notes in proposal thread).
- [x] 1.2 Refactor `scripts/crux-group-report.ts` so cohorts are a data-driven ordered list (Walmart CAM = `walmart_propios` + `walmart_subsidiarias`; Walmart Global = `walmart_global`; Competencia = `otros`) instead of a hardcoded 2-cohort record.
- [x] 1.3 Render the third cohort in all sections: field summary tables, field heatmaps, lab summary tables, lab heatmaps, and "Sitios evaluados".
- [x] 1.4 Validate: `openspec validate add-walmart-global-sites --strict`, `npm run typecheck`, `npm run test:unit`.
- [x] 1.5 Run CrUX sync (`crux:sync`) to pull history for the 16 new URLs; run a fast4g synthetic baseline limited to the 4 new sites (`--site` per site or equivalent) with label `baseline-global-fast4g`.
- [x] 1.6 Regenerate the report and verify the new segment appears with plausible values in both field and lab sections.
- [x] 1.7 Fix lab data selection in `scripts/crux-group-report.ts` to merge multiple non-excluded synthetic runs: newest row per origin+page_type wins (query all `excluded=0` rows ordered by `fetched_at` DESC, dedupe first-wins), so the 76-URL baseline and the per-site walmart_global runs all contribute. Lab intro shows contributing run count + newest date (or the single run_id when only one run contributes) and the throttling profile(s).
