## ADDED Requirements

### Requirement: A "Comparativa" tab shows side-by-side multi-site comparison
The dashboard SHALL provide a "Comparativa" tab that displays a grid view with selected sites as columns and metrics as rows, allowing direct comparison of 2-10 individually selected sites.

#### Scenario: Comparativa tab visible in navigation
- **WHEN** the dashboard loads
- **THEN** the tab bar includes a "Comparativa" tab alongside existing tabs

#### Scenario: Grid renders with selected sites
- **WHEN** the user selects 3 individual sites via the sidebar checkboxes and navigates to the Comparativa tab
- **THEN** a grid displays the 3 sites as columns and all available metrics as rows

#### Scenario: Empty state when fewer than 2 sites selected
- **WHEN** the user navigates to the Comparativa tab with fewer than 2 sites selected
- **THEN** the dashboard displays a message: "Seleccioná al menos 2 sitios en el panel lateral para comparar"

#### Scenario: Maximum 10 sites supported
- **WHEN** the user selects more than 10 sites
- **THEN** the URL state stores only the first 10 and the comparison view shows up to 10 columns

### Requirement: Comparison grid cells show metric values with color coding
Each cell in the comparison grid SHALL display the most recent p75 value (for histogram metrics) or the most recent fraction (for fractional metrics) with color coding based on Core Web Vitals thresholds (green = good, yellow = needs improvement, red = poor).

#### Scenario: p75 metric cell colored by threshold
- **WHEN** a cell displays LCP p75 for a site
- **THEN** the cell background is green if p75 ≤ 2500ms, yellow if ≤ 4000ms, red if > 4000ms

#### Scenario: CLS cell uses unitless thresholds
- **WHEN** a cell displays CLS p75
- **THEN** the cell background is green if p75 ≤ 0.10, yellow if ≤ 0.25, red if > 0.25

#### Scenario: Fractional metric cells use neutral color
- **WHEN** a cell displays a fractional metric (LCP resource type, navigation types, form factors)
- **THEN** the cell background is neutral (no color coding) since fractional metrics have no Good/NI/Poor thresholds

#### Scenario: Null or missing data shown clearly
- **WHEN** a site has no data for a particular metric under current filters
- **THEN** the cell displays "—" with a muted background

### Requirement: Comparison grid supports drill-down to trend view
Clicking a metric row label in the comparison grid SHALL switch to the Tendencia tab with that metric pre-selected and the currently selected sites applied.

#### Scenario: Click LCP row in comparison grid
- **WHEN** the user clicks the "LCP" row label in the Comparativa grid
- **THEN** the dashboard switches to the Tendencia tab, sets metric=LCP, keeps the selected sites, and shows the time-series chart

### Requirement: Comparison grid includes trend sparkline indicators
Each metric row in the comparison grid SHALL include a small sparkline indicator showing the direction of change between the two most recent collection periods (improving ▼ green, worsening ▲ red, unchanged → gray).

#### Scenario: Improving trend shows green down arrow
- **WHEN** a site's LCP p75 decreased by more than 5% between the two most recent periods
- **THEN** the cell displays a green ▼ indicator

#### Scenario: Worsening trend shows red up arrow
- **WHEN** a site's LCP p75 increased by more than 5% between the two most recent periods
- **THEN** the cell displays a red ▲ indicator

#### Scenario: Stable trend shows gray arrow
- **WHEN** a site's LCP p75 changed by 5% or less between the two most recent periods
- **THEN** the cell displays a gray → indicator

### Requirement: URL state supports up to 10 comparison sites
The dashboard URL state SHALL serialize up to 10 selected site origins in the `sites` query parameter, raised from the current limit of 5.

#### Scenario: 7 sites serialized in URL
- **WHEN** the user selects 7 sites
- **THEN** the URL contains `sites=origin1,origin2,...,origin7`

#### Scenario: More than 10 sites truncated
- **WHEN** the user selects more than 10 sites
- **THEN** only the first 10 are serialized in the URL

### Requirement: API provides comparison grid data endpoint
The API SHALL provide a `/api/compare-grid` endpoint that returns the most recent period's data for all selected sites and metrics in a grid-ready format.

#### Scenario: Grid endpoint returns pivoted data
- **WHEN** `GET /api/compare-grid?sites=www.walmart.com.gt,www.exito.com&metric=largest_contentful_paint&ff=PHONE` is called
- **THEN** the response is an object with `columns` (site labels), `rows` (metric entries with per-site p75, good_pct, ni_pct, poor_pct values), and `periods` (for trend sparkline data)

#### Scenario: Grid endpoint includes fraction data
- **WHEN** `GET /api/compare-grid?sites=...&metric=largest_contentful_paint_resource_type` is called
- **THEN** the response includes `fractions` with per-site category breakdowns
