## ADDED Requirements

### Requirement: Anomalies are visually highlighted in charts and tables
The dashboard SHALL detect metric values that deviate more than 20% from the group average and highlight them with a visual indicator (orange/red border or icon). Anomaly detection SHALL run client-side on filtered data.

#### Scenario: Anomalous good_pct is highlighted in the data table
- **WHEN** a site's good_pct for a given metric is more than 20% below the group average for the same metric and form factor
- **THEN** the row in the Datos table displays a warning icon (⚠) and the good_pct cell has an orange border

#### Scenario: Normal values are not highlighted
- **WHEN** a site's good_pct for a given metric is within 20% of the group average
- **THEN** the row in the Datos table shows no warning icon and no special border

#### Scenario: Anomalies are shown in chart tooltips
- **WHEN** the user hovers over a data point with anomalous values in the bar chart or scatter plot
- **THEN** the tooltip includes a warning indicator and the deviation percentage from the group average

#### Scenario: Anomalies are shown in bar chart borders
- **WHEN** a bar in the grouped bar chart represents a group/site with anomalous good_pct
- **THEN** the bar has a dashed orange border stroke indicating the anomaly

#### Scenario: Anomaly detection handles missing data gracefully
- **WHEN** the group average cannot be calculated (insufficient data points for the group/metric/FF combination)
- **THEN** no anomaly highlighting is applied to those rows
