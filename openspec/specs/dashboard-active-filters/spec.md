## ADDED Requirements

### Requirement: Active filter chips are displayed in the top bar
The dashboard SHALL display chips (pills) in the top bar summarizing all currently active filters. Each chip SHALL include a label describing the filter value and a clickable "X" button to remove that filter.

#### Scenario: Chips appear when filters are active
- **WHEN** the user selects metric=LCP, formFactor=PHONE, and group=walmart_propios
- **THEN** three chips appear in the top bar: "LCP ✕", "PHONE ✕", "walmart_propios ✕"

#### Scenario: Clicking chip X removes the filter
- **WHEN** the user clicks the "✕" on the "PHONE" chip
- **THEN** the formFactor filter is reset to "Todos", the chip is removed, the sidebar dropdown is updated, and the view refreshes

#### Scenario: No chips when no filters are active
- **WHEN** all filters are at their default values (no group, no sites, no pageType, LCP metric, no formFactor, no queryLevel, no date range)
- **THEN** no active filter chips are displayed in the top bar

#### Scenario: Sites chip shows count when multiple sites selected
- **WHEN** the user selects 5 or more sites
- **THEN** the sites chip displays "5 sitios" instead of listing all names, with the X button removing all site filters

#### Scenario: Date range chip shows human-readable range
- **WHEN** dateFrom="2026-05-01" and dateTo="2026-06-29"
- **THEN** the date chip displays "May 1 – Jun 29" with an X button to clear the date range
