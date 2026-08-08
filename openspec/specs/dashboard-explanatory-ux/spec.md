# dashboard-explanatory-ux Specification

## Purpose
TBD - created by archiving change improve-crux-dashboard-ux. Update Purpose after archive.
## Requirements
### Requirement: Metric explanations are discoverable
The dashboard SHALL provide hover and keyboard-focus explanations for each supported Core Web Vitals metric: LCP, CLS, INP, FCP, and TTFB. Each explanation SHALL include the full metric name, a concise description, the unit, and Good / Needs Improvement / Poor thresholds.

#### Scenario: User hovers metric help
- **WHEN** the user hovers or focuses the info affordance for `LCP`
- **THEN** a tooltip appears explaining Largest Contentful Paint, milliseconds as the unit, and thresholds for Good, Needs Improvement, and Poor

#### Scenario: CLS explanation uses score thresholds
- **WHEN** the user views the explanation for `CLS`
- **THEN** the tooltip presents CLS as a layout stability score and shows thresholds `Good <= 0.10`, `Needs Improvement <= 0.25`, and `Poor > 0.25`

### Requirement: Chart titles explain aggregation and interaction
Each chart view SHALL include a title and short explanatory subtitle that describe the current metric, how data is aggregated, and whether chart elements can be clicked to filter.

#### Scenario: Site chart title explains site filtering
- **WHEN** the `Sitios` tab renders `Métrica por Sitio — LCP`
- **THEN** the chart includes explanatory text indicating it shows Good / Needs Improvement / Poor distribution by site and that clicking a bar filters that site

#### Scenario: Group chart title explains group filtering
- **WHEN** the `Grupos` tab renders `Comparación por Grupo — LCP`
- **THEN** the chart includes explanatory text indicating it shows group averages and that clicking a bar filters that group

#### Scenario: Trend chart title explains series scope
- **WHEN** the `Tendencia` tab renders
- **THEN** the chart includes explanatory text indicating it shows p75 evolution over time for the current selected scope

### Requirement: Hover tooltips describe click action precisely
Chart hover tooltips SHALL describe the specific click action for the hovered mark when the mark is clickable.

#### Scenario: Hover site bar tooltip
- **WHEN** the user hovers a site bar
- **THEN** the tooltip includes `Click para ver solo este sitio`

#### Scenario: Hover group bar tooltip
- **WHEN** the user hovers a group bar
- **THEN** the tooltip includes `Click para filtrar este grupo`

#### Scenario: Hover scatter point tooltip
- **WHEN** the user hovers a scatter plot point
- **THEN** the tooltip includes `Click para ver solo este sitio`

### Requirement: Current analysis scope is visible
The dashboard SHALL display a concise current-scope summary near the chart area or top filters indicating whether the user is analyzing all sites, one group, one site, or multiple sites.

#### Scenario: Scope shows one site
- **WHEN** exactly one site is selected
- **THEN** the scope summary identifies the state as `Sitio único` and displays the selected site

#### Scenario: Scope shows group
- **WHEN** a group is selected and no sites are selected
- **THEN** the scope summary identifies the state as `Grupo` and displays the selected group

#### Scenario: Scope shows multiple sites
- **WHEN** more than one site is selected
- **THEN** the scope summary identifies the state as `Sitios seleccionados` and displays the count of selected sites

#### Scenario: Scope shows all sites
- **WHEN** no group and no sites are selected
- **THEN** the scope summary identifies the state as `Todos los sitios`

### Requirement: Site group selector is visually clear
The dashboard SHALL render the site selector as a styled grouped checklist with visible group headers, container boundaries, hover feedback, active press feedback, and selected counts.

#### Scenario: Group selector container is styled
- **WHEN** the dashboard loads the sidebar
- **THEN** the site checklist appears inside a bordered, scrollable dark container matching the dashboard theme

#### Scenario: Group header shows selected count
- **WHEN** a group contains five visible sites and two are selected
- **THEN** the group header displays a selected count equivalent to `2/5`

#### Scenario: Site row provides interaction feedback
- **WHEN** the user hovers or presses a site row
- **THEN** the row provides visible hover and active feedback without changing the selected state until the checkbox action occurs

