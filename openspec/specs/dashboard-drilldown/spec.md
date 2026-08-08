# dashboard-drilldown Specification

## Purpose
Click-through exploration: clicking chart elements (bars, scatter points) sets the corresponding filter to drill into a group or site.

## Requirements

### Requirement: Bar chart drill-down on click
The dashboard SHALL allow users to click on clickable chart marks to set the corresponding filter value. Clicking a bar in the `Grupos` tab SHALL set the group filter. Clicking a bar in the `Sitios` tab SHALL set the site filter for that specific site, replacing previous site selections and clearing any active group filter.

#### Scenario: Clicking a group bar sets the group filter
- **WHEN** the user is on the Grupos tab and clicks a bar labeled "walmart_subsidiarias PHONE"
- **THEN** the group filter is set to "walmart_subsidiarias", the sidebar dropdown is updated, active filter chips are updated, and the view refreshes with only that group's data

#### Scenario: Clicking a site bar sets the site filter
- **WHEN** the user is on the Sitios tab and clicks a bar for "mercadolibre.com.ar"
- **THEN** that site is selected in the site checkboxes replacing previous selections, the group filter is cleared, the view refreshes to show only that site's data, and an active site filter chip appears

#### Scenario: Drill-down cursor and tooltip indicate group clickability
- **WHEN** the user hovers over a clickable bar in the Grupos tab
- **THEN** the cursor changes to pointer and a tooltip hint "Click para filtrar este grupo" is displayed alongside the existing data tooltip

#### Scenario: Drill-down cursor and tooltip indicate site clickability
- **WHEN** the user hovers over a clickable bar in the Sitios tab
- **THEN** the cursor changes to pointer and a tooltip hint "Click para ver solo este sitio" is displayed alongside the existing data tooltip

#### Scenario: Scatter plot drill-down on click
- **WHEN** the user clicks a circle in the scatter plot representing a specific site
- **THEN** that site is selected in the site filter, previous site selections are replaced, the group filter is cleared, and the view refreshes to show only that site's data

#### Scenario: Clicking the already-active group filter value clears it
- **WHEN** the user clicks a group bar whose group is already the active group filter
- **THEN** the group filter is cleared (set to "Todos") and the view refreshes showing all groups

#### Scenario: Clicking the already-active site filter value clears it
- **WHEN** the user clicks a site bar or scatter point whose site is already the only active site filter
- **THEN** the site filter is cleared and the view refreshes showing the broader current scope
