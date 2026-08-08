## MODIFIED Requirements

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

### Requirement: The report lists the evaluated sites per cohort
The report SHALL include a "Sitios evaluados" section listing every site in each cohort with its label, origin, and country code, and SHALL visually flag sites that contributed no data to the report period.

#### Scenario: Sites are grouped by cohort
- **WHEN** the report is rendered
- **THEN** each cohort column lists its sites (13 Walmart CAM, 4 Walmart Global, 6 Competencia), each with its origin and country

#### Scenario: Site without data is flagged
- **WHEN** a site has no CrUX rows in the report's collection period
- **THEN** the site appears in the list with a "sin datos" badge

## ADDED Requirements

### Requirement: The configuration includes the four Walmart global market sites
`engine/crux-pages.yaml` SHALL include a group `walmart_global` with exactly these sites, each with homepage, checkout, PLP, and PDP entries: Walmart US (`www.walmart.com`, country US), Walmart Canada (`www.walmart.ca`, country CA), Walmart Mexico (`www.walmart.com.mx`, country MX), Walmart Chile (`super.lider.cl`, country CL).

#### Scenario: Config validates against the schema
- **WHEN** `crux-pages.yaml` is loaded by the sync or report tooling
- **THEN** the 4 new sites pass zod validation with group `walmart_global` and 4 pages each

#### Scenario: Chile uses the Lider supermercado origin
- **WHEN** the configuration is inspected
- **THEN** the Chile site's origin is `super.lider.cl` (not `www.lider.cl`, whose /supermercado paths redirect there)
