## ADDED Requirements

### Requirement: Bar chart drill-down on click
The dashboard SHALL allow users to click on a bar in the grouped bar chart to set the corresponding filter value. Clicking a bar for "walmart_subsidiarias" SHALL set the group filter to "walmart_subsidiarias" and refresh the view.

#### Scenario: Clicking a group bar sets the group filter
- **WHEN** the user is on the Grupos tab and clicks a bar labeled "walmart_subsidiarias PHONE"
- **THEN** the group filter is set to "walmart_subsidiarias", the sidebar dropdown is updated, active filter chips are updated, and the view refreshes with only that group's data

#### Scenario: Clicking a site bar sets the site filter
- **WHEN** the user is on the Sitios tab and clicks a bar for "mercadolibre.com.ar"
- **THEN** that site is selected in the site checkboxes (replacing previous selections), the view refreshes to show only that site's data, and an active filter chip appears

#### Scenario: Drill-down cursor and tooltip indicate clickability
- **WHEN** the user hovers over a bar in the grouped bar chart
- **THEN** the cursor changes to pointer and a tooltip hint "Click para filtrar" is displayed alongside the existing data tooltip

#### Scenario: Scatter plot drill-down on click
- **WHEN** the user clicks a circle in the scatter plot representing a specific site
- **THEN** that site is selected in the site filter and the view refreshes to show only that site's data

#### Scenario: Clicking the already-active filter value clears it
- **WHEN** the user clicks a bar whose group is already the active group filter
- **THEN** the group filter is cleared (set to "Todos") and the view refreshes showing all groups
