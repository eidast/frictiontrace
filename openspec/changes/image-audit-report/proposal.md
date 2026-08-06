## Why

Homepage images are the heaviest and most impactful assets in e-commerce: they drive LCP, page weight, and bandwidth cost. Lighthouse already computes image audits on every synthetic run (modern formats, compression, responsive sizing, offscreen images, unsized images) but the runner discards them. Persisting these findings and rendering them as a dedicated work-list report turns the synthetic pipeline into an actionable image-optimization backlog per site.

## What Changes

- Extend the synthetic runner to persist Lighthouse image-audit detail items (`modern-image-formats`, `uses-optimized-images`, `uses-responsive-images`, `offscreen-images`, `unsized-images`) into a new `image_findings` table (additive migration), capturing per-image URL, audit type, wasted bytes, and total bytes.
- Add `scripts/image-report.ts` (`npm run image-report`): generates `reports/image-audit.html` — a self-contained work-list report, homepage-only, ordered by estimated byte savings, per site, with a "worst offenders" global view.
- Mark sites whose audit likely hit an anti-bot challenge page (heuristic: zero image findings AND suspiciously low page weight, or blocked URL patterns) as "parcial" in the report.

## Capabilities

### New Capabilities
- `image-audit-report`: Persistence of per-image Lighthouse findings and a dedicated, self-contained work-list HTML report for homepage image optimization, ordered by savings, with partial-data flagging for bot-walled sites.

### Modified Capabilities
- `synthetic-lighthouse-runs`: the runner now also persists image audit detail rows for each audited URL.

## Impact

- **Schema**: `engine/src/crux/schema.ts` + `engine/src/crux/db.ts` — new `image_findings` table (additive).
- **Runner**: `scripts/synthetic-run.ts` — extract and persist image audit items per URL.
- **New file**: `scripts/image-report.ts`; npm script `image:report`.
- **Data**: one fresh synthetic run over the 23 homepages to populate findings.
- No changes to CrUX sync or the group comparison report.
