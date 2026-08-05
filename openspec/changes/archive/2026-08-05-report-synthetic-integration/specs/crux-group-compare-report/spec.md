## MODIFIED Requirements

### Requirement: The system generates a static cohort comparison report
The system SHALL provide a script (`npm run crux:group-report`) that reads `data/crux.db` and writes a self-contained HTML file to `reports/crux-group-compare.html` comparing two site cohorts: Walmart (origins in groups `walmart_propios` and `walmart_subsidiarias`) and Competencia (origins in group `otros`). The report SHALL present CrUX field data sections and, when synthetic run data exists, Lighthouse lab data sections.

#### Scenario: Report generation produces a portable HTML file
- **WHEN** the user runs `npm run crux:group-report` with a populated `data/crux.db`
- **THEN** `reports/crux-group-compare.html` is created containing all CSS inline and requiring no server or network access to render

#### Scenario: Report fails clearly when the database is missing
- **WHEN** `data/crux.db` does not exist
- **THEN** the script exits with a non-zero code and a clear error message

#### Scenario: No synthetic run available
- **WHEN** the `synthetic_runs` table has no rows with `excluded = 0`
- **THEN** the report is still generated with all field sections, and the lab sections show a notice that no synthetic run is available

## ADDED Requirements

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
