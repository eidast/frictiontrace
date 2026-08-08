# image-audit-report Specification

## Purpose
TBD - created by archiving change image-audit-report. Update Purpose after archive.
## Requirements
### Requirement: The system persists Lighthouse image audit findings
For each audited URL, the synthetic runner SHALL extract detail items from the Lighthouse image audits available in the bundled Lighthouse version — `image-delivery-insight` (consolidates format, compression, and responsive-sizing savings) and `unsized-images` — and persist them in an `image_findings` table with run_id, origin, page_type, form factor, audited URL, audit id, resource URL, total bytes, wasted bytes, and wasted percentage. When available (from `image-delivery-insight` item node bounding rect), the displayed CSS width and height of the element referencing the resource SHALL be persisted as `displayed_width` / `displayed_height`. The table MUST evolve additively without altering existing tables. Within a single audited URL, items sharing the same `(audit_id, resource_url)` MUST be deduplicated, keeping the maximum wasted bytes, because `image-delivery-insight` repeats one row per DOM node referencing the same resource.

Additionally, the runner SHALL persist priority and platform-specific findings derived from the same LHR:

- `lcp-lazy-loaded`, `lcp-missing-fetchpriority`, `lcp-not-discoverable` — emitted for the LCP image URL (from `largest-contentful-paint-element`) according to the `lcp-discovery-insight` checklist verdicts, with NULL byte columns (they are prioritization findings, not byte savings).
- `vtex-fullres-image` — emitted for each image network request (from the `network-requests` audit) whose host matches `*.vtexassets.com` or `*.vteximg.com.br` and whose path lacks the `-{width}-{height}` resize segment, which per VTEX documentation means the full-resolution original is downloaded. `total_bytes` SHALL be the request's transfer size.

#### Scenario: Findings stored per resource
- **WHEN** a homepage audit finds 3 JPEG images that could be WebP
- **THEN** 3 rows with audit_id `image-delivery-insight` are persisted with each image's URL, estimated wasted bytes, and displayed dimensions

#### Scenario: Same resource referenced by multiple nodes is counted once
- **WHEN** `image-delivery-insight` lists the same image URL in two items because two DOM nodes render it
- **THEN** a single `image_findings` row is persisted for that URL with the maximum wasted bytes, so savings are not double-counted

#### Scenario: URL with no findings stores nothing
- **WHEN** an audited URL has no image audit items
- **THEN** no `image_findings` rows are written for that URL and the run continues normally

#### Scenario: LCP image is lazy-loaded
- **WHEN** the `lcp-discovery-insight` checklist reports the LCP image has `loading="lazy"`
- **THEN** a row with audit_id `lcp-lazy-loaded`, the LCP image URL, and NULL bytes is persisted

#### Scenario: VTEX image without resize segment
- **WHEN** a page requests `https://acct.vtexassets.com/arquivos/ids/banner-123?v=1` (no `-{w}-{h}` segment) as an image
- **THEN** a row with audit_id `vtex-fullres-image` and the request's transfer size as total_bytes is persisted

#### Scenario: Findings are scoped by form factor
- **WHEN** the same URL is audited with `--form-factor both`
- **THEN** the mobile and desktop findings are distinguishable via `form_factor`, and historical rows read `form_factor = 'mobile'`

### Requirement: The system generates a dedicated image work-list report
The system SHALL provide `npm run image:report` generating `reports/image-audit.html` covering the homepage of every configured site, using the newest non-excluded findings per origin and form factor. The report SHALL include: a per-site summary (total potential savings, finding counts by audit type), a per-site work list ordered by wasted bytes descending (resource URL, audit type, current bytes, estimated savings), and a global top-20 "peores ofensores" list across all sites.

The report SHALL be interactive:

- A mobile/desktop toggle (mobile default) SHALL filter every table and summary by `form_factor`.
- Each finding row SHALL open a viewer showing the original image (hotlinked with `referrerpolicy="no-referrer"`, with a fallback message when hotlinking fails), the locally generated optimized variant when present in `reports/image-assets/manifest.json`, a byte comparison (downloaded original bytes vs optimized bytes vs Lighthouse estimated savings), a link to open the original, and a download action for the optimized file.
- Each site section SHALL show its image byte split (modern formats AVIF/WebP vs legacy JPEG/PNG/GIF vs third-party) from the run's stored page image stats.
- The report SHALL note that the `image-assets/` folder must accompany the HTML for optimized variants to display and download.

#### Scenario: Work list is ordered by impact
- **WHEN** a site has findings of 50 KB and 900 KB
- **THEN** the 900 KB finding appears first in that site's list and is a candidate for the global top-20

#### Scenario: No findings available
- **WHEN** `image_findings` has no non-excluded rows
- **THEN** the report is generated with a notice instead of failing

#### Scenario: Finding row opens the viewer
- **WHEN** a user clicks a finding with an optimized variant present
- **THEN** the viewer shows the original image, the optimized WebP, and a working download link for the optimized file

#### Scenario: Form factor toggle filters the data
- **WHEN** findings exist for both mobile and desktop and the user selects Desktop
- **THEN** only desktop findings and desktop stats are shown

### Requirement: Bot-walled sites are flagged as partial
The report SHALL mark a site's homepage results as "parcial" when the audit produced zero image findings AND (the page's total byte weight is suspiciously low (< 200 KB) OR the final audited URL matches known bot-wall patterns such as `/blocked`, `queue-it`, or `challenge`).

#### Scenario: Blocked audit is flagged
- **WHEN** a site's homepage Lighthouse run hit a PerimeterX /blocked page
- **THEN** the report shows the site with a "parcial" badge and excludes its numbers from the global top-20

### Requirement: The system generates optimized image variants for findings
The system SHALL provide `npm run image:optimize` (`scripts/image-optimize.ts`) which, for each resource URL in the newest non-excluded homepage findings per origin and form factor, downloads the original (with a browser user agent, timeout, and a size cap), produces an optimized variant using `sharp` — resized to displayed dimensions ×2 DPR (capped at 2560 px) when displayed dimensions are known, encoded as WebP quality 80 — and writes it to `reports/image-assets/<finding_id>.webp` along with a `manifest.json` mapping each finding id to its optimized file, fetched original bytes, optimized bytes, and pixel dimensions. The optimizer SHALL be idempotent (skip findings whose variant already exists), process downloads with bounded concurrency, and skip failures (network error, anti-hotlink response, unsupported format) with a log line so one bad resource never aborts the batch.

#### Scenario: Optimized variant is smaller and correctly sized
- **WHEN** a finding references a 3200×1980 JPEG displayed at 693×429
- **THEN** the generated variant is WebP at most 1386 px wide (2× DPR) and its optimized bytes are recorded in the manifest

#### Scenario: Download failure is skipped
- **WHEN** a finding's resource URL returns 403 or times out
- **THEN** that finding is logged and skipped, no manifest entry is written for it, and the batch continues

#### Scenario: Re-running does no duplicate work
- **WHEN** `image:optimize` runs twice over the same findings
- **THEN** the second run skips every finding whose variant file already exists

