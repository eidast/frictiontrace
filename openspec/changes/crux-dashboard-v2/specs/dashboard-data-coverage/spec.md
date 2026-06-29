## ADDED Requirements

### Requirement: Data freshness indicator is displayed
The dashboard SHALL display the date of the most recent data in the top bar (e.g., "Datos al 29 Jun 2026"). This date SHALL be derived from `MAX(collection_end)` in the database (serve mode) or from embedded `dateRange` (build mode).

#### Scenario: Freshness date shown on initial load
- **WHEN** the dashboard loads in serve mode
- **THEN** the top bar displays "Datos al <fecha>" where fecha is the most recent collection_end date from crux_history

#### Scenario: Freshness date updates after data sync
- **WHEN** the user runs crux-sync.ts and refreshes the dashboard
- **THEN** the freshness date reflects the newly synced data

#### Scenario: Freshness date in build mode
- **WHEN** a build-mode dashboard HTML is opened
- **THEN** the freshness date matches the dateRange.max_date embedded in CRUX_DATA

### Requirement: Data coverage summary is available
The dashboard SHALL display a coverage summary in the Resumen tab showing: the number of available periods, percentage of queries with URL-level data vs origin-level data, and count of sites with data.

#### Scenario: Coverage shows URL vs origin breakdown
- **WHEN** the Resumen tab is active and data is loaded
- **THEN** a coverage section displays the percentage of records with query_level='url' vs 'origin'

#### Scenario: Coverage shows period count
- **WHEN** data is loaded
- **THEN** the coverage section displays the total number of distinct collection periods available in the dataset

#### Scenario: Coverage shows site completeness
- **WHEN** data is loaded
- **THEN** the coverage section displays how many sites have at least one data record out of total configured sites (e.g., "17/19 sitios con datos")
