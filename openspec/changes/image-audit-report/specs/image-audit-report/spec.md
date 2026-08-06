## ADDED Requirements

### Requirement: The system persists Lighthouse image audit findings
For each audited URL, the synthetic runner SHALL extract detail items from the Lighthouse audits `modern-image-formats`, `uses-optimized-images`, `uses-responsive-images`, `offscreen-images`, and `unsized-images`, and persist them in an `image_findings` table with run_id, origin, page_type, audited URL, audit id, resource URL, total bytes, wasted bytes, and wasted percentage. The table MUST be created additively without altering existing tables.

#### Scenario: Findings stored per resource
- **WHEN** a homepage audit finds 3 JPEG images that could be WebP
- **THEN** 3 rows with audit_id `modern-image-formats` are persisted with each image's URL and estimated wasted bytes

#### Scenario: URL with no findings stores nothing
- **WHEN** an audited URL has no image audit items
- **THEN** no `image_findings` rows are written for that URL and the run continues normally

### Requirement: The system generates a dedicated image work-list report
The system SHALL provide `npm run image:report` generating a self-contained `reports/image-audit.html` covering the homepage of every configured site, using the newest non-excluded findings per origin. The report SHALL include: a per-site summary (total potential savings, finding counts by audit type), a per-site work list ordered by wasted bytes descending (resource URL, audit type, current bytes, estimated savings), and a global top-20 "peores ofensores" list across all sites.

#### Scenario: Work list is ordered by impact
- **WHEN** a site has findings of 50 KB and 900 KB
- **THEN** the 900 KB finding appears first in that site's list and is a candidate for the global top-20

#### Scenario: No findings available
- **WHEN** `image_findings` has no non-excluded rows
- **THEN** the report is generated with a notice instead of failing

### Requirement: Bot-walled sites are flagged as partial
The report SHALL mark a site's homepage results as "parcial" when the audit produced zero image findings AND (the page's total byte weight is suspiciously low (< 200 KB) OR the final audited URL matches known bot-wall patterns such as `/blocked`, `queue-it`, or `challenge`).

#### Scenario: Blocked audit is flagged
- **WHEN** a site's homepage Lighthouse run hit a PerimeterX /blocked page
- **THEN** the report shows the site with a "parcial" badge and excludes its numbers from the global top-20
