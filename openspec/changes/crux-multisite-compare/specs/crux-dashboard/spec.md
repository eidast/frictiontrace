## ADDED Requirements

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

## MODIFIED Requirements

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

#### Scenario: Fractional metric activates Desglose view
- **WHEN** the user selects a fractional metric (LCP resource type, navigation types, or form factors) from the metric filter while on a histogram-only tab (Resumen, Grupos, Sitios, Tendencia)
- **THEN** the dashboard automatically switches to the Desglose tab

#### Scenario: Metric filter groups options by category
- **WHEN** the user opens the metric filter dropdown
- **THEN** options are grouped under "Core Web Vitals", "LCP Diagnostics", and "Other" with optgroup elements or visual separators

#### Scenario: Site multiselect allows cross-group comparison
- **WHEN** the user selects sites from walmart_propios and otros simultaneously
- **THEN** both appear together in comparison charts and the Comparativa grid
