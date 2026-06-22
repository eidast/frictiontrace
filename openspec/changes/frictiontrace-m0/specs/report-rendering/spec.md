## ADDED Requirements

### Requirement: The system produces a static HTML report
The system MUST produce a self-contained `report.html` file at `./runs/<runId>/report.html` for every successful run. The report MUST be valid HTML5, MUST NOT require network access to render (all assets embedded or referenced from the same directory), and MUST be openable in any modern browser by double-clicking.

#### Scenario: Report file produced
- **WHEN** a run completes successfully
- **THEN** a non-empty `report.html` file exists at `./runs/<runId>/report.html`

#### Scenario: Report renders offline
- **WHEN** the user opens `report.html` in a browser with no network connection
- **THEN** the report renders with all sections visible and no broken-asset indicators

### Requirement: The system produces a HAR file
The system MUST produce a HAR 1.2 file at `./runs/<runId>/run.har`, generated from the run's `network` category signals. The HAR file MUST validate against the HAR 1.2 JSON Schema.

#### Scenario: HAR file produced
- **WHEN** a run completes successfully
- **THEN** a non-empty `run.har` file exists at `./runs/<runId>/run.har`

#### Scenario: HAR is importable
- **WHEN** the user imports `run.har` into Chrome DevTools' Network panel
- **THEN** DevTools shows the requests with correct timing, status, and sizes

### Requirement: The system produces an MHTML file
The system MUST produce an MHTML file at `./runs/<runId>/run.mhtml` that captures the final state of the journey's last step. The MHTML file MUST open as a navigable page in Chrome when double-clicked.

#### Scenario: MHTML file produced
- **WHEN** a run completes successfully
- **THEN** a non-empty `run.mhtml` file exists at `./runs/<runId>/run.mhtml`

#### Scenario: MHTML opens in browser
- **WHEN** the user double-clicks `run.mhtml` in Chrome
- **THEN** Chrome renders the captured page as a single navigable file

### Requirement: The report shows the executive summary
The report MUST include an executive summary section at the top, generated from a deterministic template that reads facts and issues. The summary MUST contain: the run target URL, the run date, the overall friction score (0–100), the count of issues by severity, and the top 5 issues sorted by severity.

#### Scenario: Executive summary present
- **WHEN** the user opens the report
- **THEN** an executive summary section appears first, with all required fields populated

#### Scenario: Top 5 issues sorted
- **WHEN** the run has more than 5 issues
- **THEN** the report shows exactly 5 issues in the top list, ordered by severity (`critical` first, then `high`, `med`, `low`) and within severity by `kind` alphabetically

### Requirement: The report shows the Cliente and Developer perspectives
The report MUST include a "Cliente final" section (human-language description of what the user felt, derived from issues and facts via templates) and a "Developer" section (technical description with evidence, derived from issues and signal IDs via templates). The M0 Developer section is allowed to be templated-only with no LLM; the structure MUST be ready for M1 to add LLM-narrated content without restructuring the page.

#### Scenario: Both perspectives present
- **WHEN** the user opens the report
- **THEN** both "Cliente final" and "Developer" sections are visible, each populated from the run's issues and facts

#### Scenario: Developer section cites evidence
- **WHEN** the Developer section describes an issue
- **THEN** it includes a "Evidence" subsection listing the signal IDs that prove the issue

### Requirement: The report embeds screenshots as evidence
The report MUST include the per-step screenshots in the evidence section, each displayed as a thumbnail with the step name as caption. Screenshots MUST be loaded from the local filesystem path, not inlined as base64, to keep the report file small.

#### Scenario: Screenshots visible
- **WHEN** the user opens the report
- **THEN** the evidence section shows one thumbnail per step with the step name as caption
