# dashboard-url-state Specification

## Purpose
Shareable dashboard state: the filter configuration is persisted in the URL query string so views can be bookmarked and shared.

## Requirements

### Requirement: Filter state is persisted in the URL query string
The dashboard SHALL synchronize all active filters and the active tab with the browser URL via query parameters. On page load, the dashboard SHALL read query parameters to restore filter state. Browser back/forward navigation SHALL restore the corresponding filter state.

#### Scenario: Changing a filter updates the URL
- **WHEN** the user selects metric=CLS in the sidebar
- **THEN** the URL is updated to include `?metric=cumulative_layout_shift` (or `?metric=CLS`) without a full page reload

#### Scenario: Loading a URL with params restores state
- **WHEN** the user navigates to `/?metric=largest_contentful_paint&tab=grupos&group=walmart_propios`
- **THEN** the metric filter is set to LCP, the active tab is Grupos, the group filter is walmart_propios, and the view renders accordingly

#### Scenario: Browser back button restores previous filter state
- **WHEN** the user applies filter A, then filter B, then presses browser back
- **THEN** the URL reverts to filter A's parameters and the dashboard restores filter A's state and view

#### Scenario: Unknown query params are ignored
- **WHEN** the URL contains query parameters not recognized by the dashboard (e.g., `?utm_source=email`)
- **THEN** those parameters are preserved in the URL but ignored by the dashboard state

#### Scenario: Default values are omitted from URL
- **WHEN** a filter is at its default value (empty string or "Todos")
- **THEN** that parameter is not included in the URL query string

#### Scenario: URL handles multi-site selection efficiently
- **WHEN** 1-3 sites are selected
- **THEN** the URL includes `sites=site1,site2,site3`
- **WHEN** more than 5 sites are selected or all sites are selected
- **THEN** the sites parameter is omitted from the URL (treated as "all")
