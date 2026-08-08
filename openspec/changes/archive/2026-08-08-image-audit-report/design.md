# Design — image-audit-report

## Lighthouse 13 removed the byte-savings image audits

The original spec targeted `modern-image-formats`, `uses-optimized-images`,
`uses-responsive-images`, and `offscreen-images`. Verified against the bundled
`lighthouse@13.4.1` (2026-08-08): these audits no longer exist in the LHR
(`score=undefined`, no detail items). Byte-savings findings moved to
**`image-delivery-insight`** (details type `table`, items carry `url`,
`totalBytes`, `wastedBytes`, plus `subItems.items[].reason` describing the
optimization type). `unsized-images` still exists and its items carry no byte
fields (only `url` + node info).

**Decision:** extract `image-delivery-insight` + `unsized-images` only. The
dead audit IDs are dropped from the extraction list rather than kept as
no-ops; historical rows with legacy audit_ids remain in `image_findings` and
the report keeps their labels for backward display.

## Deduplication by (audit_id, resource_url)

`image-delivery-insight` emits one item **per DOM node** referencing a
resource — the same image URL appears N times with identical `wastedBytes`
when N elements render it (observed: an ad image listed twice on
walmart.com.gt). Summing raw items would double-count savings.

**Decision:** within one audited URL, collapse items by
`(audit_id, resource_url)` keeping the max `total_bytes`/`wasted_bytes`.
Alternatives considered: (a) persist all rows and dedupe at report time —
rejected, inflates the table and pushes the trap onto every consumer;
(b) dedupe by URL across audits — rejected, `unsized-images` and
`image-delivery-insight` legitimately flag the same URL for different
problems.

## No schema change

`image_findings` already stores audit_id/resource_url/total/wasted/wasted_pct;
`image-delivery-insight` rows fit the same shape. The `reason` subtype
(responsive vs. format vs. compression) is **not** persisted — the report
groups by audit_id only, and a reason column can be added additively later if
the work lists need that granularity.
