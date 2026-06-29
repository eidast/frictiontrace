## MODIFIED Requirements

### Requirement: D3.js is served from a local file
The system SHALL serve D3.js from `engine/src/crux/d3.v7.min.js`. If the file does not exist at startup, the system SHALL download it once from `https://d3js.org/d3.v7.min.js`. The dashboard HTML SHALL include `<script src="d3.v7.min.js">` so D3 is loaded in serve mode.

#### Scenario: D3 file exists locally
- **WHEN** `d3.v7.min.js` is present in `engine/src/crux/`
- **THEN** the server serves it as a static asset without network access

#### Scenario: D3 file is missing and downloaded
- **WHEN** `d3.v7.min.js` does not exist and the dashboard script starts
- **THEN** the file is downloaded once and then served normally

#### Scenario: D3 is loaded by the browser in serve mode
- **WHEN** the browser loads the dashboard HTML in serve mode
- **THEN** the HTML includes `<script src="d3.v7.min.js">` and the `d3` global is available to dashboard.js

### Requirement: The dashboard has five navigable views with presets and date presets
The dashboard SHALL present five views via tabs, a Presets dropdown with predefined filter configurations, and date preset buttons for quick range selection. Applying a preset SHALL reset all filters to default values before configuring the preset-specific settings.

#### Scenario: Tab navigation switches views
- **WHEN** the user clicks the "Sitios" tab
- **THEN** the sidebar filters persist and the main content area updates

#### Scenario: Preset fully resets filters before applying configuration
- **WHEN** the user selects "Walmart vs Otros" from the Presets dropdown
- **THEN** all filters (sites, pageType, formFactor, queryLevel, dateFrom, dateTo) are reset to defaults, then metric is set to LCP and the Grupos tab is activated

#### Scenario: Preset "Tendencia 6 meses" resets filters and sets date range
- **WHEN** the user selects "Tendencia 6 meses" from the Presets dropdown
- **THEN** all filters are reset to defaults, dateFrom is set to 6 months ago, dateTo is set to today, and the Tendencia tab is activated

#### Scenario: Presets available
- **WHEN** the dashboard loads
- **THEN** the Presets dropdown contains: "Walmart vs Otros", "Top 5 peores checkouts", "Tendencia 6 meses", "Mobile vs Desktop"

#### Scenario: Date preset buttons are displayed in the sidebar
- **WHEN** the dashboard renders the sidebar
- **THEN** date preset buttons "1m", "2m", "4m", "6m", "Todo" are visible below the date range inputs

### Requirement: Global filters control all views with LCP default
The dashboard SHALL provide sidebar filters: group, site (multiselect with search), page type, metric (defaulting to LCP), form factor, query_level, and date range with quick presets. The dashboard SHALL show a loading indicator while fetching data.

#### Scenario: Initial load shows LCP by default
- **WHEN** the dashboard loads for the first time with no URL parameters
- **THEN** the metric filter is set to LCP, the Resumen tab shows LCP data, and scorecards display LCP averages

#### Scenario: Selecting "Todas las métricas" shows all metrics
- **WHEN** the user selects "Todas las métricas" in the metric dropdown
- **THEN** the Resumen tab shows one scorecard per metric (LCP, CLS, INP, FCP, TTFB), and the Grupos/Sitios tabs show LCP with a message to select a specific metric for comparison

#### Scenario: Filter change updates the active view
- **WHEN** the user changes the metric filter from LCP to CLS
- **THEN** the active view re-fetches data (serve) or re-filters (build) and redraws charts

#### Scenario: Site multiselect includes search and select-all
- **WHEN** the dashboard renders the site checkboxes
- **THEN** a search input and "Todos"/"Ninguno" buttons are displayed above the checkbox list

#### Scenario: Site search filters the checkbox list
- **WHEN** the user types "mercado" in the site search input
- **THEN** only sites whose label or origin contains "mercado" are visible in the checkbox list

#### Scenario: Loading indicator shown during data fetch
- **WHEN** the dashboard fetches data from the API
- **THEN** a loading overlay with spinner is displayed over the main content area until the response is received

#### Scenario: Date presets set dateFrom and dateTo
- **WHEN** the user clicks the "4m" date preset button
- **THEN** dateFrom is set to 4 months before today, dateTo is set to today, and the view refreshes

### Requirement: API exposes CrUX data with query_level
All data endpoints SHALL include `query_level` in responses and accept optional `level` parameter (`url`, `origin`, or absent for mixed). The `/api/timeseries` endpoint SHALL return flat rows ordered by collection_end; grouping into series SHALL be performed client-side.

#### Scenario: Compare endpoint includes query_level
- **WHEN** `GET /api/compare?level=url&page=checkout` is called
- **THEN** each result object includes `query_level: "url"`

#### Scenario: Timeseries endpoint returns flat rows for client-side grouping
- **WHEN** `GET /api/timeseries?sites=www.walmart.com.gt&metric=interaction_to_next_paint&ff=PHONE` is called
- **THEN** the response is a flat array of rows ordered by `collection_end`, and the client groups them into series by origin+form_factor before rendering the line chart

### Requirement: Empty, error, and loading states show descriptive messages
The system SHALL display specific messages for missing data, empty filter results, missing database, and API errors. The system SHALL display a loading indicator during data fetches.

#### Scenario: Loading state during data fetch
- **WHEN** the dashboard is fetching data from the API
- **THEN** a loading spinner overlay covers the main content area with a semi-transparent background

#### Scenario: Site without CrUX data
- **WHEN** a site selected in filters has no records in `crux_history`
- **THEN** the dashboard displays "Este sitio no tiene datos disponibles en CrUX. Intentá capturar la información y volvé más tarde."

#### Scenario: No filter matches
- **WHEN** the current filter combination produces zero results
- **THEN** the dashboard displays "No se encontraron resultados para los filtros seleccionados. Probá con otros criterios."

#### Scenario: crux.db does not exist
- **WHEN** the dashboard server starts and `data/crux.db` is not found
- **THEN** the server logs an error and the dashboard displays "Base de datos no encontrada. Ejecutá `npx tsx scripts/crux-sync.ts` para reconstruir la información o contactá al administrador."

### Requirement: D3.js visualizations render with tooltips, thresholds, and drill-down
The dashboard SHALL render bar, line, and scatter charts using D3.js v7 with hover tooltips showing date, p75 value, and good/ni/poor percentages. Charts SHALL include Core Web Vitals threshold lines, accessibility patterns on bars, and click-to-filter drill-down on bars and scatter points. Anomalous values (>20% deviation from group average) SHALL be visually highlighted.

#### Scenario: Line chart hover tooltip
- **WHEN** the user hovers over a data point on a trend line
- **THEN** a tooltip appears showing collection_end date, p75 value, and good/ni/poor %

#### Scenario: Mobile vs desktop comparison in charts
- **WHEN** form factor filter is "Todos" and the Comparativa view is active
- **THEN** bar charts show PHONE and DESKTOP side-by-side; trend lines use solid (PHONE) and dashed (DESKTOP)

#### Scenario: Threshold lines appear on time-series charts
- **WHEN** the trend chart renders for LCP
- **THEN** horizontal dashed lines are drawn at 2500ms (Good threshold) and 4000ms (NI threshold) with labels

#### Scenario: Bar charts use texture patterns for accessibility
- **WHEN** a grouped bar chart renders
- **THEN** Good bars use solid fill, NI bars use diagonal line pattern fill, and Poor bars use grid pattern fill, in addition to their respective colors

#### Scenario: Clicking a bar drills down to that group
- **WHEN** the user clicks a bar in the Grupos tab labeled "walmart_subsidiarias PHONE"
- **THEN** the group filter is set to "walmart_subsidiarias" and the view refreshes

#### Scenario: Anomalous bars have visual border
- **WHEN** a bar represents a site/metric whose good_pct deviates >20% from the group average
- **THEN** the bar has a dashed orange border stroke

### Requirement: Resumen Ejecutivo defaults to LCP and shows trend arrows
The executive summary SHALL default to showing LCP scorecards on initial load. When a metric is selected, it SHALL show PHONE and DESKTOP scorecards with trend arrows (▲/▼) comparing current values to the previous month. When no metric filter is set ("Todas"), it SHALL show all five metrics.

#### Scenario: Initial load shows LCP scorecards with trend arrows
- **WHEN** the dashboard loads for the first time
- **THEN** the executive summary shows PHONE and DESKTOP scorecards for LCP, each with a trend arrow (▲ if worse, ▼ if better, → if stable) comparing to the previous month

#### Scenario: Trend arrow shows improvement
- **WHEN** the current month's LCP good% is more than 5% higher than the previous month's
- **THEN** a green ▼ arrow is displayed next to the good% value

#### Scenario: Trend arrow shows degradation
- **WHEN** the current month's LCP p75 is more than 5% higher (worse) than the previous month's
- **THEN** a red ▲ arrow is displayed next to the p75 value

#### Scenario: Single metric selected
- **WHEN** the metric filter is set to CLS
- **THEN** the executive summary shows PHONE and DESKTOP scorecards for CLS with trend arrows

#### Scenario: No metric filter shows all five metrics
- **WHEN** "Todas las métricas" is selected
- **THEN** the executive summary shows one scorecard per metric (LCP, CLS, INP, FCP, TTFB) with their good% averages

### Requirement: Export buttons include metadata context
CSV and JSON export buttons SHALL be in the top bar, always visible regardless of active view. Exports SHALL use the current filter state and SHALL include metadata describing the export context (date, active filters, source, record count).

#### Scenario: CSV export with metadata
- **WHEN** the user clicks "CSV" in the top bar
- **THEN** a CSV file downloads with comment lines at the top containing export date, active filters, data source, and record count, followed by the data rows with a header row

#### Scenario: JSON export with metadata wrapper
- **WHEN** the user clicks "JSON" in the top bar
- **THEN** a JSON file downloads with a `_metadata` object containing exported_at, filters, source, and record_count, and a `data` array containing the filtered rows

#### Scenario: Export metadata matches current filter state
- **WHEN** the user exports with metric=LCP and group=walmart_propios active
- **THEN** the metadata section includes `metric: "LCP"` and `group: "walmart_propios"`

## ADDED Requirements

### Requirement: Active filter chips with individual removal
The dashboard SHALL display chips in the top bar for each active filter. Each chip SHALL show the filter name and value, with a clickable X to remove that individual filter.

#### Scenario: Active filter chips display and removal
- **WHEN** filters are active (e.g., LCP, PHONE, walmart_propios)
- **THEN** corresponding chips appear in the top bar, and clicking X on any chip clears only that filter and refreshes the view

### Requirement: Filter state is URL-persisted
The dashboard SHALL synchronize filter state and active tab with the browser URL query string using pushState. Loading a URL with params SHALL restore the corresponding state. Browser back/forward SHALL work correctly.

#### Scenario: URL reflects filter state
- **WHEN** the user selects metric=CLS and tab=Sitios
- **THEN** the URL updates to include `metric=cumulative_layout_shift&tab=sitios` without page reload

### Requirement: Data freshness and coverage indicators
The dashboard SHALL display the date of the most recent data in the top bar and a coverage summary in the Resumen tab showing period count, URL vs origin percentage, and sites with data.

#### Scenario: Freshness date displayed
- **WHEN** the dashboard loads
- **THEN** the top bar shows the most recent collection_end date from the database

### Requirement: Reset filters button
The dashboard SHALL provide a "Limpiar filtros" button that resets all filters to their default values (LCP metric, no group, no sites, no pageType, no formFactor, no queryLevel, no date range, Resumen tab) and refreshes the view.

#### Scenario: Reset filters button clears all filters
- **WHEN** the user has multiple filters active and clicks "Limpiar filtros"
- **THEN** all filters are reset to defaults, all chips disappear, the sidebar dropdowns and checkboxes are reset, and the Resumen tab shows LCP data
