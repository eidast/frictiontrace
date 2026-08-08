# dashboard-date-presets Specification

## Purpose
Quick date-range selection via presets (e.g. last 4/12/26 weeks) that configure the dashboard's date filters in one action.

## Requirements

### Requirement: Date presets provide quick range selection
The dashboard SHALL display preset buttons in the sidebar date section for common time ranges: "1m", "2m", "4m", "6m", and "Todo". Clicking a preset SHALL set `dateFrom` to N months ago and `dateTo` to today's date, update the date input fields, and trigger `applyFilters()`.

#### Scenario: Selecting the 1-month preset
- **WHEN** the user clicks the "1m" date preset button
- **THEN** `dateFrom` is set to 1 month before today, `dateTo` is set to today, the date input fields reflect these values, and the active view re-fetches or re-filters data

#### Scenario: Selecting the 4-month preset
- **WHEN** the user clicks the "4m" date preset button
- **THEN** `dateFrom` is set to 4 months before today, `dateTo` is set to today, and data is filtered accordingly

#### Scenario: Clearing date range with "Todo"
- **WHEN** the user clicks the "Todo" date preset button
- **THEN** both `dateFrom` and `dateTo` are cleared, the date input fields are emptied, and all data is shown without date filtering

#### Scenario: Date preset updates active filters display
- **WHEN** a date preset is applied
- **THEN** active filter chips are updated to show the selected date range (e.g., "Último mes" or "Jun 2026")

#### Scenario: Preset buttons are visually distinct from active/inactive
- **WHEN** the dashboard renders the date presets
- **THEN** the button corresponding to the currently active range is visually highlighted, and all preset buttons use cursor pointer styling
