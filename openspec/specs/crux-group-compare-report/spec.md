# crux-group-compare-report Specification

## Purpose
TBD - created by archiving change crux-group-compare-report. Update Purpose after archive.
## Requirements
### Requirement: The system generates a static cohort comparison report
The system SHALL provide a script (`npm run crux:group-report`) that reads `data/crux.db` and writes a self-contained HTML file to `reports/crux-group-compare.html` comparing site cohorts derived from the `group_name` values in the pages configuration: Walmart CAM (`walmart_propios` + `walmart_subsidiarias`), Walmart Global (`walmart_global`), and Competencia (`otros`). The set of cohorts SHALL be data-driven: adding a new `group_name` to the configuration and mapping it to a cohort MUST NOT require changes to the aggregation or rendering logic beyond the cohort list definition. The report SHALL present CrUX field data sections and, when synthetic run data exists, Lighthouse lab data sections.

#### Scenario: Report generation produces a portable HTML file
- **WHEN** the user runs `npm run crux:group-report` with a populated `data/crux.db`
- **THEN** `reports/crux-group-compare.html` is created containing all CSS inline and requiring no server or network access to render

#### Scenario: Report fails clearly when the database is missing
- **WHEN** `data/crux.db` does not exist
- **THEN** the script exits with a non-zero code and a clear error message

#### Scenario: No synthetic run available
- **WHEN** the `synthetic_runs` table has no rows with `excluded = 0`
- **THEN** the report is still generated with all field sections, and the lab sections show a notice that no synthetic run is available

#### Scenario: Third cohort renders everywhere
- **WHEN** `walmart_global` origins exist in the database with field or lab data
- **THEN** every summary table shows a "Walmart Global" column group, every heatmap includes the Walmart Global site block, and "Sitios evaluados" lists the 4 Walmart Global sites

### Requirement: The report aggregates p75 metrics per cohort and page type
The report SHALL show, for each page type (`homepage`, `checkout`, `plp`, `pdp`), each metric (LCP, INP, CLS, FCP, TTFB), and each cohort, the minimum, median, and maximum of site-level `p75_value` from the latest collection period for the PHONE form factor, along with the label of the site reaching each extreme. The median is used instead of the arithmetic mean because cohorts are small (6-13 sites) and the mean is sensitive to outliers.

#### Scenario: Latest period only, phone only
- **WHEN** the report is generated
- **THEN** only rows with `form_factor = 'PHONE'` and `collection_end` equal to the maximum `collection_end` in `crux_history` are aggregated

#### Scenario: Sites without data are excluded from statistics
- **WHEN** a site has a null `p75_value` or no row for a metric in the latest period
- **THEN** that site is excluded from min/median/max for that metric and the report indicates how many sites contributed to each statistic

### Requirement: The report shows the percentage of sites rated good per cohort
For each cohort × page type × metric, the report SHALL show a "% bueno" cell: the percentage of contributing sites whose p75 is at or below the metric's "good" threshold, with the underlying count (e.g. `8/13 sitios`). The cell is colored green when ≥ 75% of sites are good, amber when ≥ 50%, red otherwise.

#### Scenario: Pass-rate cell reflects per-site ratings
- **WHEN** 8 of 13 Walmart sites have p75 LCP ≤ 2500 ms on homepage
- **THEN** the Walmart homepage LCP "% bueno" cell shows 62% with `8/13 sitios`

### Requirement: Metric cells use a graduated color scale anchored on Core Web Vitals thresholds
The report SHALL color each value cell (min/median/max, heatmap cells, and "% bueno" cells) with a continuous scale: green at or below the metric's "good" threshold, interpolating green → amber → red between the good and poor thresholds, and progressively darker red beyond the poor threshold (capped at 2× the poor threshold). Text color MUST switch between dark and white for contrast. Thresholds: LCP good ≤ 2500 ms, poor > 4000 ms; INP good ≤ 200 ms, poor > 500 ms; CLS good ≤ 0.1, poor > 0.25; FCP good ≤ 1800 ms, poor > 3000 ms; TTFB good ≤ 800 ms, poor > 1800 ms.

#### Scenario: Color scale legend is present
- **WHEN** the report is rendered
- **THEN** a legend explains the color scale with a gradient bar and the good/poor thresholds used per metric

#### Scenario: Severity is visible in color intensity
- **WHEN** one cell has an LCP of 4200 ms and another has 7000 ms (both above the 4000 ms poor threshold)
- **THEN** the 7000 ms cell renders in a visibly darker red than the 4200 ms cell

### Requirement: Metric labels show an explanatory tooltip
The report SHALL display a tooltip when hovering over each metric label (LCP, INP, CLS, FCP, TTFB) in the table row headers and in the legend, explaining in Spanish what the metric measures and its good/poor thresholds. The tooltip MUST be CSS-only (no JavaScript) so the report remains functional in locked-down environments.

#### Scenario: Tooltip appears on hover
- **WHEN** the user hovers over the "LCP" label in any page-type table
- **THEN** a tooltip appears explaining that LCP measures the render time of the largest visible element and its good/poor thresholds

### Requirement: The report lists the evaluated sites per cohort
The report SHALL include a "Sitios evaluados" section listing every site in each cohort with its label, origin, and country code, and SHALL visually flag sites that contributed no data to the report period.

#### Scenario: Sites are grouped by cohort
- **WHEN** the report is rendered
- **THEN** each cohort column lists its sites (13 Walmart CAM, 4 Walmart Global, 6 Competencia), each with its origin and country

#### Scenario: Site without data is flagged
- **WHEN** a site has no CrUX rows in the report's collection period
- **THEN** the site appears in the list with a "sin datos" badge

### Requirement: The report includes a per-site heatmap (semáforo) per page type
The report SHALL include, after the cohort summary tables, one heatmap table per page type where each row is an individual site (grouped by cohort) and each column is one of the 5 metrics, with cells showing the site's p75 value colored by the same CWV rating scale.

#### Scenario: Heatmap shows every site with data
- **WHEN** the report is rendered
- **THEN** each page-type heatmap lists all sites of both cohorts and each cell shows the site p75 for that metric, colored good/NI/poor

#### Scenario: Missing site value renders as empty
- **WHEN** a site has no p75 value for a metric on a page type
- **THEN** the corresponding heatmap cell renders as "—" without color

### Requirement: Report tables are sortable by column
All data tables in the report (cohort summaries, field and lab heatmaps) SHALL allow sorting rows by clicking a column header: first click sorts ascending, second click descending, using the underlying numeric value (not the formatted text). Sorting MUST be implemented with inline JavaScript and `data-*` attributes so the report remains a single self-contained HTML file with no external dependencies. The metric/site label column MUST remain the first column and is not sortable.

#### Scenario: Sort heatmap by LCP ascending
- **WHEN** the user clicks the "LCP" header of a heatmap table
- **THEN** site rows reorder from lowest to highest LCP, and clicking again reverses the order

#### Scenario: Report still works offline
- **WHEN** the report is opened without network access
- **THEN** column sorting works because the script is inlined in the HTML

### Requirement: The report includes lab metrics from the latest non-excluded synthetic run
For each page type, the report SHALL show a lab summary table (min / median / max per cohort) and a per-site heatmap for: Lighthouse performance score, Total Blocking Time, Speed Index, total byte weight, and lab LCP, using rows from the synthetic run with the maximum `fetched_at` among non-excluded runs. The lab sections MUST display the run id and run date.

#### Scenario: Lab summary reflects the latest included run
- **WHEN** two runs exist and the newer one is excluded
- **THEN** the lab sections use the older non-excluded run

#### Scenario: Lab heatmap covers all audited sites
- **WHEN** the latest run has 76 rows covering 19 sites × 4 page types
- **THEN** each page-type lab heatmap shows all 19 sites with their lab values

### Requirement: Lab metric cells use graduated color scales appropriate to each metric
The report SHALL color lab cells with graduated scales: performance score uses Lighthouse bands (≥ 0.9 green, ≥ 0.5 amber, below red, higher-is-better); time-based metrics (TBT, Speed Index, lab LCP) use graduated red-intensity beyond their poor thresholds; total byte weight uses fixed bands (≤ 1.6 MB good, ≤ 3 MB needs improvement, above poor, with darkening beyond).

#### Scenario: Score coloring is higher-is-better
- **WHEN** a lab score cell shows 0.95 and another shows 0.10
- **THEN** the 0.95 cell renders green and the 0.10 cell renders deep red

### Requirement: The configuration includes the four Walmart global market sites
`engine/crux-pages.yaml` SHALL include a group `walmart_global` with exactly these sites, each with homepage, checkout, PLP, and PDP entries: Walmart US (`www.walmart.com`, country US), Walmart Canada (`www.walmart.ca`, country CA), Walmart Mexico (`www.walmart.com.mx`, country MX), Walmart Chile (`super.lider.cl`, country CL).

#### Scenario: Config validates against the schema
- **WHEN** `crux-pages.yaml` is loaded by the sync or report tooling
- **THEN** the 4 new sites pass zod validation with group `walmart_global` and 4 pages each

#### Scenario: Chile uses the Lider supermercado origin
- **WHEN** the configuration is inspected
- **THEN** the Chile site's origin is `super.lider.cl` (not `www.lider.cl`, whose /supermercado paths redirect there)

