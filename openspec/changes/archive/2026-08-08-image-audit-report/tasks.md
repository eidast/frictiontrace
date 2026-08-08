# Tasks

- [x] 1.1 Add `image_findings` table to `engine/src/crux/schema.ts` (additive; migration-safe for existing DBs): id, run_id, origin, page_type, url_audited, audit_id (modern-image-formats | uses-optimized-images | uses-responsive-images | offscreen-images | unsized-images), resource_url, total_bytes, wasted_bytes, wasted_pct, fetched_at. Index on (run_id) and (origin, page_type).
- [x] 1.2 Extend `scripts/synthetic-run.ts` to extract the 5 image audits' detail items from each Lighthouse result and persist them (both sequential and worker paths).
- [x] 1.3 Add `--page homepage` full-cohort run: execute a fast4g run over all 23 homepages with label `image-audit-2026-08`.
- [x] 1.4 Implement `scripts/image-report.ts` + npm script `image:report`: reads latest non-excluded findings per origin (homepage only), generates self-contained `reports/image-audit.html`.
- [x] 1.5 Report structure: (a) global summary per site (total wasted bytes, finding counts by audit type), (b) per-site work list ordered by wasted bytes desc with resource URL, audit type, current bytes, potential savings, (c) "peores ofensores" global top-20 across all sites.
- [x] 1.6 Partial detection: flag a site as "parcial" when its homepage audit has zero image findings AND (total_byte_weight < 200 KB OR the audited final URL matches a bot-wall pattern like /blocked, queue-it, challenge). Show a clear badge.
- [x] 1.7 Verify: typecheck, unit tests, openspec validate --strict, generate report and sanity-check values against the DB.
- [x] 1.8 Replace obsolete audit IDs in `scripts/synthetic-run.ts` (`modern-image-formats`, `uses-optimized-images`, `uses-responsive-images`, `offscreen-images` no longer exist in Lighthouse 13) with `image-delivery-insight`; dedupe items by (audit_id, resource_url) keeping max wasted bytes.
- [x] 1.9 Add `image-delivery-insight` labels to `scripts/image-report.ts` (AUDIT_LABELS / AUDIT_SHORT); keep legacy labels for historical rows.
- [x] 1.10 Re-run the homepage cohort with the fixed extraction (label `image-audit-2026-08`), regenerate the report, and sanity-check that wasted-bytes savings are now populated.
