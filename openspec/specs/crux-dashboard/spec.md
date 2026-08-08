# crux-dashboard Specification

## Purpose
Interactive CrUX dashboard (HTTP server and self-contained HTML build) for exploring p75 web vitals across sites, page types, and form factors, with global filters, multiple views, and D3.js visualizations.
## Requirements
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
The dashboard SHALL present seven views via tabs: Resumen, Grupos, Sitios, Tendencia, Comparativa, Desglose, Datos. The sidebar SHALL provide a Presets dropdown with predefined filter configurations.

#### Scenario: Tab navigation switches views
- **WHEN** the user clicks any tab
- **THEN** the sidebar filters persist and the main content area updates to the selected view

#### Scenario: Preset configures filters
- **WHEN** the user selects "Top 5 peores checkouts" from the Presets dropdown
- **THEN** the filters are set to page_type=checkout, metric=LCP, ff=PHONE, and the Sitios view shows top 5 worst

#### Scenario: Presets available
- **WHEN** the dashboard loads
- **THEN** the Presets dropdown contains: "Walmart vs Otros", "Top 5 peores checkouts", "Tendencia 6 meses", "Mobile vs Desktop", "Comparar todos (resumen)"

#### Scenario: Comparativa tab requires 2+ sites
- **WHEN** the user navigates to the Comparativa tab with fewer than 2 sites selected
- **THEN** the dashboard displays: "Seleccioná al menos 2 sitios en el panel lateral para comparar"

### Requirement: Global filters control all views
The dashboard SHALL provide sidebar filters: group, site (multiselect), page type, metric (13 options grouped by category), form factor, query_level, and date range.

#### Scenario: Filter change updates the active view
- **WHEN** the user changes the metric filter from LCP to CLS
- **THEN** the active view re-fetches data (serve) or re-filters (build) and redraws charts

#### Scenario: query_level filter distinguishes URL from origin data
- **WHEN** the user selects query_level="URL" and a checkout page type
- **THEN** only records with query_level='url' are shown, and each data point displays a `[U]` label

#### Scenario: Fractional metric activates Desglose view
- **WHEN** the user selects a fractional metric (LCP resource type, navigation types, or form factors) from the metric filter while on a histogram-only tab (Resumen, Grupos, Sitios, Tendencia)
- **THEN** the dashboard automatically switches to the Desglose tab

#### Scenario: Metric filter groups options by category
- **WHEN** the user opens the metric filter dropdown
- **THEN** options are grouped under "Core Web Vitals", "LCP Diagnostics", and "Other" with optgroup elements or visual separators

#### Scenario: Site multiselect allows cross-group comparison
- **WHEN** the user selects sites from walmart_propios and otros simultaneously
- **THEN** both appear together in comparison charts and the Comparativa grid

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

### Requirement: The API exposes fractional metric data
All data endpoints SHALL include `query_level` in responses. The system SHALL additionally provide `/api/fractions` for fractional metrics and `/api/compare-grid` for multi-site comparison data.

#### Scenario: Fractions endpoint returns categorized data
- **WHEN** `GET /api/fractions?metric=largest_contentful_paint_resource_type&ff=PHONE` is called
- **THEN** the response is an array of objects with `label`, `origin`, `metric_name`, `category`, `fraction_value`, `collection_end`

#### Scenario: Compare-grid endpoint returns pivoted data
- **WHEN** `GET /api/compare-grid?sites=www.walmart.com.gt,www.exito.com` is called
- **THEN** the response includes per-site values for all metrics in the most recent collection period

### Requirement: Dashboard has seven navigable views with presets
The dashboard SHALL present seven views via tabs: Resumen, Grupos, Sitios, Tendencia, Comparativa, Desglose, Datos. The Presets dropdown SHALL include predefined filter configurations updated for the new views.

#### Scenario: Comparativa tab visible in navigation
- **WHEN** the dashboard loads
- **THEN** the tab bar includes "Comparativa" and "Desglose" tabs alongside the existing five tabs

#### Scenario: Comparativa tab shows grid when sites are selected
- **WHEN** the user selects 3 sites and clicks the "Comparativa" tab
- **THEN** a side-by-side comparison grid renders with sites as columns and metrics as rows

#### Scenario: Desglose tab shows fractional metric charts
- **WHEN** the user clicks the "Desglose" tab
- **THEN** D3.js stacked bar charts render for LCP resource types and navigation types for the currently selected sites

### Requirement: Metric filter includes all 13 available metrics
The metric filter selector SHALL list all 13 metrics grouped by category: Core Web Vitals (LCP, CLS, INP, FCP, TTFB), LCP Diagnostics (resource type, image TTFB, load delay, load duration, render delay), and Other (RTT, navigation types, form factors).

#### Scenario: Metric dropdown shows 13 options
- **WHEN** the dashboard loads
- **THEN** the metric filter dropdown contains 13 options grouped by category, with the 5 existing options listed first

#### Scenario: Selecting a fractional metric updates views
- **WHEN** the user selects `largest_contentful_paint_resource_type` from the metric filter
- **THEN** the Desglose tab automatically activates and shows the resource type stacked bar chart

### Requirement: D3.js visualizations include stacked bar charts for fractional metrics
The dashboard SHALL render stacked bar charts for fractional metrics (LCP resource types, navigation types, form factors) using D3.js v7 with hover tooltips showing category labels and percentages.

#### Scenario: Stacked bar chart for LCP resource types
- **WHEN** the Desglose tab is active and metric is set to `largest_contentful_paint_resource_type`
- **THEN** a stacked bar chart renders with segments for "text", "image", and "video" per selected site

#### Scenario: Stacked bar chart hover tooltip
- **WHEN** the user hovers over a segment in a stacked bar chart
- **THEN** a tooltip shows the category name and exact percentage

### Requirement: Exports include all metric types
CSV and JSON exports SHALL include data from both `crux_history` (histogram metrics) and `crux_fractions` (fractional metrics) for the active filter state.

#### Scenario: CSV export with fractional metric active
- **WHEN** the user exports CSV while a fractional metric filter is active
- **THEN** the CSV includes rows with `category` and `fraction_value` columns

#### Scenario: JSON export with all data
- **WHEN** the user exports JSON with "Todas las métricas" selected
- **THEN** the JSON contains both `data` (histogram records) and `fractions` (fractional records) arrays

### Requirement: Resumen Ejecutivo adapts to all 13 metrics
The executive summary SHALL show scorecards for the currently selected metric. For the 5 Core Web Vitals, it SHALL show the existing 3 scorecards per form factor. For LCP image subpart metrics and RTT, it SHALL show a single p75 scorecard per form factor. For fractional metrics, it SHALL show the most recent category distribution.

#### Scenario: LCP subpart metric selected
- **WHEN** the metric filter is set to `largest_contentful_paint_image_time_to_first_byte`
- **THEN** the executive summary shows 2 scorecards (PHONE, DESKTOP) with the p75 value for that subpart

#### Scenario: Fractional metric selected
- **WHEN** the metric filter is set to `largest_contentful_paint_resource_type`
- **THEN** the Resumen tab displays a stacked bar or donut chart showing the most recent category distribution across selected sites

### Requirement: Dashboard explanatory UI works in serve and build modes
The dashboard SHALL render metric explanations, chart subtitles, scope summaries, and improved site selector UI consistently in HTTP serve mode and self-contained build mode.

#### Scenario: Serve mode renders explanatory UI
- **WHEN** the user runs the dashboard in serve mode and opens the dashboard
- **THEN** metric explanations, chart subtitles, current-scope summaries, and the improved site selector are available while data is fetched from `/api/*`

#### Scenario: Build mode renders explanatory UI
- **WHEN** the user opens the self-contained built dashboard HTML without the server running
- **THEN** metric explanations, chart subtitles, current-scope summaries, and the improved site selector are available while data is read from embedded `CRUX_DATA`

### Requirement: Sidebar styling matches dashboard markup
The dashboard stylesheet SHALL style the classes and IDs used by the sidebar markup, including sidebar sections and the site checkbox group.

#### Scenario: Sidebar sections have consistent spacing
- **WHEN** the dashboard sidebar renders
- **THEN** each `.sidebar-section` has consistent vertical spacing from adjacent sections

#### Scenario: Site checkbox group receives container styles
- **WHEN** the `#site-checkboxes` element renders with class `checkbox-group`
- **THEN** it receives the intended scrollable container styling, including border, background, padding, radius, and scrollbar styling

