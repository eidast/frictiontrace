## ADDED Requirements

### Requirement: The system serves an interactive dashboard via HTTP
The system SHALL start an HTTP server on `localhost:3000` when invoked with `--serve`, serving static files from `engine/src/crux/` at `GET /` and a REST API at `/api/*`.

#### Scenario: Server starts and serves dashboard
- **WHEN** the user runs `npx tsx scripts/crux-dashboard.ts --serve`
- **THEN** an HTTP server starts on port 3000, `GET /` returns `dashboard.html`, and static assets (CSS, JS, D3) are served

#### Scenario: Server fails gracefully when port is occupied
- **WHEN** port 3000 is already in use
- **THEN** the server logs the error and exits with a non-zero code

### Requirement: The system generates a self-contained HTML report
The system SHALL generate `reports/crux-dashboard.html` when invoked with `--build`, embedding all available CrUX data as inline JSON.

#### Scenario: Build mode generates portable HTML
- **WHEN** the user runs `npx tsx scripts/crux-dashboard.ts --build`
- **THEN** `reports/crux-dashboard.html` is created with CSS and JS inlined, D3 inlined, and all crux_history data embedded in `<script>`

#### Scenario: Build mode HTML works offline
- **WHEN** `reports/crux-dashboard.html` is opened in a browser without the server running
- **THEN** the dashboard renders with filters and charts using embedded data

### Requirement: D3.js is served from a local file
The system SHALL serve D3.js from `engine/src/crux/d3.v7.min.js`. If the file does not exist at startup, the system SHALL download it once from `https://d3js.org/d3.v7.min.js`.

#### Scenario: D3 file exists locally
- **WHEN** `d3.v7.min.js` is present in `engine/src/crux/`
- **THEN** the server serves it as a static asset without network access

#### Scenario: D3 file is missing and downloaded
- **WHEN** `d3.v7.min.js` does not exist and the dashboard script starts
- **THEN** the file is downloaded once and then served normally

### Requirement: The dashboard has five navigable views with presets
The dashboard SHALL present five views via tabs and a Presets dropdown with predefined filter configurations.

#### Scenario: Tab navigation switches views
- **WHEN** the user clicks the "Comparativa por Sitio" tab
- **THEN** the sidebar filters persist and the main content area updates

#### Scenario: Preset configures filters
- **WHEN** the user selects "Top 5 peores checkouts" from the Presets dropdown
- **THEN** the filters are set to page_type=checkout, metric=LCP, ff=PHONE, and the Comparativa view shows top 5 worst

#### Scenario: Presets available
- **WHEN** the dashboard loads
- **THEN** the Presets dropdown contains: "Walmart vs Otros", "Top 5 peores checkouts", "Tendencia 6 meses", "Mobile vs Desktop"

### Requirement: Global filters control all views
The dashboard SHALL provide sidebar filters: group, site (multiselect), page type, metric, form factor, query_level, and date range.

#### Scenario: Filter change updates the active view
- **WHEN** the user changes the metric filter from LCP to CLS
- **THEN** the active view re-fetches data (serve) or re-filters (build) and redraws charts

#### Scenario: query_level filter distinguishes URL from origin data
- **WHEN** the user selects query_level="URL" and a checkout page type
- **THEN** only records with query_level='url' are shown, and each data point displays a `[U]` label

#### Scenario: Site multiselect allows cross-group comparison
- **WHEN** the user selects sites from walmart_propios and otros simultaneously
- **THEN** both appear together in comparison charts

### Requirement: API exposes CrUX data with query_level
All data endpoints SHALL include `query_level` in responses and accept optional `level` parameter (`url`, `origin`, or absent for mixed).

#### Scenario: Compare endpoint includes query_level
- **WHEN** `GET /api/compare?level=url&page=checkout` is called
- **THEN** each result object includes `query_level: "url"`

#### Scenario: Timeseries endpoint returns historical data
- **WHEN** `GET /api/timeseries?sites=www.walmart.com.gt&metric=interaction_to_next_paint&ff=PHONE` is called
- **THEN** the response is ordered by `collection_end` and includes `query_level` per row

### Requirement: CLS values are normalized for charting
The frontend SHALL convert CLS `p75_value` strings to numbers via `parseFloat()` and use a [0, 1] scale for CLS charts, distinct from millisecond scales used by other metrics.

#### Scenario: CLS chart uses correct scale
- **WHEN** the metric filter is set to CLS and a bar chart renders
- **THEN** the y-axis domain is [0, 1] and the p75 values are parsed from strings like "0.15"

### Requirement: Empty and error states show descriptive messages
The system SHALL display specific messages for missing data, empty filter results, missing database, and API errors.

#### Scenario: Site without CrUX data
- **WHEN** a site selected in filters has no records in `crux_history`
- **THEN** the dashboard displays "Este sitio no tiene datos disponibles en CrUX. Intentá capturar la información y volvé más tarde."

#### Scenario: No filter matches
- **WHEN** the current filter combination produces zero results
- **THEN** the dashboard displays "No se encontraron resultados para los filtros seleccionados. Probá con otros criterios."

#### Scenario: crux.db does not exist
- **WHEN** the dashboard server starts and `data/crux.db` is not found
- **THEN** the server logs an error and the dashboard displays "Base de datos no encontrada. Ejecutá `npx tsx scripts/crux-sync.ts` para reconstruir la información o contactá al administrador."

### Requirement: Export buttons are globally accessible
CSV and JSON export buttons SHALL be in the top bar, always visible regardless of active view. Exports SHALL use the current filter state.

#### Scenario: CSV export from any view
- **WHEN** the user clicks "CSV" in the top bar while on the Resumen Ejecutivo view
- **THEN** a CSV file downloads with data matching the current filter settings, filename includes date

#### Scenario: JSON export downloads filtered data
- **WHEN** the user clicks "JSON" in the top bar
- **THEN** a JSON file downloads with the filtered data as an array of objects

### Requirement: D3.js visualizations render with tooltips
The dashboard SHALL render bar, line, and scatter charts using D3.js v7 with hover tooltips showing date, p75 value, and good/ni/poor percentages.

#### Scenario: Line chart hover tooltip
- **WHEN** the user hovers over a data point on a trend line
- **THEN** a tooltip appears showing collection_end date, p75 value, and good/ni/poor %

#### Scenario: Mobile vs desktop comparison in charts
- **WHEN** form factor filter is "Todos" and the Comparativa view is active
- **THEN** bar charts show PHONE and DESKTOP side-by-side; trend lines use solid (PHONE) and dashed (DESKTOP)

### Requirement: Resumen Ejecutivo adapts to metric filter
The executive summary SHALL show scorecards for the currently selected metric. When no metric filter is set, it SHALL show all five metrics.

#### Scenario: Single metric selected
- **WHEN** the metric filter is set to LCP
- **THEN** the executive summary shows 3 scorecards: LCP good%, LCP needs-improvement%, LCP poor% for the selected group

#### Scenario: No metric filter
- **WHEN** no specific metric is selected
- **THEN** the executive summary shows one scorecard per metric (LCP, CLS, INP, FCP, TTFB) with their good% averages
