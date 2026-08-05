# Tasks

- [x] 1.1 Query the latest non-excluded synthetic run (`MAX(fetched_at)` where `excluded = 0`) in `scripts/crux-group-report.ts`; if none exists, render a notice in the lab sections and continue generating the field-only report.
- [x] 1.2 Add a lab summary table per page type: rows = Lighthouse performance score, TBT, Speed Index, total byte weight, lab LCP; columns = min / median / max per cohort, using the latest run's rows.
- [x] 1.3 Add a lab heatmap per page type: rows = sites grouped by cohort, columns = the 5 lab metrics, cells colored with graduated scales (score uses Lighthouse bands ≥0.9 / ≥0.5, higher-is-better; byte weight uses fixed bands; time metrics reuse CWV-style thresholds for lab).
- [x] 1.4 Label sections clearly as "Campo (CrUX)" vs "Lab (Lighthouse)" and show the lab run id + date in the header of the lab sections.
- [x] 1.5 Regenerate the report, verify plausible values against `run_20260805_Z1PctQ`, run `npm run typecheck` and `npm run test:unit`, re-validate the change with `openspec validate report-synthetic-integration --strict`.
- [x] 1.6 Surface the run's `throttling_profile` in the lab intro line with a human-readable description (fast4g / slow4g; raw name for unknown profiles), keeping the subtle `.run-meta` styling.
